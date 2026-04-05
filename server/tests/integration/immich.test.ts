/**
 * Immich integration tests.
 * Covers IMMICH-001 to IMMICH-015 (settings, SSRF protection, connection test).
 *
 * External Immich API calls are not made — tests focus on settings persistence
 * and input validation.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

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
    getPlaceWithTags: (placeId: number) => {
      const place: any = db.prepare(`SELECT p.*, c.name as category_name, c.color as category_color, c.icon as category_icon FROM places p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`).get(placeId);
      if (!place) return null;
      const tags = db.prepare(`SELECT t.* FROM tags t JOIN place_tags pt ON t.id = pt.tag_id WHERE pt.place_id = ?`).all(placeId);
      return { ...place, category: place.category_id ? { id: place.category_id, name: place.category_name, color: place.category_color, icon: place.category_icon } : null, tags };
    },
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

// Mock SSRF guard: block loopback and private IPs, allow external hostnames without DNS.
vi.mock('../../src/utils/ssrfGuard', async () => {
  const actual = await vi.importActual<typeof import('../../src/utils/ssrfGuard')>('../../src/utils/ssrfGuard');
  return {
    ...actual,
    checkSsrf: vi.fn().mockImplementation(async (rawUrl: string) => {
      try {
        const url = new URL(rawUrl);
        const h = url.hostname;
        if (h === '127.0.0.1' || h === '::1' || h === 'localhost') {
          return { allowed: false, isPrivate: true, error: 'Requests to loopback addresses are not allowed' };
        }
        if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) {
          return { allowed: false, isPrivate: true, error: 'Requests to private network addresses are not allowed' };
        }
        return { allowed: true, isPrivate: false, resolvedIp: '93.184.216.34' };
      } catch {
        return { allowed: false, isPrivate: false, error: 'Invalid URL' };
      }
    }),
  };
});

import { createApp } from '../../src/app';
import { createTables } from '../../src/db/schema';
import { runMigrations } from '../../src/db/migrations';
import { resetTestDb } from '../helpers/test-db';
import { createUser, createTrip } from '../helpers/factories';
import { authCookie } from '../helpers/auth';
import { resetRateLimiters } from '../../src/routes/auth';

const app: Application = createApp();

beforeAll(() => {
  createTables(testDb);
  runMigrations(testDb);
});

beforeEach(() => {
  resetTestDb(testDb);
  resetRateLimiters();
});

afterAll(() => {
  testDb.close();
});

describe('Immich settings', () => {
  it('IMMICH-001 — GET /api/immich/settings returns current settings', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .get('/api/integrations/immich/settings')
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    // Settings may be empty initially
    expect(res.body).toBeDefined();
  });

  it('IMMICH-001 — PUT /api/immich/settings saves Immich URL and API key', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .put('/api/integrations/immich/settings')
      .set('Cookie', authCookie(user.id))
      .send({ immich_url: 'https://immich.example.com', immich_api_key: 'test-api-key' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('IMMICH-002 — PUT /api/immich/settings with private IP is blocked by SSRF guard', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .put('/api/integrations/immich/settings')
      .set('Cookie', authCookie(user.id))
      .send({ immich_url: 'http://192.168.1.100', immich_api_key: 'test-key' });
    expect(res.status).toBe(400);
  });

  it('IMMICH-002 — PUT /api/immich/settings with loopback is blocked', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .put('/api/integrations/immich/settings')
      .set('Cookie', authCookie(user.id))
      .send({ immich_url: 'http://127.0.0.1:2283', immich_api_key: 'test-key' });
    expect(res.status).toBe(400);
  });
});

describe('Immich authentication', () => {
  it('GET /api/immich/settings without auth returns 401', async () => {
    const res = await request(app).get('/api/integrations/immich/settings');
    expect(res.status).toBe(401);
  });

  it('PUT /api/immich/settings without auth returns 401', async () => {
    const res = await request(app)
      .put('/api/integrations/immich/settings')
      .send({ url: 'https://example.com', api_key: 'key' });
    expect(res.status).toBe(401);
  });
});

// ── Additional Immich Tests ─────────────────────────────────────────────────

describe('Immich endpoint authentication', () => {
  it('IMMICH-010 — GET /api/integrations/immich/status without auth returns 401', async () => {
    const res = await request(app).get('/api/integrations/immich/status');
    expect(res.status).toBe(401);
  });

  it('IMMICH-011 — POST /api/integrations/immich/test without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/integrations/immich/test')
      .send({ immich_url: 'https://immich.example.com', immich_api_key: 'key' });
    expect(res.status).toBe(401);
  });

  it('IMMICH-012 — GET /api/integrations/immich/browse without auth returns 401', async () => {
    const res = await request(app).get('/api/integrations/immich/browse');
    expect(res.status).toBe(401);
  });

  it('IMMICH-013 — GET /api/integrations/immich/albums without auth returns 401', async () => {
    const res = await request(app).get('/api/integrations/immich/albums');
    expect(res.status).toBe(401);
  });

  it('IMMICH-014 — GET /api/integrations/immich/trips/:tripId/photos without auth returns 401', async () => {
    const res = await request(app).get('/api/integrations/immich/trips/1/photos');
    expect(res.status).toBe(401);
  });

  it('IMMICH-015 — POST /api/integrations/immich/search without auth returns 401', async () => {
    const res = await request(app).post('/api/integrations/immich/search').send({});
    expect(res.status).toBe(401);
  });
});

describe('Immich status and connection (no credentials configured)', () => {
  it('IMMICH-020 — GET /api/integrations/immich/status returns connected:false when no creds set', async () => {
    const { user } = createUser(testDb);
    const res = await request(app)
      .get('/api/integrations/immich/status')
      .set('Cookie', authCookie(user.id));
    // Without immich_url/api_key, service returns connected: false
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
  });

  it('IMMICH-021 — GET /api/integrations/immich/albums returns 400 when no creds set', async () => {
    const { user } = createUser(testDb);
    const res = await request(app)
      .get('/api/integrations/immich/albums')
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('IMMICH-022 — GET /api/integrations/immich/browse returns 400 when no creds set', async () => {
    const { user } = createUser(testDb);
    const res = await request(app)
      .get('/api/integrations/immich/browse')
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(400);
  });
});

describe('Immich connection test endpoint', () => {
  it('IMMICH-030 — POST /api/integrations/immich/test with missing body returns error', async () => {
    const { user } = createUser(testDb);
    const res = await request(app)
      .post('/api/integrations/immich/test')
      .set('Cookie', authCookie(user.id))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
    expect(res.body.error).toBeTruthy();
  });

  it('IMMICH-031 — POST /api/integrations/immich/test with only URL (no key) returns error', async () => {
    const { user } = createUser(testDb);
    const res = await request(app)
      .post('/api/integrations/immich/test')
      .set('Cookie', authCookie(user.id))
      .send({ immich_url: 'https://immich.example.com' });
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
  });
});

describe('Immich trip photo endpoints', () => {
  it('IMMICH-040 — GET /api/integrations/immich/trips/:tripId/photos returns 404 for non-existent trip', async () => {
    const { user } = createUser(testDb);
    const res = await request(app)
      .get('/api/integrations/immich/trips/99999/photos')
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(404);
  });

  it('IMMICH-041 — POST /api/integrations/immich/trips/:tripId/photos returns 404 for non-existent trip', async () => {
    const { user } = createUser(testDb);
    const res = await request(app)
      .post('/api/integrations/immich/trips/99999/photos')
      .set('Cookie', authCookie(user.id))
      .send({ asset_ids: ['asset-uuid-1'] });
    expect(res.status).toBe(404);
  });

  it('IMMICH-042 — GET /trips/:tripId/photos returns photos array for existing trip', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const res = await request(app)
      .get(`/api/integrations/immich/trips/${trip.id}/photos`)
      .set('Cookie', authCookie(user.id));
    // Trip exists and user has access; no immich credentials but listTripPhotos is DB-only
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.photos)).toBe(true);
  });

  it('IMMICH-043 — DELETE /trips/:tripId/photos/:assetId returns 404 for non-existent trip', async () => {
    const { user } = createUser(testDb);
    const res = await request(app)
      .delete('/api/integrations/immich/trips/99999/photos/asset-id-1')
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(404);
  });
});

describe('Immich album links', () => {
  it('IMMICH-050 — GET /trips/:tripId/album-links returns 404 for non-existent trip', async () => {
    const { user } = createUser(testDb);
    const res = await request(app)
      .get('/api/integrations/immich/trips/99999/album-links')
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(404);
  });

  it('IMMICH-051 — GET /trips/:tripId/album-links returns empty array for existing trip', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const res = await request(app)
      .get(`/api/integrations/immich/trips/${trip.id}/album-links`)
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.links)).toBe(true);
    expect(res.body.links.length).toBe(0);
  });

  it('IMMICH-052 — POST /trips/:tripId/album-links without album_id returns 400', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const res = await request(app)
      .post(`/api/integrations/immich/trips/${trip.id}/album-links`)
      .set('Cookie', authCookie(user.id))
      .send({ album_name: 'My Album' }); // no album_id
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('album_id');
  });

  it('IMMICH-053 — POST /trips/:tripId/album-links without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/integrations/immich/trips/1/album-links')
      .send({ album_id: 'album-uuid' });
    expect(res.status).toBe(401);
  });
});

describe('Immich asset validation', () => {
  it('IMMICH-060 — GET /assets/:assetId/info without auth returns 401', async () => {
    const res = await request(app).get('/api/integrations/immich/assets/some-uuid/info');
    expect(res.status).toBe(401);
  });

  it('IMMICH-061 — GET /assets/:assetId/info with invalid assetId returns 400', async () => {
    const { user } = createUser(testDb);
    // Asset IDs with path traversal characters should be rejected
    const res = await request(app)
      .get('/api/integrations/immich/assets/../etc/passwd/info')
      .set('Cookie', authCookie(user.id));
    // Express may 404 on this due to path normalization; either 400 or 404 is fine
    expect([400, 404]).toContain(res.status);
  });

  it('IMMICH-062 — GET /assets/:assetId/info returns 404 or error when no immich credentials', async () => {
    const { user } = createUser(testDb);
    const res = await request(app)
      .get('/api/integrations/immich/assets/valid-asset-uuid/info')
      .set('Cookie', authCookie(user.id));
    // Without credentials, immich service should return an error
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
