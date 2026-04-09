import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { getPendingNotices, dismissNotice } from '../services/noticesService';

const router = Router();

router.get('/', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  res.json(getPendingNotices(authReq.user.id));
});

router.post('/:id/dismiss', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const ok = dismissNotice(authReq.user.id, req.params.id);
  res.json({ success: ok });
});

export default router;
