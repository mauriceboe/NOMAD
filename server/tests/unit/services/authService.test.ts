import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/db/database', () => ({
  db: { prepare: () => ({ get: vi.fn(), all: vi.fn(), run: vi.fn() }) },
  canAccessTrip: vi.fn(),
}));
vi.mock('../../../src/config', () => ({ JWT_SECRET: 'test-secret', ENCRYPTION_KEY: '0'.repeat(64) }));
vi.mock('../../../src/services/mfaCrypto', () => ({ encryptMfaSecret: vi.fn(), decryptMfaSecret: vi.fn() }));
vi.mock('../../../src/services/apiKeyCrypto', () => ({
  decrypt_api_key: vi.fn((v) => v),
  maybe_encrypt_api_key: vi.fn((v) => v),
  encrypt_api_key: vi.fn((v) => v),
}));
vi.mock('../../../src/services/permissions', () => ({ getAllPermissions: vi.fn(() => ({})), checkPermission: vi.fn() }));
vi.mock('../../../src/services/ephemeralTokens', () => ({ createEphemeralToken: vi.fn() }));
vi.mock('../../../src/mcp', () => ({ revokeUserSessions: vi.fn() }));
vi.mock('../../../src/scheduler', () => ({ startTripReminders: vi.fn(), buildCronExpression: vi.fn() }));

import {
  utcSuffix,
  stripUserForClient,
  maskKey,
  avatarUrl,
  normalizeBackupCode,
  hashBackupCode,
  generateBackupCodes,
  parseBackupCodeHashes,
} from '../../../src/services/authService';
import type { User } from '../../../src/types';

// ── utcSuffix ────────────────────────────────────────────────────────────────

describe('utcSuffix', () => {
  it('returns null for null', () => {
    expect(utcSuffix(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(utcSuffix(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(utcSuffix('')).toBeNull();
  });

  it('returns timestamp unchanged when already ending with Z', () => {
    expect(utcSuffix('2024-01-01T12:00:00Z')).toBe('2024-01-01T12:00:00Z');
  });

  it('replaces space with T and appends Z for SQLite-style datetime', () => {
    expect(utcSuffix('2024-01-01 12:00:00')).toBe('2024-01-01T12:00:00Z');
  });

  it('appends Z when T is present but Z is missing', () => {
    expect(utcSuffix('2024-06-15T08:30:00')).toBe('2024-06-15T08:30:00Z');
  });
});

// ── stripUserForClient ───────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    role: 'user',
    password_hash: 'supersecret',
    maps_api_key: 'maps-key',
    openweather_api_key: 'weather-key',
    unsplash_api_key: 'unsplash-key',
    mfa_secret: 'totpsecret',
    mfa_backup_codes: '["hash1","hash2"]',
    mfa_enabled: 0,
    must_change_password: 0,
    avatar: null,
    created_at: '2024-01-01 00:00:00',
    updated_at: '2024-06-01 00:00:00',
    last_login: null,
    ...overrides,
  } as unknown as User;
}

describe('stripUserForClient', () => {
  it('SEC-008: omits password_hash', () => {
    const result = stripUserForClient(makeUser());
    expect(result).not.toHaveProperty('password_hash');
  });

  it('SEC-008: omits maps_api_key', () => {
    const result = stripUserForClient(makeUser());
    expect(result).not.toHaveProperty('maps_api_key');
  });

  it('SEC-008: omits openweather_api_key', () => {
    const result = stripUserForClient(makeUser());
    expect(result).not.toHaveProperty('openweather_api_key');
  });

  it('SEC-008: omits unsplash_api_key', () => {
    const result = stripUserForClient(makeUser());
    expect(result).not.toHaveProperty('unsplash_api_key');
  });

  it('SEC-008: omits mfa_secret', () => {
    const result = stripUserForClient(makeUser());
    expect(result).not.toHaveProperty('mfa_secret');
  });

  it('SEC-008: omits mfa_backup_codes', () => {
    const result = stripUserForClient(makeUser());
    expect(result).not.toHaveProperty('mfa_backup_codes');
  });

  it('preserves non-sensitive fields', () => {
    const result = stripUserForClient(makeUser({ username: 'alice', email: 'alice@example.com', role: 'user' }));
    expect(result.id).toBe(1);
    expect(result.username).toBe('alice');
    expect(result.email).toBe('alice@example.com');
    expect(result.role).toBe('user');
  });

  it('normalizes mfa_enabled integer 1 to true', () => {
    const result = stripUserForClient(makeUser({ mfa_enabled: 1 } as any));
    expect(result.mfa_enabled).toBe(true);
  });

  it('normalizes mfa_enabled integer 0 to false', () => {
    const result = stripUserForClient(makeUser({ mfa_enabled: 0 } as any));
    expect(result.mfa_enabled).toBe(false);
  });

  it('normalizes mfa_enabled boolean true to true', () => {
    const result = stripUserForClient(makeUser({ mfa_enabled: true } as any));
    expect(result.mfa_enabled).toBe(true);
  });

  it('normalizes must_change_password integer 1 to true', () => {
    const result = stripUserForClient(makeUser({ must_change_password: 1 } as any));
    expect(result.must_change_password).toBe(true);
  });

  it('normalizes must_change_password integer 0 to false', () => {
    const result = stripUserForClient(makeUser({ must_change_password: 0 } as any));
    expect(result.must_change_password).toBe(false);
  });

  it('converts created_at through utcSuffix', () => {
    const result = stripUserForClient(makeUser({ created_at: '2024-01-01 00:00:00' }));
    expect(result.created_at).toBe('2024-01-01T00:00:00Z');
  });

  it('converts updated_at through utcSuffix', () => {
    const result = stripUserForClient(makeUser({ updated_at: '2024-06-01 12:00:00' }));
    expect(result.updated_at).toBe('2024-06-01T12:00:00Z');
  });

  it('passes null last_login through as null', () => {
    const result = stripUserForClient(makeUser({ last_login: null }));
    expect(result.last_login).toBeNull();
  });
});

// ── maskKey ──────────────────────────────────────────────────────────────────

describe('maskKey', () => {
  it('returns null for null', () => {
    expect(maskKey(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(maskKey(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(maskKey('')).toBeNull();
  });

  it('returns -------- for keys with 8 or fewer characters', () => {
    expect(maskKey('abcd1234')).toBe('--------');
    expect(maskKey('short')).toBe('--------');
    expect(maskKey('a')).toBe('--------');
  });

  it('returns ---- + last 4 chars for keys longer than 8 characters', () => {
    expect(maskKey('abcdefghijkl')).toBe('----ijkl');
    expect(maskKey('sk-test-12345678')).toBe('----5678');
  });
});

// ── avatarUrl ────────────────────────────────────────────────────────────────

describe('avatarUrl', () => {
  it('returns /uploads/avatars/<filename> when avatar is set', () => {
    expect(avatarUrl({ avatar: 'photo.jpg' })).toBe('/uploads/avatars/photo.jpg');
  });

  it('returns null when avatar is null', () => {
    expect(avatarUrl({ avatar: null })).toBeNull();
  });

  it('returns null when avatar is undefined', () => {
    expect(avatarUrl({})).toBeNull();
  });
});

// ── normalizeBackupCode ──────────────────────────────────────────────────────

describe('normalizeBackupCode', () => {
  it('uppercases the input', () => {
    expect(normalizeBackupCode('abcd1234')).toBe('ABCD1234');
  });

  it('strips non-alphanumeric characters', () => {
    expect(normalizeBackupCode('AB-CD 12!34')).toBe('ABCD1234');
  });

  it('handles code with dashes (normal backup code format)', () => {
    expect(normalizeBackupCode('A1B2-C3D4')).toBe('A1B2C3D4');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeBackupCode('')).toBe('');
  });
});

// ── hashBackupCode ───────────────────────────────────────────────────────────

describe('hashBackupCode', () => {
  it('returns a 64-character hex string', () => {
    const hash = hashBackupCode('A1B2-C3D4');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic: same input always produces same output', () => {
    expect(hashBackupCode('A1B2-C3D4')).toBe(hashBackupCode('A1B2-C3D4'));
  });

  it('normalizes before hashing: dashed and plain form produce the same hash', () => {
    expect(hashBackupCode('A1B2-C3D4')).toBe(hashBackupCode('a1b2c3d4'));
  });
});

// ── generateBackupCodes ──────────────────────────────────────────────────────

describe('generateBackupCodes', () => {
  it('returns 10 codes by default', () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
  });

  it('respects a custom count', () => {
    expect(generateBackupCodes(5)).toHaveLength(5);
    expect(generateBackupCodes(20)).toHaveLength(20);
  });

  it('each code matches the XXXX-XXXX uppercase hex pattern', () => {
    const codes = generateBackupCodes();
    for (const code of codes) {
      expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
    }
  });

  it('generates no duplicate codes', () => {
    const codes = generateBackupCodes(10);
    expect(new Set(codes).size).toBe(10);
  });
});

// ── parseBackupCodeHashes ────────────────────────────────────────────────────

describe('parseBackupCodeHashes', () => {
  it('returns [] for null', () => {
    expect(parseBackupCodeHashes(null)).toEqual([]);
  });

  it('returns [] for undefined', () => {
    expect(parseBackupCodeHashes(undefined)).toEqual([]);
  });

  it('returns [] for empty string', () => {
    expect(parseBackupCodeHashes('')).toEqual([]);
  });

  it('returns [] for invalid JSON', () => {
    expect(parseBackupCodeHashes('not-json')).toEqual([]);
  });

  it('returns [] for JSON that is not an array', () => {
    expect(parseBackupCodeHashes('{"key":"value"}')).toEqual([]);
  });

  it('filters out non-string entries', () => {
    expect(parseBackupCodeHashes('[1, "abc", null, true]')).toEqual(['abc']);
  });

  it('returns all strings from a valid JSON string array', () => {
    expect(parseBackupCodeHashes('["hash1","hash2","hash3"]')).toEqual(['hash1', 'hash2', 'hash3']);
  });
});
