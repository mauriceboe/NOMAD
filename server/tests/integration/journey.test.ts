/**
 * Journey API integration tests.
 * Covers JOURNEY-INT-001 through JOURNEY-INT-020.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Bare in-memory DB — schema applied in beforeAll after mocks register
// ─────────────────────────────────────────────────────────────────────────────
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
      const place: any = db.prepare(`
        SELECT p.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM places p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?
      `).get(placeId);
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
vi.mock('../../src/websocket', () => ({
  broadcast: vi.fn(),
  broadcastToUser: vi.fn(),
  setupWebSocket: vi.fn(),
  getOnlineUserIds: vi.fn(() => []),
}));
vi.mock('../../src/services/memories/immichService', () => ({
  uploadToImmich: vi.fn(async () => null),
  getImmichCredentials: vi.fn(() => null),
}));

import { createApp } from '../../src/app';
import { createTables } from '../../src/db/schema';
import { runMigrations } from '../../src/db/migrations';
import { resetTestDb } from '../helpers/test-db';
import {
  createUser,
  createAdmin,
  createTrip,
  createJourney,
  createJourneyEntry,
  addJourneyContributor,
} from '../helpers/factories';
import { authCookie } from '../helpers/auth';
import { loginAttempts, mfaAttempts } from '../../src/routes/auth';
import { invalidatePermissionsCache } from '../../src/services/permissions';

const app: Application = createApp();

beforeAll(() => { createTables(testDb); runMigrations(testDb); });
beforeEach(() => {
  resetTestDb(testDb);
  loginAttempts.clear();
  mfaAttempts.clear();
  invalidatePermissionsCache();
  // Enable the journey addon
  testDb.prepare(
    "INSERT OR REPLACE INTO addons (id, name, description, type, icon, enabled, sort_order) VALUES ('journey', 'Journey', 'Travel journal', 'global', 'Compass', 1, 35)"
  ).run();
});
afterAll(() => { testDb.close(); });

// ─────────────────────────────────────────────────────────────────────────────
// List journeys (JOURNEY-INT-001, 002)
// ─────────────────────────────────────────────────────────────────────────────

describe('List journeys', () => {
  it('JOURNEY-INT-001 — GET /api/journeys returns 200 with empty list initially', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .get('/api/journeys')
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.journeys).toEqual([]);
  });

  it('JOURNEY-INT-002 — GET /api/journeys returns 401 without auth', async () => {
    const res = await request(app).get('/api/journeys');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Create journey (JOURNEY-INT-003)
// ─────────────────────────────────────────────────────────────────────────────

describe('Create journey', () => {
  it('JOURNEY-INT-003 — POST /api/journeys creates a journey', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .post('/api/journeys')
      .set('Cookie', authCookie(user.id))
      .send({ title: 'Japan 2026', subtitle: 'Cherry blossom season' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Japan 2026');
    expect(res.body.subtitle).toBe('Cherry blossom season');
    expect(res.body.id).toBeDefined();

    // Should appear in listing now
    const list = await request(app)
      .get('/api/journeys')
      .set('Cookie', authCookie(user.id));
    expect(list.body.journeys).toHaveLength(1);
    expect(list.body.journeys[0].title).toBe('Japan 2026');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Get journey detail (JOURNEY-INT-004, 005)
// ─────────────────────────────────────────────────────────────────────────────

describe('Get journey detail', () => {
  it('JOURNEY-INT-004 — GET /api/journeys/:id returns full detail', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id, { title: 'Iceland' });

    const res = await request(app)
      .get(`/api/journeys/${journey.id}`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Iceland');
    expect(res.body.entries).toBeDefined();
    expect(res.body.contributors).toBeDefined();
    expect(res.body.stats).toBeDefined();
  });

  it('JOURNEY-INT-005 — GET /api/journeys/:id returns 404 for non-existent', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .get('/api/journeys/99999')
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Update journey (JOURNEY-INT-006)
// ─────────────────────────────────────────────────────────────────────────────

describe('Update journey', () => {
  it('JOURNEY-INT-006 — PATCH /api/journeys/:id updates journey', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id, { title: 'Draft' });

    const res = await request(app)
      .patch(`/api/journeys/${journey.id}`)
      .set('Cookie', authCookie(user.id))
      .send({ title: 'Updated Title', subtitle: 'New subtitle' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title');
    expect(res.body.subtitle).toBe('New subtitle');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Delete journey (JOURNEY-INT-007)
// ─────────────────────────────────────────────────────────────────────────────

describe('Delete journey', () => {
  it('JOURNEY-INT-007 — DELETE /api/journeys/:id deletes journey', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);

    const res = await request(app)
      .delete(`/api/journeys/${journey.id}`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify it's gone
    const get = await request(app)
      .get(`/api/journeys/${journey.id}`)
      .set('Cookie', authCookie(user.id));
    expect(get.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Journey trips (JOURNEY-INT-008, 009)
// ─────────────────────────────────────────────────────────────────────────────

describe('Journey trips', () => {
  it('JOURNEY-INT-008 — POST /api/journeys/:id/trips links a trip', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const trip = createTrip(testDb, user.id, { title: 'Paris', start_date: '2026-06-01', end_date: '2026-06-05' });

    const res = await request(app)
      .post(`/api/journeys/${journey.id}/trips`)
      .set('Cookie', authCookie(user.id))
      .send({ trip_id: trip.id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify trip appears in journey detail
    const detail = await request(app)
      .get(`/api/journeys/${journey.id}`)
      .set('Cookie', authCookie(user.id));
    expect(detail.body.trips).toHaveLength(1);
    expect(detail.body.trips[0].trip_id).toBe(trip.id);
  });

  it('JOURNEY-INT-009 — DELETE /api/journeys/:id/trips/:tripId unlinks trip', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const trip = createTrip(testDb, user.id, { title: 'Rome', start_date: '2026-07-01', end_date: '2026-07-03' });

    // Link via API first (avoids factory column mismatch)
    await request(app)
      .post(`/api/journeys/${journey.id}/trips`)
      .set('Cookie', authCookie(user.id))
      .send({ trip_id: trip.id });

    const res = await request(app)
      .delete(`/api/journeys/${journey.id}/trips/${trip.id}`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Journey entries (JOURNEY-INT-010, 011, 012)
// ─────────────────────────────────────────────────────────────────────────────

describe('Journey entries', () => {
  it('JOURNEY-INT-010 — POST /api/journeys/:id/entries creates an entry', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);

    const res = await request(app)
      .post(`/api/journeys/${journey.id}/entries`)
      .set('Cookie', authCookie(user.id))
      .send({
        title: 'First day in Tokyo',
        story: 'Arrived at Narita airport.',
        entry_date: '2026-04-01',
        entry_time: '14:00',
        location_name: 'Narita Airport',
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('First day in Tokyo');
    expect(res.body.entry_date).toBe('2026-04-01');
    expect(res.body.id).toBeDefined();
  });

  it('JOURNEY-INT-011 — PATCH /api/journeys/entries/:id updates entry', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, {
      title: 'Original',
      entry_date: '2026-04-01',
    });

    const res = await request(app)
      .patch(`/api/journeys/entries/${entry.id}`)
      .set('Cookie', authCookie(user.id))
      .send({ title: 'Updated entry title', story: 'Now with a story' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated entry title');
    expect(res.body.story).toBe('Now with a story');
  });

  it('JOURNEY-INT-012 — DELETE /api/journeys/entries/:id deletes entry', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, {
      title: 'To delete',
      entry_date: '2026-04-02',
    });

    const res = await request(app)
      .delete(`/api/journeys/entries/${entry.id}`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Contributors (JOURNEY-INT-013, 014)
// ─────────────────────────────────────────────────────────────────────────────

describe('Journey contributors', () => {
  it('JOURNEY-INT-013 — POST /api/journeys/:id/contributors adds a contributor', async () => {
    const { user: owner } = createUser(testDb);
    const { user: contributor } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);

    const res = await request(app)
      .post(`/api/journeys/${journey.id}/contributors`)
      .set('Cookie', authCookie(owner.id))
      .send({ user_id: contributor.id, role: 'editor' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Contributor should now be able to access the journey
    const detail = await request(app)
      .get(`/api/journeys/${journey.id}`)
      .set('Cookie', authCookie(contributor.id));
    expect(detail.status).toBe(200);
    expect(detail.body.title).toBeDefined();
  });

  it('JOURNEY-INT-014 — DELETE /api/journeys/:id/contributors/:userId removes contributor', async () => {
    const { user: owner } = createUser(testDb);
    const { user: contributor } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, contributor.id, 'editor');

    const res = await request(app)
      .delete(`/api/journeys/${journey.id}/contributors/${contributor.id}`)
      .set('Cookie', authCookie(owner.id));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Contributor should no longer access the journey
    const detail = await request(app)
      .get(`/api/journeys/${journey.id}`)
      .set('Cookie', authCookie(contributor.id));
    expect(detail.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Share link (JOURNEY-INT-015, 016, 017)
// ─────────────────────────────────────────────────────────────────────────────

describe('Journey share link', () => {
  it('JOURNEY-INT-015 — GET /api/journeys/:id/share-link returns null initially', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);

    const res = await request(app)
      .get(`/api/journeys/${journey.id}/share-link`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.link).toBeNull();
  });

  it('JOURNEY-INT-016 — POST /api/journeys/:id/share-link creates a share link', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);

    const res = await request(app)
      .post(`/api/journeys/${journey.id}/share-link`)
      .set('Cookie', authCookie(user.id))
      .send({ share_timeline: true, share_gallery: true, share_map: false });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    expect(res.body.created).toBe(true);

    // GET should now return the link
    const get = await request(app)
      .get(`/api/journeys/${journey.id}/share-link`)
      .set('Cookie', authCookie(user.id));
    expect(get.body.link).not.toBeNull();
    expect(get.body.link.token).toBe(res.body.token);
    expect(get.body.link.share_timeline).toBe(true);
    expect(get.body.link.share_gallery).toBe(true);
    expect(get.body.link.share_map).toBe(false);
  });

  it('JOURNEY-INT-017 — DELETE /api/journeys/:id/share-link deletes the share link', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);

    // Create first
    await request(app)
      .post(`/api/journeys/${journey.id}/share-link`)
      .set('Cookie', authCookie(user.id))
      .send({ share_timeline: true, share_gallery: true, share_map: true });

    // Delete
    const res = await request(app)
      .delete(`/api/journeys/${journey.id}/share-link`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify it's gone
    const get = await request(app)
      .get(`/api/journeys/${journey.id}/share-link`)
      .set('Cookie', authCookie(user.id));
    expect(get.body.link).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Permission checks (JOURNEY-INT-018, 019)
// ─────────────────────────────────────────────────────────────────────────────

describe('Journey permissions', () => {
  it('JOURNEY-INT-018 — contributor (viewer) can read but non-member cannot', async () => {
    const { user: owner } = createUser(testDb);
    const { user: viewer } = createUser(testDb);
    const { user: outsider } = createUser(testDb);
    const journey = createJourney(testDb, owner.id, { title: 'Private Journey' });
    addJourneyContributor(testDb, journey.id, viewer.id, 'viewer');

    // Viewer can read
    const viewerRes = await request(app)
      .get(`/api/journeys/${journey.id}`)
      .set('Cookie', authCookie(viewer.id));
    expect(viewerRes.status).toBe(200);
    expect(viewerRes.body.title).toBe('Private Journey');

    // Outsider cannot
    const outsiderRes = await request(app)
      .get(`/api/journeys/${journey.id}`)
      .set('Cookie', authCookie(outsider.id));
    expect(outsiderRes.status).toBe(404);
  });

  it('JOURNEY-INT-019 — non-owner cannot delete a journey', async () => {
    const { user: owner } = createUser(testDb);
    const { user: editor } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, editor.id, 'editor');

    // Editor can read
    const readRes = await request(app)
      .get(`/api/journeys/${journey.id}`)
      .set('Cookie', authCookie(editor.id));
    expect(readRes.status).toBe(200);

    // Editor cannot delete — only owner can
    const delRes = await request(app)
      .delete(`/api/journeys/${journey.id}`)
      .set('Cookie', authCookie(editor.id));
    expect(delRes.status).toBe(404);

    // Journey still exists
    const verify = await request(app)
      .get(`/api/journeys/${journey.id}`)
      .set('Cookie', authCookie(owner.id));
    expect(verify.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suggestions (JOURNEY-INT-020)
// ─────────────────────────────────────────────────────────────────────────────

describe('Journey suggestions', () => {
  it('JOURNEY-INT-020 — GET /api/journeys/suggestions returns trip suggestions', async () => {
    const { user } = createUser(testDb);

    // Create a recent trip so it shows up in suggestions
    createTrip(testDb, user.id, {
      title: 'Recent Trip',
      start_date: '2026-03-01',
      end_date: '2026-03-05',
    });

    const res = await request(app)
      .get('/api/journeys/suggestions')
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.trips).toBeDefined();
    expect(Array.isArray(res.body.trips)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Available trips (JOURNEY-INT-021)
// ─────────────────────────────────────────────────────────────────────────────

describe('Available trips', () => {
  it('JOURNEY-INT-021 — GET /api/journeys/available-trips returns user trips', async () => {
    const { user } = createUser(testDb);
    createTrip(testDb, user.id, { title: 'My Trip', start_date: '2026-05-01', end_date: '2026-05-03' });

    const res = await request(app)
      .get('/api/journeys/available-trips')
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.trips).toBeDefined();
    expect(Array.isArray(res.body.trips)).toBe(true);
    expect(res.body.trips.length).toBeGreaterThanOrEqual(1);
    expect(res.body.trips[0].title).toBe('My Trip');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Create journey validation (JOURNEY-INT-022)
// ─────────────────────────────────────────────────────────────────────────────

describe('Create journey validation', () => {
  it('JOURNEY-INT-022 — POST /api/journeys returns 400 without title', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .post('/api/journeys')
      .set('Cookie', authCookie(user.id))
      .send({ subtitle: 'No title provided' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Title is required');
  });

  it('JOURNEY-INT-023 — POST /api/journeys returns 400 for blank title', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .post('/api/journeys')
      .set('Cookie', authCookie(user.id))
      .send({ title: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Title is required');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Provider photos (JOURNEY-INT-024, 025, 026)
// ─────────────────────────────────────────────────────────────────────────────

describe('Provider photos', () => {
  it('JOURNEY-INT-024 — POST /api/journeys/entries/:id/provider-photos creates provider photo', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-04-01' });

    const res = await request(app)
      .post(`/api/journeys/entries/${entry.id}/provider-photos`)
      .set('Cookie', authCookie(user.id))
      .send({ provider: 'immich', asset_id: 'abc-123', caption: 'Nice view' });

    expect(res.status).toBe(201);
    expect(res.body.provider).toBe('immich');
    expect(res.body.asset_id).toBe('abc-123');
    expect(res.body.caption).toBe('Nice view');
  });

  it('JOURNEY-INT-025 — POST /api/journeys/entries/:id/provider-photos returns 400 without required fields', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-04-01' });

    const res = await request(app)
      .post(`/api/journeys/entries/${entry.id}/provider-photos`)
      .set('Cookie', authCookie(user.id))
      .send({ caption: 'Missing provider and asset_id' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('provider and asset_id required');
  });

  it('JOURNEY-INT-026 — POST /api/journeys/entries/:id/provider-photos returns 403 for viewer', async () => {
    const { user: owner } = createUser(testDb);
    const { user: viewer } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, viewer.id, 'viewer');
    const entry = createJourneyEntry(testDb, journey.id, owner.id, { entry_date: '2026-04-01' });

    const res = await request(app)
      .post(`/api/journeys/entries/${entry.id}/provider-photos`)
      .set('Cookie', authCookie(viewer.id))
      .send({ provider: 'immich', asset_id: 'xyz-456' });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Link photo to entry (JOURNEY-INT-027, 028)
// ─────────────────────────────────────────────────────────────────────────────

describe('Link photo to entry', () => {
  it('JOURNEY-INT-027 — POST /api/journeys/entries/:id/link-photo moves photo', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry1 = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-04-01' });
    const entry2 = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-04-02' });

    // Add a provider photo to entry1
    const photoRes = await request(app)
      .post(`/api/journeys/entries/${entry1.id}/provider-photos`)
      .set('Cookie', authCookie(user.id))
      .send({ provider: 'immich', asset_id: 'link-test-asset' });

    // Link it to entry2
    const res = await request(app)
      .post(`/api/journeys/entries/${entry2.id}/link-photo`)
      .set('Cookie', authCookie(user.id))
      .send({ photo_id: photoRes.body.id });

    expect(res.status).toBe(201);
    expect(res.body.entry_id).toBe(entry2.id);
  });

  it('JOURNEY-INT-028 — POST /api/journeys/entries/:id/link-photo returns 400 without photo_id', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-04-01' });

    const res = await request(app)
      .post(`/api/journeys/entries/${entry.id}/link-photo`)
      .set('Cookie', authCookie(user.id))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('photo_id required');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Update photo (JOURNEY-INT-029, 030)
// ─────────────────────────────────────────────────────────────────────────────

describe('Update photo', () => {
  it('JOURNEY-INT-029 — PATCH /api/journeys/photos/:id updates caption and sort_order', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-04-01' });

    // Add a provider photo first
    const photoRes = await request(app)
      .post(`/api/journeys/entries/${entry.id}/provider-photos`)
      .set('Cookie', authCookie(user.id))
      .send({ provider: 'immich', asset_id: 'update-test-asset' });

    const res = await request(app)
      .patch(`/api/journeys/photos/${photoRes.body.id}`)
      .set('Cookie', authCookie(user.id))
      .send({ caption: 'Updated caption', sort_order: 5 });

    expect(res.status).toBe(200);
    expect(res.body.caption).toBe('Updated caption');
    expect(res.body.sort_order).toBe(5);
  });

  it('JOURNEY-INT-030 — PATCH /api/journeys/photos/:id returns 404 for non-existent photo', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .patch('/api/journeys/photos/99999')
      .set('Cookie', authCookie(user.id))
      .send({ caption: 'No photo here' });

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Delete photo via route (JOURNEY-INT-031, 032)
// ─────────────────────────────────────────────────────────────────────────────

describe('Delete photo (route)', () => {
  it('JOURNEY-INT-031 — DELETE /api/journeys/photos/:id deletes photo', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-04-01' });

    const photoRes = await request(app)
      .post(`/api/journeys/entries/${entry.id}/provider-photos`)
      .set('Cookie', authCookie(user.id))
      .send({ provider: 'immich', asset_id: 'del-test-asset' });

    const res = await request(app)
      .delete(`/api/journeys/photos/${photoRes.body.id}`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('JOURNEY-INT-032 — DELETE /api/journeys/photos/:id returns 404 for non-existent', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .delete('/api/journeys/photos/99999')
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Journey entries sub-routes (JOURNEY-INT-033, 034)
// ─────────────────────────────────────────────────────────────────────────────

describe('Journey entries sub-routes', () => {
  it('JOURNEY-INT-033 — GET /api/journeys/:id/entries returns entries list', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    createJourneyEntry(testDb, journey.id, user.id, { title: 'Day 1', entry_date: '2026-04-01' });
    createJourneyEntry(testDb, journey.id, user.id, { title: 'Day 2', entry_date: '2026-04-02' });

    const res = await request(app)
      .get(`/api/journeys/${journey.id}/entries`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(2);
  });

  it('JOURNEY-INT-034 — GET /api/journeys/:id/entries returns 404 for inaccessible journey', async () => {
    const { user: owner } = createUser(testDb);
    const { user: outsider } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);

    const res = await request(app)
      .get(`/api/journeys/${journey.id}/entries`)
      .set('Cookie', authCookie(outsider.id));

    expect(res.status).toBe(404);
  });

  it('JOURNEY-INT-035 — POST /api/journeys/:id/entries returns 400 without entry_date', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);

    const res = await request(app)
      .post(`/api/journeys/${journey.id}/entries`)
      .set('Cookie', authCookie(user.id))
      .send({ title: 'Missing date' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('entry_date is required');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Update entry edge cases (JOURNEY-INT-036, 037)
// ─────────────────────────────────────────────────────────────────────────────

describe('Update entry edge cases', () => {
  it('JOURNEY-INT-036 — PATCH /api/journeys/entries/:id returns 404 for non-existent entry', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .patch('/api/journeys/entries/99999')
      .set('Cookie', authCookie(user.id))
      .send({ title: 'Does not exist' });

    expect(res.status).toBe(404);
  });

  it('JOURNEY-INT-037 — DELETE /api/journeys/entries/:id returns 404 for non-existent entry', async () => {
    const { user } = createUser(testDb);

    const res = await request(app)
      .delete('/api/journeys/entries/99999')
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Trip link validation (JOURNEY-INT-038, 039)
// ─────────────────────────────────────────────────────────────────────────────

describe('Trip link validation', () => {
  it('JOURNEY-INT-038 — POST /api/journeys/:id/trips returns 400 without trip_id', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);

    const res = await request(app)
      .post(`/api/journeys/${journey.id}/trips`)
      .set('Cookie', authCookie(user.id))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('trip_id required');
  });

  it('JOURNEY-INT-039 — DELETE /api/journeys/:id/trips/:tripId returns 403 for non-owner', async () => {
    const { user: owner } = createUser(testDb);
    const { user: editor } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, editor.id, 'editor');
    const trip = createTrip(testDb, owner.id, { title: 'Link Trip', start_date: '2026-06-01', end_date: '2026-06-03' });

    await request(app)
      .post(`/api/journeys/${journey.id}/trips`)
      .set('Cookie', authCookie(owner.id))
      .send({ trip_id: trip.id });

    const res = await request(app)
      .delete(`/api/journeys/${journey.id}/trips/${trip.id}`)
      .set('Cookie', authCookie(editor.id));

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Contributor routes (JOURNEY-INT-040, 041, 042)
// ─────────────────────────────────────────────────────────────────────────────

describe('Contributor route validation', () => {
  it('JOURNEY-INT-040 — POST /api/journeys/:id/contributors returns 400 without user_id', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);

    const res = await request(app)
      .post(`/api/journeys/${journey.id}/contributors`)
      .set('Cookie', authCookie(user.id))
      .send({ role: 'editor' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('user_id required');
  });

  it('JOURNEY-INT-041 — PATCH /api/journeys/:id/contributors/:userId updates role', async () => {
    const { user: owner } = createUser(testDb);
    const { user: contrib } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, contrib.id, 'viewer');

    const res = await request(app)
      .patch(`/api/journeys/${journey.id}/contributors/${contrib.id}`)
      .set('Cookie', authCookie(owner.id))
      .send({ role: 'editor' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('JOURNEY-INT-042 — PATCH /api/journeys/:id/contributors/:userId returns 403 for non-owner', async () => {
    const { user: owner } = createUser(testDb);
    const { user: editor } = createUser(testDb);
    const { user: target } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, editor.id, 'editor');
    addJourneyContributor(testDb, journey.id, target.id, 'viewer');

    const res = await request(app)
      .patch(`/api/journeys/${journey.id}/contributors/${target.id}`)
      .set('Cookie', authCookie(editor.id))
      .send({ role: 'editor' });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Share link with update (JOURNEY-INT-043, 044)
// ─────────────────────────────────────────────────────────────────────────────

describe('Share link update', () => {
  it('JOURNEY-INT-043 — POST /api/journeys/:id/share-link updates existing share link permissions', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);

    // Create initial share link
    const create = await request(app)
      .post(`/api/journeys/${journey.id}/share-link`)
      .set('Cookie', authCookie(user.id))
      .send({ share_timeline: true, share_gallery: true, share_map: true });

    expect(create.body.created).toBe(true);

    // Update permissions (same endpoint creates or updates)
    const update = await request(app)
      .post(`/api/journeys/${journey.id}/share-link`)
      .set('Cookie', authCookie(user.id))
      .send({ share_timeline: true, share_gallery: false, share_map: false });

    expect(update.status).toBe(200);
    expect(update.body.token).toBe(create.body.token);
    expect(update.body.created).toBe(false);

    // Verify updated permissions
    const get = await request(app)
      .get(`/api/journeys/${journey.id}/share-link`)
      .set('Cookie', authCookie(user.id));
    expect(get.body.link.share_timeline).toBe(true);
    expect(get.body.link.share_gallery).toBe(false);
    expect(get.body.link.share_map).toBe(false);
  });

  it('JOURNEY-INT-044 — journey PATCH /:id can update status', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);

    const res = await request(app)
      .patch(`/api/journeys/${journey.id}`)
      .set('Cookie', authCookie(user.id))
      .send({ status: 'archived' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('archived');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Photo upload without files (JOURNEY-INT-045)
// ─────────────────────────────────────────────────────────────────────────────

describe('Photo upload validation', () => {
  it('JOURNEY-INT-045 — POST /api/journeys/entries/:id/photos returns 400 without files', async () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-04-01' });

    const res = await request(app)
      .post(`/api/journeys/entries/${entry.id}/photos`)
      .set('Cookie', authCookie(user.id));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No files uploaded');
  });
});
