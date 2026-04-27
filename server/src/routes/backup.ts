import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import { authenticate, adminOnly } from '../middleware/auth';
import { AuthRequest } from '../types';
import { writeAudit, getClientIp } from '../services/auditLog';
import {
  listBackups,
  createBackup,
  restoreFromZip,
  getAutoSettings,
  updateAutoSettings,
  deleteBackup,
  isValidBackupFilename,
  backupFilePath,
  backupFileExists,
  checkRateLimit,
  getUploadTmpDir,
  BACKUP_RATE_WINDOW,
  MAX_BACKUP_UPLOAD_SIZE,
} from '../services/backupService';

const router = express.Router();

router.use(authenticate, adminOnly);

// ---------------------------------------------------------------------------
// Rate-limiter middleware (HTTP concern wrapping service-level check)
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

router.get('/list', (_req: Request, res: Response) => {
  try {
    res.json({ backups: listBackups() });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Error loading backups' });
  }
});

router.post('/create', backupRateLimiter(3, BACKUP_RATE_WINDOW), async (req: Request, res: Response) => {
  try {
    const backup = await createBackup();
    const authReq = req as AuthRequest;
    writeAudit({
      userId: authReq.user.id,
      action: 'backup.create',
      resource: backup.filename,
      ip: getClientIp(req),
      details: { size: backup.size },
    });
    res.json({ success: true, backup });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Error creating backup' });
  }
});

router.get('/download/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;

  if (!isValidBackupFilename(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  if (!backupFileExists(filename)) {
    return res.status(404).json({ error: 'Backup not found' });
  }

  res.download(backupFilePath(filename), filename);
});

router.post('/restore/:filename', async (req: Request, res: Response) => {
  const { filename } = req.params;
  if (!isValidBackupFilename(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const zipPath = backupFilePath(filename);
  if (!backupFileExists(filename)) {
    return res.status(404).json({ error: 'Backup not found' });
  }

  try {
    const result = await restoreFromZip(zipPath);
    if (!result.success) {
      return res.status(result.status || 400).json({ error: result.error });
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
      detail: process.env.NODE_ENV?.toLowerCase() !== 'production' ? msg : undefined,
    });
  }
});

router.delete('/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;

  if (!isValidBackupFilename(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  if (!backupFileExists(filename)) {
    return res.status(404).json({ error: 'Backup not found' });
  }

  deleteBackup(filename);
  const authReq = req as AuthRequest;
  writeAudit({
    userId: authReq.user.id,
    action: 'backup.delete',
    resource: filename,
    ip: getClientIp(req),
  });
  res.json({ success: true });
});

export default router;
