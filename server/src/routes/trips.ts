import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getBackend } from '../storage/factory';
import { StoragePurpose } from '../storage/types';
import { canAccessTrip } from '../db/database';
import { authenticate, demoUploadBlock } from '../middleware/auth';
import { broadcast } from '../websocket';
import { AuthRequest } from '../types';
import { writeAudit, getClientIp, logInfo } from '../services/auditLog';
import { checkPermission } from '../services/permissions';
import {
  listTrips,
  createTrip,
  getTrip,
  updateTrip,
  deleteTrip,
  getTripRaw,
  getTripOwner,
  updateCoverImage,
  listMembers,
  addMember,
  removeMember,
  exportICS,
  verifyTripAccess,
  NotFoundError,
  ValidationError,
} from '../services/tripService';

const router = express.Router();

const MAX_COVER_SIZE = 20 * 1024 * 1024; // 20 MB

const tmpDir = path.join(__dirname, '../../data/tmp');
const coverStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    cb(null, tmpDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const uploadCover = multer({
  storage: coverStorage,
  limits: { fileSize: MAX_COVER_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (file.mimetype.startsWith('image/') && !file.mimetype.includes('svg') && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, png, gif, webp images allowed'));
    }
  },
});

// ── List trips ────────────────────────────────────────────────────────────

router.get('/', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const archived = req.query.archived === '1' ? 1 : 0;
  const trips = listTrips(authReq.user.id, archived);
  res.json({ trips });
});

// ── Create trip ───────────────────────────────────────────────────────────

router.post('/', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!checkPermission('trip_create', authReq.user.role, null, authReq.user.id, false))
    return res.status(403).json({ error: 'No permission to create trips' });

  const { title, description, start_date, end_date, currency, reminder_days } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  if (start_date && end_date && new Date(end_date) < new Date(start_date))
    return res.status(400).json({ error: 'End date must be after start date' });

  const { trip, tripId, reminderDays } = createTrip(authReq.user.id, { title, description, start_date, end_date, currency, reminder_days });

  writeAudit({ userId: authReq.user.id, action: 'trip.create', ip: getClientIp(req), details: { tripId, title, reminder_days: reminderDays === 0 ? 'none' : `${reminderDays} days` } });
  if (reminderDays > 0) {
    logInfo(`${authReq.user.email} set ${reminderDays}-day reminder for trip "${title}"`);
  }

  res.status(201).json({ trip });
});

// ── Get trip ──────────────────────────────────────────────────────────────

router.get('/:id', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const trip = getTrip(req.params.id, authReq.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  res.json({ trip });
});

// ── Update trip ───────────────────────────────────────────────────────────

router.put('/:id', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const access = canAccessTrip(req.params.id, authReq.user.id);
  if (!access) return res.status(404).json({ error: 'Trip not found' });

  const tripOwnerId = access.user_id;
  const isMember = access.user_id !== authReq.user.id;

  // Archive check
  if (req.body.is_archived !== undefined) {
    if (!checkPermission('trip_archive', authReq.user.role, tripOwnerId, authReq.user.id, isMember))
      return res.status(403).json({ error: 'No permission to archive/unarchive this trip' });
  }
  // Cover image check
  if (req.body.cover_image !== undefined) {
    if (!checkPermission('trip_cover_upload', authReq.user.role, tripOwnerId, authReq.user.id, isMember))
      return res.status(403).json({ error: 'No permission to change cover image' });
  }
  // General edit check (title, description, dates, currency, reminder_days)
  const editFields = ['title', 'description', 'start_date', 'end_date', 'currency', 'reminder_days'];
  if (editFields.some(f => req.body[f] !== undefined)) {
    if (!checkPermission('trip_edit', authReq.user.role, tripOwnerId, authReq.user.id, isMember))
      return res.status(403).json({ error: 'No permission to edit this trip' });
  }

  try {
    // Capture old cover before update for backend cleanup
    const oldCover = req.body.cover_image !== undefined ? getTripRaw(req.params.id)?.cover_image : undefined;
    const result = updateTrip(req.params.id, authReq.user.id, req.body, authReq.user.role);

    // Delete old cover from storage if cover_image was changed/cleared
    if (oldCover && req.body.cover_image !== oldCover) {
      try {
        const backend = getBackend(StoragePurpose.COVERS);
        await backend.delete(path.basename(oldCover));
      } catch (e) {
        console.error('Error deleting old cover:', e);
      }
    }

    if (Object.keys(result.changes).length > 0) {
      writeAudit({ userId: authReq.user.id, action: 'trip.update', ip: getClientIp(req), details: { tripId: Number(req.params.id), trip: result.newTitle, ...(result.ownerEmail ? { owner: result.ownerEmail } : {}), ...result.changes } });
      if (result.isAdminEdit && result.ownerEmail) {
        logInfo(`Admin ${authReq.user.email} edited trip "${result.newTitle}" owned by ${result.ownerEmail}`);
      }
    }

    if (result.newReminder !== result.oldReminder) {
      if (result.newReminder > 0) {
        logInfo(`${authReq.user.email} set ${result.newReminder}-day reminder for trip "${result.newTitle}"`);
      } else {
        logInfo(`${authReq.user.email} removed reminder for trip "${result.newTitle}"`);
      }
    }

    res.json({ trip: result.updatedTrip });
    broadcast(req.params.id, 'trip:updated', { trip: result.updatedTrip }, req.headers['x-socket-id'] as string);
  } catch (e: any) {
    if (e instanceof NotFoundError) return res.status(404).json({ error: e.message });
    if (e instanceof ValidationError) return res.status(400).json({ error: e.message });
    throw e;
  }
});

// ── Cover upload ──────────────────────────────────────────────────────────

router.post('/:id/cover', authenticate, demoUploadBlock, uploadCover.single('cover'), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const access = canAccessTrip(req.params.id, authReq.user.id);
  const tripOwnerId = access?.user_id;
  if (!tripOwnerId) return res.status(404).json({ error: 'Trip not found' });
  const isMember = tripOwnerId !== authReq.user.id;
  if (!checkPermission('trip_cover_upload', authReq.user.role, tripOwnerId, authReq.user.id, isMember))
    return res.status(403).json({ error: 'No permission to change the cover image' });

  const trip = getTripRaw(req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  const tempPath = req.file.path;
  const ext = path.extname(req.file.originalname);
  const storageKey = `${uuidv4()}${ext}`;

  try {
    const backend = getBackend(StoragePurpose.COVERS);

    // Delete old cover if exists
    if (trip.cover_image) {
      try {
        await backend.delete(path.basename(trip.cover_image));
      } catch (e) {
        console.error('Error deleting old cover:', e);
      }
    }

    // Upload new cover
    const stream = fs.createReadStream(tempPath);
    await backend.store(storageKey, stream);

    // Store full URL path for consistency with GET responses (backward-compatible with legacy data)
    const coverPath = `/uploads/covers/${storageKey}`;
    updateCoverImage(req.params.id, coverPath);
    res.json({ cover_image: coverPath });
  } catch (err: unknown) {
    console.error('Cover upload error:', err);
    res.status(500).json({ error: 'Failed to upload cover image' });
  } finally {
    try { fs.unlinkSync(tempPath); } catch {}
  }
});

// ── Delete trip ───────────────────────────────────────────────────────────

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const tripOwner = getTripOwner(req.params.id);
  if (!tripOwner) return res.status(404).json({ error: 'Trip not found' });
  const tripOwnerId = tripOwner.user_id;
  const isMemberDel = tripOwnerId !== authReq.user.id;
  if (!checkPermission('trip_delete', authReq.user.role, tripOwnerId, authReq.user.id, isMemberDel))
    return res.status(403).json({ error: 'No permission to delete this trip' });

  const info = deleteTrip(req.params.id, authReq.user.id, authReq.user.role);

  writeAudit({ userId: authReq.user.id, action: 'trip.delete', ip: getClientIp(req), details: { tripId: info.tripId, trip: info.title, ...(info.ownerEmail ? { owner: info.ownerEmail } : {}) } });
  if (info.isAdminDelete && info.ownerEmail) {
    logInfo(`Admin ${authReq.user.email} deleted trip "${info.title}" owned by ${info.ownerEmail}`);
  }

  res.json({ success: true });
  broadcast(info.tripId, 'trip:deleted', { id: info.tripId }, req.headers['x-socket-id'] as string);
});

// ── List members ──────────────────────────────────────────────────────────

router.get('/:id/members', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const access = canAccessTrip(req.params.id, authReq.user.id);
  if (!access)
    return res.status(404).json({ error: 'Trip not found' });

  const { owner, members } = listMembers(req.params.id, access.user_id);
  res.json({ owner, members, current_user_id: authReq.user.id });
});

// ── Add member ────────────────────────────────────────────────────────────

router.post('/:id/members', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const access = canAccessTrip(req.params.id, authReq.user.id);
  if (!access)
    return res.status(404).json({ error: 'Trip not found' });

  const tripOwnerId = access.user_id;
  const isMember = tripOwnerId !== authReq.user.id;
  if (!checkPermission('member_manage', authReq.user.role, tripOwnerId, authReq.user.id, isMember))
    return res.status(403).json({ error: 'No permission to manage members' });

  const { identifier } = req.body;

  try {
    const result = addMember(req.params.id, identifier, tripOwnerId, authReq.user.id);

    // Notify invited user
    import('../services/notifications').then(({ notify }) => {
      notify({ userId: result.targetUserId, event: 'trip_invite', params: { trip: result.tripTitle, actor: authReq.user.email, invitee: result.member.email } }).catch(() => {});
    });

    res.status(201).json({ member: result.member });
  } catch (e: any) {
    if (e instanceof NotFoundError) return res.status(404).json({ error: e.message });
    if (e instanceof ValidationError) return res.status(400).json({ error: e.message });
    throw e;
  }
});

// ── Remove member ─────────────────────────────────────────────────────────

router.delete('/:id/members/:userId', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!canAccessTrip(req.params.id, authReq.user.id))
    return res.status(404).json({ error: 'Trip not found' });

  const targetId = parseInt(req.params.userId);
  const isSelf = targetId === authReq.user.id;
  if (!isSelf) {
    const access = canAccessTrip(req.params.id, authReq.user.id);
    if (!access) return res.status(404).json({ error: 'Trip not found' });
    const memberCheck = access.user_id !== authReq.user.id;
    if (!checkPermission('member_manage', authReq.user.role, access.user_id, authReq.user.id, memberCheck))
      return res.status(403).json({ error: 'No permission to remove members' });
  }

  removeMember(req.params.id, targetId);
  res.json({ success: true });
});

// ── ICS calendar export ───────────────────────────────────────────────────

router.get('/:id/export.ics', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!canAccessTrip(req.params.id, authReq.user.id))
    return res.status(404).json({ error: 'Trip not found' });

  try {
    const { ics, filename } = exportICS(req.params.id);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(ics);
  } catch (e: any) {
    if (e instanceof NotFoundError) return res.status(404).json({ error: e.message });
    throw e;
  }
});

export default router;
