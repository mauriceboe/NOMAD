import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { getBackend } from '../storage/factory';
import { StoragePurpose } from '../storage/types';

const router = express.Router();

router.get('/:purpose/:key', authenticate, async (req: Request, res: Response) => {
  const { purpose, key } = req.params;

  const validPurposes = [StoragePurpose.PHOTOS, StoragePurpose.FILES, StoragePurpose.COVERS];
  if (!validPurposes.includes(purpose as StoragePurpose)) {
    return res.status(400).json({ error: 'Invalid purpose' });
  }

  try {
    const backend = getBackend(purpose as StoragePurpose);
    const result = await backend.download(key);

    if (result.type === 'redirect') {
      return res.redirect(302, result.url);
    }

    result.stream.pipe(res);
  } catch (err: unknown) {
    console.error('File proxy error:', err);
    res.status(404).json({ error: 'File not found' });
  }
});

export default router;
