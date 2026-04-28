/**
 * Unit tests for tripService — exportICS function (TRIP-SVC-001 through TRIP-SVC-009).
 * Uses a real in-memory SQLite DB so SQL logic is exercised faithfully.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';

// ── DB setup ──────────────────────────────────────────────────────────────────

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

import { createTables } from '../../../src/db/schema';
import { runMigrations } from '../../../src/db/migrations';
import { resetTestDb } from '../../helpers/test-db';
import { createUser, createTrip, createReservation, createPlace, createDay, createDayAssignment, createDayNote } from '../../helpers/factories';
import { exportICS, generateDays } from '../../../src/services/tripService';

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDays(tripId: number) {
  return testDb.prepare('SELECT * FROM days WHERE trip_id = ? ORDER BY day_number').all(tripId) as {
    id: number; trip_id: number; day_number: number; date: string | null;
  }[];
}

function getAssignments(dayId: number) {
  return testDb.prepare('SELECT * FROM day_assignments WHERE day_id = ?').all(dayId) as { id: number; day_id: number }[];
}

function getNotes(dayId: number) {
  return testDb.prepare('SELECT * FROM day_notes WHERE day_id = ?').all(dayId) as { id: number; day_id: number }[];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generateDays', () => {
  it('TRIP-SVC-010: full range shift preserves day assignments and notes positionally', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { start_date: '2025-06-01', end_date: '2025-06-05' });
    const daysBefore = getDays(trip.id);
    expect(daysBefore).toHaveLength(5);

    const place = createPlace(testDb, trip.id);
    const assignment = createDayAssignment(testDb, daysBefore[0].id, place.id);
    const note = createDayNote(testDb, daysBefore[1].id, trip.id, { text: 'packed' });

    // Shift forward 9 days — zero overlap with original dates
    generateDays(trip.id, '2025-06-10', '2025-06-14');

    const daysAfter = getDays(trip.id);
    expect(daysAfter).toHaveLength(5);
    expect(daysAfter.map(d => d.date)).toEqual([
      '2025-06-10', '2025-06-11', '2025-06-12', '2025-06-13', '2025-06-14',
    ]);

    // day_number 1 (formerly June 1) now has date June 10 — assignment still attached
    const day1 = daysAfter[0];
    const day2 = daysAfter[1];
    expect(getAssignments(day1.id)).toHaveLength(1);
    expect(getAssignments(day1.id)[0].id).toBe(assignment.id);
    expect(getNotes(day2.id)).toHaveLength(1);
    expect(getNotes(day2.id)[0].id).toBe(note.id);
  });

  it('TRIP-SVC-011: shrinking range deletes overflow days and their assignments (issue #909)', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { start_date: '2025-07-01', end_date: '2025-07-05' });
    const daysBefore = getDays(trip.id);
    expect(daysBefore).toHaveLength(5);

    const place = createPlace(testDb, trip.id);
    createDayAssignment(testDb, daysBefore[3].id, place.id);
    createDayAssignment(testDb, daysBefore[4].id, place.id);

    // Shrink from 5 to 3 days — surplus days and their content are removed
    generateDays(trip.id, '2025-07-01', '2025-07-03');

    const daysAfter = getDays(trip.id);
    expect(daysAfter).toHaveLength(3);
    expect(daysAfter.map(d => d.date)).toEqual(['2025-07-01', '2025-07-02', '2025-07-03']);
  });

  it('TRIP-SVC-016: shrinking range deletes empty overflow days (issue #909)', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { start_date: '2025-07-01', end_date: '2025-07-07' });
    expect(getDays(trip.id)).toHaveLength(7);

    // Shrink 7 → 5; days 6 and 7 have no content
    generateDays(trip.id, '2025-07-01', '2025-07-05');

    const daysAfter = getDays(trip.id);
    expect(daysAfter).toHaveLength(5);
    expect(daysAfter.map(d => d.date)).toEqual([
      '2025-07-01', '2025-07-02', '2025-07-03', '2025-07-04', '2025-07-05',
    ]);
  });

  it('TRIP-SVC-012: growing range keeps existing day content and appends new empty days', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { start_date: '2025-08-01', end_date: '2025-08-03' });
    const daysBefore = getDays(trip.id);
    expect(daysBefore).toHaveLength(3);

    const place = createPlace(testDb, trip.id);
    const assignment = createDayAssignment(testDb, daysBefore[0].id, place.id);

    // Grow to 5 days
    generateDays(trip.id, '2025-08-01', '2025-08-05');

    const daysAfter = getDays(trip.id);
    expect(daysAfter).toHaveLength(5);
    expect(daysAfter.map(d => d.date)).toEqual([
      '2025-08-01', '2025-08-02', '2025-08-03', '2025-08-04', '2025-08-05',
    ]);

    // Existing day 1 retains its assignment
    expect(getAssignments(daysAfter[0].id)).toHaveLength(1);
    expect(getAssignments(daysAfter[0].id)[0].id).toBe(assignment.id);

    // New days 4 and 5 are empty
    expect(getAssignments(daysAfter[3].id)).toHaveLength(0);
    expect(getAssignments(daysAfter[4].id)).toHaveLength(0);
  });

  it('TRIP-SVC-013: clearing dates converts all days to dateless without destroying assignments', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { start_date: '2025-09-01', end_date: '2025-09-04' });
    const daysBefore = getDays(trip.id);
    expect(daysBefore).toHaveLength(4);

    const place = createPlace(testDb, trip.id);
    const assignment = createDayAssignment(testDb, daysBefore[1].id, place.id);

    // Clear both dates
    generateDays(trip.id, null, null);

    const daysAfter = getDays(trip.id);
    expect(daysAfter).toHaveLength(4);
    expect(daysAfter.every(d => d.date === null)).toBe(true);

    // The assignment on the former day 2 still exists
    const formerDay2 = daysAfter.find(d => d.id === daysBefore[1].id);
    expect(formerDay2).toBeDefined();
    expect(getAssignments(formerDay2!.id)).toHaveLength(1);
    expect(getAssignments(formerDay2!.id)[0].id).toBe(assignment.id);
  });

  it('TRIP-SVC-014: partial overlap shift remaps by position (day 1→3 kept, 4-5 overflow)', () => {
    // Original: Jun 1-5. New: Jun 3-7 (overlap on Jun 3-5, but we map by position)
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { start_date: '2025-10-01', end_date: '2025-10-05' });
    const daysBefore = getDays(trip.id);
    const place = createPlace(testDb, trip.id);
    // Assign to each of the 5 days
    for (const day of daysBefore) createDayAssignment(testDb, day.id, place.id);

    // Shift forward 2 days (partial overlap with original range)
    generateDays(trip.id, '2025-10-03', '2025-10-07');

    const daysAfter = getDays(trip.id);
    expect(daysAfter).toHaveLength(5);
    expect(daysAfter.map(d => d.date)).toEqual([
      '2025-10-03', '2025-10-04', '2025-10-05', '2025-10-06', '2025-10-07',
    ]);

    // All 5 assignments survive
    for (const day of daysAfter) {
      expect(getAssignments(day.id)).toHaveLength(1);
    }
  });

  it('TRIP-SVC-015: growing into dateless days reuses them; leftover dateless renumber without UNIQUE collision', () => {
    // 3 dated days + 2 pre-existing dateless days. Resize to 4 dated days.
    // Main loop: dated[0..2] → positions 1-3, dateless[0] → position 4 (consumed).
    // Unused dateless: dateless[1] should land at position 5, NOT 4 (collision bug).
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { start_date: '2025-11-01', end_date: '2025-11-03' });

    // Insert 2 dateless days directly
    const daysBefore = getDays(trip.id);
    testDb.prepare('INSERT INTO days (trip_id, day_number, date) VALUES (?, ?, NULL)').run(trip.id, 4);
    testDb.prepare('INSERT INTO days (trip_id, day_number, date) VALUES (?, ?, NULL)').run(trip.id, 5);

    const allDays = getDays(trip.id);
    expect(allDays).toHaveLength(5);

    const place = createPlace(testDb, trip.id);
    // Put an assignment on the second dateless day (day_number=5) — it should survive
    const assignment = createDayAssignment(testDb, allDays[4].id, place.id);

    // Grow from 3 to 4 dated days — consumes dateless[0], leaves dateless[1] unused
    // This is the scenario that triggered the UNIQUE collision bug
    generateDays(trip.id, '2025-11-01', '2025-11-04');

    const daysAfter = getDays(trip.id);
    expect(daysAfter).toHaveLength(5);

    const dated = daysAfter.filter(d => d.date !== null);
    const dateless = daysAfter.filter(d => d.date === null);
    expect(dated).toHaveLength(4);
    expect(dateless).toHaveLength(1);

    // The remaining dateless day still has its assignment
    expect(getAssignments(dateless[0].id)).toHaveLength(1);
    expect(getAssignments(dateless[0].id)[0].id).toBe(assignment.id);

    // All day_numbers are unique 1..5
    const nums = daysAfter.map(d => d.day_number).sort((a, b) => a - b);
    expect(nums).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('exportICS', () => {
  it('TRIP-SVC-001: returns VCALENDAR wrapper', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, {
      title: 'My Vacation',
      start_date: '2025-06-01',
      end_date: '2025-06-07',
    });

    const { ics } = exportICS(trip.id);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('TRIP-SVC-002: trip with start_date + end_date includes all-day VEVENT', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, {
      title: 'Summer Holiday',
      start_date: '2025-06-01',
      end_date: '2025-06-07',
    });

    const { ics } = exportICS(trip.id);

    expect(ics).toContain('DTSTART;VALUE=DATE:20250601');
    expect(ics).toContain('SUMMARY:Summer Holiday');
  });

  it('TRIP-SVC-003: reservation with full datetime (includes T) → DTSTART without VALUE=DATE', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { title: 'Paris Trip' });
    const reservation = createReservation(testDb, trip.id, {
      title: 'Morning Flight',
      type: 'flight',
    });
    testDb
      .prepare('UPDATE reservations SET reservation_time=? WHERE id=?')
      .run('2025-06-02T09:00', reservation.id);

    const { ics } = exportICS(trip.id);

    expect(ics).toContain('DTSTART:20250602T090000');
    expect(ics).not.toContain('DTSTART;VALUE=DATE');
  });

  it('TRIP-SVC-004: reservation with date-only → DTSTART;VALUE=DATE', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { title: 'Paris Trip' });
    const reservation = createReservation(testDb, trip.id, {
      title: 'Hotel Check-in',
      type: 'hotel',
    });
    testDb
      .prepare('UPDATE reservations SET reservation_time=? WHERE id=?')
      .run('2025-06-02', reservation.id);

    const { ics } = exportICS(trip.id);

    expect(ics).toContain('DTSTART;VALUE=DATE:20250602');
  });

  it('TRIP-SVC-005: reservation metadata with flight info appears in DESCRIPTION', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { title: 'Paris Trip' });
    const reservation = createReservation(testDb, trip.id, {
      title: 'CDG to JFK',
      type: 'flight',
    });
    testDb
      .prepare('UPDATE reservations SET reservation_time=?, metadata=? WHERE id=?')
      .run(
        '2025-06-02T09:00',
        JSON.stringify({
          airline: 'Air Test',
          flight_number: 'AT100',
          departure_airport: 'CDG',
          arrival_airport: 'JFK',
        }),
        reservation.id
      );

    const { ics } = exportICS(trip.id);

    expect(ics).toContain('Airline: Air Test');
    expect(ics).toContain('Flight: AT100');
  });

  it('TRIP-SVC-006: special characters in title are escaped', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { title: 'Trip; First, Best' });

    const { ics } = exportICS(trip.id);

    expect(ics).toContain('Trip\\; First\\, Best');
  });

  it('TRIP-SVC-007: throws NotFoundError for non-existent trip', () => {
    expect(() => exportICS(99999)).toThrow();
  });

  it('TRIP-SVC-008: returns a filename derived from trip title', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { title: 'My Trip 2025' });

    const { filename } = exportICS(trip.id);

    expect(filename).toMatch(/My.Trip.2025\.ics/);
  });

  it('TRIP-SVC-009: reservation with end time includes DTEND', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { title: 'Paris Trip' });
    const reservation = createReservation(testDb, trip.id, {
      title: 'Afternoon Tour',
      type: 'activity',
    });
    testDb
      .prepare('UPDATE reservations SET reservation_time=?, reservation_end_time=? WHERE id=?')
      .run('2025-06-02T14:00', '2025-06-02T16:00', reservation.id);

    const { ics } = exportICS(trip.id);

    expect(ics).toContain('DTEND:20250602T160000');
  });
});
