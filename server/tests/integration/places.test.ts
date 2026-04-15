/**
 * Places API integration tests.
 * Covers PLACE-001 through PLACE-019.
 *
 * Notes:
 * - PLACE-008/009: place-to-day assignment is tested in assignments.test.ts
 * - PLACE-014: reordering within a day is tested in assignments.test.ts
 * - PLACE-019: GPX bulk import tested here using the test fixture
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';
import path from 'path';

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
vi.mock('../../src/services/placeService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/placeService')>();
  return {
    ...actual,
    importGoogleList: vi.fn(),
    searchPlaceImage: vi.fn(),
  };
});

import { createApp } from '../../src/app';
import { createTables } from '../../src/db/schema';
import { runMigrations } from '../../src/db/migrations';
import { resetTestDb } from '../helpers/test-db';
import { createUser, createAdmin, createTrip, createPlace, addTripMember } from '../helpers/factories';
import { authCookie } from '../helpers/auth';
import { loginAttempts, mfaAttempts } from '../../src/routes/auth';
import * as placeService from '../../src/services/placeService';
import { invalidatePermissionsCache } from '../../src/services/permissions';

const app: Application = createApp();
const GPX_FIXTURE = path.join(__dirname, '../fixtures/test.gpx');
const KML_FIXTURE = path.join(__dirname, '../fixtures/test.kml');
const KML_NESTED_FIXTURE = path.join(__dirname, '../fixtures/test-nested.kml');
const KML_MALFORMED_FIXTURE = path.join(__dirname, '../fixtures/test-malformed.kml');
const KMZ_FIXTURE = path.join(__dirname, '../fixtures/test.kmz');

beforeAll(() => {
  createTables(testDb);
  runMigrations(testDb);
});

beforeEach(() => {
  resetTestDb(testDb);
  loginAttempts.clear();
  mfaAttempts.clear();
  invalidatePermissionsCache();
});

afterAll(() => {
  testDb.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// Create place
// ─────────────────────────────────────────────────────────────────────────────

describe('Create place', () => {
  it('PLACE-001 — POST /api/trips/:tripId/places creates place and returns 201', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places`)
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Eiffel Tower', lat: 48.8584, lng: 2.2945 });
    expect(res.status).toBe(201);
    expect(res.body.place.name).toBe('Eiffel Tower');
    expect(res.body.place.lat).toBe(48.8584);
    expect(res.body.place.trip_id).toBe(trip.id);
  });

  it('PLACE-001 — POST without name returns 400', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places`)
      .set('Cookie', authCookie(user.id))
      .send({ lat: 48.8584, lng: 2.2945 });
    expect(res.status).toBe(400);
  });

  it('PLACE-002 — name exceeding 200 characters is rejected', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places`)
      .set('Cookie', authCookie(user.id))
      .send({ name: 'A'.repeat(201) });
    expect(res.status).toBe(400);
  });

  it('PLACE-007 — non-member cannot create a place', async () => {
    const { user: owner } = createUser(testDb);
    const { user: other } = createUser(testDb);
    const trip = createTrip(testDb, owner.id);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places`)
      .set('Cookie', authCookie(other.id))
      .send({ name: 'Test Place' });
    expect(res.status).toBe(404);
  });

  it('PLACE-016 — create place with category assigns it correctly', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const cat = testDb.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number };

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places`)
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Louvre', category_id: cat.id });
    expect(res.status).toBe(201);
    expect(res.body.place.category).toBeDefined();
    expect(res.body.place.category.id).toBe(cat.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// List places
// ─────────────────────────────────────────────────────────────────────────────

describe('List places', () => {
  it('PLACE-003 — GET /api/trips/:tripId/places returns all places', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    createPlace(testDb, trip.id, { name: 'Place A' });
    createPlace(testDb, trip.id, { name: 'Place B' });

    const res = await request(app)
      .get(`/api/trips/${trip.id}/places`)
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expect(res.body.places).toHaveLength(2);
  });

  it('PLACE-003 — member can list places for a shared trip', async () => {
    const { user: owner } = createUser(testDb);
    const { user: member } = createUser(testDb);
    const trip = createTrip(testDb, owner.id);
    addTripMember(testDb, trip.id, member.id);
    createPlace(testDb, trip.id, { name: 'Shared Place' });

    const res = await request(app)
      .get(`/api/trips/${trip.id}/places`)
      .set('Cookie', authCookie(member.id));
    expect(res.status).toBe(200);
    expect(res.body.places).toHaveLength(1);
  });

  it('PLACE-007 — non-member cannot list places', async () => {
    const { user: owner } = createUser(testDb);
    const { user: other } = createUser(testDb);
    const trip = createTrip(testDb, owner.id);

    const res = await request(app)
      .get(`/api/trips/${trip.id}/places`)
      .set('Cookie', authCookie(other.id));
    expect(res.status).toBe(404);
  });

  it('PLACE-017 — GET /api/trips/:tripId/places?category=X filters by category id', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const cats = testDb.prepare('SELECT id, name FROM categories LIMIT 2').all() as { id: number; name: string }[];
    expect(cats.length).toBeGreaterThanOrEqual(2);

    createPlace(testDb, trip.id, { name: 'Hotel Alpha', category_id: cats[0].id });
    createPlace(testDb, trip.id, { name: 'Hotel Beta', category_id: cats[0].id });
    createPlace(testDb, trip.id, { name: 'Restaurant Gamma', category_id: cats[1].id });

    // The route filters by category_id, not name
    const res = await request(app)
      .get(`/api/trips/${trip.id}/places?category=${cats[0].id}`)
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expect(res.body.places).toHaveLength(2);
    expect(res.body.places.every((p: any) => p.category?.id === cats[0].id)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Get single place
// ─────────────────────────────────────────────────────────────────────────────

describe('Get place', () => {
  it('PLACE-004 — GET /api/trips/:tripId/places/:id returns place with tags', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const place = createPlace(testDb, trip.id, { name: 'Test Place' });

    const res = await request(app)
      .get(`/api/trips/${trip.id}/places/${place.id}`)
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expect(res.body.place.id).toBe(place.id);
    expect(Array.isArray(res.body.place.tags)).toBe(true);
  });

  it('PLACE-004 — GET non-existent place returns 404', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const res = await request(app)
      .get(`/api/trips/${trip.id}/places/99999`)
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Update place
// ─────────────────────────────────────────────────────────────────────────────

describe('Update place', () => {
  it('PLACE-005 — PUT /api/trips/:tripId/places/:id updates place details', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const place = createPlace(testDb, trip.id, { name: 'Old Name' });

    const res = await request(app)
      .put(`/api/trips/${trip.id}/places/${place.id}`)
      .set('Cookie', authCookie(user.id))
      .send({ name: 'New Name', description: 'Updated description' });
    expect(res.status).toBe(200);
    expect(res.body.place.name).toBe('New Name');
    expect(res.body.place.description).toBe('Updated description');
  });

  it('PLACE-005 — PUT returns 404 for non-existent place', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const res = await request(app)
      .put(`/api/trips/${trip.id}/places/99999`)
      .set('Cookie', authCookie(user.id))
      .send({ name: 'New Name' });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Delete place
// ─────────────────────────────────────────────────────────────────────────────

describe('Delete place', () => {
  it('PLACE-006 — DELETE /api/trips/:tripId/places/:id removes place', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const place = createPlace(testDb, trip.id);

    const del = await request(app)
      .delete(`/api/trips/${trip.id}/places/${place.id}`)
      .set('Cookie', authCookie(user.id));
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    const get = await request(app)
      .get(`/api/trips/${trip.id}/places/${place.id}`)
      .set('Cookie', authCookie(user.id));
    expect(get.status).toBe(404);
  });

  it('PLACE-007 — member with default permissions can delete a place', async () => {
    const { user: owner } = createUser(testDb);
    const { user: member } = createUser(testDb);
    const trip = createTrip(testDb, owner.id);
    addTripMember(testDb, trip.id, member.id);
    const place = createPlace(testDb, trip.id);

    const res = await request(app)
      .delete(`/api/trips/${trip.id}/places/${place.id}`)
      .set('Cookie', authCookie(member.id));
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tags
// ─────────────────────────────────────────────────────────────────────────────

describe('Tags', () => {
  it('PLACE-013 — GET /api/tags returns user tags', async () => {
    const { user } = createUser(testDb);
    // Create a tag in DB
    testDb.prepare('INSERT INTO tags (name, user_id) VALUES (?, ?)').run('Must-see', user.id);

    const res = await request(app)
      .get('/api/tags')
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expect(res.body.tags).toBeDefined();
    const names = (res.body.tags as any[]).map((t: any) => t.name);
    expect(names).toContain('Must-see');
  });

  it('PLACE-010/011 — POST place with tags associates them correctly', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    // Pre-create a tag
    const tagResult = testDb.prepare('INSERT INTO tags (name, user_id) VALUES (?, ?)').run('Romantic', user.id);
    const tagId = tagResult.lastInsertRowid as number;

    // The places API accepts `tags` as an array of tag IDs
    const res = await request(app)
      .post(`/api/trips/${trip.id}/places`)
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Dinner Spot', tags: [tagId] });
    expect(res.status).toBe(201);

    // Get place with tags
    const getRes = await request(app)
      .get(`/api/trips/${trip.id}/places/${res.body.place.id}`)
      .set('Cookie', authCookie(user.id));
    expect(getRes.body.place.tags.some((t: any) => t.id === tagId)).toBe(true);
  });

  it('PLACE-012 — DELETE /api/tags/:id removes tag', async () => {
    const { user } = createUser(testDb);
    const tagResult = testDb.prepare('INSERT INTO tags (name, user_id) VALUES (?, ?)').run('OldTag', user.id);
    const tagId = tagResult.lastInsertRowid as number;

    const res = await request(app)
      .delete(`/api/tags/${tagId}`)
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);

    const tags = await request(app).get('/api/tags').set('Cookie', authCookie(user.id));
    expect((tags.body.tags as any[]).some((t: any) => t.id === tagId)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Update place tags (PLACE-011)
// ─────────────────────────────────────────────────────────────────────────────

describe('Update place tags', () => {
  it('PLACE-011 — PUT with tags array replaces existing tags', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const tag1Result = testDb.prepare('INSERT INTO tags (name, user_id) VALUES (?, ?)').run('OldTag', user.id);
    const tag2Result = testDb.prepare('INSERT INTO tags (name, user_id) VALUES (?, ?)').run('NewTag', user.id);
    const tag1Id = tag1Result.lastInsertRowid as number;
    const tag2Id = tag2Result.lastInsertRowid as number;

    // Create place with tag1
    const createRes = await request(app)
      .post(`/api/trips/${trip.id}/places`)
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Taggable Place', tags: [tag1Id] });
    expect(createRes.status).toBe(201);
    const placeId = createRes.body.place.id;

    // Update with tag2 only — should replace tag1
    const updateRes = await request(app)
      .put(`/api/trips/${trip.id}/places/${placeId}`)
      .set('Cookie', authCookie(user.id))
      .send({ tags: [tag2Id] });
    expect(updateRes.status).toBe(200);
    const tags = updateRes.body.place.tags as any[];
    expect(tags.some((t: any) => t.id === tag2Id)).toBe(true);
    expect(tags.some((t: any) => t.id === tag1Id)).toBe(false);
  });

  it('PLACE-011 — PUT with empty tags array removes all tags', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const tagResult = testDb.prepare('INSERT INTO tags (name, user_id) VALUES (?, ?)').run('RemovableTag', user.id);
    const tagId = tagResult.lastInsertRowid as number;

    const createRes = await request(app)
      .post(`/api/trips/${trip.id}/places`)
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Place With Tag', tags: [tagId] });
    const placeId = createRes.body.place.id;

    const updateRes = await request(app)
      .put(`/api/trips/${trip.id}/places/${placeId}`)
      .set('Cookie', authCookie(user.id))
      .send({ tags: [] });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.place.tags).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Place notes (PLACE-018)
// ─────────────────────────────────────────────────────────────────────────────

describe('Place notes', () => {
  it('PLACE-018 — Create a place with notes', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places`)
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Noted Place', notes: 'Book in advance!' });
    expect(res.status).toBe(201);
    expect(res.body.place.notes).toBe('Book in advance!');
  });

  it('PLACE-018 — Update place notes via PUT', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const place = createPlace(testDb, trip.id, { name: 'My Spot' });

    const res = await request(app)
      .put(`/api/trips/${trip.id}/places/${place.id}`)
      .set('Cookie', authCookie(user.id))
      .send({ notes: 'Updated notes here' });
    expect(res.status).toBe(200);
    expect(res.body.place.notes).toBe('Updated notes here');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Search filter (PLACE-017 search variant)
// ─────────────────────────────────────────────────────────────────────────────

describe('Search places', () => {
  it('PLACE-017 — GET ?search= filters places by name', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    createPlace(testDb, trip.id, { name: 'Eiffel Tower' });
    createPlace(testDb, trip.id, { name: 'Arc de Triomphe' });

    const res = await request(app)
      .get(`/api/trips/${trip.id}/places?search=Eiffel`)
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expect(res.body.places).toHaveLength(1);
    expect(res.body.places[0].name).toBe('Eiffel Tower');
  });

  it('PLACE-017 — GET ?tag= filters by tag id', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const tagResult = testDb.prepare('INSERT INTO tags (name, user_id) VALUES (?, ?)').run('Scenic', user.id);
    const tagId = tagResult.lastInsertRowid as number;

    // Create place with the tag and one without
    const createRes = await request(app)
      .post(`/api/trips/${trip.id}/places`)
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Scenic Place', tags: [tagId] });
    expect(createRes.status).toBe(201);

    createPlace(testDb, trip.id, { name: 'Plain Place' });

    const res = await request(app)
      .get(`/api/trips/${trip.id}/places?tag=${tagId}`)
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expect(res.body.places).toHaveLength(1);
    expect(res.body.places[0].name).toBe('Scenic Place');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────────────────────────────────

describe('Categories', () => {
  it('PLACE-015 — GET /api/categories returns all categories', async () => {
    const { user } = createUser(testDb);
    const res = await request(app)
      .get('/api/categories')
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
    expect(res.body.categories.length).toBeGreaterThan(0);
    expect(res.body.categories[0]).toHaveProperty('name');
    expect(res.body.categories[0]).toHaveProperty('color');
    expect(res.body.categories[0]).toHaveProperty('icon');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Naver list import
// ─────────────────────────────────────────────────────────────────────────────

describe('Naver list import', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('POST /import/naver-list resolves shortlink, paginates, and creates places', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const folderId = 'a04c3f7a8dd24d42a8eb52d710a700cc';

    testDb.prepare("UPDATE addons SET enabled = 1 WHERE id = 'naver_list_import'").run();

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        url: `https://map.naver.com/v5/favorite/myPlace/folder/${folderId}`,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          folder: { name: 'Seoul Food', bookmarkCount: 22 },
          bookmarkList: [
            { name: 'SINSAJEON', px: 127.0226195, py: 37.5186363, memo: null, address: 'Sinsa-dong Seoul' },
            { name: 'Ilpyeondeungsim', px: 126.9852986, py: 37.5629334, memo: 'Try lunch set', address: 'Myeong-dong Seoul' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          folder: { name: 'Seoul Food', bookmarkCount: 22 },
          bookmarkList: [
            { name: 'WAIKIKI MARKET', px: 126.8886523, py: 37.5589079, memo: null, address: 'Mapo-gu Seoul' },
          ],
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/naver-list`)
      .set('Cookie', authCookie(user.id))
      .send({ url: 'https://naver.me/GYDpx3Wv' });

    expect(res.status).toBe(201);
    expect(res.body.count).toBe(3);
    expect(res.body.listName).toBe('Seoul Food');
    expect(res.body.places[0].name).toBe('SINSAJEON');
    expect(res.body.places[1].notes).toBe('Try lunch set');
    expect(res.body.places[2].address).toBe('Mapo-gu Seoul');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain(`shares/${folderId}/bookmarks?`);
    expect(fetchMock.mock.calls[1][0]).toContain('start=0');
    expect(fetchMock.mock.calls[1][0]).toContain('limit=20');
    expect(fetchMock.mock.calls[2][0]).toContain('start=20');
  });

  it('POST /import/naver-list returns 400 for invalid URL', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    testDb.prepare("UPDATE addons SET enabled = 1 WHERE id = 'naver_list_import'").run();

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/naver-list`)
      .set('Cookie', authCookie(user.id))
      .send({ url: 'https://example.com/not-a-naver-list' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Could not extract folder ID');
  });

  it('POST /import/naver-list returns 502 when Naver API is unavailable', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const folderId = 'abc123';

    testDb.prepare("UPDATE addons SET enabled = 1 WHERE id = 'naver_list_import'").run();

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false });

    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/naver-list`)
      .set('Cookie', authCookie(user.id))
      .send({ url: `https://map.naver.com/v5/favorite/myPlace/folder/${folderId}` });

    expect(res.status).toBe(502);
    expect(res.body.error).toContain('Failed to fetch list from Naver Maps');
  });

  it('POST /import/naver-list returns 400 when list is empty', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const folderId = 'abc123';

    testDb.prepare("UPDATE addons SET enabled = 1 WHERE id = 'naver_list_import'").run();

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ folder: { name: 'Empty List', bookmarkCount: 0 }, bookmarkList: [] }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/naver-list`)
      .set('Cookie', authCookie(user.id))
      .send({ url: `https://map.naver.com/v5/favorite/myPlace/folder/${folderId}` });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('List is empty or could not be read');
  });

  it('POST /import/naver-list returns 400 when all items lack valid coordinates', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const folderId = 'abc123';

    testDb.prepare("UPDATE addons SET enabled = 1 WHERE id = 'naver_list_import'").run();

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        folder: { name: 'No Coords', bookmarkCount: 2 },
        bookmarkList: [
          { name: 'Place A', px: undefined, py: undefined },
          { name: 'Place B', px: 'not-a-number', py: 'not-a-number' },
        ],
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/naver-list`)
      .set('Cookie', authCookie(user.id))
      .send({ url: `https://map.naver.com/v5/favorite/myPlace/folder/${folderId}` });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No places with coordinates found in list');
  });

  it('POST /import/naver-list accepts canonical map.naver.com URL without redirect fetch', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const folderId = 'abc123';

    testDb.prepare("UPDATE addons SET enabled = 1 WHERE id = 'naver_list_import'").run();

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        folder: { name: 'Seoul', bookmarkCount: 1 },
        bookmarkList: [{ name: 'Gyeongbokgung', px: 126.9770, py: 37.5796, memo: null, address: 'Sejongno Seoul' }],
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/naver-list`)
      .set('Cookie', authCookie(user.id))
      .send({ url: `https://map.naver.com/v5/favorite/myPlace/folder/${folderId}` });

    expect(res.status).toBe(201);
    expect(res.body.count).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GPX Import
// ─────────────────────────────────────────────────────────────────────────────

describe('GPX Import', () => {
  it('PLACE-019 — POST /import/gpx with valid GPX file creates places', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/gpx`)
      .set('Cookie', authCookie(user.id))
      .attach('file', GPX_FIXTURE);
    expect(res.status).toBe(201);
    expect(res.body.places).toBeDefined();
    expect(res.body.count).toBeGreaterThan(0);
  });

  it('PLACE-019 — POST /import/gpx without file returns 400', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/gpx`)
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KML / KMZ Import
// ─────────────────────────────────────────────────────────────────────────────

describe('KML/KMZ Import', () => {
  it('PLACE-020 — POST /import/kml with valid KML creates places and returns summary', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    testDb.prepare('INSERT INTO categories (name, color, icon, user_id) VALUES (?, ?, ?, ?)')
      .run('Museums', '#3b82f6', 'Landmark', user.id);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/map`)
      .set('Cookie', authCookie(user.id))
      .attach('file', KML_FIXTURE);

    expect(res.status).toBe(201);
    expect(res.body.count).toBe(2);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.totalPlacemarks).toBe(2);
    expect(res.body.summary.createdCount).toBe(2);

    const first = res.body.places.find((p: any) => p.name === 'Eiffel Tower View');
    expect(first).toBeDefined();
    expect(first.description).toContain('Great spot');
    expect(first.description).toContain('\n');
    expect(first.description).not.toContain('<b>');
    expect(first.category?.name).toBe('Museums');
  });

  it('PLACE-021 — nested folders, empty placemark, and coordinates-only placemark are handled', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    testDb.prepare('INSERT INTO categories (name, color, icon, user_id) VALUES (?, ?, ?, ?)')
      .run('Parks', '#22c55e', 'Trees', user.id);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/map`)
      .set('Cookie', authCookie(user.id))
      .attach('file', KML_NESTED_FIXTURE);

    expect(res.status).toBe(201);
    expect(res.body.count).toBe(2);
    expect(res.body.summary.totalPlacemarks).toBe(3);
    expect(res.body.summary.skippedCount).toBe(1);
    expect(Array.isArray(res.body.summary.errors)).toBe(true);
    expect(res.body.summary.errors.join(' ')).toContain('missing Point coordinates');

    const nested = res.body.places.find((p: any) => p.name === 'Nested Place');
    expect(nested).toBeDefined();
    expect(nested.category?.name).toBe('Parks');

    const fallback = res.body.places.find((p: any) => String(p.name).startsWith('Placemark'));
    expect(fallback).toBeDefined();
  });

  it('PLACE-022 — malformed KML returns 400', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/map`)
      .set('Cookie', authCookie(user.id))
      .attach('file', KML_MALFORMED_FIXTURE);

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('PLACE-023 — non-UTF8 KML continues with warning', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const prefix = Buffer.from('<?xml version="1.0"?><kml><Document><Placemark><name>Caf');
    const invalidByte = Buffer.from([0xe9]); // invalid UTF-8 sequence when used standalone
    const suffix = Buffer.from('</name><Point><coordinates>2.1,48.1,0</coordinates></Point></Placemark></Document></kml>');
    const nonUtf8Kml = Buffer.concat([prefix, invalidByte, suffix]);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/map`)
      .set('Cookie', authCookie(user.id))
      .attach('file', nonUtf8Kml, 'non-utf8.kml');

    expect(res.status).toBe(201);
    expect(res.body.count).toBe(1);
    expect(Array.isArray(res.body.summary.warnings)).toBe(true);
    expect(res.body.summary.warnings.join(' ')).toContain('not valid UTF-8');
  });

  it('PLACE-024 — POST /import/kmz with valid KMZ creates places', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/map`)
      .set('Cookie', authCookie(user.id))
      .attach('file', KMZ_FIXTURE);

    expect(res.status).toBe(201);
    expect(res.body.count).toBeGreaterThan(0);
    expect(res.body.summary).toBeDefined();
  });

  it('PLACE-025 — invalid KMZ returns 400', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/map`)
      .set('Cookie', authCookie(user.id))
      .attach('file', Buffer.from('not-a-zip-archive'), 'invalid.kmz');

    expect(res.status).toBe(400);
    expect(String(res.body.error || '')).toContain('KMZ');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GPX import — no waypoints
// ─────────────────────────────────────────────────────────────────────────────

describe('GPX Import — edge cases', () => {
  it('PLACE-019c — GPX with no waypoints returns 400', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    // Minimal valid GPX with no waypoints, tracks, or routes
    const emptyGpx = Buffer.from(
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"></gpx>'
    );

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/gpx`)
      .set('Cookie', authCookie(user.id))
      .attach('file', emptyGpx, { filename: 'empty.gpx', contentType: 'application/gpx+xml' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no waypoints/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Google Maps list import
// ─────────────────────────────────────────────────────────────────────────────

describe('Google Maps list import', () => {
  it('PLACE-020 — POST /import/google-list without url returns 400', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/google-list`)
      .set('Cookie', authCookie(user.id))
      .send({});
    expect(res.status).toBe(400);
  });

  it('PLACE-020b — POST /import/google-list success path returns 201 with places', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    vi.mocked(placeService.importGoogleList).mockResolvedValueOnce({
      places: [{ id: 1, name: 'Mocked Place' } as any],
      listName: 'My List',
    } as any);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/google-list`)
      .set('Cookie', authCookie(user.id))
      .send({ url: 'https://maps.google.com/maps/list/example' });
    expect(res.status).toBe(201);
    expect(res.body.count).toBe(1);
    expect(res.body.listName).toBe('My List');
  });

  it('PLACE-020c — POST /import/google-list returns service error status', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    vi.mocked(placeService.importGoogleList).mockResolvedValueOnce({
      error: 'Invalid list URL',
      status: 422,
    } as any);

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/google-list`)
      .set('Cookie', authCookie(user.id))
      .send({ url: 'https://maps.google.com/maps/list/bad' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Invalid list URL');
  });

  it('PLACE-020d — POST /import/google-list thrown exception returns 400', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    vi.mocked(placeService.importGoogleList).mockRejectedValueOnce(new Error('Network failure'));

    const res = await request(app)
      .post(`/api/trips/${trip.id}/places/import/google-list`)
      .set('Cookie', authCookie(user.id))
      .send({ url: 'https://maps.google.com/maps/list/broken' });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Place image search
// ─────────────────────────────────────────────────────────────────────────────

describe('Place image search', () => {
  it('PLACE-021 — GET /:id/image returns photos on success', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const place = createPlace(testDb, trip.id, { name: 'Louvre' });

    vi.mocked(placeService.searchPlaceImage).mockResolvedValueOnce({
      photos: [{ url: 'https://example.com/photo.jpg' }],
    } as any);

    const res = await request(app)
      .get(`/api/trips/${trip.id}/places/${place.id}/image`)
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expect(res.body.photos).toHaveLength(1);
  });

  it('PLACE-021b — GET /:id/image returns service error status', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const place = createPlace(testDb, trip.id, { name: 'Tower' });

    vi.mocked(placeService.searchPlaceImage).mockResolvedValueOnce({
      error: 'No images found',
      status: 404,
    } as any);

    const res = await request(app)
      .get(`/api/trips/${trip.id}/places/${place.id}/image`)
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('No images found');
  });

  it('PLACE-021c — GET /:id/image thrown exception returns 500', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const place = createPlace(testDb, trip.id, { name: 'Bridge' });

    vi.mocked(placeService.searchPlaceImage).mockRejectedValueOnce(new Error('Unsplash down'));

    const res = await request(app)
      .get(`/api/trips/${trip.id}/places/${place.id}/image`)
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Delete place permission denied
// ─────────────────────────────────────────────────────────────────────────────

describe('Delete place — permission edge cases', () => {
  it('PLACE-022 — DELETE place by non-owner member when place_edit is trip_owner returns 403', async () => {
    const { user: owner } = createUser(testDb);
    const { user: member } = createUser(testDb);
    const trip = createTrip(testDb, owner.id);
    addTripMember(testDb, trip.id, member.id);
    const place = createPlace(testDb, trip.id, { name: 'Restricted Place' });

    // Restrict place edits to trip owner only
    testDb.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('perm_place_edit', 'trip_owner')").run();
    invalidatePermissionsCache();

    const res = await request(app)
      .delete(`/api/trips/${trip.id}/places/${place.id}`)
      .set('Cookie', authCookie(member.id));
    expect(res.status).toBe(403);
  });
});

describe('Delete place — not found', () => {
  it('PLACE-023 — DELETE non-existent place returns 404', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const res = await request(app)
      .delete(`/api/trips/${trip.id}/places/99999`)
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(404);
  });
});
