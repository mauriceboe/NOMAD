/**
 * In-memory SQLite test database helper.
 *
 * Usage in an integration test file:
 *
 *   import { createTestDb, resetTestDb } from '../helpers/test-db';
 *   import { buildDbMock } from '../helpers/test-db';
 *
 *   // Declare at module scope (before vi.mock so it's available in factory)
 *   const testDb = createTestDb();
 *
 *   vi.mock('../../src/db/database', () => buildDbMock(testDb));
 *   vi.mock('../../src/config', () => TEST_CONFIG);
 *
 *   beforeEach(() => resetTestDb(testDb));
 *   afterAll(() => testDb.close());
 */

import Database from 'better-sqlite3';
import { createTables } from '../../src/db/schema';
import { runMigrations } from '../../src/db/migrations';

// Tables to clear on reset, child-before-parent to be safe (FK checks are OFF during reset).
// Keep in sync with schema.ts + migrations.ts. Intentionally excluded: categories, addons,
// photo_providers, photo_provider_fields, schema_version (seed/config data, not user data).
const RESET_TABLES = [
  // Collab
  'file_links',
  'collab_message_reactions',
  'collab_poll_votes',
  'collab_messages',
  'collab_polls',
  'collab_notes',
  // Day content
  'day_notes',
  'todo_category_assignees',
  'todo_items',
  'assignment_participants',
  'day_assignments',
  // Places
  'place_regions',
  'place_tags',
  'places',
  // Packing
  'packing_category_assignees',
  'packing_bag_members',
  'packing_bags',
  'packing_template_items',
  'packing_template_categories',
  'packing_templates',
  'packing_items',
  // Budget
  'budget_item_members',
  'budget_items',
  // Photos & files
  'trip_photos',
  'trip_album_links',
  'trip_files',
  'photos',
  // Reservations
  'reservation_day_positions',
  'reservations',
  // Accommodations & days
  'day_accommodations',
  'days',
  // Trip
  'share_tokens',
  'trip_members',
  'trips',
  // Journey
  'journey_share_tokens',
  'journey_photos',
  'journey_entries',
  'journey_contributors',
  'journey_trips',
  'journeys',
  // Vacay
  'vacay_entries',
  'vacay_company_holidays',
  'vacay_holiday_calendars',
  'vacay_plan_members',
  'vacay_user_colors',
  'vacay_user_years',
  'vacay_years',
  'vacay_plans',
  // Atlas
  'visited_regions',
  'visited_countries',
  'bucket_list',
  // Notifications & audit
  'notification_channel_preferences',
  'notifications',
  'audit_log',
  // User data
  'settings',
  'mcp_tokens',
  'invite_tokens',
  'tags',
  'app_settings',
  'users',
];

const DEFAULT_CATEGORIES = [
  { name: 'Hotel', color: '#3b82f6', icon: '🏨' },
  { name: 'Restaurant', color: '#ef4444', icon: '🍽️' },
  { name: 'Attraction', color: '#8b5cf6', icon: '🏛️' },
  { name: 'Shopping', color: '#f59e0b', icon: '🛍️' },
  { name: 'Transport', color: '#6b7280', icon: '🚌' },
  { name: 'Activity', color: '#10b981', icon: '🎯' },
  { name: 'Bar/Cafe', color: '#f97316', icon: '☕' },
  { name: 'Beach', color: '#06b6d4', icon: '🏖️' },
  { name: 'Nature', color: '#84cc16', icon: '🌿' },
  { name: 'Other', color: '#6366f1', icon: '📍' },
];

const DEFAULT_ADDONS = [
  { id: 'packing',   name: 'Packing List',    description: 'Pack your bags',            type: 'trip',        icon: 'ListChecks',  enabled: 1, sort_order: 0  },
  { id: 'budget',    name: 'Budget Planner',  description: 'Track expenses',             type: 'trip',        icon: 'Wallet',      enabled: 1, sort_order: 1  },
  { id: 'documents', name: 'Documents',       description: 'Manage travel documents',    type: 'trip',        icon: 'FileText',    enabled: 1, sort_order: 2  },
  { id: 'vacay',     name: 'Vacay',           description: 'Vacation day planner',       type: 'global',      icon: 'CalendarDays',enabled: 1, sort_order: 10 },
  { id: 'atlas',     name: 'Atlas',           description: 'Visited countries map',      type: 'global',      icon: 'Globe',       enabled: 1, sort_order: 11 },
  { id: 'mcp',       name: 'MCP',             description: 'AI assistant integration',   type: 'integration', icon: 'Terminal',    enabled: 0, sort_order: 12 },
  { id: 'collab',    name: 'Collab',          description: 'Notes, polls, live chat',    type: 'trip',        icon: 'Users',       enabled: 1, sort_order: 6  },
];

const DEFAULT_PHOTO_PROVIDERS = [
  { id: 'immich',         name: 'Immich',          enabled: 1 },
  { id: 'synologyphotos', name: 'Synology Photos',  enabled: 1 },
];

function seedDefaults(db: Database.Database): void {
  const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, color, icon) VALUES (?, ?, ?)');
  for (const cat of DEFAULT_CATEGORIES) insertCat.run(cat.name, cat.color, cat.icon);

  const insertAddon = db.prepare('INSERT OR IGNORE INTO addons (id, name, description, type, icon, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const a of DEFAULT_ADDONS) insertAddon.run(a.id, a.name, a.description, a.type, a.icon, a.enabled, a.sort_order);

  try {
    const insertProvider = db.prepare('INSERT OR IGNORE INTO photo_providers (id, name, description, icon, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    for (const p of DEFAULT_PHOTO_PROVIDERS) insertProvider.run(p.id, p.name, p.id, 'Image', p.enabled, 0);
  } catch { /* table may not exist in very old schemas */ }
}

/**
 * Creates a fresh in-memory SQLite database with the full schema and migrations applied.
 * Default categories and addons are seeded. No users are created.
 */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA foreign_keys = ON');
  createTables(db);
  runMigrations(db);
  seedDefaults(db);
  return db;
}

/**
 * Clears all user-generated data from the test DB and re-seeds defaults.
 * Call in beforeEach() for test isolation within a file.
 */
export function resetTestDb(db: Database.Database): void {
  db.exec('PRAGMA foreign_keys = OFF');
  const existingTables = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(r => r.name)
  );
  for (const table of RESET_TABLES) {
    if (existingTables.has(table)) {
      db.exec(`DELETE FROM "${table}"`);
    }
  }
  db.exec('PRAGMA foreign_keys = ON');
  seedDefaults(db);
}

/**
 * Returns the mock factory for vi.mock('../../src/db/database', ...).
 * The returned object mirrors the shape of database.ts exports.
 *
 * @example
 *   const testDb = createTestDb();
 *   vi.mock('../../src/db/database', () => buildDbMock(testDb));
 */
export function buildDbMock(testDb: Database.Database) {
  return {
    db: testDb,
    closeDb: () => {},
    reinitialize: () => {},
    getPlaceWithTags: (placeId: number | string) => {
      interface PlaceRow {
        id: number;
        category_id: number | null;
        category_name: string | null;
        category_color: string | null;
        category_icon: string | null;
        [key: string]: unknown;
      }
      const place = testDb.prepare(`
        SELECT p.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM places p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
      `).get(placeId) as PlaceRow | undefined;

      if (!place) return null;

      const tags = testDb.prepare(`
        SELECT t.* FROM tags t
        JOIN place_tags pt ON t.id = pt.tag_id
        WHERE pt.place_id = ?
      `).all(placeId);

      return {
        ...place,
        category: place.category_id ? {
          id: place.category_id,
          name: place.category_name,
          color: place.category_color,
          icon: place.category_icon,
        } : null,
        tags,
      };
    },
    canAccessTrip: (tripId: number | string, userId: number) => {
      return testDb.prepare(`
        SELECT t.id, t.user_id FROM trips t
        LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ?
        WHERE t.id = ? AND (t.user_id = ? OR m.user_id IS NOT NULL)
      `).get(userId, tripId, userId);
    },
    isOwner: (tripId: number | string, userId: number) => {
      return !!testDb.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(tripId, userId);
    },
  };
}

/** Fixed config mock — use with vi.mock('../../src/config', () => TEST_CONFIG) */
export const TEST_CONFIG = {
  JWT_SECRET: 'test-jwt-secret-for-trek-testing-only',
  ENCRYPTION_KEY: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2',
  updateJwtSecret: () => {},
};
