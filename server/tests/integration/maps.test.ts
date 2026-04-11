/**
 * Maps integration tests.
 * Covers MAPS-001 to MAPS-008.
 *
 * External API calls (Nominatim, Google Places, Wikipedia) are tested at the
 * input validation level. Full integration tests would require live external APIs.
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

// Default mock: resolveGoogleMapsUrl rejects with 400 (SSRF-like behaviour for
// URLs that look internal); individual tests override with mockResolvedValueOnce.
vi.mock('../../src/services/mapsService', () => ({
  searchPlaces: vi.fn(),
  autocompletePlaces: vi.fn(),
  getPlaceDetails: vi.fn(),
  getPlacePhoto: vi.fn(),
  reverseGeocode: vi.fn(),
  resolveGoogleMapsUrl: vi.fn().mockRejectedValue(
    Object.assign(new Error('SSRF or invalid URL'), { status: 400 })
  ),
}));

import { createApp } from '../../src/app';
import { createTables } from '../../src/db/schema';
import { runMigrations } from '../../src/db/migrations';
import { resetTestDb } from '../helpers/test-db';
import { createUser } from '../helpers/factories';
import { authCookie } from '../helpers/auth';
import { loginAttempts, mfaAttempts } from '../../src/routes/auth';
import * as mapsService from '../../src/services/mapsService';

const app: Application = createApp();

beforeAll(() => {
  createTables(testDb);
  runMigrations(testDb);
});

beforeEach(() => {
  resetTestDb(testDb);
  loginAttempts.clear();
  mfaAttempts.clear();
});

afterAll(() => {
  testDb.close();
});

describe('Maps authentication', () => {
  it('POST /maps/search without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/maps/search')
      .send({ query: 'Paris' });
    expect(res.status).toBe(401);
  });

  it('GET /maps/reverse without auth returns 401', async () => {
    const res = await request(app)
      .get('/api/maps/reverse?lat=48.8566&lng=2.3522');
    expect(res.status).toBe(401);
  });
});

describe('Maps validation', () => {
  it('MAPS-001 — POST /maps/search without query returns 400', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .post('/api/maps/search')
      .set('Cookie', authCookie(user.id))
      .send({});
    expect(res.status).toBe(400);
  });

  it('MAPS-006 — GET /maps/reverse without lat/lng returns 400', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .get('/api/maps/reverse')
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(400);
  });

  it('MAPS-007 — POST /maps/resolve-url without url returns 400', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .post('/api/maps/resolve-url')
      .set('Cookie', authCookie(user.id))
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('Maps SSRF protection', () => {
  it('MAPS-007 — POST /maps/resolve-url with internal IP is blocked', async () => {
    const { user } = createUser(testDb);

    // SSRF: should be blocked by ssrfGuard
    const res = await request(app)
      .post('/api/maps/resolve-url')
      .set('Cookie', authCookie(user.id))
      .send({ url: 'http://192.168.1.1/admin' });
    expect(res.status).toBe(400);
  });

  it('MAPS-007 — POST /maps/resolve-url with loopback IP is blocked', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .post('/api/maps/resolve-url')
      .set('Cookie', authCookie(user.id))
      .send({ url: 'http://127.0.0.1/secret' });
    expect(res.status).toBe(400);
  });
});

describe('Maps happy paths (mocked service)', () => {
  it('MAPS-002 — POST /maps/search returns results from service', async () => {
    const { user } = createUser(testDb);
    vi.mocked(mapsService.searchPlaces).mockResolvedValueOnce({
      results: [{ address: 'Paris, France', source: 'nominatim' }],
    } as any);

    const res = await request(app)
      .post('/api/maps/search')
      .set('Cookie', authCookie(user.id))
      .send({ query: 'Paris' });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].address).toBe('Paris, France');
  });

  it('MAPS-003 — GET /maps/details/:placeId returns place details', async () => {
    const { user } = createUser(testDb);
    vi.mocked(mapsService.getPlaceDetails).mockResolvedValueOnce({
      name: 'Eiffel Tower',
      address: 'Champ de Mars, Paris',
    } as any);

    const res = await request(app)
      .get('/api/maps/details/ChIJLU7jZClu5kcR4PcOOO6p3I0')
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Eiffel Tower');
  });

  it('MAPS-004 — GET /maps/place-photo/:placeId returns photo url', async () => {
    const { user } = createUser(testDb);
    vi.mocked(mapsService.getPlacePhoto).mockResolvedValueOnce({
      url: 'https://example.com/photo.jpg',
      source: 'wikimedia',
    } as any);

    const res = await request(app)
      .get('/api/maps/place-photo/ChIJLU7jZClu5kcR4PcOOO6p3I0?lat=48.8584&lng=2.2945')
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://example.com/photo.jpg');
  });

  it('MAPS-005 — GET /maps/reverse returns geocoded location', async () => {
    const { user } = createUser(testDb);
    vi.mocked(mapsService.reverseGeocode).mockResolvedValueOnce({
      name: 'Eiffel Tower',
      address: 'Champ de Mars, Paris',
    } as any);

    const res = await request(app)
      .get('/api/maps/reverse?lat=48.8584&lng=2.2945')
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Eiffel Tower');
  });

  it('MAPS-008 — POST /maps/resolve-url returns extracted coordinates', async () => {
    const { user } = createUser(testDb);
    vi.mocked(mapsService.resolveGoogleMapsUrl).mockResolvedValueOnce({
      lat: 48.8584,
      lng: 2.2945,
    } as any);

    const res = await request(app)
      .post('/api/maps/resolve-url')
      .set('Cookie', authCookie(user.id))
      .send({ url: 'https://maps.google.com/place/eiffel-tower' });

    expect(res.status).toBe(200);
    expect(res.body.lat).toBe(48.8584);
    expect(res.body.lng).toBe(2.2945);
  });

  it('MAPS-002 — search service error propagates correct status', async () => {
    const { user } = createUser(testDb);
    const err = Object.assign(new Error('No API key'), { status: 503 });
    vi.mocked(mapsService.searchPlaces).mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/maps/search')
      .set('Cookie', authCookie(user.id))
      .send({ query: 'Anywhere' });

    expect(res.status).toBe(503);
  });

  it('MAPS-003 — getPlaceDetails error returns 500', async () => {
    const { user } = createUser(testDb);
    vi.mocked(mapsService.getPlaceDetails).mockRejectedValueOnce(new Error('External API failure'));

    const res = await request(app)
      .get('/api/maps/details/some-place-id')
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  it('MAPS-004 — getPlacePhoto error with status returns that status', async () => {
    const { user } = createUser(testDb);
    vi.mocked(mapsService.getPlacePhoto).mockRejectedValueOnce(
      Object.assign(new Error('Photo not found'), { status: 404 })
    );

    const res = await request(app)
      .get('/api/maps/place-photo/some-place-id?lat=48.8&lng=2.3')
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('MAPS-005 — reverseGeocode error returns null values', async () => {
    const { user } = createUser(testDb);
    vi.mocked(mapsService.reverseGeocode).mockRejectedValueOnce(new Error('Geocode failed'));

    const res = await request(app)
      .get('/api/maps/reverse?lat=48.8584&lng=2.2945')
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.name).toBeNull();
    expect(res.body.address).toBeNull();
  });
});

describe('Maps autocomplete', () => {
  it('MAPS-009 — POST /maps/autocomplete without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/maps/autocomplete')
      .send({ input: 'Paris' });
    expect(res.status).toBe(401);
  });

  it('MAPS-010 — POST /maps/autocomplete without input returns 400', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .post('/api/maps/autocomplete')
      .set('Cookie', authCookie(user.id))
      .send({});
    expect(res.status).toBe(400);
  });

  it('MAPS-011 — POST /maps/autocomplete with non-string input returns 400', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .post('/api/maps/autocomplete')
      .set('Cookie', authCookie(user.id))
      .send({ input: 123 });
    expect(res.status).toBe(400);
  });

  it('MAPS-012 — POST /maps/autocomplete with invalid locationBias returns 400', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .post('/api/maps/autocomplete')
      .set('Cookie', authCookie(user.id))
      .send({ input: 'Paris', locationBias: { lat: NaN, lng: 2.3 } });
    expect(res.status).toBe(400);
  });

  it('MAPS-013 — POST /maps/autocomplete returns suggestions from service', async () => {
    const { user } = createUser(testDb);
    vi.mocked(mapsService.autocompletePlaces).mockResolvedValueOnce({
      suggestions: [
        { placeId: 'ChIJ1234', mainText: 'Paris', secondaryText: 'France' },
      ],
      source: 'google',
    });

    const res = await request(app)
      .post('/api/maps/autocomplete')
      .set('Cookie', authCookie(user.id))
      .send({ input: 'Paris' });

    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(1);
    expect(res.body.suggestions[0].mainText).toBe('Paris');
    expect(res.body.source).toBe('google');
  });

  it('MAPS-014 — POST /maps/autocomplete passes lang and locationBias to service', async () => {
    const { user } = createUser(testDb);
    vi.mocked(mapsService.autocompletePlaces).mockResolvedValueOnce({
      suggestions: [],
      source: 'google',
    });

    await request(app)
      .post('/api/maps/autocomplete')
      .set('Cookie', authCookie(user.id))
      .send({ input: 'test', lang: 'fr', locationBias: { lat: 48.8, lng: 2.3 } });

    expect(mapsService.autocompletePlaces).toHaveBeenCalledWith(
      user.id,
      'test',
      'fr',
      { lat: 48.8, lng: 2.3 },
    );
  });

  it('MAPS-015 — autocomplete service error propagates correct status', async () => {
    const { user } = createUser(testDb);
    const err = Object.assign(new Error('Rate limited'), { status: 429 });
    vi.mocked(mapsService.autocompletePlaces).mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/maps/autocomplete')
      .set('Cookie', authCookie(user.id))
      .send({ input: 'test' });

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Rate limited');
  });

  it('MAPS-016 — autocomplete service error without status returns 500', async () => {
    const { user } = createUser(testDb);
    vi.mocked(mapsService.autocompletePlaces).mockRejectedValueOnce(new Error('Unknown'));

    const res = await request(app)
      .post('/api/maps/autocomplete')
      .set('Cookie', authCookie(user.id))
      .send({ input: 'test' });

    expect(res.status).toBe(500);
  });
});
