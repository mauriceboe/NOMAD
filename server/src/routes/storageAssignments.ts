import express, { Request, Response } from 'express';
import { db } from '../db/database';
import { authenticate, adminOnly } from '../middleware/auth';
import { StorageAssignment, StoragePurpose } from '../storage/types';
import { invalidateBackendCache } from '../storage/factory';

const router = express.Router();

router.use(authenticate, adminOnly);

router.get('/', (_req: Request, res: Response) => {
  try {
    const purposes = Object.values(StoragePurpose);
    const assignments: (StorageAssignment & { target_name: string | null })[] = [];

    for (const purpose of purposes) {
      const row = db.prepare(
        `SELECT sa.purpose, sa.target_id, st.name AS target_name
         FROM storage_assignments sa
         LEFT JOIN storage_targets st ON st.id = sa.target_id
         WHERE sa.purpose = ?`
      ).get(purpose) as (StorageAssignment & { target_name: string | null }) | undefined;

      assignments.push({
        purpose,
        target_id: row?.target_id ?? null,
        target_name: row?.target_name ?? 'Local'
      });
    }

    res.json({ assignments });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list storage assignments' });
  }
});

router.put('/:purpose', (req: Request, res: Response) => {
  try {
    const { purpose } = req.params;
    const { target_id } = req.body;

    const validPurposes = Object.values(StoragePurpose);
    if (!validPurposes.includes(purpose as StoragePurpose)) {
      return res.status(400).json({ error: 'Invalid purpose' });
    }

    if (target_id === null || target_id === undefined) {
      db.prepare('DELETE FROM storage_assignments WHERE purpose = ?').run(purpose);
    } else {
      db.prepare(
        'INSERT INTO storage_assignments (purpose, target_id) VALUES (?, ?) ON CONFLICT(purpose) DO UPDATE SET target_id = ?'
      ).run(purpose, target_id, target_id);
    }

    invalidateBackendCache();

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update storage assignment' });
  }
});

export default router;
