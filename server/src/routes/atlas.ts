import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import {
  getStats,
  getCountryPlaces,
  markCountryVisited,
  unmarkCountryVisited,
  listBucketList,
  createBucketItem,
  updateBucketItem,
  deleteBucketItem,
} from '../services/atlasService';

const router = express.Router();
router.use(authenticate);

router.get('/stats', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const data = await getStats(userId);
  res.json(data);
});

router.get('/country/:code', (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const code = req.params.code.toUpperCase();
  res.json(getCountryPlaces(userId, code));
});

router.post('/country/:code/mark', (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  markCountryVisited(userId, req.params.code.toUpperCase());
  res.json({ success: true });
});

router.delete('/country/:code/mark', (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  unmarkCountryVisited(userId, req.params.code.toUpperCase());
  res.json({ success: true });
});

// ── Bucket List ─────────────────────────────────────────────────────────────

router.get('/bucket-list', (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  res.json({ items: listBucketList(userId) });
});

router.post('/bucket-list', (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const { name, lat, lng, country_code, notes, target_date } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const item = createBucketItem(userId, { name, lat, lng, country_code, notes, target_date });
  res.status(201).json({ item });
});

router.put('/bucket-list/:id', (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const { name, notes, lat, lng, country_code, target_date } = req.body;
  const item = updateBucketItem(userId, req.params.id, { name, notes, lat, lng, country_code, target_date });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json({ item });
});

router.delete('/bucket-list/:id', (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const deleted = deleteBucketItem(userId, req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Item not found' });
  res.json({ success: true });
});

export default router;
