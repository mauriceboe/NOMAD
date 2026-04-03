import express, { NextFunction, Request, Response } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { db, canAccessTrip } from '../db/database';
import { authenticate } from '../middleware/auth';
import { broadcast } from '../websocket';
import { AuthRequest } from '../types';
import { maybe_encrypt_api_key, decrypt_api_key } from '../services/apiKeyCrypto';
import { consumeEphemeralToken } from '../services/ephemeralTokens';

const router = express.Router();

function copyProxyHeaders(resp: Response, upstream: globalThis.Response, headerNames: string[]): void {
  for (const headerName of headerNames) {
    const value = upstream.headers.get(headerName);
    if (value) {
      resp.set(headerName, value);
    }
  }
}

// Helper: Get Synology credentials from users table
function getSynologyCredentials(userId: number) {
  try {
    const user = db.prepare('SELECT synology_url, synology_username, synology_password FROM users WHERE id = ?').get(userId) as any;
    if (!user?.synology_url || !user?.synology_username || !user?.synology_password) return null;
    return {
      synology_url: user.synology_url as string,
      synology_username: user.synology_username as string,
      synology_password: decrypt_api_key(user.synology_password) as string,
    };
  } catch {
    return null;
  }
}

// Helper: Get cached SID from settings or users table
function getCachedSynologySID(userId: number) {
  try {
    const row = db.prepare('SELECT synology_sid FROM users WHERE id = ?').get(userId) as any;
    return row?.synology_sid || null;
  } catch {
    return null;
  }
}

// Helper: Cache SID in users table
function cacheSynologySID(userId: number, sid: string) {
  try {
    db.prepare('UPDATE users SET synology_sid = ? WHERE id = ?').run(sid, userId);
  } catch (err) {
    // Ignore if columns don't exist yet
  }
}

// Helper: Get authenticated session

interface SynologySession {
  success: boolean;
  sid?: string;
  error?: { code: number; message?: string };
}

async function getSynologySession(userId: number): Promise<SynologySession> {
  // Check for cached SID
  const cachedSid = getCachedSynologySID(userId);
  if (cachedSid) {
    return { success: true, sid: cachedSid };
  }

  const creds = getSynologyCredentials(userId);
  // Login with credentials
  if (!creds) {
    return { success: false, error: { code: 400, message: 'Invalid Synology credentials' } };
  }
  const endpoint = prepareSynologyEndpoint(creds.synology_url);

  const body = new URLSearchParams({
    api: 'SYNO.API.Auth',
    method: 'login',
    version: '3',
    account: creds.synology_username,
    passwd: creds.synology_password,
  });

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body,
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    return { success: false, error: { code: resp.status, message: 'Failed to authenticate with Synology' } };
  }

  const data = await resp.json() as { success: boolean; data?: { sid?: string } };

  if (data.success && data.data?.sid) {
    const sid = data.data.sid;
    cacheSynologySID(userId, sid);
    return { success: true, sid };
  }

  return { success: false, error: { code: 500, message: 'Failed to get Synology session' } };
}

// Helper: Clear cached SID

function clearSynologySID(userId: number): void {
  try {
    db.prepare('UPDATE users SET synology_sid = NULL WHERE id = ?').run(userId);
  } catch {
    // Ignore if columns don't exist yet
  }
}

interface ApiCallParams {
  api: string;
  method: string;
  version?: number;
  [key: string]: any;
}

interface SynologyApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: number, message?: string };
}

function prepareSynologyEndpoint(url: string): string {
  url = url.replace(/\/$/, '');
  if (!/^https?:\/\//.test(url)) {
    url = `https://${url}`;
  }
  return `${url}/photo/webapi/entry.cgi`;
}

function splitPackedSynologyId(rawId: string): { id: string; cacheKey: string; assetId: string } {
  const id = rawId.split('_')[0];
  return { id: id, cacheKey: rawId, assetId: rawId };
}

function transformSynologyPhoto(item: any): any {
  const address = item.additional?.address || {};
  return {
    id: item.additional?.thumbnail?.cache_key,
    takenAt: item.time ? new Date(item.time * 1000).toISOString() : null,
    city: address.city || null,
    country: address.country || null,
  };
}

async function callSynologyApi<T>(userId: number, params: ApiCallParams): Promise<SynologyApiResponse<T>> {
  try {
    const creds = getSynologyCredentials(userId);
    if (!creds) {
      return { success: false, error: { code: 400, message: 'Synology not configured' } };
    }
    const endpoint = prepareSynologyEndpoint(creds.synology_url);


    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      body.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }

    const sid = await getSynologySession(userId);
    if (!sid.success || !sid.sid) {
      return { success: false, error: sid.error || { code: 500, message: 'Failed to get Synology session' } };
    }
    body.append('_sid', sid.sid);

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body,
      signal: AbortSignal.timeout(30000),
    });


    if (!resp.ok) {
      const text = await resp.text();
      return { success: false, error: { code: resp.status, message: text } };
    }

    const result = await resp.json() as SynologyApiResponse<T>;
    if (!result.success && result.error?.code === 119) {
      clearSynologySID(userId);
      return callSynologyApi(userId, params);
    }
    return result;
  } catch (err) {
    return { success: false, error: { code: -1, message: err instanceof Error ? err.message : 'Unknown error' } };
  }
}

// Settings
router.get('/settings', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const creds = getSynologyCredentials(authReq.user.id);
  res.json({
    synology_url: creds?.synology_url || '',
    synology_username: creds?.synology_username || '',
    connected: !!(creds?.synology_url && creds?.synology_username),
  });
});

router.put('/settings', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { synology_url, synology_username, synology_password } = req.body;

  const url = String(synology_url || '').trim();
  const username = String(synology_username || '').trim();
  const password = String(synology_password || '').trim();

  if (!url || !username) {
    return res.status(400).json({ error: 'URL and username are required' });
  }

  const existing = db.prepare('SELECT synology_password FROM users WHERE id = ?').get(authReq.user.id) as { synology_password?: string | null } | undefined;
  const existingEncryptedPassword = existing?.synology_password || null;

  // First-time setup requires password; later updates may keep existing password.
  if (!password && !existingEncryptedPassword) {
    return res.status(400).json({ error: 'Password is required' });
  }
  
  try {
    db.prepare('UPDATE users SET synology_url = ?, synology_username = ?, synology_password = ? WHERE id = ?').run(
      url,
      username,
      password ? maybe_encrypt_api_key(password) : existingEncryptedPassword,
      authReq.user.id
    );
  } catch (err) {
    return res.status(400).json({ error: 'Failed to save settings' });
  }
  
  clearSynologySID(authReq.user.id);
  res.json({ success: true });
});

// Status
router.get('/status', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const sid = await getSynologySession(authReq.user.id);
    if (!sid.success || !sid.sid) {
      return res.json({ connected: false, error: 'Authentication failed' });
    }

    const user = db.prepare('SELECT synology_username FROM users WHERE id = ?').get(authReq.user.id) as any;
    res.json({ connected: true, user: { username: user.synology_username } });
  } catch (err: unknown) {
    res.json({ connected: false, error: err instanceof Error ? err.message : 'Connection failed' });
  }
});

// Album linking parity with Immich
router.get('/albums', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const result = await callSynologyApi<{ list: any[] }>(authReq.user.id, {
      api: 'SYNO.Foto.Browse.Album',
      method: 'list',
      version: 4,
      offset: 0,
      limit: 100,
    });

    if (!result.success || !result.data) {
      return res.status(502).json({ error: result.error?.message || 'Failed to fetch albums' });
    }

    const albums = (result.data.list || []).map((a: any) => ({
      id: String(a.id),
      albumName: a.name || '',
      assetCount: a.item_count || 0,
    }));

    res.json({ albums });
  } catch (err: unknown) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Could not reach Synology' });
  }
});

router.post('/trips/:tripId/album-links', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId } = req.params;
  if (!canAccessTrip(tripId, authReq.user.id)) return res.status(404).json({ error: 'Trip not found' });
  const { album_id, album_name } = req.body;
  if (!album_id) return res.status(400).json({ error: 'album_id required' });

  try {
    db.prepare(
      'INSERT OR IGNORE INTO trip_album_links (trip_id, user_id, provider, album_id, album_name) VALUES (?, ?, ?, ?, ?)'
    ).run(tripId, authReq.user.id, 'synologyphotos', String(album_id), album_name || '');
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: 'Album already linked' });
  }
});

router.post('/trips/:tripId/album-links/:linkId/sync', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId, linkId } = req.params;

  const link = db.prepare("SELECT * FROM trip_album_links WHERE id = ? AND trip_id = ? AND user_id = ? AND provider = 'synologyphotos'")
    .get(linkId, tripId, authReq.user.id) as any;
  if (!link) return res.status(404).json({ error: 'Album link not found' });

  try {
    const allItems: any[] = [];
    const pageSize = 1000;
    let offset = 0;

    while (true) {
      const result = await callSynologyApi<{ list: any[] }>(authReq.user.id, {
        api: 'SYNO.Foto.Browse.Item',
        method: 'list',
        version: 1,
        album_id: Number(link.album_id),
        offset,
        limit: pageSize,
        additional: ['thumbnail'],
      });

      if (!result.success || !result.data) {
        return res.status(502).json({ error: result.error?.message || 'Failed to fetch album' });
      }

      const items = result.data.list || [];
      allItems.push(...items);
      if (items.length < pageSize) break;
      offset += pageSize;
    }

    const insert = db.prepare(
      "INSERT OR IGNORE INTO trip_photos (trip_id, user_id, asset_id, provider, shared) VALUES (?, ?, ?, 'synologyphotos', 1)"
    );

    let added = 0;
    for (const item of allItems) {
      const transformed = transformSynologyPhoto(item);
      const assetId = String(transformed?.id || '').trim();
      if (!assetId) continue;
      const r = insert.run(tripId, authReq.user.id, assetId);
      if (r.changes > 0) added++;
    }

    db.prepare('UPDATE trip_album_links SET last_synced_at = CURRENT_TIMESTAMP WHERE id = ?').run(linkId);

    res.json({ success: true, added, total: allItems.length });
    if (added > 0) {
      broadcast(tripId, 'memories:updated', { userId: authReq.user.id }, req.headers['x-socket-id'] as string);
    }
  } catch (err: unknown) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Could not reach Synology' });
  }
});

// Search
router.post('/search', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  let { from, to, offset = 0, limit = 300 } = req.body;

  try {
    const params: any = {
      api: 'SYNO.Foto.Search.Search',
      method: 'list_item',
      version: 1,
      offset,
      limit,
      keyword: '.',
      additional: ['thumbnail', 'address'],
    };

    if (from || to) {
      if (from) {
        params.start_time = Math.floor(new Date(from).getTime() / 1000);
      }
      if (to) {
        params.end_time = Math.floor(new Date(to).getTime()  / 1000) + 86400; // Include entire end day
      }
    }

    
    const result = await callSynologyApi<{ list: any[]; total: number }>(authReq.user.id, params);

    if (!result.success || !result.data) {
      return res.status(502).json({ error: result.error?.message || 'Failed to fetch album photos' });
    }

    const allItems = (result.data.list || []);
    const total = allItems.length;

    const assets = allItems.map((item: any) => transformSynologyPhoto(item));

    res.json({
      assets,
      total,
      hasMore: total == limit,
    });
  } catch (err: unknown) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Could not reach Synology' });
  }
});

// Proxy Synology Assets

// Asset info endpoint (returns metadata, not image)
router.get('/assets/:photoId/info', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { photoId } = req.params;
  const parsedId = splitPackedSynologyId(photoId);
  const { userId } = req.query;

  const targetUserId = userId ? Number(userId) : authReq.user.id;

  try {
    const result = await callSynologyApi<any>(targetUserId, {
      api: 'SYNO.Foto.Browse.Item',
      method: 'get',
      version: 2,
      id: Number(parsedId.id),
      additional: ['thumbnail', 'resolution', 'exif', 'gps', 'address', 'orientation', 'description'],
    });
    if (!result.success || !result.data) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    

    const exif = result.data.additional?.exif || {};
    const address = result.data.additional?.address || {};
    const gps = result.data.additional?.gps || {};
    res.json({
      id: result.data.id,
      takenAt: result.data.time ? new Date(result.data.time * 1000).toISOString() : null,
      width: result.data.additional?.resolution?.width || null,
      height: result.data.additional?.resolution?.height || null,
      camera: exif.model || null,
      lens: exif.lens_model || null,
      focalLength: exif.focal_length ? `${exif.focal_length}mm` : null,
      aperture: exif.f_number ? `f/${exif.f_number}` : null,
      shutter: exif.exposure_time || null,
      iso: exif.iso_speed_ratings || null,
      city: address.city || null,
      state: address.state || null,
      country: address.country || null,
      lat: gps.latitude || null,
      lng: gps.longitude || null,
      orientation: result.data.additional?.orientation || null,
      description: result.data.additional?.description || null,
      fileSize: result.data.filesize || null,
      fileName: result.data.filename || null,
    });
  } catch (err: unknown) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Could not reach Synology'});
  }
});

// Middleware: Accept ephemeral token from query param for <img> tags
function authFromQuery(req: Request, res: Response, next: NextFunction) {
  const queryToken = req.query.token as string | undefined;
  if (queryToken) {
    const userId = consumeEphemeralToken(queryToken, 'synologyphotos');
    if (!userId) return res.status(401).send('Invalid or expired token');
    const user = db.prepare('SELECT id, username, email, role, mfa_enabled FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(401).send('User not found');
    (req as AuthRequest).user = user;
    return next();
  }
  return (authenticate as any)(req, res, next);
}

router.get('/assets/:photoId/thumbnail', authFromQuery, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { photoId } = req.params;
  const parsedId = splitPackedSynologyId(photoId);
  const { userId, cacheKey, size = 'sm' } = req.query;

  const targetUserId = userId ? Number(userId) : authReq.user.id;

  const creds = getSynologyCredentials(targetUserId);
  if (!creds) {
    return res.status(404).send('Not found');
  }

  try {
    const sid = await getSynologySession(authReq.user.id);
    if (!sid.success && !sid.sid) {
      return res.status(401).send('Authentication failed');
    }

    let resolvedCacheKey = cacheKey ? String(cacheKey) : parsedId.cacheKey;
    if (!resolvedCacheKey) {
      const row = db.prepare(`
        SELECT asset_id FROM trip_photos
        WHERE user_id = ? AND (asset_id = ? OR asset_id = ? OR asset_id LIKE ? OR asset_id LIKE ?)
        ORDER BY id DESC LIMIT 1
      `).get(targetUserId, parsedId.assetId, parsedId.id, `${parsedId.id}_%`, `${parsedId.id}::%`) as { asset_id?: string } | undefined;
      const packed = row?.asset_id || '';
      if (packed) {
        resolvedCacheKey = splitPackedSynologyId(packed).cacheKey;
      }
    }
    if (!resolvedCacheKey) return res.status(404).send('Missing cache key for thumbnail');

    const params = new URLSearchParams({
      api: 'SYNO.Foto.Thumbnail',
      method: 'get',
      version: '2',
      mode: 'download',
      id: String(parsedId.id),
      type: 'unit',
      size: String(size),
      cache_key: resolvedCacheKey,
      _sid: sid.sid,
    });
    const url = prepareSynologyEndpoint(creds.synology_url) + '?' + params.toString();
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      return res.status(resp.status).send('Failed');
    }

    res.status(resp.status);
    copyProxyHeaders(res, resp, ['content-type', 'cache-control', 'content-length', 'content-disposition']);
    res.set('Content-Type', resp.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', resp.headers.get('cache-control') || 'public, max-age=86400');

    if (!resp.body) {
      return res.end();
    }

    await pipeline(Readable.fromWeb(resp.body), res);
  } catch (err: unknown) {
    if (res.headersSent) {
      return;
    }
    res.status(502).send('Proxy error: ' + (err instanceof Error ? err.message : String(err)));
  }
});


router.get('/assets/download', authFromQuery, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { userId, cacheKey, unitIds } = req.query;

  const targetUserId = userId ? Number(userId) : authReq.user.id;

  const creds = getSynologyCredentials(targetUserId);
  if (!creds) {
    return res.status(404).send('Not found');
  }

  try {
    const sid = await getSynologySession(authReq.user.id);
    if (!sid.success && !sid.sid) {
      return res.status(401).send('Authentication failed');
    }

    const params = new URLSearchParams({
      api: 'SYNO.Foto.Download',
      method: 'download',
      version: '2',
      cache_key: String(cacheKey),
      unit_id: "[" + String(unitIds) + "]",
      _sid: sid.sid,
    });

    const url = prepareSynologyEndpoint(creds.synology_url) + '?' + params.toString();
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const body = await resp.text();
      return res.status(resp.status).send('Failed: ' + body);
    }

    res.status(resp.status);
    copyProxyHeaders(res, resp, ['content-type', 'cache-control', 'content-length', 'content-disposition']);
    res.set('Content-Type', resp.headers.get('content-type') || 'application/octet-stream');
    res.set('Cache-Control', resp.headers.get('cache-control') || 'public, max-age=86400');

    if (!resp.body) {
      return res.end();
    }

    await pipeline(Readable.fromWeb(resp.body), res);
  } catch (err: unknown) {
    if (res.headersSent) {
      return;
    }
    res.status(502).send('Proxy error: ' + (err instanceof Error ? err.message : String(err)));
  }
});


export default router;
