import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { authenticate, adminOnly } from '../middleware/auth';
import { AuthRequest } from '../types';
import { writeAudit, getClientIp } from '../services/auditLog';
import {
  createBackup,
  restoreFromZip,
  getAutoSettings,
  updateAutoSettings,
  isValidBackupFilename,
  backupFilePath,
  checkRateLimit,
  getUploadTmpDir,
  BACKUP_RATE_WINDOW,
  MAX_BACKUP_UPLOAD_SIZE,
  formatSize,
} from '../services/backupService';
import { getBackend, getTargetNameForSource } from '../storage/factory';
import { StoragePurpose } from '../storage/types';
import { db } from '../db/database';

const router = express.Router();

router.use(authenticate, adminOnly);

// ---------------------------------------------------------------------------
// Rate-limiter middleware
// ---------------------------------------------------------------------------

function backupRateLimiter(maxAttempts: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    if (!checkRateLimit(key, maxAttempts, windowMs)) {
      return res.status(429).json({ error: 'Too many backup requests. Please try again later.' });
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get('/list', async (_req: Request, res: Response) => {
  try {
    const backend = getBackend(StoragePurpose.BACKUP);
    const entries = await backend.list();
    const backups = entries.map(entry => ({
      filename: entry.key,
      size: entry.size,
      sizeText: formatSize(entry.size),
      created_at: entry.createdAt,
      source: entry.source,
      targetName: entry.targetName,
    }));
    res.json({ backups });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Error loading backups' });
  }
});

router.post('/create', backupRateLimiter(3, BACKUP_RATE_WINDOW), async (req: Request, res: Response) => {
  let localPath: string | null = null;
  try {
    // Always create locally first (handles archiving/WAL checkpoint)
    const backup = await createBackup();
    localPath = backupFilePath(backup.filename);

    // Upload to the configured backend
    const backend = getBackend(StoragePurpose.BACKUP);
    const stream = fs.createReadStream(localPath);
    await backend.store(backup.filename, stream);

    // If using external (non-local) backend, delete the local copy
    const assignment = db.prepare('SELECT target_id FROM storage_assignments WHERE purpose = ?').get('backup') as { target_id: number | null } | undefined;
    if (assignment?.target_id && fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }

    const targetName = assignment?.target_id
      ? getTargetNameForSource(`target:${assignment.target_id}`)
      : 'Local';

    const authReq = req as AuthRequest;
    writeAudit({
      userId: authReq.user.id,
      action: 'backup.create',
      resource: `${backup.filename} (${targetName})`,
      ip: getClientIp(req),
      details: { size: backup.size, target: targetName },
    });
    res.json({ success: true, backup: { ...backup, targetName } });
  } catch (err: unknown) {
    if (localPath && fs.existsSync(localPath)) {
      try { fs.unlinkSync(localPath); } catch {}
    }
    res.status(500).json({ error: 'Error creating backup' });
  }
});

router.get('/download/:filename', async (req: Request, res: Response) => {
  const { filename } = req.params;

  if (!isValidBackupFilename(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  try {
    const backend = getBackend(StoragePurpose.BACKUP);
    const result = await backend.download(filename);

    if (result.type === 'redirect') {
      return res.redirect(302, result.url);
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/zip');
    result.stream.pipe(res);
  } catch (err: unknown) {
    res.status(404).json({ error: 'Backup not found' });
  }
});

router.post('/restore/:filename', async (req: Request, res: Response) => {
  const { filename } = req.params;

  if (!isValidBackupFilename(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const tmpDir = getUploadTmpDir();
  const tempPath = path.join(tmpDir, `restore-${Date.now()}-${filename}`);

  try {
    const backend = getBackend(StoragePurpose.BACKUP);
    const result = await backend.download(filename);

    if (result.type === 'redirect') {
      return res.status(400).json({ error: 'Cannot restore from presigned URL directly' });
    }

    // Write stream to temp file then restore
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const out = fs.createWriteStream(tempPath);
      result.stream.pipe(out);
      out.on('finish', resolve);
      out.on('error', reject);
    });

    const restoreResult = await restoreFromZip(tempPath);
    if (!restoreResult.success) {
      return res.status(restoreResult.status || 400).json({ error: restoreResult.error });
    }

    const authReq = req as AuthRequest;
    writeAudit({
      userId: authReq.user.id,
      action: 'backup.restore',
      resource: filename,
      ip: getClientIp(req),
    });
    res.json({ success: true });
  } catch (err: unknown) {
    if (!res.headersSent) res.status(500).json({ error: 'Error restoring backup' });
  } finally {
    if (fs.existsSync(tempPath)) { try { fs.unlinkSync(tempPath); } catch {} }
  }
});

const uploadTmp = multer({
  dest: getUploadTmpDir(),
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith('.zip')) cb(null, true);
    else cb(new Error('Only ZIP files allowed'));
  },
  limits: { fileSize: MAX_BACKUP_UPLOAD_SIZE },
});

router.post('/upload-restore', uploadTmp.single('backup'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const zipPath = req.file.path;
  const origName = req.file.originalname || 'upload.zip';

  try {
    const result = await restoreFromZip(zipPath);
    if (!result.success) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    const authReq = req as AuthRequest;
    writeAudit({
      userId: authReq.user.id,
      action: 'backup.upload_restore',
      resource: origName,
      ip: getClientIp(req),
    });
    res.json({ success: true });
  } catch (err: unknown) {
    if (!res.headersSent) res.status(500).json({ error: 'Error restoring backup' });
  } finally {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  }
});

router.get('/auto-settings', (_req: Request, res: Response) => {
  try {
    const data = getAutoSettings();
    res.json(data);
  } catch (err: unknown) {
    console.error('[backup] GET auto-settings:', err);
    res.status(500).json({ error: 'Could not load backup settings' });
  }
});

router.put('/auto-settings', (req: Request, res: Response) => {
  try {
    const settings = updateAutoSettings((req.body || {}) as Record<string, unknown>);
    const authReq = req as AuthRequest;
    writeAudit({
      userId: authReq.user.id,
      action: 'backup.auto_settings',
      ip: getClientIp(req),
      details: { enabled: settings.enabled, interval: settings.interval, keep_days: settings.keep_days },
    });
    res.json({ settings });
  } catch (err: unknown) {
    console.error('[backup] PUT auto-settings:', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: 'Could not save auto-backup settings',
      detail: process.env.NODE_ENV !== 'production' ? msg : undefined,
    });
  }
});

router.delete('/:filename', async (req: Request, res: Response) => {
  const { filename } = req.params;

  if (!isValidBackupFilename(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  try {
    const backend = getBackend(StoragePurpose.BACKUP);
    await backend.delete(filename);

    const authReq = req as AuthRequest;
    writeAudit({
      userId: authReq.user.id,
      action: 'backup.delete',
      resource: filename,
      ip: getClientIp(req),
    });
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(404).json({ error: 'Backup not found' });
  }
});

export default router;
