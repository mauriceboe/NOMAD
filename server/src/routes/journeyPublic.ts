import express, { Request, Response } from 'express';
import { getPublicJourney, validateShareTokenForAsset } from '../services/journeyShareService';
import { streamImmichAsset } from '../services/memories/immichService';
import path from 'node:path';
import fs from 'node:fs';

const router = express.Router();

router.get('/:token', (req: Request, res: Response) => {
  const data = getPublicJourney(req.params.token);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// Public photo proxy — validates share token instead of auth
router.get('/:token/photo/:provider/:assetId/:ownerId/:kind', async (req: Request, res: Response) => {
  const { token, provider, assetId, ownerId, kind } = req.params;

  // Validate token and that this asset belongs to the shared journey
  const valid = validateShareTokenForAsset(token, assetId);
  if (!valid) return res.status(404).json({ error: 'Not found' });

  if (provider === 'local') {
    // Local file — assetId is the file_path
    const filePath = path.join(__dirname, '../../uploads/journey', assetId);
    const resolved = path.resolve(filePath);
    const uploadsDir = path.resolve(__dirname, '../../uploads');
    if (!resolved.startsWith(uploadsDir) || !fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.set('Cache-Control', 'public, max-age=86400');
    return res.sendFile(resolved);
  }

  // Immich/Synology — proxy through
  const effectiveOwnerId = valid.ownerId || Number(ownerId);
  if (provider === 'immich') {
    await streamImmichAsset(res, effectiveOwnerId, assetId, kind === 'thumbnail' ? 'thumbnail' : 'original', effectiveOwnerId);
  } else {
    // Synology or other providers — try dynamic import
    try {
      const { streamSynologyAsset } = await import('../services/memories/synologyService');
      await streamSynologyAsset(res, effectiveOwnerId, effectiveOwnerId, assetId, kind === 'thumbnail' ? 'thumbnail' : 'original');
    } catch {
      res.status(404).json({ error: 'Provider not supported' });
    }
  }
});

export default router;
