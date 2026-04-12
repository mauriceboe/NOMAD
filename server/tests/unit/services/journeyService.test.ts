/**
 * Unit tests for journeyService (JOURNEY-SVC-001 through JOURNEY-SVC-038).
 * Uses a real in-memory SQLite DB so SQL logic is exercised faithfully.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';

// -- DB setup -----------------------------------------------------------------

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
    canAccessTrip: () => null,
    isOwner: () => false,
  };
  return { testDb: db, dbMock: mock };
});

vi.mock('../../../src/db/database', () => dbMock);
vi.mock('../../../src/config', () => ({
  JWT_SECRET: 'test-secret',
  ENCRYPTION_KEY: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2',
  updateJwtSecret: () => {},
}));
vi.mock('../../../src/websocket', () => ({ broadcastToUser: vi.fn() }));

import { createTables } from '../../../src/db/schema';
import { runMigrations } from '../../../src/db/migrations';
import { resetTestDb } from '../../helpers/test-db';
import {
  createUser,
  createTrip,
  createJourney,
  createJourneyEntry,
  addJourneyContributor,
  createPlace,
  createDay,
  createDayAssignment,
  addTripPhoto,
} from '../../helpers/factories';
import {
  canAccessJourney,
  isOwner,
  canEdit,
  listJourneys,
  createJourney as svcCreateJourney,
  getJourneyFull,
  updateJourney,
  deleteJourney,
  addTripToJourney,
  removeTripFromJourney,
  listEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  addPhoto,
  addProviderPhoto,
  deletePhoto,
  addContributor,
  updateContributorRole,
  removeContributor,
  getSuggestions,
  syncTripPlaces,
  onPlaceCreated,
  onPlaceUpdated,
  onPlaceDeleted,
  linkPhotoToEntry,
  setPhotoProvider,
  updatePhoto,
  listUserTrips,
} from '../../../src/services/journeyService';

beforeAll(() => {
  createTables(testDb);
  runMigrations(testDb);
});

beforeEach(() => {
  resetTestDb(testDb);
});

afterAll(() => {
  testDb.close();
});

// -- Access control -----------------------------------------------------------

describe('canAccessJourney', () => {
  it('JOURNEY-SVC-001: returns journey for owner', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id, { title: 'My Journey' });

    const result = canAccessJourney(journey.id, user.id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(journey.id);
    expect(result!.title).toBe('My Journey');
  });

  it('JOURNEY-SVC-002: returns journey for contributor', () => {
    const { user: owner } = createUser(testDb);
    const { user: contrib } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, contrib.id, 'editor');

    const result = canAccessJourney(journey.id, contrib.id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(journey.id);
  });

  it('JOURNEY-SVC-003: returns null for stranger', () => {
    const { user: owner } = createUser(testDb);
    const { user: stranger } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);

    const result = canAccessJourney(journey.id, stranger.id);

    expect(result).toBeNull();
  });
});

describe('isOwner', () => {
  it('JOURNEY-SVC-004: returns true for owner', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);

    expect(isOwner(journey.id, user.id)).toBe(true);
  });

  it('JOURNEY-SVC-005: returns false for contributor', () => {
    const { user: owner } = createUser(testDb);
    const { user: contrib } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, contrib.id, 'editor');

    expect(isOwner(journey.id, contrib.id)).toBe(false);
  });

  it('JOURNEY-SVC-006: returns false for stranger', () => {
    const { user: owner } = createUser(testDb);
    const { user: stranger } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);

    expect(isOwner(journey.id, stranger.id)).toBe(false);
  });
});

describe('canEdit', () => {
  it('JOURNEY-SVC-007: owner can edit', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);

    expect(canEdit(journey.id, user.id)).toBe(true);
  });

  it('JOURNEY-SVC-008: editor contributor can edit', () => {
    const { user: owner } = createUser(testDb);
    const { user: editor } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, editor.id, 'editor');

    expect(canEdit(journey.id, editor.id)).toBe(true);
  });

  it('JOURNEY-SVC-009: viewer contributor cannot edit', () => {
    const { user: owner } = createUser(testDb);
    const { user: viewer } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, viewer.id, 'viewer');

    expect(canEdit(journey.id, viewer.id)).toBe(false);
  });

  it('JOURNEY-SVC-010: stranger cannot edit', () => {
    const { user: owner } = createUser(testDb);
    const { user: stranger } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);

    expect(canEdit(journey.id, stranger.id)).toBe(false);
  });
});

// -- Journey CRUD -------------------------------------------------------------

describe('listJourneys', () => {
  it('JOURNEY-SVC-011: returns owned journeys with counts', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id, { title: 'Road Trip' });
    createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-03-01', location_name: 'Paris' });
    createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-03-02', location_name: 'Lyon' });

    const result = listJourneys(user.id);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Road Trip');
    expect(result[0].entry_count).toBe(2);
    expect(result[0].city_count).toBe(2);
  });

  it('JOURNEY-SVC-012: includes journeys where user is contributor', () => {
    const { user: owner } = createUser(testDb);
    const { user: contrib } = createUser(testDb);
    const journey = createJourney(testDb, owner.id, { title: 'Shared Trip' });
    addJourneyContributor(testDb, journey.id, contrib.id, 'editor');

    const result = listJourneys(contrib.id);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Shared Trip');
  });

  it('JOURNEY-SVC-013: does not include other users journeys', () => {
    const { user: owner } = createUser(testDb);
    const { user: other } = createUser(testDb);
    createJourney(testDb, owner.id, { title: 'Private' });

    const result = listJourneys(other.id);

    expect(result).toHaveLength(0);
  });
});

describe('createJourney (service)', () => {
  it('JOURNEY-SVC-014: creates journey with contributor record', () => {
    const { user } = createUser(testDb);

    const journey = svcCreateJourney(user.id, { title: 'New Journey', subtitle: 'Subtitle' });

    expect(journey.title).toBe('New Journey');
    expect(journey.subtitle).toBe('Subtitle');
    expect(journey.user_id).toBe(user.id);
    expect(journey.status).toBe('active');

    // owner should be added as contributor
    const contrib = testDb.prepare(
      'SELECT * FROM journey_contributors WHERE journey_id = ? AND user_id = ?'
    ).get(journey.id, user.id) as { role: string } | undefined;
    expect(contrib).toBeDefined();
    expect(contrib!.role).toBe('owner');
  });

  it('JOURNEY-SVC-015: links trips when trip_ids provided', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { title: 'Paris 2026' });

    const journey = svcCreateJourney(user.id, { title: 'Euro Trip', trip_ids: [trip.id] });

    const link = testDb.prepare(
      'SELECT * FROM journey_trips WHERE journey_id = ? AND trip_id = ?'
    ).get(journey.id, trip.id);
    expect(link).toBeDefined();
  });
});

describe('getJourneyFull', () => {
  it('JOURNEY-SVC-016: returns full journey with entries, trips, contributors', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id, { title: 'Full Journey' });
    createJourneyEntry(testDb, journey.id, user.id, {
      title: 'Day 1',
      entry_date: '2026-03-01',
      story: 'Arrived!',
    });

    const result = getJourneyFull(journey.id, user.id);

    expect(result).not.toBeNull();
    expect(result!.title).toBe('Full Journey');
    expect(result!.entries).toHaveLength(1);
    expect(result!.entries[0].title).toBe('Day 1');
    expect(result!.contributors).toHaveLength(1);
    expect(result!.stats.entries).toBe(1);
  });

  it('JOURNEY-SVC-017: returns null for unauthorized user', () => {
    const { user: owner } = createUser(testDb);
    const { user: stranger } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);

    const result = getJourneyFull(journey.id, stranger.id);

    expect(result).toBeNull();
  });
});

describe('updateJourney', () => {
  it('JOURNEY-SVC-018: owner can update title and subtitle', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id, { title: 'Old Title' });

    const updated = updateJourney(journey.id, user.id, { title: 'New Title', subtitle: 'New Sub' });

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe('New Title');
    expect(updated!.subtitle).toBe('New Sub');
  });

  it('JOURNEY-SVC-019: editor contributor can update', () => {
    const { user: owner } = createUser(testDb);
    const { user: editor } = createUser(testDb);
    const journey = createJourney(testDb, owner.id, { title: 'Original' });
    addJourneyContributor(testDb, journey.id, editor.id, 'editor');

    const updated = updateJourney(journey.id, editor.id, { title: 'Edited' });

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe('Edited');
  });

  it('JOURNEY-SVC-020: viewer cannot update', () => {
    const { user: owner } = createUser(testDb);
    const { user: viewer } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, viewer.id, 'viewer');

    const result = updateJourney(journey.id, viewer.id, { title: 'Hacked' });

    expect(result).toBeNull();
  });

  it('JOURNEY-SVC-021: returns journey unchanged when no valid fields provided', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id, { title: 'Same' });

    const result = updateJourney(journey.id, user.id, {});

    expect(result).not.toBeNull();
    expect(result!.title).toBe('Same');
  });
});

describe('deleteJourney', () => {
  it('JOURNEY-SVC-022: owner can delete', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);

    const result = deleteJourney(journey.id, user.id);

    expect(result).toBe(true);
    const row = testDb.prepare('SELECT * FROM journeys WHERE id = ?').get(journey.id);
    expect(row).toBeUndefined();
  });

  it('JOURNEY-SVC-023: non-owner cannot delete', () => {
    const { user: owner } = createUser(testDb);
    const { user: editor } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, editor.id, 'editor');

    const result = deleteJourney(journey.id, editor.id);

    expect(result).toBe(false);
    const row = testDb.prepare('SELECT * FROM journeys WHERE id = ?').get(journey.id);
    expect(row).toBeDefined();
  });
});

// -- Trip management ----------------------------------------------------------

describe('addTripToJourney / removeTripFromJourney', () => {
  it('JOURNEY-SVC-024: links a trip to a journey', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const trip = createTrip(testDb, user.id, { title: 'Linked Trip' });

    const result = addTripToJourney(journey.id, trip.id, user.id);

    expect(result).toBe(true);
    const link = testDb.prepare(
      'SELECT * FROM journey_trips WHERE journey_id = ? AND trip_id = ?'
    ).get(journey.id, trip.id);
    expect(link).toBeDefined();
  });

  it('JOURNEY-SVC-025: syncs places as skeleton entries when linking a trip', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const trip = createTrip(testDb, user.id, {
      title: 'Trip with Places',
      start_date: '2026-03-01',
      end_date: '2026-03-03',
    });
    const place = createPlace(testDb, trip.id, { name: 'Eiffel Tower' });

    addTripToJourney(journey.id, trip.id, user.id);

    const skeletons = testDb.prepare(
      "SELECT * FROM journey_entries WHERE journey_id = ? AND source_place_id = ? AND type = 'skeleton'"
    ).all(journey.id, place.id);
    expect(skeletons.length).toBe(1);
  });

  it('JOURNEY-SVC-026: owner can remove a trip from journey', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const trip = createTrip(testDb, user.id, { title: 'Remove Me' });
    addTripToJourney(journey.id, trip.id, user.id);

    const result = removeTripFromJourney(journey.id, trip.id, user.id);

    expect(result).toBe(true);
    const link = testDb.prepare(
      'SELECT * FROM journey_trips WHERE journey_id = ? AND trip_id = ?'
    ).get(journey.id, trip.id);
    expect(link).toBeUndefined();
  });

  it('JOURNEY-SVC-027: non-owner cannot remove a trip', () => {
    const { user: owner } = createUser(testDb);
    const { user: editor } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    const trip = createTrip(testDb, owner.id, { title: 'Stay Linked' });
    addTripToJourney(journey.id, trip.id, owner.id);
    addJourneyContributor(testDb, journey.id, editor.id, 'editor');

    const result = removeTripFromJourney(journey.id, trip.id, editor.id);

    expect(result).toBe(false);
  });
});

// -- Entries ------------------------------------------------------------------

describe('listEntries', () => {
  it('JOURNEY-SVC-028: returns entries with photos for authorized user', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, {
      title: 'Morning Walk',
      entry_date: '2026-03-01',
    });

    const result = listEntries(journey.id, user.id);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].title).toBe('Morning Walk');
    expect(result![0].photos).toEqual([]);
  });

  it('JOURNEY-SVC-029: returns null for unauthorized user', () => {
    const { user: owner } = createUser(testDb);
    const { user: stranger } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);

    const result = listEntries(journey.id, stranger.id);

    expect(result).toBeNull();
  });
});

describe('createEntry', () => {
  it('JOURNEY-SVC-030: creates entry for editor', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);

    const entry = createEntry(journey.id, user.id, {
      title: 'Beach Day',
      entry_date: '2026-03-10',
      story: 'Beautiful sunset',
      mood: 'happy',
      weather: 'sunny',
      tags: ['beach', 'sunset'],
    });

    expect(entry).not.toBeNull();
    expect(entry!.title).toBe('Beach Day');
    expect(entry!.story).toBe('Beautiful sunset');
    expect(entry!.mood).toBe('happy');
    expect(entry!.type).toBe('entry');
    expect(entry!.author_id).toBe(user.id);
  });

  it('JOURNEY-SVC-031: viewer cannot create entry', () => {
    const { user: owner } = createUser(testDb);
    const { user: viewer } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, viewer.id, 'viewer');

    const entry = createEntry(journey.id, viewer.id, {
      title: 'Should Fail',
      entry_date: '2026-03-10',
    });

    expect(entry).toBeNull();
  });
});

describe('updateEntry', () => {
  it('JOURNEY-SVC-032: updates entry fields', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, {
      title: 'Old',
      entry_date: '2026-03-01',
    });

    const updated = updateEntry(entry.id, user.id, { title: 'Updated', mood: 'excited' });

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe('Updated');
    expect(updated!.mood).toBe('excited');
  });

  it('JOURNEY-SVC-033: promotes skeleton to entry when story is added', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, {
      type: 'skeleton',
      title: 'Placeholder',
      entry_date: '2026-03-01',
    });

    const updated = updateEntry(entry.id, user.id, { story: 'Now I have a story!' });

    expect(updated).not.toBeNull();
    expect(updated!.type).toBe('entry');
    expect(updated!.story).toBe('Now I have a story!');
  });

  it('JOURNEY-SVC-034: returns null for non-existent entry', () => {
    const { user } = createUser(testDb);

    const result = updateEntry(99999, user.id, { title: 'No Such Entry' });

    expect(result).toBeNull();
  });
});

describe('deleteEntry', () => {
  it('JOURNEY-SVC-035: deletes entry for editor', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-03-01' });

    const result = deleteEntry(entry.id, user.id);

    expect(result).toBe(true);
    const row = testDb.prepare('SELECT * FROM journey_entries WHERE id = ?').get(entry.id);
    expect(row).toBeUndefined();
  });

  it('JOURNEY-SVC-036: returns false for non-existent entry', () => {
    const { user } = createUser(testDb);

    expect(deleteEntry(99999, user.id)).toBe(false);
  });

  it('JOURNEY-SVC-037: viewer cannot delete entry', () => {
    const { user: owner } = createUser(testDb);
    const { user: viewer } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, viewer.id, 'viewer');
    const entry = createJourneyEntry(testDb, journey.id, owner.id, { entry_date: '2026-03-01' });

    expect(deleteEntry(entry.id, viewer.id)).toBe(false);
  });
});

// -- Photos -------------------------------------------------------------------

describe('addPhoto / addProviderPhoto / deletePhoto', () => {
  it('JOURNEY-SVC-038: addPhoto creates a local photo on an entry', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-03-01' });

    const photo = addPhoto(entry.id, user.id, '/uploads/photo.jpg', '/uploads/thumb.jpg', 'Sunset');

    expect(photo).not.toBeNull();
    expect(photo!.file_path).toBe('/uploads/photo.jpg');
    expect(photo!.thumbnail_path).toBe('/uploads/thumb.jpg');
    expect(photo!.caption).toBe('Sunset');
    expect(photo!.provider).toBe('local');
  });

  it('JOURNEY-SVC-039: addPhoto returns null for non-existent entry', () => {
    const { user } = createUser(testDb);

    const result = addPhoto(99999, user.id, '/uploads/photo.jpg');

    expect(result).toBeNull();
  });

  it('JOURNEY-SVC-040: addProviderPhoto creates a provider-backed photo', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-03-01' });

    const photo = addProviderPhoto(entry.id, user.id, 'immich', 'asset-123', 'My caption');

    expect(photo).not.toBeNull();
    expect(photo!.provider).toBe('immich');
    expect(photo!.asset_id).toBe('asset-123');
    expect(photo!.caption).toBe('My caption');
  });

  it('JOURNEY-SVC-041: addProviderPhoto skips duplicate asset', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-03-01' });

    addProviderPhoto(entry.id, user.id, 'immich', 'dup-asset');
    const duplicate = addProviderPhoto(entry.id, user.id, 'immich', 'dup-asset');

    expect(duplicate).toBeNull();
  });

  it('JOURNEY-SVC-042: deletePhoto removes photo and returns it', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-03-01' });
    const photo = addPhoto(entry.id, user.id, '/uploads/delete-me.jpg');

    const deleted = deletePhoto(photo!.id, user.id);

    expect(deleted).not.toBeNull();
    expect(deleted!.id).toBe(photo!.id);
    const row = testDb.prepare('SELECT * FROM journey_photos WHERE id = ?').get(photo!.id);
    expect(row).toBeUndefined();
  });

  it('JOURNEY-SVC-043: deletePhoto returns null for non-existent photo', () => {
    const { user } = createUser(testDb);

    expect(deletePhoto(99999, user.id)).toBeNull();
  });

  it('JOURNEY-SVC-044: viewer cannot add photo', () => {
    const { user: owner } = createUser(testDb);
    const { user: viewer } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, viewer.id, 'viewer');
    const entry = createJourneyEntry(testDb, journey.id, owner.id, { entry_date: '2026-03-01' });

    const result = addPhoto(entry.id, viewer.id, '/uploads/no.jpg');

    expect(result).toBeNull();
  });
});

// -- Contributors -------------------------------------------------------------

describe('addContributor / updateContributorRole / removeContributor', () => {
  it('JOURNEY-SVC-045: owner can add contributor', () => {
    const { user: owner } = createUser(testDb);
    const { user: newContrib } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);

    const result = addContributor(journey.id, owner.id, newContrib.id, 'editor');

    expect(result).toBe(true);
    const row = testDb.prepare(
      'SELECT * FROM journey_contributors WHERE journey_id = ? AND user_id = ?'
    ).get(journey.id, newContrib.id) as { role: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.role).toBe('editor');
  });

  it('JOURNEY-SVC-046: non-owner cannot add contributor', () => {
    const { user: owner } = createUser(testDb);
    const { user: editor } = createUser(testDb);
    const { user: newUser } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, editor.id, 'editor');

    const result = addContributor(journey.id, editor.id, newUser.id, 'viewer');

    expect(result).toBe(false);
  });

  it('JOURNEY-SVC-047: owner cannot add themselves as contributor', () => {
    const { user: owner } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);

    const result = addContributor(journey.id, owner.id, owner.id, 'editor');

    expect(result).toBe(false);
  });

  it('JOURNEY-SVC-048: owner can update contributor role', () => {
    const { user: owner } = createUser(testDb);
    const { user: contrib } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, contrib.id, 'viewer');

    const result = updateContributorRole(journey.id, owner.id, contrib.id, 'editor');

    expect(result).toBe(true);
    const row = testDb.prepare(
      'SELECT role FROM journey_contributors WHERE journey_id = ? AND user_id = ?'
    ).get(journey.id, contrib.id) as { role: string };
    expect(row.role).toBe('editor');
  });

  it('JOURNEY-SVC-049: non-owner cannot update contributor role', () => {
    const { user: owner } = createUser(testDb);
    const { user: editor } = createUser(testDb);
    const { user: target } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, editor.id, 'editor');
    addJourneyContributor(testDb, journey.id, target.id, 'viewer');

    const result = updateContributorRole(journey.id, editor.id, target.id, 'editor');

    expect(result).toBe(false);
  });

  it('JOURNEY-SVC-050: owner can remove contributor', () => {
    const { user: owner } = createUser(testDb);
    const { user: contrib } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, contrib.id, 'editor');

    const result = removeContributor(journey.id, owner.id, contrib.id);

    expect(result).toBe(true);
    const row = testDb.prepare(
      'SELECT * FROM journey_contributors WHERE journey_id = ? AND user_id = ?'
    ).get(journey.id, contrib.id);
    expect(row).toBeUndefined();
  });

  it('JOURNEY-SVC-051: removeContributor does not remove owner contributor record', () => {
    const { user: owner } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);

    // attempting to remove the owner's own contributor record should not work
    // (the SQL filters role != 'owner')
    removeContributor(journey.id, owner.id, owner.id);

    const row = testDb.prepare(
      'SELECT * FROM journey_contributors WHERE journey_id = ? AND user_id = ?'
    ).get(journey.id, owner.id);
    expect(row).toBeDefined();
  });
});

// -- Suggestions --------------------------------------------------------------

describe('getSuggestions', () => {
  it('JOURNEY-SVC-052: returns recently ended trips not yet in a journey', () => {
    const { user } = createUser(testDb);
    // Trip that ended 5 days ago (within 30-day window)
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    createTrip(testDb, user.id, {
      title: 'Recent Trip',
      start_date: tenDaysAgo,
      end_date: fiveDaysAgo,
    });

    const suggestions = getSuggestions(user.id);

    expect(suggestions.length).toBe(1);
    expect((suggestions[0] as any).title).toBe('Recent Trip');
  });

  it('JOURNEY-SVC-053: excludes trips already linked to a journey', () => {
    const { user } = createUser(testDb);
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const trip = createTrip(testDb, user.id, {
      title: 'Already Linked',
      start_date: tenDaysAgo,
      end_date: fiveDaysAgo,
    });
    const journey = createJourney(testDb, user.id);
    addTripToJourney(journey.id, trip.id, user.id);

    const suggestions = getSuggestions(user.id);

    expect(suggestions.length).toBe(0);
  });

  it('JOURNEY-SVC-054: excludes trips ending in the future', () => {
    const { user } = createUser(testDb);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    createTrip(testDb, user.id, {
      title: 'Future Trip',
      start_date: '2026-04-01',
      end_date: tomorrow,
    });

    const suggestions = getSuggestions(user.id);

    expect(suggestions.length).toBe(0);
  });
});

// -- syncTripPlaces ------------------------------------------------------------

describe('syncTripPlaces', () => {
  it('JOURNEY-SVC-055: creates skeleton entries for each trip place', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const trip = createTrip(testDb, user.id, {
      title: 'Sync Trip',
      start_date: '2026-05-01',
      end_date: '2026-05-03',
    });
    const place1 = createPlace(testDb, trip.id, { name: 'Eiffel Tower' });
    const place2 = createPlace(testDb, trip.id, { name: 'Louvre' });

    syncTripPlaces(journey.id, trip.id, user.id);

    const skeletons = testDb.prepare(
      "SELECT * FROM journey_entries WHERE journey_id = ? AND type = 'skeleton'"
    ).all(journey.id) as any[];
    expect(skeletons.length).toBe(2);
    const names = skeletons.map((s: any) => s.title).sort();
    expect(names).toEqual(['Eiffel Tower', 'Louvre']);
  });

  it('JOURNEY-SVC-056: skips places that already have skeleton entries', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const trip = createTrip(testDb, user.id, {
      title: 'Idempotent Trip',
      start_date: '2026-05-01',
      end_date: '2026-05-02',
    });
    createPlace(testDb, trip.id, { name: 'Notre Dame' });

    syncTripPlaces(journey.id, trip.id, user.id);
    syncTripPlaces(journey.id, trip.id, user.id); // second call

    const skeletons = testDb.prepare(
      "SELECT * FROM journey_entries WHERE journey_id = ? AND type = 'skeleton'"
    ).all(journey.id);
    expect(skeletons.length).toBe(1);
  });

  it('JOURNEY-SVC-057: uses day date for skeleton entry_date when available', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    // Trip with dates auto-creates days; grab an existing day to assign the place
    const trip = createTrip(testDb, user.id, {
      title: 'Dated Trip',
      start_date: '2026-06-10',
      end_date: '2026-06-12',
    });
    const day = testDb.prepare(
      "SELECT * FROM days WHERE trip_id = ? AND date = '2026-06-11'"
    ).get(trip.id) as { id: number };
    const place = createPlace(testDb, trip.id, { name: 'Colosseum' });
    createDayAssignment(testDb, day.id, place.id);

    syncTripPlaces(journey.id, trip.id, user.id);

    const skeleton = testDb.prepare(
      "SELECT * FROM journey_entries WHERE journey_id = ? AND source_place_id = ?"
    ).get(journey.id, place.id) as any;
    expect(skeleton).toBeDefined();
    expect(skeleton.entry_date).toBe('2026-06-11');
  });
});

// -- onPlaceCreated / onPlaceUpdated / onPlaceDeleted -------------------------

describe('onPlaceCreated', () => {
  it('JOURNEY-SVC-058: creates skeleton entry in linked journeys', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const trip = createTrip(testDb, user.id, {
      title: 'Webhook Trip',
      start_date: '2026-07-01',
      end_date: '2026-07-03',
    });
    addTripToJourney(journey.id, trip.id, user.id);

    // Create a new place after trip is linked
    const place = createPlace(testDb, trip.id, { name: 'Sagrada Familia' });
    onPlaceCreated(trip.id, place.id);

    const skeleton = testDb.prepare(
      "SELECT * FROM journey_entries WHERE journey_id = ? AND source_place_id = ? AND type = 'skeleton'"
    ).get(journey.id, place.id);
    expect(skeleton).toBeDefined();
  });

  it('JOURNEY-SVC-059: does nothing if trip is not linked to any journey', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { title: 'Unlinked Trip' });
    const place = createPlace(testDb, trip.id, { name: 'Remote Place' });

    onPlaceCreated(trip.id, place.id);

    const entries = testDb.prepare(
      "SELECT * FROM journey_entries WHERE source_place_id = ?"
    ).all(place.id);
    expect(entries.length).toBe(0);
  });

  it('JOURNEY-SVC-060: does not duplicate if skeleton already exists', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const trip = createTrip(testDb, user.id, {
      title: 'Dup Trip',
      start_date: '2026-07-01',
      end_date: '2026-07-02',
    });
    addTripToJourney(journey.id, trip.id, user.id);

    const place = createPlace(testDb, trip.id, { name: 'Arc de Triomphe' });
    onPlaceCreated(trip.id, place.id);
    onPlaceCreated(trip.id, place.id); // second call

    const entries = testDb.prepare(
      "SELECT * FROM journey_entries WHERE journey_id = ? AND source_place_id = ?"
    ).all(journey.id, place.id);
    expect(entries.length).toBe(1);
  });
});

describe('onPlaceUpdated', () => {
  it('JOURNEY-SVC-061: updates skeleton entry fields when place changes', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const trip = createTrip(testDb, user.id, {
      title: 'Update Place Trip',
      start_date: '2026-08-01',
      end_date: '2026-08-03',
    });
    const place = createPlace(testDb, trip.id, { name: 'Old Name' });
    addTripToJourney(journey.id, trip.id, user.id);

    // Update the place name directly in DB
    testDb.prepare('UPDATE places SET name = ?, address = ? WHERE id = ?').run('New Name', 'New Address', place.id);
    onPlaceUpdated(place.id);

    const entry = testDb.prepare(
      "SELECT * FROM journey_entries WHERE journey_id = ? AND source_place_id = ? AND type = 'skeleton'"
    ).get(journey.id, place.id) as any;
    expect(entry).toBeDefined();
    expect(entry.title).toBe('New Name');
    expect(entry.location_name).toBe('New Address');
  });

  it('JOURNEY-SVC-062: only updates location on filled entries, not title', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const trip = createTrip(testDb, user.id, {
      title: 'Filled Entry Trip',
      start_date: '2026-08-01',
      end_date: '2026-08-02',
    });
    const place = createPlace(testDb, trip.id, { name: 'Original Place' });
    addTripToJourney(journey.id, trip.id, user.id);

    // Promote the skeleton to a full entry
    const skeleton = testDb.prepare(
      "SELECT id FROM journey_entries WHERE journey_id = ? AND source_place_id = ?"
    ).get(journey.id, place.id) as { id: number };
    updateEntry(skeleton.id, user.id, { story: 'My story', title: 'Custom Title' });

    // Now update the place
    testDb.prepare('UPDATE places SET name = ?, address = ? WHERE id = ?').run('Changed Place', 'Changed Addr', place.id);
    onPlaceUpdated(place.id);

    const entry = testDb.prepare(
      "SELECT * FROM journey_entries WHERE id = ?"
    ).get(skeleton.id) as any;
    expect(entry.title).toBe('Custom Title'); // title unchanged
    expect(entry.location_name).toBe('Changed Addr'); // location updated
  });

  it('JOURNEY-SVC-063: does nothing if place has no linked entries', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { title: 'Orphan Trip' });
    const place = createPlace(testDb, trip.id, { name: 'Orphan Place' });

    // Should not throw
    onPlaceUpdated(place.id);

    const entries = testDb.prepare(
      "SELECT * FROM journey_entries WHERE source_place_id = ?"
    ).all(place.id);
    expect(entries.length).toBe(0);
  });
});

describe('onPlaceDeleted', () => {
  it('JOURNEY-SVC-064: deletes empty skeleton entries', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const trip = createTrip(testDb, user.id, {
      title: 'Delete Place Trip',
      start_date: '2026-09-01',
      end_date: '2026-09-02',
    });
    const place = createPlace(testDb, trip.id, { name: 'To Be Deleted' });
    addTripToJourney(journey.id, trip.id, user.id);

    onPlaceDeleted(place.id);

    const entry = testDb.prepare(
      "SELECT * FROM journey_entries WHERE source_place_id = ?"
    ).get(place.id);
    expect(entry).toBeUndefined();
  });

  it('JOURNEY-SVC-065: detaches filled entries and adds note instead of deleting', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const trip = createTrip(testDb, user.id, {
      title: 'Detach Trip',
      start_date: '2026-09-01',
      end_date: '2026-09-02',
    });
    const place = createPlace(testDb, trip.id, { name: 'Detach Place' });
    addTripToJourney(journey.id, trip.id, user.id);

    // Promote the skeleton to a filled entry
    const skeleton = testDb.prepare(
      "SELECT id FROM journey_entries WHERE journey_id = ? AND source_place_id = ?"
    ).get(journey.id, place.id) as { id: number };
    updateEntry(skeleton.id, user.id, { story: 'I really enjoyed this place' });

    onPlaceDeleted(place.id);

    const entry = testDb.prepare(
      "SELECT * FROM journey_entries WHERE id = ?"
    ).get(skeleton.id) as any;
    expect(entry).toBeDefined();
    expect(entry.source_place_id).toBeNull();
    expect(entry.source_trip_id).toBeNull();
    expect(entry.story).toContain('original trip place was removed');
  });

  it('JOURNEY-SVC-066: does nothing for unlinked places', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { title: 'Unlinked' });
    const place = createPlace(testDb, trip.id, { name: 'Nowhere' });

    // Should not throw
    onPlaceDeleted(place.id);
  });
});

// -- linkPhotoToEntry ----------------------------------------------------------

describe('linkPhotoToEntry', () => {
  it('JOURNEY-SVC-067: moves photo from one entry to another', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry1 = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-03-01' });
    const entry2 = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-03-02' });

    const photo = addPhoto(entry1.id, user.id, '/uploads/link-test.jpg');
    expect(photo).not.toBeNull();

    const result = linkPhotoToEntry(entry2.id, photo!.id, user.id);
    expect(result).not.toBeNull();
    expect(result!.entry_id).toBe(entry2.id);
  });

  it('JOURNEY-SVC-068: returns same photo if already on target entry', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-03-01' });
    const photo = addPhoto(entry.id, user.id, '/uploads/same-entry.jpg');

    const result = linkPhotoToEntry(entry.id, photo!.id, user.id);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(photo!.id);
    expect(result!.entry_id).toBe(entry.id);
  });

  it('JOURNEY-SVC-069: returns null for non-existent entry', () => {
    const { user } = createUser(testDb);

    const result = linkPhotoToEntry(99999, 1, user.id);
    expect(result).toBeNull();
  });

  it('JOURNEY-SVC-070: returns null for non-existent photo', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-03-01' });

    const result = linkPhotoToEntry(entry.id, 99999, user.id);
    expect(result).toBeNull();
  });

  it('JOURNEY-SVC-071: viewer cannot link photo', () => {
    const { user: owner } = createUser(testDb);
    const { user: viewer } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, viewer.id, 'viewer');
    const entry = createJourneyEntry(testDb, journey.id, owner.id, { entry_date: '2026-03-01' });
    const photo = addPhoto(entry.id, owner.id, '/uploads/owner-photo.jpg');

    const result = linkPhotoToEntry(entry.id, photo!.id, viewer.id);
    expect(result).toBeNull();
  });
});

// -- setPhotoProvider ----------------------------------------------------------

describe('setPhotoProvider', () => {
  it('JOURNEY-SVC-072: sets provider info on an existing photo', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-03-01' });
    const photo = addPhoto(entry.id, user.id, '/uploads/provider-test.jpg');

    setPhotoProvider(photo!.id, 'immich', 'immich-asset-789', user.id);

    const updated = testDb.prepare('SELECT * FROM journey_photos WHERE id = ?').get(photo!.id) as any;
    expect(updated.provider).toBe('immich');
    expect(updated.asset_id).toBe('immich-asset-789');
    expect(updated.owner_id).toBe(user.id);
  });
});

// -- updatePhoto ---------------------------------------------------------------

describe('updatePhoto', () => {
  it('JOURNEY-SVC-073: updates caption on photo', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-03-01' });
    const photo = addPhoto(entry.id, user.id, '/uploads/caption-test.jpg', undefined, 'Old caption');

    const result = updatePhoto(photo!.id, user.id, { caption: 'New caption' });

    expect(result).not.toBeNull();
    expect(result!.caption).toBe('New caption');
  });

  it('JOURNEY-SVC-074: updates sort_order on photo', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-03-01' });
    const photo = addPhoto(entry.id, user.id, '/uploads/sort-test.jpg');

    const result = updatePhoto(photo!.id, user.id, { sort_order: 10 });

    expect(result).not.toBeNull();
    expect(result!.sort_order).toBe(10);
  });

  it('JOURNEY-SVC-075: returns null for non-existent photo', () => {
    const { user } = createUser(testDb);

    const result = updatePhoto(99999, user.id, { caption: 'Nope' });
    expect(result).toBeNull();
  });

  it('JOURNEY-SVC-076: returns photo unchanged when no fields provided', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-03-01' });
    const photo = addPhoto(entry.id, user.id, '/uploads/noop-test.jpg', undefined, 'Stay');

    const result = updatePhoto(photo!.id, user.id, {});

    expect(result).not.toBeNull();
    expect(result!.caption).toBe('Stay');
  });

  it('JOURNEY-SVC-077: viewer cannot update photo', () => {
    const { user: owner } = createUser(testDb);
    const { user: viewer } = createUser(testDb);
    const journey = createJourney(testDb, owner.id);
    addJourneyContributor(testDb, journey.id, viewer.id, 'viewer');
    const entry = createJourneyEntry(testDb, journey.id, owner.id, { entry_date: '2026-03-01' });
    const photo = addPhoto(entry.id, owner.id, '/uploads/viewer-update.jpg');

    const result = updatePhoto(photo!.id, viewer.id, { caption: 'Hacked' });
    expect(result).toBeNull();
  });
});

// -- listUserTrips -------------------------------------------------------------

describe('listUserTrips', () => {
  it('JOURNEY-SVC-078: returns all user trips', () => {
    const { user } = createUser(testDb);
    createTrip(testDb, user.id, { title: 'Trip A', start_date: '2026-01-01', end_date: '2026-01-03' });
    createTrip(testDb, user.id, { title: 'Trip B', start_date: '2026-02-01', end_date: '2026-02-03' });

    const trips = listUserTrips(user.id);

    expect(trips.length).toBe(2);
    // ordered by start_date DESC
    expect((trips[0] as any).title).toBe('Trip B');
    expect((trips[1] as any).title).toBe('Trip A');
  });

  it('JOURNEY-SVC-079: returns empty for user with no trips', () => {
    const { user } = createUser(testDb);

    const trips = listUserTrips(user.id);

    expect(trips.length).toBe(0);
  });

  it('JOURNEY-SVC-080: does not return other users trips', () => {
    const { user: user1 } = createUser(testDb);
    const { user: user2 } = createUser(testDb);
    createTrip(testDb, user1.id, { title: 'User1 Trip' });

    const trips = listUserTrips(user2.id);

    expect(trips.length).toBe(0);
  });
});

// -- Edge cases ----------------------------------------------------------------

describe('Edge cases', () => {
  it('JOURNEY-SVC-081: deleteEntry moves photos to Gallery entry instead of deleting them', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-03-01' });
    const photo = addPhoto(entry.id, user.id, '/uploads/gallery-move.jpg');

    const result = deleteEntry(entry.id, user.id);
    expect(result).toBe(true);

    // Photo should still exist, moved to a Gallery entry
    const movedPhoto = testDb.prepare('SELECT * FROM journey_photos WHERE id = ?').get(photo!.id) as any;
    expect(movedPhoto).toBeDefined();
    expect(movedPhoto.entry_id).not.toBe(entry.id);

    const galleryEntry = testDb.prepare('SELECT * FROM journey_entries WHERE id = ?').get(movedPhoto.entry_id) as any;
    expect(galleryEntry.title).toBe('Gallery');
  });

  it('JOURNEY-SVC-082: updateJourney can set cover_gradient', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);

    const result = updateJourney(journey.id, user.id, { cover_gradient: 'linear-gradient(to right, #ff0000, #0000ff)' });

    expect(result).not.toBeNull();
    expect((result as any).cover_gradient).toBe('linear-gradient(to right, #ff0000, #0000ff)');
  });

  it('JOURNEY-SVC-083: updateJourney ignores unknown fields', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id, { title: 'Original' });

    const result = updateJourney(journey.id, user.id, { bogus: 'field' } as any);

    expect(result).not.toBeNull();
    expect(result!.title).toBe('Original');
  });

  it('JOURNEY-SVC-084: createEntry stores tags and pros_cons as JSON', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);

    const entry = createEntry(journey.id, user.id, {
      entry_date: '2026-03-10',
      tags: ['food', 'culture'],
      pros_cons: { pros: ['Great view'], cons: ['Expensive'] },
    });

    expect(entry).not.toBeNull();
    // Read raw from DB
    const raw = testDb.prepare('SELECT tags, pros_cons FROM journey_entries WHERE id = ?').get(entry!.id) as any;
    expect(JSON.parse(raw.tags)).toEqual(['food', 'culture']);
    expect(JSON.parse(raw.pros_cons)).toEqual({ pros: ['Great view'], cons: ['Expensive'] });
  });

  it('JOURNEY-SVC-085: updateEntry handles tags and pros_cons update', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const entry = createJourneyEntry(testDb, journey.id, user.id, { entry_date: '2026-03-01' });

    const result = updateEntry(entry.id, user.id, {
      tags: ['beach', 'adventure'],
      pros_cons: { pros: ['Fun'], cons: [] },
    });

    expect(result).not.toBeNull();
    const raw = testDb.prepare('SELECT tags, pros_cons FROM journey_entries WHERE id = ?').get(entry.id) as any;
    expect(JSON.parse(raw.tags)).toEqual(['beach', 'adventure']);
    expect(JSON.parse(raw.pros_cons)).toEqual({ pros: ['Fun'], cons: [] });
  });

  it('JOURNEY-SVC-086: addTripToJourney syncs trip photos when present', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const trip = createTrip(testDb, user.id, {
      title: 'Photo Trip',
      start_date: '2026-04-01',
      end_date: '2026-04-03',
    });
    addTripPhoto(testDb, trip.id, user.id, 'immich-photo-1', 'immich', { shared: true });

    addTripToJourney(journey.id, trip.id, user.id);

    // Should have a [Trip Photos] entry with the imported photo
    const photoEntry = testDb.prepare(
      "SELECT * FROM journey_entries WHERE journey_id = ? AND title = '[Trip Photos]'"
    ).get(journey.id) as any;
    expect(photoEntry).toBeDefined();

    const photos = testDb.prepare(
      'SELECT * FROM journey_photos WHERE entry_id = ?'
    ).all(photoEntry.id);
    expect(photos.length).toBe(1);
    expect((photos[0] as any).asset_id).toBe('immich-photo-1');
  });

  it('JOURNEY-SVC-087: removeTripFromJourney detaches filled entries, deletes skeletons', () => {
    const { user } = createUser(testDb);
    const journey = createJourney(testDb, user.id);
    const trip = createTrip(testDb, user.id, {
      title: 'Mixed Trip',
      start_date: '2026-04-01',
      end_date: '2026-04-03',
    });
    const place1 = createPlace(testDb, trip.id, { name: 'Skeleton Place' });
    const place2 = createPlace(testDb, trip.id, { name: 'Filled Place' });
    addTripToJourney(journey.id, trip.id, user.id);

    // Promote one skeleton to a filled entry
    const filled = testDb.prepare(
      "SELECT id FROM journey_entries WHERE journey_id = ? AND source_place_id = ? AND type = 'skeleton'"
    ).get(journey.id, place2.id) as { id: number };
    updateEntry(filled.id, user.id, { story: 'Now filled!' });

    removeTripFromJourney(journey.id, trip.id, user.id);

    // skeleton for place1 should be deleted
    const skeletonRow = testDb.prepare(
      "SELECT * FROM journey_entries WHERE journey_id = ? AND source_place_id = ?"
    ).get(journey.id, place1.id);
    expect(skeletonRow).toBeUndefined();

    // filled entry for place2 should be detached but still present
    const filledRow = testDb.prepare(
      "SELECT * FROM journey_entries WHERE id = ?"
    ).get(filled.id) as any;
    expect(filledRow).toBeDefined();
    expect(filledRow.source_trip_id).toBeNull();
    expect(filledRow.source_place_id).toBeNull();
  });
});
