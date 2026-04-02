import { db } from '../db/database';
import { encryptCredentials } from './crypto';
import { StoragePurpose } from './types';

export function envBootstrapStorage(): void {
  const s3Endpoint = process.env.STORAGE_S3_ENDPOINT;
  if (s3Endpoint) {
    const name = process.env.STORAGE_S3_NAME || 'S3';
    
    const existing = db.prepare('SELECT id FROM storage_targets WHERE name = ?').get(name);
    if (existing) {
      console.log(`[Storage] Target "${name}" already exists, skipping S3 bootstrap`);
    } else {
      const config = {
        endpoint: s3Endpoint,
        bucket: process.env.STORAGE_S3_BUCKET || '',
        region: process.env.STORAGE_S3_REGION || 'us-east-1',
        accessKeyId: process.env.STORAGE_S3_ACCESS_KEY || '',
        secretAccessKey: process.env.STORAGE_S3_SECRET_KEY || '',
        pathPrefix: process.env.STORAGE_S3_PATH_PREFIX || '',
        use_presigned_urls: process.env.STORAGE_S3_USE_PRESIGNED_URLS === 'true'
      };

      const configEncrypted = encryptCredentials(JSON.stringify(config));
      const encrypt = process.env.STORAGE_S3_ENCRYPT_AT_REST === 'true' ? 1 : 0;

      const result = db.prepare(
        'INSERT INTO storage_targets (name, type, config_encrypted, encrypt) VALUES (?, ?, ?, ?)'
      ).run(name, 's3', configEncrypted, encrypt);

      console.log(`[Storage] Created S3 target "${name}" (id=${result.lastInsertRowid})`);

      const purposes: StoragePurpose[] = [StoragePurpose.BACKUP, StoragePurpose.PHOTOS, StoragePurpose.FILES, StoragePurpose.COVERS, StoragePurpose.AVATARS];
      for (const purpose of purposes) {
        const envKey = `STORAGE_ASSIGN_${purpose.toUpperCase()}`;
        const assignValue = process.env[envKey];
        
        if (assignValue === 's3') {
          db.prepare(
            'INSERT INTO storage_assignments (purpose, target_id) VALUES (?, ?) ON CONFLICT(purpose) DO UPDATE SET target_id = ?'
          ).run(purpose, result.lastInsertRowid, result.lastInsertRowid);
          console.log(`[Storage] Assigned ${purpose} to S3 target`);
        }
      }
    }
  }
}

export function bootstrapStorageAssignments(): void {
  const purposes: StoragePurpose[] = [StoragePurpose.BACKUP, StoragePurpose.PHOTOS, StoragePurpose.FILES, StoragePurpose.COVERS, StoragePurpose.AVATARS];
  
  for (const purpose of purposes) {
    const existing = db.prepare('SELECT purpose FROM storage_assignments WHERE purpose = ?').get(purpose);
    if (!existing) {
      db.prepare('INSERT INTO storage_assignments (purpose, target_id) VALUES (?, NULL)').run(purpose);
    }
  }
  
  console.log('[Storage] Storage assignments initialized (local as default)');
}
