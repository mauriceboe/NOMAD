import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import * as svc from '../services/journeyService';
import { createOrUpdateJourneyShareLink, getJourneyShareLink, deleteJourneyShareLink, getPublicJourney } from '../services/journeyShareService';
import { uploadToImmich } from '../services/memories/immichService';

const router = express.Router();

const uploadsBase = path.join(__dirname, '../../uploads/journey');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(uploadsBase)) fs.mkdirSync(uploadsBase, { recursive: true });
    cb(null, uploadsBase);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ── Static prefix routes (MUST come before /:id) ─────────────────────────

router.get('/', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  res.json({ journeys: svc.listJourneys(authReq.user.id) });
});

router.post('/', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { title, subtitle, trip_ids } = req.body || {};
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const journey = svc.createJourney(authReq.user.id, {
    title: title.trim(),
    subtitle,
    trip_ids: Array.isArray(trip_ids) ? trip_ids : [],
  });
  res.status(201).json(journey);
});

router.get('/suggestions', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  res.json({ trips: svc.getSuggestions(authReq.user.id) });
});

router.get('/available-trips', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  res.json({ trips: svc.listUserTrips(authReq.user.id) });
});

// ── Entries (prefix /entries — before /:id) ──────────────────────────────

router.patch('/entries/:entryId', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const result = svc.updateEntry(Number(req.params.entryId), authReq.user.id, req.body || {});
  if (!result) return res.status(404).json({ error: 'Entry not found' });
  res.json(result);
});

router.delete('/entries/:entryId', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!svc.deleteEntry(Number(req.params.entryId), authReq.user.id)) {
    return res.status(404).json({ error: 'Entry not found' });
  }
  res.json({ success: true });
});

// ── Photos (prefix /photos and /entries — before /:id) ───────────────────

router.post('/entries/:entryId/photos', authenticate, upload.array('photos', 10), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const files = req.files as Express.Multer.File[];
  if (!files?.length) return res.status(400).json({ error: 'No files uploaded' });

  const results: any[] = [];
  for (const file of files) {
    const relativePath = `journey/${file.filename}`;
    const photo = svc.addPhoto(
      Number(req.params.entryId),
      authReq.user.id,
      relativePath,
      undefined,
      req.body?.caption
    );
    if (photo) {
      // sync to Immich if connected — update the same photo record
      try {
        const immichId = await uploadToImmich(authReq.user.id, relativePath, file.originalname);
        if (immichId) {
          svc.setPhotoProvider(photo.id, 'immich', immichId, authReq.user.id);
          photo.provider = 'immich' as any;
          photo.asset_id = immichId;
          photo.owner_id = authReq.user.id;
        }
      } catch {}
      results.push(photo);
    }
  }

  if (!results.length) return res.status(403).json({ error: 'Not allowed' });
  res.status(201).json({ photos: results });
});

router.post('/entries/:entryId/provider-photos', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { provider, asset_id, caption } = req.body || {};
  if (!provider || !asset_id) return res.status(400).json({ error: 'provider and asset_id required' });
  const photo = svc.addProviderPhoto(Number(req.params.entryId), authReq.user.id, provider, asset_id, caption);
  if (!photo) return res.status(403).json({ error: 'Not allowed or duplicate' });
  res.status(201).json(photo);
});

// Link an existing photo to a (different) entry
router.post('/entries/:entryId/link-photo', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { photo_id } = req.body || {};
  if (!photo_id) return res.status(400).json({ error: 'photo_id required' });
  const result = svc.linkPhotoToEntry(Number(req.params.entryId), Number(photo_id), authReq.user.id);
  if (!result) return res.status(403).json({ error: 'Not allowed' });
  res.status(201).json(result);
});

router.patch('/photos/:photoId', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const result = svc.updatePhoto(Number(req.params.photoId), authReq.user.id, req.body || {});
  if (!result) return res.status(404).json({ error: 'Photo not found' });
  res.json(result);
});

router.delete('/photos/:photoId', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const photo = svc.deletePhoto(Number(req.params.photoId), authReq.user.id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });
  // delete local file
  if (photo.file_path) {
    const fullPath = path.join(__dirname, '../../uploads', photo.file_path);
    try { fs.unlinkSync(fullPath); } catch {}
  }
  // only delete from Immich if the photo was UPLOADED through TREK (has local file)
  // photos imported from Immich (no file_path) are just references — don't touch Immich
  if (photo.provider === 'immich' && photo.asset_id && photo.file_path) {
    try {
      const { getImmichCredentials } = await import('../services/memories/immichService');
      const creds = getImmichCredentials(authReq.user.id);
      if (creds) {
        const { safeFetch } = await import('../utils/ssrfGuard');
        await safeFetch(`${creds.immich_url}/api/assets`, {
          method: 'DELETE',
          headers: { 'x-api-key': creds.immich_api_key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [photo.asset_id] }),
        });
      }
    } catch {}
  }
  res.json({ success: true });
});

// ── Journeys /:id (parameterized routes AFTER static prefixes) ───────────

router.get('/:id', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const data = svc.getJourneyFull(Number(req.params.id), authReq.user.id);
  if (!data) return res.status(404).json({ error: 'Journey not found' });
  res.json(data);
});

router.patch('/:id', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const result = svc.updateJourney(Number(req.params.id), authReq.user.id, req.body || {});
  if (!result) return res.status(404).json({ error: 'Journey not found' });
  res.json(result);
});

router.post('/:id/cover', authenticate, upload.single('cover'), (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const relativePath = `journey/${req.file.filename}`;
  const result = svc.updateJourney(Number(req.params.id), authReq.user.id, { cover_image: relativePath });
  if (!result) return res.status(404).json({ error: 'Journey not found' });
  res.json(result);
});

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!svc.deleteJourney(Number(req.params.id), authReq.user.id)) {
    return res.status(404).json({ error: 'Journey not found' });
  }
  res.json({ success: true });
});

// ── Journey trips ────────────────────────────────────────────────────────

router.post('/:id/trips', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { trip_id } = req.body || {};
  if (!trip_id) return res.status(400).json({ error: 'trip_id required' });
  if (!svc.addTripToJourney(Number(req.params.id), trip_id, authReq.user.id)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  res.json({ success: true });
});

router.delete('/:id/trips/:tripId', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!svc.removeTripFromJourney(Number(req.params.id), Number(req.params.tripId), authReq.user.id)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  res.json({ success: true });
});

// ── Entries under journey ────────────────────────────────────────────────

router.get('/:id/entries', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const entries = svc.listEntries(Number(req.params.id), authReq.user.id);
  if (!entries) return res.status(404).json({ error: 'Journey not found' });
  res.json({ entries });
});

router.post('/:id/entries', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { entry_date } = req.body || {};
  if (!entry_date) return res.status(400).json({ error: 'entry_date is required' });
  const entry = svc.createEntry(Number(req.params.id), authReq.user.id, req.body);
  if (!entry) return res.status(404).json({ error: 'Journey not found' });
  res.status(201).json(entry);
});

// ── Contributors ─────────────────────────────────────────────────────────

router.post('/:id/contributors', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { user_id, role } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  if (!svc.addContributor(Number(req.params.id), authReq.user.id, user_id, role || 'viewer')) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  res.status(201).json({ success: true });
});

router.patch('/:id/contributors/:userId', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { role } = req.body || {};
  if (!svc.updateContributorRole(Number(req.params.id), authReq.user.id, Number(req.params.userId), role)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  res.json({ success: true });
});

router.delete('/:id/contributors/:userId', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!svc.removeContributor(Number(req.params.id), authReq.user.id, Number(req.params.userId))) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  res.json({ success: true });
});

// ── Share Link ────────────────────────────────────────────────────────────

router.get('/:id/share-link', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const link = getJourneyShareLink(Number(req.params.id));
  res.json({ link });
});

router.post('/:id/share-link', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { share_timeline, share_gallery, share_map } = req.body || {};
  const result = createOrUpdateJourneyShareLink(Number(req.params.id), authReq.user.id, { share_timeline, share_gallery, share_map });
  res.json(result);
});

router.delete('/:id/share-link', authenticate, (req: Request, res: Response) => {
  deleteJourneyShareLink(Number(req.params.id));
  res.json({ success: true });
});

export default router;
