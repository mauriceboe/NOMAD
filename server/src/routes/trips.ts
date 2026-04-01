import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
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
  deleteOldCover,
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

const coversDir = path.join(__dirname, '../../uploads/covers');
const coverStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
    cb(null, coversDir);
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

router.put('/:id', authenticate, (req: Request, res: Response) => {
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
    const result = updateTrip(req.params.id, authReq.user.id, req.body, authReq.user.role);

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

router.post('/:id/cover', authenticate, demoUploadBlock, uploadCover.single('cover'), (req: Request, res: Response) => {
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

  deleteOldCover(trip.cover_image);

  const coverUrl = `/uploads/covers/${req.file.filename}`;
  updateCoverImage(req.params.id, coverUrl);
  res.json({ cover_image: coverUrl });
});

// ── Copy / duplicate a trip ──────────────────────────────────────────────────
router.post('/:id/copy', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!checkPermission('trip_create', authReq.user.role, null, authReq.user.id, false))
    return res.status(403).json({ error: 'No permission to create trips' });

  if (!canAccessTrip(req.params.id, authReq.user.id))
    return res.status(404).json({ error: 'Trip not found' });

  const src = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id) as Trip | undefined;
  if (!src) return res.status(404).json({ error: 'Trip not found' });

  const title = req.body.title || src.title;

  const copyTrip = db.transaction(() => {
    // 1. Create new trip
    const tripResult = db.prepare(`
      INSERT INTO trips (user_id, title, description, start_date, end_date, currency, cover_image, is_archived, reminder_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(authReq.user.id, title, src.description, src.start_date, src.end_date, src.currency, src.cover_image, src.reminder_days ?? 3);
    const newTripId = tripResult.lastInsertRowid;

    // 2. Copy days → build ID map
    const oldDays = db.prepare('SELECT * FROM days WHERE trip_id = ? ORDER BY day_number').all(req.params.id) as any[];
    const dayMap = new Map<number, number | bigint>();
    const insertDay = db.prepare('INSERT INTO days (trip_id, day_number, date, notes, title) VALUES (?, ?, ?, ?, ?)');
    for (const d of oldDays) {
      const r = insertDay.run(newTripId, d.day_number, d.date, d.notes, d.title);
      dayMap.set(d.id, r.lastInsertRowid);
    }

    // 3. Copy places → build ID map
    const oldPlaces = db.prepare('SELECT * FROM places WHERE trip_id = ?').all(req.params.id) as any[];
    const placeMap = new Map<number, number | bigint>();
    const insertPlace = db.prepare(`
      INSERT INTO places (trip_id, name, description, lat, lng, address, category_id, price, currency,
        reservation_status, reservation_notes, reservation_datetime, place_time, end_time,
        duration_minutes, notes, image_url, google_place_id, website, phone, transport_mode, osm_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of oldPlaces) {
      const r = insertPlace.run(newTripId, p.name, p.description, p.lat, p.lng, p.address, p.category_id,
        p.price, p.currency, p.reservation_status, p.reservation_notes, p.reservation_datetime,
        p.place_time, p.end_time, p.duration_minutes, p.notes, p.image_url, p.google_place_id,
        p.website, p.phone, p.transport_mode, p.osm_id);
      placeMap.set(p.id, r.lastInsertRowid);
    }

    // 4. Copy place_tags
    const oldTags = db.prepare(`
      SELECT pt.* FROM place_tags pt JOIN places p ON p.id = pt.place_id WHERE p.trip_id = ?
    `).all(req.params.id) as any[];
    const insertTag = db.prepare('INSERT OR IGNORE INTO place_tags (place_id, tag_id) VALUES (?, ?)');
    for (const t of oldTags) {
      const newPlaceId = placeMap.get(t.place_id);
      if (newPlaceId) insertTag.run(newPlaceId, t.tag_id);
    }

    // 5. Copy day_assignments → build ID map
    const oldAssignments = db.prepare(`
      SELECT da.* FROM day_assignments da JOIN days d ON d.id = da.day_id WHERE d.trip_id = ?
    `).all(req.params.id) as any[];
    const assignmentMap = new Map<number, number | bigint>();
    const insertAssignment = db.prepare(`
      INSERT INTO day_assignments (day_id, place_id, order_index, notes, reservation_status, reservation_notes, reservation_datetime, assignment_time, assignment_end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const a of oldAssignments) {
      const newDayId = dayMap.get(a.day_id);
      const newPlaceId = placeMap.get(a.place_id);
      if (newDayId && newPlaceId) {
        const r = insertAssignment.run(newDayId, newPlaceId, a.order_index, a.notes,
          a.reservation_status, a.reservation_notes, a.reservation_datetime,
          a.assignment_time, a.assignment_end_time);
        assignmentMap.set(a.id, r.lastInsertRowid);
      }
    }

    // 6. Copy day_accommodations → build ID map (before reservations, which reference them)
    const oldAccom = db.prepare('SELECT * FROM day_accommodations WHERE trip_id = ?').all(req.params.id) as any[];
    const accomMap = new Map<number, number | bigint>();
    const insertAccom = db.prepare(`
      INSERT INTO day_accommodations (trip_id, place_id, start_day_id, end_day_id, check_in, check_out, confirmation, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const a of oldAccom) {
      const newPlaceId = placeMap.get(a.place_id);
      const newStartDay = dayMap.get(a.start_day_id);
      const newEndDay = dayMap.get(a.end_day_id);
      if (newPlaceId && newStartDay && newEndDay) {
        const r = insertAccom.run(newTripId, newPlaceId, newStartDay, newEndDay, a.check_in, a.check_out, a.confirmation, a.notes);
        accomMap.set(a.id, r.lastInsertRowid);
      }
    }

    // 7. Copy reservations
    const oldReservations = db.prepare('SELECT * FROM reservations WHERE trip_id = ?').all(req.params.id) as any[];
    const insertReservation = db.prepare(`
      INSERT INTO reservations (trip_id, day_id, place_id, assignment_id, accommodation_id, title, reservation_time, reservation_end_time,
        location, confirmation_number, notes, status, type, metadata, day_plan_position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of oldReservations) {
      insertReservation.run(newTripId,
        r.day_id ? (dayMap.get(r.day_id) ?? null) : null,
        r.place_id ? (placeMap.get(r.place_id) ?? null) : null,
        r.assignment_id ? (assignmentMap.get(r.assignment_id) ?? null) : null,
        r.accommodation_id ? (accomMap.get(r.accommodation_id) ?? null) : null,
        r.title, r.reservation_time, r.reservation_end_time,
        r.location, r.confirmation_number, r.notes, r.status, r.type,
        r.metadata, r.day_plan_position);
    }

    // 8. Copy budget_items (paid_by_user_id reset to null)
    const oldBudget = db.prepare('SELECT * FROM budget_items WHERE trip_id = ?').all(req.params.id) as any[];
    const insertBudget = db.prepare(`
      INSERT INTO budget_items (trip_id, category, name, total_price, persons, days, note, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const b of oldBudget) {
      insertBudget.run(newTripId, b.category, b.name, b.total_price, b.persons, b.days, b.note, b.sort_order);
    }

    // 9. Copy packing_bags → build ID map
    const oldBags = db.prepare('SELECT * FROM packing_bags WHERE trip_id = ?').all(req.params.id) as any[];
    const bagMap = new Map<number, number | bigint>();
    const insertBag = db.prepare(`
      INSERT INTO packing_bags (trip_id, name, color, weight_limit_grams, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const bag of oldBags) {
      const r = insertBag.run(newTripId, bag.name, bag.color, bag.weight_limit_grams, bag.sort_order);
      bagMap.set(bag.id, r.lastInsertRowid);
    }

    // 10. Copy packing_items (checked reset to 0)
    const oldPacking = db.prepare('SELECT * FROM packing_items WHERE trip_id = ?').all(req.params.id) as any[];
    const insertPacking = db.prepare(`
      INSERT INTO packing_items (trip_id, name, checked, category, sort_order, weight_grams, bag_id)
      VALUES (?, ?, 0, ?, ?, ?, ?)
    `);
    for (const p of oldPacking) {
      insertPacking.run(newTripId, p.name, p.category, p.sort_order, p.weight_grams,
        p.bag_id ? (bagMap.get(p.bag_id) ?? null) : null);
    }

    // 11. Copy day_notes
    const oldNotes = db.prepare('SELECT * FROM day_notes WHERE trip_id = ?').all(req.params.id) as any[];
    const insertNote = db.prepare(`
      INSERT INTO day_notes (day_id, trip_id, text, time, icon, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const n of oldNotes) {
      const newDayId = dayMap.get(n.day_id);
      if (newDayId) insertNote.run(newDayId, newTripId, n.text, n.time, n.icon, n.sort_order);
    }

    return newTripId;
  });

  try {
    const newTripId = copyTrip();
    writeAudit({ userId: authReq.user.id, action: 'trip.copy', ip: getClientIp(req), details: { sourceTripId: Number(req.params.id), newTripId: Number(newTripId), title } });
    const trip = db.prepare(`${TRIP_SELECT} WHERE t.id = :tripId`).get({ userId: authReq.user.id, tripId: newTripId });
    res.status(201).json({ trip });
  } catch {
    return res.status(500).json({ error: 'Failed to copy trip' });
  }
});

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
