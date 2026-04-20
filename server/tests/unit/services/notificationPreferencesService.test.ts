/**
 * Unit tests for notificationPreferencesService.
 * Covers NPREF-001 to NPREF-021.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';

const { testDb, dbMock } = vi.hoisted(() => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
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
  JWT_SECRET: 'test-jwt-secret-for-trek-testing-only',
  ENCRYPTION_KEY: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2',
  updateJwtSecret: () => {},
}));
vi.mock('../../../src/services/apiKeyCrypto', () => ({
  decrypt_api_key: (v: string | null) => v,
  maybe_encrypt_api_key: (v: string) => v,
  encrypt_api_key: (v: string) => v,
}));

import { createTables } from '../../../src/db/schema';
import { runMigrations } from '../../../src/db/migrations';
import { resetTestDb } from '../../helpers/test-db';
import { createUser, createAdmin, setAppSetting, setNotificationChannels, disableNotificationPref } from '../../helpers/factories';
import {
  isEnabledForEvent,
  getPreferencesMatrix,
  setPreferences,
  setAdminPreferences,
  getAdminGlobalPref,
  getActiveChannels,
  getAvailableChannels,
  isWebhookConfigured,
} from '../../../src/services/notificationPreferencesService';

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

// ─────────────────────────────────────────────────────────────────────────────
// isEnabledForEvent
// ─────────────────────────────────────────────────────────────────────────────

describe('isEnabledForEvent', () => {
  it('NPREF-001 — returns true when no row exists (default enabled)', () => {
    const { user } = createUser(testDb);
    expect(isEnabledForEvent(user.id, 'trip_invite', 'email')).toBe(true);
  });

  it('NPREF-002 — returns true when row exists with enabled=1', () => {
    const { user } = createUser(testDb);
    testDb.prepare(
      'INSERT INTO notification_channel_preferences (user_id, event_type, channel, enabled) VALUES (?, ?, ?, 1)'
    ).run(user.id, 'trip_invite', 'email');
    expect(isEnabledForEvent(user.id, 'trip_invite', 'email')).toBe(true);
  });

  it('NPREF-003 — returns false when row exists with enabled=0', () => {
    const { user } = createUser(testDb);
    disableNotificationPref(testDb, user.id, 'trip_invite', 'email');
    expect(isEnabledForEvent(user.id, 'trip_invite', 'email')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getPreferencesMatrix
// ─────────────────────────────────────────────────────────────────────────────

describe('getPreferencesMatrix', () => {
  it('NPREF-004 — regular user does not see version_available in event_types', () => {
    const { user } = createUser(testDb);
    const { event_types } = getPreferencesMatrix(user.id, 'user');
    expect(event_types).not.toContain('version_available');
    expect(event_types.length).toBe(9);
  });

  it('NPREF-005 — user scope excludes version_available for everyone including admins', () => {
    const { user } = createAdmin(testDb);
    const { event_types } = getPreferencesMatrix(user.id, 'admin', 'user');
    expect(event_types).not.toContain('version_available');
    expect(event_types.length).toBe(9);
  });

  it('NPREF-005b — admin scope returns only version_available', () => {
    const { user } = createAdmin(testDb);
    const { event_types } = getPreferencesMatrix(user.id, 'admin', 'admin');
    expect(event_types).toContain('version_available');
    expect(event_types.length).toBe(1);
  });

  it('NPREF-006 — returns default true for all preferences when no stored prefs', () => {
    const { user } = createUser(testDb);
    const { preferences } = getPreferencesMatrix(user.id, 'user');
    for (const [, channels] of Object.entries(preferences)) {
      for (const [, enabled] of Object.entries(channels as Record<string, boolean>)) {
        expect(enabled).toBe(true);
      }
    }
  });

  it('NPREF-007 — reflects stored disabled preferences in the matrix', () => {
    const { user } = createUser(testDb);
    disableNotificationPref(testDb, user.id, 'trip_invite', 'email');
    disableNotificationPref(testDb, user.id, 'collab_message', 'webhook');
    const { preferences } = getPreferencesMatrix(user.id, 'user');
    expect(preferences['trip_invite']!['email']).toBe(false);
    expect(preferences['collab_message']!['webhook']).toBe(false);
    // Others unaffected
    expect(preferences['trip_invite']!['webhook']).toBe(true);
    expect(preferences['booking_change']!['email']).toBe(true);
  });

  it('NPREF-008 — available_channels.inapp is always true', () => {
    const { user } = createUser(testDb);
    const { available_channels } = getPreferencesMatrix(user.id, 'user');
    expect(available_channels.inapp).toBe(true);
  });

  it('NPREF-009 — available_channels.email is true when email is in notification_channels', () => {
    const { user } = createUser(testDb);
    setNotificationChannels(testDb, 'email');
    const { available_channels } = getPreferencesMatrix(user.id, 'user');
    expect(available_channels.email).toBe(true);
  });

  it('NPREF-010 — available_channels.email is false when email is not in notification_channels', () => {
    const { user } = createUser(testDb);
    // No notification_channels set → defaults to none
    const { available_channels } = getPreferencesMatrix(user.id, 'user');
    expect(available_channels.email).toBe(false);
  });

  it('NPREF-011 — implemented_combos maps version_available to [inapp, email, webhook, ntfy]', () => {
    const { user } = createAdmin(testDb);
    const { implemented_combos } = getPreferencesMatrix(user.id, 'admin', 'admin');
    expect(implemented_combos['version_available']).toEqual(['inapp', 'email', 'webhook', 'ntfy']);
    // All events now support all four channels
    expect(implemented_combos['trip_invite']).toContain('inapp');
    expect(implemented_combos['trip_invite']).toContain('email');
    expect(implemented_combos['trip_invite']).toContain('webhook');
    expect(implemented_combos['trip_invite']).toContain('ntfy');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// setPreferences
// ─────────────────────────────────────────────────────────────────────────────

describe('setPreferences', () => {
  it('NPREF-012 — disabling a preference inserts a row with enabled=0', () => {
    const { user } = createUser(testDb);
    setPreferences(user.id, { trip_invite: { email: false } });
    const row = testDb.prepare(
      'SELECT enabled FROM notification_channel_preferences WHERE user_id = ? AND event_type = ? AND channel = ?'
    ).get(user.id, 'trip_invite', 'email') as { enabled: number } | undefined;
    expect(row).toBeDefined();
    expect(row!.enabled).toBe(0);
  });

  it('NPREF-013 — re-enabling a preference removes the disabled row', () => {
    const { user } = createUser(testDb);
    // First disable
    disableNotificationPref(testDb, user.id, 'trip_invite', 'email');
    // Then re-enable
    setPreferences(user.id, { trip_invite: { email: true } });
    const row = testDb.prepare(
      'SELECT enabled FROM notification_channel_preferences WHERE user_id = ? AND event_type = ? AND channel = ?'
    ).get(user.id, 'trip_invite', 'email');
    // Row should be deleted — default is enabled
    expect(row).toBeUndefined();
  });

  it('NPREF-014 — bulk update handles multiple event+channel combos', () => {
    const { user } = createUser(testDb);
    setPreferences(user.id, {
      trip_invite: { email: false, webhook: false },
      booking_change: { email: false },
      trip_reminder: { webhook: true },
    });
    expect(isEnabledForEvent(user.id, 'trip_invite', 'email')).toBe(false);
    expect(isEnabledForEvent(user.id, 'trip_invite', 'webhook')).toBe(false);
    expect(isEnabledForEvent(user.id, 'booking_change', 'email')).toBe(false);
    // trip_reminder webhook was set to true → no row, default enabled
    const row = testDb.prepare(
      'SELECT enabled FROM notification_channel_preferences WHERE user_id = ? AND event_type = ? AND channel = ?'
    ).get(user.id, 'trip_reminder', 'webhook');
    expect(row).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getActiveChannels
// ─────────────────────────────────────────────────────────────────────────────

describe('getActiveChannels', () => {
  it('NPREF-015 — returns [] when notification_channels is none', () => {
    setAppSetting(testDb, 'notification_channels', 'none');
    expect(getActiveChannels()).toEqual([]);
  });

  it('NPREF-016 — returns [email] when notification_channels is email', () => {
    setAppSetting(testDb, 'notification_channels', 'email');
    expect(getActiveChannels()).toEqual(['email']);
  });

  it('NPREF-017 — returns [email, webhook] when notification_channels is email,webhook', () => {
    setAppSetting(testDb, 'notification_channels', 'email,webhook');
    expect(getActiveChannels()).toEqual(['email', 'webhook']);
  });

  it('NPREF-018 — falls back to notification_channel (singular) when plural key absent', () => {
    // Only set the singular key
    setAppSetting(testDb, 'notification_channel', 'webhook');
    // No notification_channels key
    expect(getActiveChannels()).toEqual(['webhook']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getAvailableChannels
// ─────────────────────────────────────────────────────────────────────────────

describe('getAvailableChannels', () => {
  it('NPREF-019 — detects SMTP config from app_settings.smtp_host', () => {
    setAppSetting(testDb, 'smtp_host', 'mail.example.com');
    const channels = getAvailableChannels();
    expect(channels.email).toBe(true);
    expect(channels.inapp).toBe(true);
  });

  it('NPREF-020 — webhook available when admin has enabled the webhook channel', () => {
    setNotificationChannels(testDb, 'webhook');
    const channels = getAvailableChannels();
    expect(channels.webhook).toBe(true);
  });

  it('NPREF-021 — detects SMTP config from env var SMTP_HOST', () => {
    const original = process.env.SMTP_HOST;
    process.env.SMTP_HOST = 'env-mail.example.com';
    try {
      const channels = getAvailableChannels();
      expect(channels.email).toBe(true);
    } finally {
      if (original === undefined) delete process.env.SMTP_HOST;
      else process.env.SMTP_HOST = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// setAdminPreferences
// ─────────────────────────────────────────────────────────────────────────────

describe('setAdminPreferences', () => {
  it('NPREF-022 — disabling email for version_available stores global pref in app_settings', () => {
    const { user } = createAdmin(testDb);
    setAdminPreferences(user.id, { version_available: { email: false } });
    expect(getAdminGlobalPref('version_available', 'email')).toBe(false);
    const row = testDb.prepare("SELECT value FROM app_settings WHERE key = ?").get('admin_notif_pref_version_available_email') as { value: string } | undefined;
    expect(row?.value).toBe('0');
  });

  it('NPREF-023 — disabling inapp for version_available stores per-user row in notification_channel_preferences', () => {
    const { user } = createAdmin(testDb);
    setAdminPreferences(user.id, { version_available: { inapp: false } });
    const row = testDb.prepare(
      'SELECT enabled FROM notification_channel_preferences WHERE user_id = ? AND event_type = ? AND channel = ?'
    ).get(user.id, 'version_available', 'inapp') as { enabled: number } | undefined;
    expect(row).toBeDefined();
    expect(row!.enabled).toBe(0);
    // Global app_settings should NOT have an inapp key
    const globalRow = testDb.prepare("SELECT value FROM app_settings WHERE key = ?").get('admin_notif_pref_version_available_inapp');
    expect(globalRow).toBeUndefined();
  });

  it('NPREF-024 — re-enabling inapp removes the disabled per-user row', () => {
    const { user } = createAdmin(testDb);
    // First disable
    disableNotificationPref(testDb, user.id, 'version_available', 'inapp');
    // Then re-enable via setAdminPreferences
    setAdminPreferences(user.id, { version_available: { inapp: true } });
    const row = testDb.prepare(
      'SELECT enabled FROM notification_channel_preferences WHERE user_id = ? AND event_type = ? AND channel = ?'
    ).get(user.id, 'version_available', 'inapp');
    expect(row).toBeUndefined();
  });

  it('NPREF-025 — enabling email stores global pref as "1" in app_settings', () => {
    const { user } = createAdmin(testDb);
    // First disable, then re-enable
    setAdminPreferences(user.id, { version_available: { email: false } });
    setAdminPreferences(user.id, { version_available: { email: true } });
    expect(getAdminGlobalPref('version_available', 'email')).toBe(true);
    const row = testDb.prepare("SELECT value FROM app_settings WHERE key = ?").get('admin_notif_pref_version_available_email') as { value: string } | undefined;
    expect(row?.value).toBe('1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isWebhookConfigured
// ─────────────────────────────────────────────────────────────────────────────

describe('isWebhookConfigured', () => {
  it('NPREF-026 — returns false when webhook is not in active channels', () => {
    // No notification_channels configured → defaults don't include webhook
    expect(isWebhookConfigured()).toBe(false);
  });

  it('NPREF-027 — returns true when webhook is in active channels', () => {
    setNotificationChannels(testDb, 'webhook');
    expect(isWebhookConfigured()).toBe(true);
  });
});
