import express, { Request, Response } from 'express';
import { getPublicJourney, validateShareTokenForAsset, validateShareTokenForPhoto } from '../services/journeyShareService';
import { streamPhoto } from '../services/memories/photoResolverService';
import { streamImmichAsset } from '../services/memories/immichService';
import { db } from '../db/database';
import path from 'node:path';
import fs from 'node:fs';
import { AssetSize } from '../services/memories/helpersService';

const router = express.Router();

router.get('/:token', (req: Request, res: Response) => {
  const data = getPublicJourney(req.params.token);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// Unified public photo proxy — uses trek_photo_id
router.get('/:token/photos/:photoId/:kind', async (req: Request, res: Response) => {
  const { token, photoId, kind } = req.params;
  const valid = validateShareTokenForPhoto(token, Number(photoId));
  if (!valid) return res.status(404).json({ error: 'Not found' });

  await streamPhoto(res, valid.ownerId, Number(photoId), kind === 'thumbnail' ? 'thumbnail' : 'original');
});

// Legacy public photo proxy — validates share token instead of auth
router.get('/:token/photo/:provider/:assetId/:ownerId/:kind', async (req: Request, res: Response) => {
  const { token, provider, assetId, ownerId, kind } = req.params;

  const valid = validateShareTokenForAsset(token, assetId);
  if (!valid) return res.status(404).json({ error: 'Not found' });

  if (provider === 'local') {
    const filePath = path.join(__dirname, '../../uploads/journey', assetId);
    const resolved = path.resolve(filePath);
    const uploadsDir = path.resolve(__dirname, '../../uploads');
    if (!resolved.startsWith(uploadsDir) || !fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.set('Cache-Control', 'public, max-age=86400');
    return res.sendFile(resolved);
  }

  const effectiveOwnerId = valid.ownerId || Number(ownerId);
  if (provider === 'immich') {
    await streamImmichAsset(res, effectiveOwnerId, assetId, kind === 'thumbnail' ? 'thumbnail' : 'original', effectiveOwnerId);
  } else {
    try {
      const { streamSynologyAsset } = await import('../services/memories/synologyService');
      const stored = db.prepare(
        'SELECT cache_key, passphrase FROM trek_photos WHERE provider = ? AND (asset_id = ? OR cache_key = ?) AND owner_id = ? LIMIT 1'
      ).get('synologyphotos', assetId, assetId, effectiveOwnerId) as { cache_key?: string | null; passphrase?: string | null } | undefined;
      await streamSynologyAsset(res, effectiveOwnerId, assetId, stored?.cache_key, kind as AssetSize, stored?.passphrase || undefined);
    } catch {
      res.status(404).json({ error: 'Provider not supported' });
    }
  }
});

export default router;
