import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'

const THUMB_MAX = 800
const THUMB_QUALITY = 80

export async function ensureLocalThumbnail(
  uploadsRoot: string,
  originalRelPath: string,
): Promise<{ thumbnailRelPath: string; width: number; height: number } | null> {
  const originalAbs = path.join(uploadsRoot, originalRelPath)
  try { await fs.access(originalAbs) } catch { return null }

  // Deterministic name so concurrent requests don't race on the same photo.
  const hash = crypto.createHash('sha1').update(originalRelPath).digest('hex').slice(0, 16)
  const thumbRel = `journey/thumbs/${hash}.webp`
  const thumbAbs = path.join(uploadsRoot, thumbRel)

  try {
    const [srcStat, dstStat] = await Promise.all([
      fs.stat(originalAbs),
      fs.stat(thumbAbs).catch(() => null),
    ])
    if (dstStat && dstStat.mtimeMs >= srcStat.mtimeMs) {
      const meta = await sharp(thumbAbs).metadata()
      return { thumbnailRelPath: thumbRel, width: meta.width ?? 0, height: meta.height ?? 0 }
    }
  } catch { /* regenerate */ }

  await fs.mkdir(path.dirname(thumbAbs), { recursive: true })
  await sharp(originalAbs)
    .rotate()
    .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toFile(thumbAbs)
  const meta = await sharp(thumbAbs).metadata()
  return { thumbnailRelPath: thumbRel, width: meta.width ?? 0, height: meta.height ?? 0 }
}
