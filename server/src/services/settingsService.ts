import { db } from '../db/database';
import { decrypt_api_key, maybe_encrypt_api_key } from './apiKeyCrypto';

const ENCRYPTED_SETTING_KEYS = new Set(['webhook_url', 'ntfy_token', 'mapbox_access_token']);
// Encrypted keys that are masked (••••••••) when returned to the client.
// Keys not in this set but in ENCRYPTED_SETTING_KEYS are decrypted and returned.
const MASKED_SETTING_KEYS = new Set(['webhook_url', 'ntfy_token']);

export const DEFAULTABLE_USER_SETTING_KEYS = [
  'temperature_unit',
  'dark_mode',
  'time_format',
  'route_calculation',
  'blur_booking_codes',
  'map_tile_url',
] as const;

type DefaultableKey = typeof DEFAULTABLE_USER_SETTING_KEYS[number];

const VALID_VALUES: Partial<Record<DefaultableKey, unknown[]>> = {
  temperature_unit: ['fahrenheit', 'celsius'],
  time_format: ['12h', '24h'],
  dark_mode: [true, false, 'light', 'dark', 'auto'],
};

const BOOLEAN_KEYS = new Set<DefaultableKey>(['route_calculation', 'blur_booking_codes']);

function parseValue(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return raw; }
}

export function getAdminUserDefaults(): Record<string, unknown> {
  const rows = db.prepare(
    "SELECT key, value FROM app_settings WHERE key LIKE 'default_user_setting_%'"
  ).all() as { key: string; value: string }[];
  const defaults: Record<string, unknown> = {};
  for (const row of rows) {
    const settingKey = row.key.slice('default_user_setting_'.length);
    defaults[settingKey] = parseValue(row.value);
  }
  return defaults;
}

export function setAdminUserDefaults(partial: Record<string, unknown>): void {
  const upsert = db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  const del = db.prepare("DELETE FROM app_settings WHERE key = ?");

  db.exec('BEGIN');
  try {
    for (const [key, value] of Object.entries(partial)) {
      if (!(DEFAULTABLE_USER_SETTING_KEYS as readonly string[]).includes(key)) {
        throw new Error(`Invalid setting key: ${key}`);
      }
      const typedKey = key as DefaultableKey;
      const appKey = `default_user_setting_${key}`;

      // null/undefined means "reset to built-in default" — delete the row
      if (value === null || value === undefined) {
        del.run(appKey);
        continue;
      }

      if (BOOLEAN_KEYS.has(typedKey) && typeof value !== 'boolean') {
        throw new Error(`Setting ${key} must be a boolean`);
      }
      const allowed = VALID_VALUES[typedKey];
      if (allowed && !allowed.includes(value)) {
        throw new Error(`Invalid value for ${key}: ${value}`);
      }

      upsert.run(appKey, JSON.stringify(value));
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getUserSettings(userId: number): Record<string, unknown> {
  const adminDefaults = getAdminUserDefaults();

  const rows = db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(userId) as { key: string; value: string }[];
  const userSettings: Record<string, unknown> = {};
  for (const row of rows) {
    if (MASKED_SETTING_KEYS.has(row.key)) {
      userSettings[row.key] = row.value ? '••••••••' : '';
      continue;
    }
    if (ENCRYPTED_SETTING_KEYS.has(row.key)) {
      userSettings[row.key] = row.value ? (decrypt_api_key(row.value) ?? '') : '';
      continue;
    }
    try {
      userSettings[row.key] = JSON.parse(row.value);
    } catch {
      userSettings[row.key] = row.value;
    }
  }

  // Admin defaults fill in only for keys the user hasn't explicitly set
  return { ...adminDefaults, ...userSettings };
}

function serializeValue(key: string, value: unknown): string {
  const raw = typeof value === 'object' ? JSON.stringify(value) : String(value !== undefined ? value : '');
  if (ENCRYPTED_SETTING_KEYS.has(key)) return maybe_encrypt_api_key(raw) ?? raw;
  return raw;
}

export function upsertSetting(userId: number, key: string, value: unknown) {
  db.prepare(`
    INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
  `).run(userId, key, serializeValue(key, value));
}

export function bulkUpsertSettings(userId: number, settings: Record<string, unknown>) {
  const upsert = db.prepare(`
    INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
  `);
  db.exec('BEGIN');
  try {
    for (const [key, value] of Object.entries(settings)) {
      upsert.run(userId, key, serializeValue(key, value));
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return Object.keys(settings).length;
}
