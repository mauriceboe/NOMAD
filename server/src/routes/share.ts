import express, { Request, Response } from 'express';
import { canAccessTrip } from '../db/database';
import { authenticate } from '../middleware/auth';
import { checkPermission } from '../services/permissions';
import { AuthRequest } from '../types';
import * as shareService from '../services/shareService';

const router = express.Router();

// Create a share link for a trip (owner/member only)
router.post('/trips/:tripId/share-link', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId } = req.params;
  const access = canAccessTrip(tripId, authReq.user.id);
  if (!access) return res.status(404).json({ error: 'Trip not found' });
  if (!checkPermission('share_manage', authReq.user.role, access.user_id, authReq.user.id, access.user_id !== authReq.user.id))
    return res.status(403).json({ error: 'No permission' });

  const { share_map, share_bookings, share_packing, share_budget, share_collab } = req.body || {};
  const result = shareService.createOrUpdateShareLink(tripId, authReq.user.id, {
    share_map, share_bookings, share_packing, share_budget, share_collab,
  });

  if (result.created) {
    return res.status(201).json({ token: result.token });
  }
  return res.json({ token: result.token });
});

// Get share link status
router.get('/trips/:tripId/share-link', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId } = req.params;
  if (!canAccessTrip(tripId, authReq.user.id)) return res.status(404).json({ error: 'Trip not found' });

  const info = shareService.getShareLink(tripId);
  res.json(info ? info : { token: null });
});

// Delete share link
router.delete('/trips/:tripId/share-link', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId } = req.params;
  const access = canAccessTrip(tripId, authReq.user.id);
  if (!access) return res.status(404).json({ error: 'Trip not found' });
  if (!checkPermission('share_manage', authReq.user.role, access.user_id, authReq.user.id, access.user_id !== authReq.user.id))
    return res.status(403).json({ error: 'No permission' });

  shareService.deleteShareLink(tripId);
  res.json({ success: true });
});

// Public read-only trip data (no auth required)
router.get('/shared/:token', (req: Request, res: Response) => {
  const { token } = req.params;
  const data = shareService.getSharedTripData(token);
  if (!data) return res.status(404).json({ error: 'Invalid or expired link' });
  res.json(data);
});

// Public calendar subscription payload (no auth required)
router.get('/shared/:token/calendar.ics', (req: Request, res: Response) => {
  const { token } = req.params;
  const exported = shareService.getSharedTripICS(token);
  if (!exported) return res.status(404).json({ error: 'Invalid or expired link' });

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  // Inline lets calendar clients subscribe/fetch from URL instead of forced download.
  res.setHeader('Content-Disposition', `inline; filename="${exported.filename}"`);
  res.send(exported.ics);
});

export default router;
