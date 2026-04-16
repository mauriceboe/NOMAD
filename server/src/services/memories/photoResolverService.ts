import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { db } from '../../db/database';
import type { TrekPhoto } from '../../types';
import { streamImmichAsset, getAssetInfo as getImmichAssetInfo } from './immichService';
import { streamSynologyAsset, getSynologyAssetInfo } from './synologyService';
import type { ServiceResult, AssetInfo } from './helpersService';
import { fail, success } from './helpersService';
import { encrypt_api_key, decrypt_api_key } from '../apiKeyCrypto';

// ── Lookup / Register ────────────────────────────────────────────────────

export function getOrCreateTrekPhoto(
  provider: string,
  assetId: string,
  ownerId: number,
  passphrase?: string,
): number {
  const existing = db.prepare(
    'SELECT id FROM trek_photos WHERE provider = ? AND asset_id = ? AND owner_id = ?'
  ).get(provider, assetId, ownerId) as { id: number } | undefined;
  if (existing) {
    if (passphrase) {
      db.prepare('UPDATE trek_photos SET passphrase = ? WHERE id = ? AND passphrase IS NULL')
        .run(encrypt_api_key(passphrase), existing.id);
    }
    return existing.id;
  }

  const res = db.prepare(
    'INSERT INTO trek_photos (provider, asset_id, owner_id, passphrase) VALUES (?, ?, ?, ?)'
  ).run(provider, assetId, ownerId, passphrase ? encrypt_api_key(passphrase) : null);
  return Number(res.lastInsertRowid);
}

export function getOrCreateLocalTrekPhoto(
  filePath: string,
  thumbnailPath?: string | null,
  width?: number | null,
  height?: number | null,
): number {
  const existing = db.prepare(
    "SELECT id FROM trek_photos WHERE provider = 'local' AND file_path = ?"
  ).get(filePath) as { id: number } | undefined;
  if (existing) return existing.id;

  const res = db.prepare(
    'INSERT INTO trek_photos (provider, file_path, thumbnail_path, width, height) VALUES (?, ?, ?, ?, ?)'
  ).run('local', filePath, thumbnailPath || null, width || null, height || null);
  return Number(res.lastInsertRowid);
}

export function resolveTrekPhoto(photoId: number): TrekPhoto | null {
  return db.prepare('SELECT * FROM trek_photos WHERE id = ?').get(photoId) as TrekPhoto | undefined || null;
}

// ── Streaming ────────────────────────────────────────────────────────────

export async function streamPhoto(
  res: Response,
  userId: number,
  photoId: number,
  kind: 'thumbnail' | 'original',
): Promise<void> {
  const photo = resolveTrekPhoto(photoId);
  if (!photo) {
    res.status(404).json({ error: 'Photo not found' });
    return;
  }

  if (photo.file_path) {
    const localPath = path.join(__dirname, '../../../uploads', photo.file_path);
    if (fs.existsSync(localPath)) {
      res.set('Cache-Control', 'public, max-age=86400');
      res.sendFile(localPath);
      return;
    }
  }

  switch (photo.provider) {
    case 'local': {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    case 'immich': {
      await streamImmichAsset(res, userId, photo.asset_id!, kind, photo.owner_id!);
      return;
    }
    case 'synologyphotos': {
      const passphrase = photo.passphrase ? (decrypt_api_key(photo.passphrase) || undefined) : undefined;
      await streamSynologyAsset(res, userId, photo.owner_id!, photo.asset_id!, kind, undefined, passphrase);
      return;
    }
    default:
      res.status(400).json({ error: `Unknown provider: ${photo.provider}` });
  }
}

// ── Asset Info ────────────────────────────────────────────────────────────

export async function getPhotoInfo(
  userId: number,
  photoId: number,
): Promise<ServiceResult<AssetInfo>> {
  const photo = resolveTrekPhoto(photoId);
  if (!photo) return fail('Photo not found', 404);

  switch (photo.provider) {
    case 'local': {
      return success({
        id: String(photo.id),
        takenAt: photo.created_at,
        city: null,
        country: null,
        width: photo.width,
        height: photo.height,
        fileName: photo.file_path?.split('/').pop() || null,
      } as AssetInfo);
    }
    case 'immich': {
      const result = await getImmichAssetInfo(userId, photo.asset_id!, photo.owner_id!);
      if (result.error) return fail(result.error, result.status || 500);
      return success(result.data as AssetInfo);
    }
    case 'synologyphotos': {
      const passphrase = photo.passphrase ? (decrypt_api_key(photo.passphrase) || undefined) : undefined;
      return getSynologyAssetInfo(userId, photo.asset_id!, photo.owner_id!, passphrase);
    }
    default:
      return fail(`Unknown provider: ${photo.provider}`, 400);
  }
}

// ── Update provider on existing trek_photo (for Immich upload sync) ─────

export function setTrekPhotoProvider(
  trekPhotoId: number,
  provider: string,
  assetId: string,
  ownerId: number,
): void {
  db.prepare(
    'UPDATE trek_photos SET provider = ?, asset_id = ?, owner_id = ? WHERE id = ?'
  ).run(provider, assetId, ownerId, trekPhotoId);
}

// ── Delete local file for a trek_photo ──────────────────────────────────

export function getTrekPhotoFilePath(photoId: number): string | null {
  const photo = resolveTrekPhoto(photoId);
  if (!photo || photo.provider !== 'local' || !photo.file_path) return null;
  return path.join(__dirname, '../../../uploads', photo.file_path);
}
