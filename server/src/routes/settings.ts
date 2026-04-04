import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import * as settingsService from '../services/settingsService';

const router = express.Router();

router.get('/', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  res.json({ settings: settingsService.getUserSettings(authReq.user.id) });
});

router.put('/', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Key is required' });
  settingsService.upsertSetting(authReq.user.id, key, value);
  res.json({ success: true, key, value });
});

router.post('/bulk', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object')
    return res.status(400).json({ error: 'Settings object is required' });
  try {
    const updated = settingsService.bulkUpsertSettings(authReq.user.id, settings);
    res.json({ success: true, updated });
  } catch (err) {
    console.error('Error saving settings:', err);
    res.status(500).json({ error: 'Error saving settings' });
  }
});

export default router;
