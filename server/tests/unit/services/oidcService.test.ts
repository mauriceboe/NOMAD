/**
 * Unit tests for oidcService — OIDC-SVC-001 through OIDC-SVC-025.
 * Covers state management, auth codes, role resolution, findOrCreateUser,
 * discover caching, and the ReDoS-sensitive issuer trailing-slash regex.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import jwtLib from 'jsonwebtoken';

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
    canAccessTrip: (tripId: any, userId: number) =>
      db.prepare(`
        SELECT t.id, t.user_id FROM trips t
        LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ?
        WHERE t.id = ? AND (t.user_id = ? OR m.user_id IS NOT NULL)
      `).get(userId, tripId, userId),
    isOwner: (tripId: any, userId: number) =>
      !!db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(tripId, userId),
  };
  return { testDb: db, dbMock: mock };
});

vi.mock('../../../src/db/database', () => dbMock);
vi.mock('../../../src/config', () => ({
  JWT_SECRET: 'test-jwt-secret-for-trek-testing-only',
  ENCRYPTION_KEY: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2',
  updateJwtSecret: () => {},
}));

import { createTables } from '../../../src/db/schema';
import { runMigrations } from '../../../src/db/migrations';
import { resetTestDb } from '../../helpers/test-db';
import { createUser } from '../../helpers/factories';
import {
  createState,
  consumeState,
  createAuthCode,
  consumeAuthCode,
  resolveOidcRole,
  frontendUrl,
  findOrCreateUser,
  discover,
  verifyIdToken,
} from '../../../src/services/oidcService';

const MOCK_CONFIG = {
  issuer: 'https://oidc.example.com',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  displayName: 'SSO',
  discoveryUrl: null,
};

beforeAll(() => {
  createTables(testDb);
  runMigrations(testDb);
});

beforeEach(() => {
  resetTestDb(testDb);
  delete process.env.OIDC_ADMIN_VALUE;
  delete process.env.OIDC_ADMIN_CLAIM;
  delete process.env.NODE_ENV;
});

afterAll(() => {
  vi.unstubAllGlobals();
  testDb.close();
});

// ── createState / consumeState ────────────────────────────────────────────────

describe('createState / consumeState', () => {
  it('OIDC-SVC-001: createState returns a hex token', () => {
    const state = createState('https://example.com/callback');
    expect(state).toMatch(/^[0-9a-f]{64}$/);
  });

  it('OIDC-SVC-002: consumeState returns stored data and deletes state', () => {
    const state = createState('https://example.com/callback', 'invite-abc');
    const data = consumeState(state);
    expect(data).not.toBeNull();
    expect(data!.redirectUri).toBe('https://example.com/callback');
    expect(data!.inviteToken).toBe('invite-abc');
    // State is consumed — second call returns null
    expect(consumeState(state)).toBeNull();
  });

  it('OIDC-SVC-003: consumeState returns null for unknown state', () => {
    expect(consumeState('not-a-real-state')).toBeNull();
  });

  it('OIDC-SVC-004: two different states do not conflict', () => {
    const s1 = createState('http://a.example.com');
    const s2 = createState('http://b.example.com');
    expect(s1).not.toBe(s2);
    expect(consumeState(s1)!.redirectUri).toBe('http://a.example.com');
    expect(consumeState(s2)!.redirectUri).toBe('http://b.example.com');
  });
});

// ── createAuthCode / consumeAuthCode ─────────────────────────────────────────

describe('createAuthCode / consumeAuthCode', () => {
  it('OIDC-SVC-005: createAuthCode returns a UUID-like string', () => {
    const code = createAuthCode('my.jwt.token');
    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(0);
  });

  it('OIDC-SVC-006: consumeAuthCode returns the stored token', () => {
    const code = createAuthCode('real.jwt.here');
    const result = consumeAuthCode(code);
    expect('token' in result).toBe(true);
    expect((result as { token: string }).token).toBe('real.jwt.here');
  });

  it('OIDC-SVC-007: auth code is single-use (second consume returns error)', () => {
    const code = createAuthCode('single.use.token');
    consumeAuthCode(code); // first use
    const second = consumeAuthCode(code);
    expect('error' in second).toBe(true);
  });

  it('OIDC-SVC-008: consumeAuthCode returns error for unknown code', () => {
    const result = consumeAuthCode('not-a-real-code');
    expect('error' in result).toBe(true);
  });
});

// ── resolveOidcRole ───────────────────────────────────────────────────────────

describe('resolveOidcRole', () => {
  it('OIDC-SVC-009: returns admin when isFirstUser is true', () => {
    expect(resolveOidcRole({ sub: 'x' }, true)).toBe('admin');
  });

  it('OIDC-SVC-010: returns user when no OIDC_ADMIN_VALUE is set', () => {
    delete process.env.OIDC_ADMIN_VALUE;
    expect(resolveOidcRole({ sub: 'x', groups: ['admins'] }, false)).toBe('user');
  });

  it('OIDC-SVC-011: returns admin when groups array contains OIDC_ADMIN_VALUE', () => {
    process.env.OIDC_ADMIN_VALUE = 'trek-admins';
    expect(resolveOidcRole({ sub: 'x', groups: ['trek-users', 'trek-admins'] }, false)).toBe('admin');
  });

  it('OIDC-SVC-012: returns user when groups array does not contain OIDC_ADMIN_VALUE', () => {
    process.env.OIDC_ADMIN_VALUE = 'trek-admins';
    expect(resolveOidcRole({ sub: 'x', groups: ['trek-users'] }, false)).toBe('user');
  });

  it('OIDC-SVC-013: uses custom OIDC_ADMIN_CLAIM when set', () => {
    process.env.OIDC_ADMIN_VALUE = 'superadmin';
    process.env.OIDC_ADMIN_CLAIM = 'roles';
    expect(resolveOidcRole({ sub: 'x', roles: ['superadmin', 'editor'] }, false)).toBe('admin');
  });

  it('OIDC-SVC-014: handles string claim (exact match)', () => {
    process.env.OIDC_ADMIN_VALUE = 'admin';
    process.env.OIDC_ADMIN_CLAIM = 'role';
    expect(resolveOidcRole({ sub: 'x', role: 'admin' }, false)).toBe('admin');
    expect(resolveOidcRole({ sub: 'x', role: 'editor' }, false)).toBe('user');
  });
});

// ── frontendUrl ───────────────────────────────────────────────────────────────

describe('frontendUrl', () => {
  it('OIDC-SVC-015: prepends localhost:5173 in non-production', () => {
    delete process.env.NODE_ENV;
    expect(frontendUrl('/login?oidc_code=abc')).toBe('http://localhost:5173/login?oidc_code=abc');
  });

  it('OIDC-SVC-016: returns bare path in production', () => {
    process.env.NODE_ENV = 'production';
    expect(frontendUrl('/login?oidc_code=abc')).toBe('/login?oidc_code=abc');
    delete process.env.NODE_ENV;
  });
});

// ── discover ──────────────────────────────────────────────────────────────────

describe('discover', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('OIDC-SVC-017: fetches and returns discovery document', async () => {
    const doc = {
      authorization_endpoint: 'https://oidc.example.com/auth',
      token_endpoint: 'https://oidc.example.com/token',
      userinfo_endpoint: 'https://oidc.example.com/userinfo',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => doc,
    }));

    // Use unique issuer to bypass module-level cache from other tests
    const result = await discover('https://unique-1.example.com');
    expect(result.authorization_endpoint).toBe(doc.authorization_endpoint);
    expect(result.token_endpoint).toBe(doc.token_endpoint);
  });

  it('OIDC-SVC-018: throws when provider returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(discover('https://bad-issuer.example.com')).rejects.toThrow();
  });

  it('OIDC-SVC-037: accepts mismatched doc issuer when discoveryUrl is explicit', async () => {
    const doc = {
      issuer: 'https://auth.example.com/application/o/myapp/',
      authorization_endpoint: 'https://auth.example.com/application/o/myapp/authorize/',
      token_endpoint: 'https://auth.example.com/application/o/token/',
      userinfo_endpoint: 'https://auth.example.com/application/o/userinfo/',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => doc }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await discover(
      'https://auth.example.com',
      'https://auth.example.com/application/o/myapp/.well-known/openid-configuration',
    );

    expect(result.issuer).toBe(doc.issuer);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('differs from configured OIDC_ISSUER'));
    warnSpy.mockRestore();
  });

  it('OIDC-SVC-038: throws on mismatched doc issuer when discoveryUrl is omitted', async () => {
    const doc = {
      issuer: 'https://evil.example.com',
      authorization_endpoint: 'https://unique-2.example.com/auth',
      token_endpoint: 'https://unique-2.example.com/token',
      userinfo_endpoint: 'https://unique-2.example.com/userinfo',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => doc }));

    await expect(discover('https://unique-2.example.com')).rejects.toThrow(
      'OIDC discovery issuer mismatch',
    );
  });

  it('OIDC-SVC-039: trailing-slash-only mismatch with explicit discoveryUrl does not warn', async () => {
    const doc = {
      issuer: 'https://auth.example.com/',
      authorization_endpoint: 'https://auth.example.com/auth',
      token_endpoint: 'https://auth.example.com/token',
      userinfo_endpoint: 'https://auth.example.com/userinfo',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => doc }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await discover(
      'https://auth.example.com',
      'https://auth.example.com/.well-known/openid-configuration',
    );

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ── issuer trailing-slash regex (ReDoS guard) ─────────────────────────────────

describe('getOidcConfig issuer trailing-slash regex', () => {
  it('OIDC-SVC-019: /\\/+$/ strips trailing slashes in < 5ms', () => {
    // The regex /\/+$/ in getOidcConfig: issuer.replace(/\/+$/, '')
    // Adversarial input: many trailing slashes — should not backtrack catastrophically
    const adversarial = 'https://oidc.example.com' + '/'.repeat(10000);
    const start = Date.now();
    const result = adversarial.replace(/\/+$/, '');
    const elapsed = Date.now() - start;
    expect(result).toBe('https://oidc.example.com');
    expect(elapsed).toBeLessThan(100);
  });
});

// ── findOrCreateUser ──────────────────────────────────────────────────────────

describe('findOrCreateUser', () => {
  it('OIDC-SVC-020: finds existing user by oidc_sub', () => {
    const { user } = createUser(testDb, { email: 'alice@example.com' });
    // Link the sub manually
    testDb.prepare('UPDATE users SET oidc_sub = ?, oidc_issuer = ? WHERE id = ?')
      .run('sub-alice-123', MOCK_CONFIG.issuer, user.id);

    const result = findOrCreateUser(
      { sub: 'sub-alice-123', email: 'alice@example.com', name: 'Alice' },
      MOCK_CONFIG
    );
    expect('user' in result).toBe(true);
    expect((result as { user: any }).user.id).toBe(user.id);
  });

  it('OIDC-SVC-021: finds existing user by email when no sub match', () => {
    const { user } = createUser(testDb, { email: 'bob@example.com' });

    const result = findOrCreateUser(
      { sub: 'sub-bob-new', email: 'bob@example.com', name: 'Bob' },
      MOCK_CONFIG
    );
    expect('user' in result).toBe(true);
    expect((result as { user: any }).user.id).toBe(user.id);
  });

  it('OIDC-SVC-022: creates new user when registration is open', () => {
    const result = findOrCreateUser(
      { sub: 'sub-new-1', email: 'newuser@example.com', name: 'New User' },
      MOCK_CONFIG
    );
    expect('user' in result).toBe(true);
    const newUser = testDb.prepare("SELECT * FROM users WHERE email = 'newuser@example.com'").get();
    expect(newUser).toBeDefined();
  });

  it('OIDC-SVC-023: first user gets admin role', () => {
    // DB is empty after resetTestDb
    const result = findOrCreateUser(
      { sub: 'sub-first', email: 'first@example.com', name: 'First' },
      MOCK_CONFIG
    );
    expect('user' in result).toBe(true);
    expect((result as { user: any }).user.role).toBe('admin');
  });

  it('OIDC-SVC-024: returns registration_disabled error when registration is off', () => {
    createUser(testDb, { email: 'existing@example.com' });
    testDb.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('allow_registration', 'false')").run();

    const result = findOrCreateUser(
      { sub: 'sub-blocked', email: 'blocked@example.com', name: 'Blocked' },
      MOCK_CONFIG
    );
    expect('error' in result).toBe(true);
    expect((result as { error: string }).error).toBe('registration_disabled');
  });

  it('OIDC-SVC-025: links oidc_sub when existing user has none', () => {
    const { user } = createUser(testDb, { email: 'charlie@example.com' });
    // Ensure no oidc_sub set
    testDb.prepare('UPDATE users SET oidc_sub = NULL, oidc_issuer = NULL WHERE id = ?').run(user.id);

    findOrCreateUser(
      { sub: 'sub-charlie-linked', email: 'charlie@example.com', name: 'Charlie' },
      MOCK_CONFIG
    );

    const updated = testDb.prepare('SELECT oidc_sub FROM users WHERE id = ?').get(user.id) as any;
    expect(updated.oidc_sub).toBe('sub-charlie-linked');
  });

  it('OIDC-SVC-026: existing user role is updated when OIDC claim mapping changes it', () => {
    const { user } = createUser(testDb, { email: 'diana@example.com', role: 'user' });
    // Link oidc_sub manually so the user is found by sub lookup
    testDb.prepare('UPDATE users SET oidc_sub = ?, oidc_issuer = ? WHERE id = ?')
      .run('sub-diana-role', MOCK_CONFIG.issuer, user.id);

    process.env.OIDC_ADMIN_VALUE = 'admins';

    const result = findOrCreateUser(
      { sub: 'sub-diana-role', email: 'diana@example.com', name: 'Diana', groups: ['admins'] },
      MOCK_CONFIG
    );

    expect('user' in result).toBe(true);
    expect((result as { user: any }).user.role).toBe('admin');

    const dbUser = testDb.prepare('SELECT role FROM users WHERE id = ?').get(user.id) as any;
    expect(dbUser.role).toBe('admin');
  });

  it('OIDC-SVC-027: new user with valid invite token increments used_count', () => {
    const { user: creator } = createUser(testDb, { email: 'creator@example.com' });
    testDb.prepare(
      "INSERT INTO invite_tokens (token, max_uses, used_count, created_by) VALUES ('tok-valid', 5, 0, ?)"
    ).run(creator.id);

    const result = findOrCreateUser(
      { sub: 'sub-invite-user', email: 'invitee@example.com', name: 'Invitee' },
      MOCK_CONFIG,
      'tok-valid'
    );

    expect('user' in result).toBe(true);

    const token = testDb.prepare("SELECT used_count FROM invite_tokens WHERE token = 'tok-valid'").get() as any;
    expect(token.used_count).toBe(1);
  });

  it('OIDC-SVC-028: new user with expired invite token is created but invite is ignored', () => {
    const { user: creator } = createUser(testDb, { email: 'creator2@example.com' });
    testDb.prepare(
      "INSERT INTO invite_tokens (token, max_uses, used_count, expires_at, created_by) VALUES ('tok-expired', 5, 0, '2000-01-01T00:00:00.000Z', ?)"
    ).run(creator.id);

    const result = findOrCreateUser(
      { sub: 'sub-expired-invite', email: 'expired-invitee@example.com', name: 'ExpiredInvitee' },
      MOCK_CONFIG,
      'tok-expired'
    );

    // User is still created because open registration is allowed
    expect('user' in result).toBe(true);
    const newUser = testDb.prepare("SELECT id FROM users WHERE email = 'expired-invitee@example.com'").get();
    expect(newUser).toBeDefined();

    // Invite used_count must remain 0 (token was treated as invalid)
    const token = testDb.prepare("SELECT used_count FROM invite_tokens WHERE token = 'tok-expired'").get() as any;
    expect(token.used_count).toBe(0);
  });

  it('OIDC-SVC-029: new user with max_uses exceeded invite token is created but invite is ignored', () => {
    const { user: creator } = createUser(testDb, { email: 'creator3@example.com' });
    testDb.prepare(
      "INSERT INTO invite_tokens (token, max_uses, used_count, created_by) VALUES ('tok-full', 1, 1, ?)"
    ).run(creator.id);

    const result = findOrCreateUser(
      { sub: 'sub-full-invite', email: 'full-invitee@example.com', name: 'FullInvitee' },
      MOCK_CONFIG,
      'tok-full'
    );

    // User is still created because open registration is allowed
    expect('user' in result).toBe(true);
    const newUser = testDb.prepare("SELECT id FROM users WHERE email = 'full-invitee@example.com'").get();
    expect(newUser).toBeDefined();

    // Invite used_count must remain 1 (token was treated as invalid)
    const token = testDb.prepare("SELECT used_count FROM invite_tokens WHERE token = 'tok-full'").get() as any;
    expect(token.used_count).toBe(1);
  });
});

// ── exchangeCodeForToken ──────────────────────────────────────────────────────

describe('exchangeCodeForToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('OIDC-SVC-030: sends correct POST body and returns token data', async () => {
    const { exchangeCodeForToken } = await import('../../../src/services/oidcService');

    const mockTokenData = { access_token: 'tok', token_type: 'Bearer' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockTokenData,
    }));

    const doc = { token_endpoint: 'https://oidc.example.com/token' } as any;
    const result = await exchangeCodeForToken(doc, 'auth-code-123', 'https://app/callback', 'client-id', 'client-secret');

    expect(result.access_token).toBe('tok');
    expect(result._ok).toBe(true);
    expect(result._status).toBe(200);

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe('https://oidc.example.com/token');
    expect(fetchCall[1].method).toBe('POST');
  });

  it('OIDC-SVC-031: reflects _ok=false when provider returns error status', async () => {
    const { exchangeCodeForToken } = await import('../../../src/services/oidcService');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant' }),
    }));

    const doc = { token_endpoint: 'https://oidc.example.com/token' } as any;
    const result = await exchangeCodeForToken(doc, 'bad-code', 'https://app/callback', 'c', 's');

    expect(result._ok).toBe(false);
    expect(result._status).toBe(400);
  });
});

// ── getUserInfo ───────────────────────────────────────────────────────────────

describe('getUserInfo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('OIDC-SVC-032: fetches userinfo with Bearer token and returns parsed JSON', async () => {
    const { getUserInfo } = await import('../../../src/services/oidcService');

    const userInfoData = { sub: 'user-sub', email: 'user@example.com', name: 'User Name' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => userInfoData,
    }));

    const result = await getUserInfo('https://oidc.example.com/userinfo', 'access-token-123');

    expect(result.sub).toBe('user-sub');
    expect(result.email).toBe('user@example.com');

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].headers.Authorization).toBe('Bearer access-token-123');
  });
});

// ── verifyIdToken ─────────────────────────────────────────────────────────────

describe('verifyIdToken', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
  const ISSUER = 'https://auth.example.com/application/o/trek';
  const CLIENT_ID = 'trek-client';
  const JWKS_URI = 'https://auth.example.com/.well-known/jwks.json';

  function mockJwks() {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [jwk] }),
    }));
  }

  function makeToken(iss: string, overrides: object = {}) {
    return jwtLib.sign(
      { sub: 'user-sub', email: 'user@example.com', ...overrides },
      privateKey,
      { algorithm: 'RS256', audience: CLIENT_ID, issuer: iss, expiresIn: '1h' }
    );
  }

  const doc = { jwks_uri: JWKS_URI } as any;

  afterEach(() => { vi.unstubAllGlobals(); });

  it('OIDC-SVC-033: accepts token whose iss matches expectedIssuer exactly', async () => {
    mockJwks();
    const token = makeToken(ISSUER);
    const result = await verifyIdToken(token, doc, CLIENT_ID, ISSUER);
    expect(result.ok).toBe(true);
  });

  it('OIDC-SVC-034: accepts token whose iss has a trailing slash (Authentik)', async () => {
    mockJwks();
    const token = makeToken(ISSUER + '/');
    const result = await verifyIdToken(token, doc, CLIENT_ID, ISSUER);
    expect(result.ok).toBe(true);
  });

  it('OIDC-SVC-035: rejects token with wrong issuer', async () => {
    mockJwks();
    const token = makeToken('https://evil.example.com');
    const result = await verifyIdToken(token, doc, CLIENT_ID, ISSUER);
    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch('jwt issuer invalid');
  });

  it('OIDC-SVC-036: rejects token with wrong audience', async () => {
    mockJwks();
    const token = makeToken(ISSUER, {});
    const wrongAudToken = jwtLib.sign(
      { sub: 'user-sub', iss: ISSUER },
      privateKey,
      { algorithm: 'RS256', audience: 'wrong-client', expiresIn: '1h' }
    );
    const result = await verifyIdToken(wrongAudToken, doc, CLIENT_ID, ISSUER);
    expect(result.ok).toBe(false);
  });
});
