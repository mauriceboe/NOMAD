/**
 * Atlas integration tests.
 * Covers ATLAS-001 to ATLAS-008.
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

import { createApp } from '../../src/app';
import { createTables } from '../../src/db/schema';
import { runMigrations } from '../../src/db/migrations';
import { resetTestDb } from '../helpers/test-db';
import { createUser, createTrip, createPlace } from '../helpers/factories';
import { authCookie } from '../helpers/auth';
import { loginAttempts, mfaAttempts } from '../../src/routes/auth';

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

describe('Atlas stats', () => {
  it('ATLAS-001 — GET /api/atlas/stats returns stats object', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .get('/api/addons/atlas/stats')
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('countries');
    expect(res.body).toHaveProperty('stats');
  });

  it('ATLAS-002 — GET /api/atlas/country/:code returns places in country', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .get('/api/addons/atlas/country/FR')
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.places)).toBe(true);
  });

  it('ATLAS-002 — US state abbreviations in addresses resolve to US, not foreign countries', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, {
      title: 'Atlanta Weekend',
      start_date: '2025-03-14',
      end_date: '2025-03-16',
    });
    const place = createPlace(testDb, trip.id, {
      name: 'Downtown Atlanta',
      lat: 33.749,
      lng: -84.388,
    });

    testDb.prepare('UPDATE places SET address = ? WHERE id = ?').run('123 Peachtree St NE, Atlanta, GA', place.id);

    const stats = await request(app)
      .get('/api/addons/atlas/stats')
      .set('Cookie', authCookie(user.id));

    expect(stats.status).toBe(200);
    const codes = (stats.body.countries as any[]).map((country: any) => country.code);
    expect(codes).toContain('US');
    expect(codes).not.toContain('GA');

    const us = await request(app)
      .get('/api/addons/atlas/country/US')
      .set('Cookie', authCookie(user.id));

    expect(us.status).toBe(200);
    expect((us.body.places as any[]).map((entry: any) => entry.id)).toContain(place.id);

    const ga = await request(app)
      .get('/api/addons/atlas/country/GA')
      .set('Cookie', authCookie(user.id));

    expect(ga.status).toBe(200);
    expect(ga.body.places).toHaveLength(0);
  });

  it('ATLAS-002 — stored place region country codes override ambiguous addresses', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, {
      title: 'Colorado Stop',
      start_date: '2025-06-20',
      end_date: '2025-06-21',
    });
    const place = createPlace(testDb, trip.id, {
      name: 'Downtown Denver',
      lat: 39.7392,
      lng: -104.9903,
    });

    testDb.prepare('UPDATE places SET address = ? WHERE id = ?').run('1701 Wynkoop St, Denver, CO', place.id);
    testDb.prepare(
      'INSERT INTO place_regions (place_id, country_code, region_code, region_name) VALUES (?, ?, ?, ?)'
    ).run(place.id, 'US', 'US-CO', 'Colorado');

    const stats = await request(app)
      .get('/api/addons/atlas/stats')
      .set('Cookie', authCookie(user.id));

    expect(stats.status).toBe(200);
    const codes = (stats.body.countries as any[]).map((country: any) => country.code);
    expect(codes).toContain('US');
    expect(codes).not.toContain('CO');

    const us = await request(app)
      .get('/api/addons/atlas/country/US')
      .set('Cookie', authCookie(user.id));

    expect(us.status).toBe(200);
    expect((us.body.places as any[]).map((entry: any) => entry.id)).toContain(place.id);
  });
});

describe('Mark/unmark country', () => {
  it('ATLAS-003 — POST /country/:code/mark marks country as visited', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .post('/api/addons/atlas/country/DE/mark')
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify it appears in visited countries
    const stats = await request(app)
      .get('/api/addons/atlas/stats')
      .set('Cookie', authCookie(user.id));
    const codes = (stats.body.countries as any[]).map((c: any) => c.code);
    expect(codes).toContain('DE');
  });

  it('ATLAS-004 — DELETE /country/:code/mark unmarks country', async () => {
    const { user } = createUser(testDb);

    await request(app)
      .post('/api/addons/atlas/country/IT/mark')
      .set('Cookie', authCookie(user.id));

    const res = await request(app)
      .delete('/api/addons/atlas/country/IT/mark')
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Bucket list', () => {
  it('ATLAS-005 — POST /bucket-list creates a bucket list item', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .post('/api/addons/atlas/bucket-list')
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Machu Picchu', country_code: 'PE', lat: -13.1631, lng: -72.5450 });
    expect(res.status).toBe(201);
    expect(res.body.item.name).toBe('Machu Picchu');
  });

  it('ATLAS-005 — POST without name returns 400', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .post('/api/addons/atlas/bucket-list')
      .set('Cookie', authCookie(user.id))
      .send({ country_code: 'JP' });
    expect(res.status).toBe(400);
  });

  it('ATLAS-006 — GET /bucket-list returns items', async () => {
    const { user } = createUser(testDb);

    await request(app)
      .post('/api/addons/atlas/bucket-list')
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Santorini', country_code: 'GR' });

    const res = await request(app)
      .get('/api/addons/atlas/bucket-list')
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('ATLAS-007 — PUT /bucket-list/:id updates item', async () => {
    const { user } = createUser(testDb);

    const create = await request(app)
      .post('/api/addons/atlas/bucket-list')
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Old Name' });
    const id = create.body.item.id;

    const res = await request(app)
      .put(`/api/addons/atlas/bucket-list/${id}`)
      .set('Cookie', authCookie(user.id))
      .send({ name: 'New Name', notes: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.item.name).toBe('New Name');
  });

  it('ATLAS-008 — DELETE /bucket-list/:id removes item', async () => {
    const { user } = createUser(testDb);

    const create = await request(app)
      .post('/api/addons/atlas/bucket-list')
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Tokyo' });
    const id = create.body.item.id;

    const del = await request(app)
      .delete(`/api/addons/atlas/bucket-list/${id}`)
      .set('Cookie', authCookie(user.id));
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    const list = await request(app)
      .get('/api/addons/atlas/bucket-list')
      .set('Cookie', authCookie(user.id));
    expect(list.body.items).toHaveLength(0);
  });

  it('ATLAS-008 — DELETE non-existent item returns 404', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .delete('/api/addons/atlas/bucket-list/99999')
      .set('Cookie', authCookie(user.id));
    expect(res.status).toBe(404);
  });
});

describe('Mark/unmark region', () => {
  it('ATLAS-009 — POST /region/:code/mark marks a region as visited', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .post('/api/addons/atlas/region/DE-NW/mark')
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Nordrhein-Westfalen', country_code: 'DE' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('ATLAS-009 — POST /region/:code/mark without name returns 400', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .post('/api/addons/atlas/region/DE-NW/mark')
      .set('Cookie', authCookie(user.id))
      .send({ country_code: 'DE' });

    expect(res.status).toBe(400);
  });

  it('ATLAS-009 — POST /region/:code/mark without country_code returns 400', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .post('/api/addons/atlas/region/DE-NW/mark')
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Nordrhein-Westfalen' });

    expect(res.status).toBe(400);
  });

  it('ATLAS-009 — marking a region also auto-marks the parent country', async () => {
    const { user } = createUser(testDb);

    await request(app)
      .post('/api/addons/atlas/region/DE-NW/mark')
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Nordrhein-Westfalen', country_code: 'DE' });

    const stats = await request(app)
      .get('/api/addons/atlas/stats')
      .set('Cookie', authCookie(user.id));

    const codes = (stats.body.countries as any[]).map((c: any) => c.code);
    expect(codes).toContain('DE');
  });

  it('ATLAS-009 — marking the same region twice is idempotent', async () => {
    const { user } = createUser(testDb);

    await request(app)
      .post('/api/addons/atlas/region/DE-NW/mark')
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Nordrhein-Westfalen', country_code: 'DE' });

    const res = await request(app)
      .post('/api/addons/atlas/region/DE-NW/mark')
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Nordrhein-Westfalen', country_code: 'DE' });

    expect(res.status).toBe(200);
  });

  it('ATLAS-010 — GET /regions returns marked regions grouped by country', async () => {
    const { user } = createUser(testDb);

    await request(app)
      .post('/api/addons/atlas/region/DE-NW/mark')
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Nordrhein-Westfalen', country_code: 'DE' });

    await request(app)
      .post('/api/addons/atlas/region/DE-BY/mark')
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Bayern', country_code: 'DE' });

    const res = await request(app)
      .get('/api/addons/atlas/regions')
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('regions');
    const deRegions = res.body.regions['DE'] as any[];
    expect(deRegions).toBeDefined();
    const codes = deRegions.map((r: any) => r.code);
    expect(codes).toContain('DE-NW');
    expect(codes).toContain('DE-BY');
  });

  it('ATLAS-011 — DELETE /region/:code/mark unmarks a region', async () => {
    const { user } = createUser(testDb);

    await request(app)
      .post('/api/addons/atlas/region/DE-NW/mark')
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Nordrhein-Westfalen', country_code: 'DE' });

    const del = await request(app)
      .delete('/api/addons/atlas/region/DE-NW/mark')
      .set('Cookie', authCookie(user.id));

    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    const res = await request(app)
      .get('/api/addons/atlas/regions')
      .set('Cookie', authCookie(user.id));

    const deRegions = res.body.regions['DE'] as any[] | undefined;
    const codes = (deRegions || []).map((r: any) => r.code);
    expect(codes).not.toContain('DE-NW');
  });

  it('ATLAS-011 — unmark last region in country also unmarks the parent country', async () => {
    const { user } = createUser(testDb);

    await request(app)
      .post('/api/addons/atlas/region/DE-NW/mark')
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Nordrhein-Westfalen', country_code: 'DE' });

    await request(app)
      .delete('/api/addons/atlas/region/DE-NW/mark')
      .set('Cookie', authCookie(user.id));

    const stats = await request(app)
      .get('/api/addons/atlas/stats')
      .set('Cookie', authCookie(user.id));

    const codes = (stats.body.countries as any[]).map((c: any) => c.code);
    expect(codes).not.toContain('DE');
  });

  it('ATLAS-011 — unmark one region keeps country when another region remains', async () => {
    const { user } = createUser(testDb);

    await request(app)
      .post('/api/addons/atlas/region/DE-NW/mark')
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Nordrhein-Westfalen', country_code: 'DE' });

    await request(app)
      .post('/api/addons/atlas/region/DE-BY/mark')
      .set('Cookie', authCookie(user.id))
      .send({ name: 'Bayern', country_code: 'DE' });

    await request(app)
      .delete('/api/addons/atlas/region/DE-NW/mark')
      .set('Cookie', authCookie(user.id));

    const stats = await request(app)
      .get('/api/addons/atlas/stats')
      .set('Cookie', authCookie(user.id));

    const codes = (stats.body.countries as any[]).map((c: any) => c.code);
    expect(codes).toContain('DE');
  });

  it('ATLAS-011 — regions are isolated between users', async () => {
    const { user: user1 } = createUser(testDb);
    const { user: user2 } = createUser(testDb);

    await request(app)
      .post('/api/addons/atlas/region/DE-NW/mark')
      .set('Cookie', authCookie(user1.id))
      .send({ name: 'Nordrhein-Westfalen', country_code: 'DE' });

    const res = await request(app)
      .get('/api/addons/atlas/regions')
      .set('Cookie', authCookie(user2.id));

    expect(res.status).toBe(200);
    const deRegions = res.body.regions['DE'] as any[] | undefined;
    expect(deRegions).toBeUndefined();
  });
});
