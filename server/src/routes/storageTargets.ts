import express, { Request, Response } from 'express';
import { db } from '../db/database';
import { authenticate, adminOnly } from '../middleware/auth';
import { StorageTarget, S3Config } from '../storage/types';
import { encryptCredentials, decryptCredentials } from '../storage/crypto';
import { invalidateBackendCache } from '../storage/factory';
import { S3Backend } from '../storage/s3';

const router = express.Router();

router.use(authenticate, adminOnly);

router.get('/', (_req: Request, res: Response) => {
  try {
    const targets = db.prepare('SELECT id, name, type, encrypt, enabled, created_at, updated_at FROM storage_targets ORDER BY created_at DESC').all() as Omit<StorageTarget, 'config_encrypted'>[];
    res.json({ targets });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list storage targets' });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, type, config, encrypt, enabled } = req.body;

    if (!name || !type || !config) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (type !== 's3') {
      return res.status(400).json({ error: 'Invalid storage type' });
    }

    const configJson = JSON.stringify(config);
    const configEncrypted = encryptCredentials(configJson);

    const result = db.prepare(
      'INSERT INTO storage_targets (name, type, config_encrypted, encrypt, enabled) VALUES (?, ?, ?, ?, ?)'
    ).run(name, type, configEncrypted, encrypt ? 1 : 0, enabled !== false ? 1 : 0);

    res.json({ id: result.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create storage target' });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, config, encrypt, enabled } = req.body;

    const target = db.prepare('SELECT * FROM storage_targets WHERE id = ?').get(id) as StorageTarget | undefined;
    
    if (!target) {
      return res.status(404).json({ error: 'Storage target not found' });
    }

    let configEncrypted = target.config_encrypted;
    if (config) {
      const configJson = JSON.stringify(config);
      configEncrypted = encryptCredentials(configJson);
    }

    db.prepare(
      'UPDATE storage_targets SET name = ?, config_encrypted = ?, encrypt = ?, enabled = ? WHERE id = ?'
    ).run(
      name !== undefined ? name : target.name,
      configEncrypted,
      encrypt !== undefined ? (encrypt ? 1 : 0) : target.encrypt,
      enabled !== undefined ? (enabled ? 1 : 0) : target.enabled,
      id
    );

    invalidateBackendCache(parseInt(id, 10));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update storage target' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM storage_targets WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Storage target not found' });
    }
    
    invalidateBackendCache(parseInt(id, 10));

    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return res.status(409).json({ error: 'Cannot delete target - it is currently assigned to one or more purposes' });
    }
    res.status(500).json({ error: 'Failed to delete storage target' });
  }
});

router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const target = db.prepare('SELECT * FROM storage_targets WHERE id = ?').get(id) as StorageTarget | undefined;
    
    if (!target) {
      return res.status(404).json({ error: 'Storage target not found' });
    }

    const configJson = decryptCredentials(target.config_encrypted);
    const config = JSON.parse(configJson);

    let backend;
    if (target.type === 's3') {
      backend = new S3Backend(config as S3Config);
    } else {
      return res.status(400).json({ error: 'Unknown storage type' });
    }

    await backend.testConnection();

    res.json({ success: true, message: 'Connection successful' });
  } catch (err: any) {
    res.json({ success: false, message: err.message || 'Connection failed' });
  }
});

export default router;
