/**
 * Synology Photos integration tests (SYNO-001 – SYNO-040).
 * Covers settings, connection test, search, albums, asset streaming, and access control.
 *
 * safeFetch is mocked to return fake Synology API JSON responses based on the `api`
 * query/body parameter. The Synology service uses POST form-body requests so the mock
 * inspects URLSearchParams to dispatch the right fake response.
 *
 * No real HTTP calls are made.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

// ── Hoisted DB mock ──────────────────────────────────────────────────────────

const { testDb, dbMock } = vi.hoisted(() => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  const mock = {
    db,
    closeDb: () => {},
    reinitialize: () => {},
    getPlaceWithTags: () => null,
    canAccessTrip: (tripId: any, userId: number) =>
      db.prepare(`SELECT t.id, t.user_id FROM trips t LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ? WHERE t.id = ? AND (t.user_id = ? OR m.user_id IS NOT NULL)`).get(userId, tripId, userId),
    isOwner: (tripId: any, userId: number) =>
      !!db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(tripId, userId),
  };
  return { testDb: db, dbMock: mock };
});

vi.mock('../../src/db/database', () => dbMock);
vi.mock('../../src/config', () => ({
  JWT_SECRET: 'test-jwt-secret-for-trek-testing-only',
  ENCRYPTION_KEY: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2',
  updateJwtSecret: () => {},
}));
vi.mock('../../src/websocket', () => ({ broadcast: vi.fn(), broadcastToUser: vi.fn() }));

// ── SSRF guard mock — routes all Synology API calls to fake responses ─────────
vi.mock('../../src/utils/ssrfGuard', async () => {
  const actual = await vi.importActual<typeof import('../../src/utils/ssrfGuard')>('../../src/utils/ssrfGuard');

  function makeFakeSynologyFetch(url: string, init?: any) {
    const u = String(url);

    // Determine which API was called from the URL query param (e.g. ?api=SYNO.API.Auth)
    // or from the body for POST requests.
    let apiName = '';
    let params = new URLSearchParams();
    try {
      params = new URL(u).searchParams;
      apiName = params.get('api') || '';
    } catch {}
    if (!apiName && init?.body) {
      params = init.body instanceof URLSearchParams
        ? init.body
        : new URLSearchParams(String(init.body));
      apiName = params.get('api') || '';
    }

    // Auth login — used by settings save, status, test-connection
    if (apiName === 'SYNO.API.Auth') {
      return Promise.resolve({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true, data: { sid: 'fake-session-id-abc' } }),
        body: null,
      });
    }

    // Album list
    if (apiName === 'SYNO.Foto.Browse.Album') {
      return Promise.resolve({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({
          success: true,
          data: {
            list: [
              { id: 1, name: 'Summer Trip', item_count: 15 },
              { id: 2, name: 'Winter Holiday', item_count: 8 },
            ],
          },
        }),
        body: null,
      });
    }

    // Search photos
    if (apiName === 'SYNO.Foto.Search.Search') {
      return Promise.resolve({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({
          success: true,
          data: {
            list: [
              {
                id: 101,
                filename: 'photo1.jpg',
                filesize: 1024000,
                time: 1717228800, // 2024-06-01 in Unix timestamp
                additional: {
                  thumbnail: { cache_key: '101_cachekey' },
                  address: { city: 'Tokyo', country: 'Japan', state: 'Tokyo' },
                  exif: { camera: 'Sony A7IV', focal_length: '50', aperture: '1.8', exposure_time: '1/250', iso: 400 },
                  gps: { latitude: 35.6762, longitude: 139.6503 },
                  resolution: { width: 6000, height: 4000 },
                  orientation: 1,
                  description: 'Tokyo street',
                },
              },
            ],
            total: 1,
          },
        }),
        body: null,
      });
    }

    // Browse items (for album sync or asset info)
    if (apiName === 'SYNO.Foto.Browse.Item') {
      return Promise.resolve({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({
          success: true,
          data: {
            list: [
              {
                id: 101,
                filename: 'photo1.jpg',
                filesize: 1024000,
                time: 1717228800,
                additional: {
                  thumbnail: { cache_key: '101_cachekey' },
                  address: { city: 'Tokyo', country: 'Japan', state: 'Tokyo' },
                  exif: { camera: 'Sony A7IV' },
                  gps: { latitude: 35.6762, longitude: 139.6503 },
                  resolution: { width: 6000, height: 4000 },
                  orientation: 1,
                  description: null,
                },
              },
            ],
          },
        }),
        body: null,
      });
    }

    // Thumbnail stream
    if (apiName === 'SYNO.Foto.Thumbnail') {
      if (!(['sm', 'm', 'xl', 'preview'].includes(params.get('size') || '')))
        return Promise.reject(new Error(`Unexpected thumbnail size: ${params.get('size')}`));
      const imageBytes = Buffer.from('fake-synology-thumbnail');
      return Promise.resolve({
        ok: true, status: 200,
        headers: { get: (h: string) => h === 'content-type' ? 'image/jpeg' : null },
        body: new ReadableStream({ start(c) { c.enqueue(imageBytes); c.close(); } }),
      });
    }

    // Original download
    if (apiName === 'SYNO.Foto.Download') {
      const imageBytes = Buffer.from('fake-synology-original');
      return Promise.resolve({
        ok: true, status: 200,
        headers: { get: (h: string) => h === 'content-type' ? 'image/jpeg' : null },
        body: new ReadableStream({ start(c) { c.enqueue(imageBytes); c.close(); } }),
      });
    }

    return Promise.reject(new Error(`Unexpected safeFetch call to Synology: ${u}, api=${apiName}`));
  }

  return {
    ...actual,
    checkSsrf: vi.fn().mockImplementation(async (rawUrl: string) => {
      try {
        const url = new URL(rawUrl);
        const h = url.hostname;
        if (h === '127.0.0.1' || h === '::1' || h === 'localhost') {
          return { allowed: false, isPrivate: true, error: 'Loopback not allowed' };
        }
        if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) {
          return { allowed: false, isPrivate: true, error: 'Private IP not allowed' };
        }
        return { allowed: true, isPrivate: false, resolvedIp: '93.184.216.34' };
      } catch {
        return { allowed: false, isPrivate: false, error: 'Invalid URL' };
      }
    }),
    safeFetch: vi.fn().mockImplementation(makeFakeSynologyFetch),
  };
});

import { createApp } from '../../src/app';
import { createTables } from '../../src/db/schema';
import { runMigrations } from '../../src/db/migrations';
import { resetTestDb } from '../helpers/test-db';
import { createUser, createTrip, addTripMember, addTripPhoto, setSynologyCredentials } from '../helpers/factories';
import { authCookie } from '../helpers/auth';
import { loginAttempts, mfaAttempts } from '../../src/routes/auth';
import { safeFetch } from '../../src/utils/ssrfGuard';

const app: Application = createApp();

const SYNO = '/api/integrations/memories/synologyphotos';

beforeAll(() => {
  createTables(testDb);
  runMigrations(testDb);
});

beforeEach(() => {
  resetTestDb(testDb);
  loginAttempts.clear();
  mfaAttempts.clear();
});

afterAll(() => testDb.close());

// ── Settings ──────────────────────────────────────────────────────────────────

describe('Synology settings', () => {
  it('SYNO-001 — GET /settings when not configured returns 400', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .get(`${SYNO}/settings`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(400);
  });

  it('SYNO-002 — PUT /settings saves credentials and returns success', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .put(`${SYNO}/settings`)
      .set('Cookie', authCookie(user.id))
      .send({
        synology_url: 'https://synology.example.com',
        synology_username: 'admin',
        synology_password: 'secure-password',
      });

    expect(res.status).toBe(200);

    const row = testDb.prepare('SELECT synology_url, synology_username FROM users WHERE id = ?').get(user.id) as any;
    expect(row.synology_url).toBe('https://synology.example.com');
    expect(row.synology_username).toBe('admin');
  });

  it('SYNO-003 — PUT /settings with SSRF-blocked URL returns 400', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .put(`${SYNO}/settings`)
      .set('Cookie', authCookie(user.id))
      .send({
        synology_url: 'http://192.168.1.100',
        synology_username: 'admin',
        synology_password: 'pass',
      });

    expect(res.status).toBe(400);
  });

  it('SYNO-004 — PUT /settings without URL returns 400', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .put(`${SYNO}/settings`)
      .set('Cookie', authCookie(user.id))
      .send({ synology_username: 'admin', synology_password: 'pass' }); // no url

    expect(res.status).toBe(400);
  });
});

// ── Connection ────────────────────────────────────────────────────────────────

describe('Synology connection', () => {
  it('SYNO-010 — GET /status when not configured returns { connected: false }', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .get(`${SYNO}/status`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
  });

  it('SYNO-011 — GET /status when configured returns { connected: true }', async () => {
    const { user } = createUser(testDb);
    setSynologyCredentials(testDb, user.id, 'https://synology.example.com', 'admin', 'pass');

    const res = await request(app)
      .get(`${SYNO}/status`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
  });

  it('SYNO-012 — POST /test with valid credentials returns { connected: true }', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .post(`${SYNO}/test`)
      .set('Cookie', authCookie(user.id))
      .send({
        synology_url: 'https://synology.example.com',
        synology_username: 'admin',
        synology_password: 'secure-password',
      });

    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
  });

  it('SYNO-013 — POST /test with missing fields returns error', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .post(`${SYNO}/test`)
      .set('Cookie', authCookie(user.id))
      .send({ synology_url: 'https://synology.example.com' }); // missing username+password

    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
    expect(res.body.error).toBeDefined();
  });
});

// ── Search & Albums ───────────────────────────────────────────────────────────

describe('Synology search and albums', () => {
  it('SYNO-020 — POST /search returns mapped assets', async () => {
    const { user } = createUser(testDb);
    setSynologyCredentials(testDb, user.id, 'https://synology.example.com', 'admin', 'pass');

    const res = await request(app)
      .post(`${SYNO}/search`)
      .set('Cookie', authCookie(user.id))
      .send({});

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.assets)).toBe(true);
    expect(res.body.assets[0]).toMatchObject({ city: 'Tokyo', country: 'Japan' });
  });

  it('SYNO-021 — POST /search when upstream throws propagates 500', async () => {
    const { user } = createUser(testDb);
    setSynologyCredentials(testDb, user.id, 'https://synology.example.com', 'admin', 'pass');

    // Auth call succeeds, search call throws a network error
    vi.mocked(safeFetch)
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { sid: 'fake-sid' } }),
        body: null,
      } as any)
      .mockRejectedValueOnce(new Error('Synology unreachable'));

    const res = await request(app)
      .post(`${SYNO}/search`)
      .set('Cookie', authCookie(user.id))
      .send({});

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });

  it('SYNO-022 — GET /albums returns album list', async () => {
    const { user } = createUser(testDb);
    setSynologyCredentials(testDb, user.id, 'https://synology.example.com', 'admin', 'pass');

    const res = await request(app)
      .get(`${SYNO}/albums`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.albums)).toBe(true);
    expect(res.body.albums).toHaveLength(2);
    expect(res.body.albums[0]).toMatchObject({ albumName: 'Summer Trip', assetCount: 15 });
  });
});

// ── Asset access ──────────────────────────────────────────────────────────────

describe('Synology asset access', () => {
  it('SYNO-030 — GET /assets/info returns metadata for own photo', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    setSynologyCredentials(testDb, user.id, 'https://synology.example.com', 'admin', 'pass');
    addTripPhoto(testDb, trip.id, user.id, '101', 'synologyphotos', { shared: false });

    const res = await request(app)
      .get(`${SYNO}/assets/${trip.id}/101/${user.id}/info`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ city: 'Tokyo', country: 'Japan' });
  });

  it('SYNO-031 — GET /assets/info by non-owner of unshared photo returns 403', async () => {
    const { user: owner } = createUser(testDb);
    const { user: member } = createUser(testDb);
    const trip = createTrip(testDb, owner.id);
    addTripMember(testDb, trip.id, member.id);
    addTripPhoto(testDb, trip.id, owner.id, '101', 'synologyphotos', { shared: false });

    const res = await request(app)
      .get(`${SYNO}/assets/${trip.id}/101/${owner.id}/info`)
      .set('Cookie', authCookie(member.id));

    expect(res.status).toBe(403);
  });

  it('SYNO-032 — GET /assets/thumbnail streams image data for own photo', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    setSynologyCredentials(testDb, user.id, 'https://synology.example.com', 'admin', 'pass');
    addTripPhoto(testDb, trip.id, user.id, '101_cachekey', 'synologyphotos', { shared: false });

    const res = await request(app)
      .get(`${SYNO}/assets/${trip.id}/101_cachekey/${user.id}/thumbnail`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/jpeg');
  });

  it('SYNO-032b — GET /api/photos/:id/thumbnail uses an allowed Synology thumbnail size', async () => {
    const { user } = createUser(testDb);
    setSynologyCredentials(testDb, user.id, 'https://synology.example.com', 'admin', 'pass');

    const insert = testDb.prepare(
      'INSERT INTO trek_photos (provider, asset_id, owner_id) VALUES (?, ?, ?)'
    ).run('synologyphotos', '101_cachekey', user.id);
    const trekPhotoId = Number(insert.lastInsertRowid);

    vi.mocked(safeFetch).mockClear();

    const res = await request(app)
      .get(`/api/photos/${trekPhotoId}/thumbnail`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
  });

  it('SYNO-033 — GET /assets/original streams image data for shared photo', async () => {
    const { user: owner } = createUser(testDb);
    const { user: member } = createUser(testDb);
    const trip = createTrip(testDb, owner.id);
    addTripMember(testDb, trip.id, member.id);
    setSynologyCredentials(testDb, owner.id, 'https://synology.example.com', 'admin', 'pass');
    addTripPhoto(testDb, trip.id, owner.id, '101_cachekey', 'synologyphotos', { shared: true });

    const res = await request(app)
      .get(`${SYNO}/assets/${trip.id}/101_cachekey/${owner.id}/original`)
      .set('Cookie', authCookie(member.id));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/jpeg');
  });

  it('SYNO-034 — GET /assets with invalid kind returns 400', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    addTripPhoto(testDb, trip.id, user.id, '101_cachekey', 'synologyphotos', { shared: false });

    const res = await request(app)
      .get(`${SYNO}/assets/${trip.id}/101_cachekey/${user.id}/badkind`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(400);
  });

  it('SYNO-035 — GET /assets/info where trip does not exist returns 403', async () => {
    const { user: owner } = createUser(testDb);
    const { user: member } = createUser(testDb);
    // Insert a shared photo referencing a trip that doesn't exist (FK disabled temporarily)
    testDb.exec('PRAGMA foreign_keys = OFF');
    testDb.prepare('INSERT OR IGNORE INTO trek_photos (provider, asset_id, owner_id) VALUES (?, ?, ?)').run('synologyphotos', '101_cachekey', owner.id);
    const tkpSyno35 = testDb.prepare('SELECT id FROM trek_photos WHERE provider = ? AND asset_id = ? AND owner_id = ?').get('synologyphotos', '101_cachekey', owner.id) as any;
    testDb.prepare(
      'INSERT INTO trip_photos (trip_id, user_id, photo_id, shared) VALUES (?, ?, ?, ?)'
    ).run(9999, owner.id, tkpSyno35.id, 1);
    testDb.exec('PRAGMA foreign_keys = ON');

    const res = await request(app)
      .get(`${SYNO}/assets/9999/101_cachekey/${owner.id}/info`)
      .set('Cookie', authCookie(member.id));

    // canAccessUserPhoto: shared photo found, but canAccessTrip(9999) → null → false → 403
    expect(res.status).toBe(403);
  });

  it('SYNO-036 — GET /assets/info when upstream throws propagates 500', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    setSynologyCredentials(testDb, user.id, 'https://synology.example.com', 'admin', 'pass');
    addTripPhoto(testDb, trip.id, user.id, '101', 'synologyphotos', { shared: false });

    // Auth call succeeds, Browse.Item call throws a network error
    vi.mocked(safeFetch)
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { sid: 'fake-sid' } }),
        body: null,
      } as any)
      .mockRejectedValueOnce(new Error('network failure'));

    const res = await request(app)
      .get(`${SYNO}/assets/${trip.id}/101/${user.id}/info`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});

// ── Auth checks ───────────────────────────────────────────────────────────────

describe('Synology auth checks', () => {
  it('SYNO-040 — GET /settings without auth returns 401', async () => {
    expect((await request(app).get(`${SYNO}/settings`)).status).toBe(401);
  });

  it('SYNO-040 — PUT /settings without auth returns 401', async () => {
    expect((await request(app).put(`${SYNO}/settings`)).status).toBe(401);
  });

  it('SYNO-040 — GET /status without auth returns 401', async () => {
    expect((await request(app).get(`${SYNO}/status`)).status).toBe(401);
  });

  it('SYNO-040 — POST /test without auth returns 401', async () => {
    expect((await request(app).post(`${SYNO}/test`)).status).toBe(401);
  });

  it('SYNO-040 — GET /albums without auth returns 401', async () => {
    expect((await request(app).get(`${SYNO}/albums`)).status).toBe(401);
  });

  it('SYNO-040 — POST /search without auth returns 401', async () => {
    expect((await request(app).post(`${SYNO}/search`)).status).toBe(401);
  });

  it('SYNO-040 — GET /assets/info without auth returns 401', async () => {
    expect((await request(app).get(`${SYNO}/assets/1/photo-x/1/info`)).status).toBe(401);
  });

  it('SYNO-040 — GET /assets/thumbnail without auth returns 401', async () => {
    expect((await request(app).get(`${SYNO}/assets/1/photo-x/1/thumbnail`)).status).toBe(401);
  });
});

// ── Album sync ────────────────────────────────────────────────────────────────

import { addAlbumLink } from '../helpers/factories';

describe('Synology syncSynologyAlbumLink', () => {
  it('SYNO-050 — POST sync happy path: trip owner with album link saves photos to DB', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    setSynologyCredentials(testDb, user.id, 'https://synology.example.com', 'admin', 'pass');
    // The migration inserts synologyphotos with enabled=0; ensure it is enabled for this test.
    testDb.prepare("UPDATE photo_providers SET enabled = 1 WHERE id = 'synologyphotos'").run();
    // album_id must be a numeric string so getAlbumIdFromLink returns it and
    // syncSynologyAlbumLink passes Number(album_id) to the API.
    const link = addAlbumLink(testDb, trip.id, user.id, 'synologyphotos', '1', 'Summer Trip');

    const res = await request(app)
      .post(`${SYNO}/trips/${trip.id}/album-links/${link.id}/sync`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(typeof res.body.added).toBe('number');
    expect(typeof res.body.total).toBe('number');

    // Verify photos were inserted into the DB
    const photos = testDb.prepare(`
      SELECT tp.*, tkp.provider FROM trip_photos tp
      JOIN trek_photos tkp ON tkp.id = tp.photo_id
      WHERE tp.trip_id = ? AND tp.user_id = ?
    `).all(trip.id, user.id) as any[];
    expect(photos.length).toBeGreaterThan(0);
    expect(photos[0].provider).toBe('synologyphotos');
  });

  it('SYNO-051 — POST sync when user is not a trip member returns 404', async () => {
    const { user: owner } = createUser(testDb);
    const { user: outsider } = createUser(testDb);
    const trip = createTrip(testDb, owner.id);
    setSynologyCredentials(testDb, owner.id, 'https://synology.example.com', 'admin', 'pass');
    const link = addAlbumLink(testDb, trip.id, owner.id, 'synologyphotos', '1', 'Summer Trip');

    const res = await request(app)
      .post(`${SYNO}/trips/${trip.id}/album-links/${link.id}/sync`)
      .set('Cookie', authCookie(outsider.id));

    expect(res.status).toBe(404);
  });

  it('SYNO-052 — POST sync when Synology is not configured returns 400', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    // No credentials — album link still exists for the user
    const link = addAlbumLink(testDb, trip.id, user.id, 'synologyphotos', '1', 'Summer Trip');

    const res = await request(app)
      .post(`${SYNO}/trips/${trip.id}/album-links/${link.id}/sync`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('SYNO-053 — POST sync without auth returns 401', async () => {
    expect((await request(app).post(`${SYNO}/trips/1/album-links/1/sync`)).status).toBe(401);
  });
});

// ── Session retry logic ───────────────────────────────────────────────────────

describe('Synology session retry on error codes 106/107/119', () => {
  it('SYNO-060 — request retries with fresh session when API returns error code 119', async () => {
    const { user } = createUser(testDb);
    setSynologyCredentials(testDb, user.id, 'https://synology.example.com', 'admin', 'pass');

    // Clear previous call history so the count only reflects this test's calls
    vi.mocked(safeFetch).mockClear();

    // Call sequence:
    //   1. Auth login (fresh session — no cached SID) → success with sid
    //   2. SYNO.Foto.Browse.Album call → returns { success: false, error: { code: 119 } }
    //   3. Auth login again (retry session after clearing SID) → success with new sid
    //   4. SYNO.Foto.Browse.Album retry call → success
    vi.mocked(safeFetch)
      .mockResolvedValueOnce({
        // call 1: initial login
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { sid: 'first-sid' } }),
        body: null,
      } as any)
      .mockResolvedValueOnce({
        // call 2: album list → session expired (119)
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: false, error: { code: 119 } }),
        body: null,
      } as any)
      .mockResolvedValueOnce({
        // call 3: retry login after clearing SID
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { sid: 'second-sid' } }),
        body: null,
      } as any)
      .mockResolvedValueOnce({
        // call 4: retry album list → success
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: true,
          data: {
            list: [{ id: 99, name: 'Retry Album', item_count: 5 }],
          },
        }),
        body: null,
      } as any);

    const res = await request(app)
      .get(`${SYNO}/albums`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.albums)).toBe(true);
    expect(res.body.albums[0]).toMatchObject({ albumName: 'Retry Album' });
    // Four safeFetch calls: login, failed album list, re-login, successful album list
    expect(vi.mocked(safeFetch)).toHaveBeenCalledTimes(4);
  });

  it('SYNO-061 — request retries with fresh session when API returns error code 106', async () => {
    const { user } = createUser(testDb);
    setSynologyCredentials(testDb, user.id, 'https://synology.example.com', 'admin', 'pass');

    vi.mocked(safeFetch).mockClear();
    vi.mocked(safeFetch)
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { sid: 'sid-one' } }),
        body: null,
      } as any)
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: false, error: { code: 106 } }),
        body: null,
      } as any)
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { sid: 'sid-two' } }),
        body: null,
      } as any)
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: true,
          data: { list: [{ id: 3, name: 'Timeout Album', item_count: 2 }] },
        }),
        body: null,
      } as any);

    const res = await request(app)
      .get(`${SYNO}/albums`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.albums[0]).toMatchObject({ albumName: 'Timeout Album' });
    expect(vi.mocked(safeFetch)).toHaveBeenCalledTimes(4);
  });
});

// ── Date range search ─────────────────────────────────────────────────────────

describe('Synology searchSynologyPhotos date range', () => {
  it('SYNO-070 — POST /search with from/to passes start_time and end_time to Synology API', async () => {
    const { user } = createUser(testDb);
    setSynologyCredentials(testDb, user.id, 'https://synology.example.com', 'admin', 'pass');

    // Capture the body sent on the search call (second safeFetch call after auth)
    let capturedBody: URLSearchParams | null = null;
    vi.mocked(safeFetch)
      .mockResolvedValueOnce({
        // login
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { sid: 'fake-sid' } }),
        body: null,
      } as any)
      .mockImplementationOnce((_url: string, init?: any) => {
        capturedBody = init?.body instanceof URLSearchParams
          ? init.body
          : new URLSearchParams(String(init?.body ?? ''));
        return Promise.resolve({
          ok: true, status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            data: {
              list: [
                {
                  id: 201,
                  filename: 'dated.jpg',
                  filesize: 512000,
                  time: 1717228800,
                  additional: {
                    thumbnail: { cache_key: '201_abc' },
                    address: { city: 'Kyoto', country: 'Japan', state: 'Kyoto' },
                    exif: {},
                    gps: {},
                    resolution: { width: 4000, height: 3000 },
                    orientation: 1,
                    description: null,
                  },
                },
              ],
            },
          }),
          body: null,
        } as any);
      });

    const res = await request(app)
      .post(`${SYNO}/search`)
      .set('Cookie', authCookie(user.id))
      .send({ from: '2024-06-01', to: '2024-06-30' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.assets)).toBe(true);

    // Verify date parameters were forwarded in the Synology API request body
    expect(capturedBody).not.toBeNull();
    const startTime = capturedBody!.get('start_time');
    const endTime = capturedBody!.get('end_time');
    expect(startTime).toBeDefined();
    expect(Number(startTime)).toBeGreaterThan(0);
    expect(endTime).toBeDefined();
    expect(Number(endTime)).toBeGreaterThan(Number(startTime));
  });

  it('SYNO-071 — POST /search without date range omits start_time and end_time', async () => {
    const { user } = createUser(testDb);
    setSynologyCredentials(testDb, user.id, 'https://synology.example.com', 'admin', 'pass');

    let capturedBody: URLSearchParams | null = null;
    vi.mocked(safeFetch)
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { sid: 'fake-sid' } }),
        body: null,
      } as any)
      .mockImplementationOnce((_url: string, init?: any) => {
        capturedBody = init?.body instanceof URLSearchParams
          ? init.body
          : new URLSearchParams(String(init?.body ?? ''));
        return Promise.resolve({
          ok: true, status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ success: true, data: { list: [] } }),
          body: null,
        } as any);
      });

    const res = await request(app)
      .post(`${SYNO}/search`)
      .set('Cookie', authCookie(user.id))
      .send({});

    expect(res.status).toBe(200);
    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.get('start_time')).toBeNull();
    expect(capturedBody!.get('end_time')).toBeNull();
  });
});

// ── SSRF catch branch in _fetchSynologyJson ────────────────────────────────────

describe('Synology SSRF blocked error handling', () => {
  it('SYNO-080 — safeFetch throwing SsrfBlockedError for private IP URL returns connected: false', async () => {
    const { user } = createUser(testDb);
    setSynologyCredentials(testDb, user.id, 'http://192.168.1.200', 'admin', 'pass');

    const { SsrfBlockedError: SsrfErr } = await import('../../src/utils/ssrfGuard');

    // Make safeFetch throw SsrfBlockedError — simulating the SSRF guard blocking the private IP.
    // _fetchSynologyJson catches SsrfBlockedError and returns fail(message, 400).
    // getSynologyStatus receives the failure from _getSynologySession and returns { connected: false }.
    vi.mocked(safeFetch).mockRejectedValueOnce(new SsrfErr('Private IP not allowed'));

    const res = await request(app)
      .get(`${SYNO}/status`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
  });

  it('SYNO-081 — safeFetch throwing SsrfBlockedError during album list returns 400', async () => {
    const { user } = createUser(testDb);
    setSynologyCredentials(testDb, user.id, 'https://synology.example.com', 'admin', 'pass');

    const { SsrfBlockedError: SsrfErr } = await import('../../src/utils/ssrfGuard');

    // Auth succeeds, but the album-list call throws SsrfBlockedError
    vi.mocked(safeFetch)
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { sid: 'sid-x' } }),
        body: null,
      } as any)
      .mockRejectedValueOnce(new SsrfErr('Private IP detected'));

    const res = await request(app)
      .get(`${SYNO}/albums`)
      .set('Cookie', authCookie(user.id));

    // _fetchSynologyJson catches SsrfBlockedError and returns fail(message, 400)
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
