/**
 * Unit tests for oidcService.ts
 * Covers OIDC-001 to OIDC-060
 *
 * All DB calls are mocked. All HTTP calls (fetch) are mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Prevent setInterval cleanup timers from running
vi.useFakeTimers();

// Mock fetch before anything
vi.mock('node-fetch', () => ({ default: vi.fn() }));

// ── DB mock ──────────────────────────────────────────────────────────────────
const mockGet = vi.fn(() => undefined);
const mockRun = vi.fn();

vi.mock('../../../src/db/database', () => ({
  db: {
    prepare: vi.fn(() => ({
      get: mockGet,
      all: vi.fn(() => []),
      run: mockRun,
    })),
  },
}));

vi.mock('../../../src/config', () => ({
  JWT_SECRET: 'test-jwt-secret-for-trek-testing-only',
  ENCRYPTION_KEY: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2',
  updateJwtSecret: () => {},
}));

vi.mock('../../../src/services/apiKeyCrypto', () => ({
  decrypt_api_key: vi.fn((v: unknown) => v as string | null),
  maybe_encrypt_api_key: vi.fn((v: unknown) => v),
  encrypt_api_key: vi.fn((v: unknown) => v),
}));

import fetch from 'node-fetch';
const mockFetch = vi.mocked(fetch);

function makeFetchResponse(body: unknown, ok = true, status = 200): ReturnType<typeof fetch> {
  return {
    ok,
    status,
    url: '',
    headers: { get: () => null },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as ReturnType<typeof fetch>;
}

import {
  getOidcConfig,
  createState,
  consumeState,
  createAuthCode,
  consumeAuthCode,
  discover,
  resolveOidcRole,
  generateToken,
  exchangeCodeForToken,
  getUserInfo,
  frontendUrl,
} from '../../../src/services/oidcService';

afterEach(() => {
  mockFetch.mockReset();
  mockGet.mockReset();
  vi.unstubAllEnvs();
});

// ── getOidcConfig ─────────────────────────────────────────────────────────────

describe('getOidcConfig', () => {
  it('OIDC-001 — returns null when DB has no OIDC settings and env is absent', () => {
    mockGet.mockReturnValue(undefined);
    // Ensure env vars are absent
    delete process.env.OIDC_ISSUER;
    delete process.env.OIDC_CLIENT_ID;
    delete process.env.OIDC_CLIENT_SECRET;
    const config = getOidcConfig();
    expect(config).toBeNull();
  });

  it('OIDC-002 — returns null when only issuer is set (missing clientId)', () => {
    vi.stubEnv('OIDC_ISSUER', 'https://auth.example.com');
    delete process.env.OIDC_CLIENT_ID;
    delete process.env.OIDC_CLIENT_SECRET;
    mockGet.mockReturnValue(undefined);
    const config = getOidcConfig();
    expect(config).toBeNull();
  });

  it('OIDC-003 — returns config when all required env vars are set', () => {
    vi.stubEnv('OIDC_ISSUER', 'https://auth.example.com/');
    vi.stubEnv('OIDC_CLIENT_ID', 'my-client-id');
    vi.stubEnv('OIDC_CLIENT_SECRET', 'my-client-secret');
    vi.stubEnv('OIDC_DISPLAY_NAME', 'My SSO');
    mockGet.mockReturnValue(undefined);

    const config = getOidcConfig();
    expect(config).not.toBeNull();
    expect(config!.issuer).toBe('https://auth.example.com'); // trailing slash stripped
    expect(config!.clientId).toBe('my-client-id');
    expect(config!.displayName).toBe('My SSO');
  });

  it('OIDC-004 — falls back to displayName "SSO" when not set', () => {
    vi.stubEnv('OIDC_ISSUER', 'https://auth.example.com');
    vi.stubEnv('OIDC_CLIENT_ID', 'cid');
    vi.stubEnv('OIDC_CLIENT_SECRET', 'secret');
    delete process.env.OIDC_DISPLAY_NAME;
    mockGet.mockReturnValue(undefined);

    const config = getOidcConfig();
    expect(config!.displayName).toBe('SSO');
  });
});

// ── createState / consumeState ────────────────────────────────────────────────

describe('createState / consumeState', () => {
  it('OIDC-010 — created state can be consumed exactly once', () => {
    const state = createState('https://app.example.com/callback');
    expect(state).toBeTruthy();
    expect(state.length).toBeGreaterThan(10);

    const data = consumeState(state);
    expect(data).not.toBeNull();
    expect(data!.redirectUri).toBe('https://app.example.com/callback');

    // Second consumption returns null (already deleted)
    const data2 = consumeState(state);
    expect(data2).toBeNull();
  });

  it('OIDC-011 — consumeState returns null for unknown state', () => {
    const result = consumeState('nonexistent-state-xyz');
    expect(result).toBeNull();
  });

  it('OIDC-012 — createState stores inviteToken when provided', () => {
    const state = createState('https://app.example.com/', 'invite-abc');
    const data = consumeState(state);
    expect(data!.inviteToken).toBe('invite-abc');
  });
});

// ── createAuthCode / consumeAuthCode ──────────────────────────────────────────

describe('createAuthCode / consumeAuthCode', () => {
  it('OIDC-020 — created code returns the token on first consumption', () => {
    const code = createAuthCode('jwt-token-here');
    const result = consumeAuthCode(code);
    expect('token' in result).toBe(true);
    if ('token' in result) {
      expect(result.token).toBe('jwt-token-here');
    }
  });

  it('OIDC-021 — code is invalidated after consumption', () => {
    const code = createAuthCode('my-token');
    consumeAuthCode(code);
    const result2 = consumeAuthCode(code);
    expect('error' in result2).toBe(true);
  });

  it('OIDC-022 — consumeAuthCode returns error for unknown code', () => {
    const result = consumeAuthCode('totally-invalid-code-xyz');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Invalid');
    }
  });

  it('OIDC-023 — createAuthCode returns a UUID-like string', () => {
    const code = createAuthCode('token');
    // UUID format: 8-4-4-4-12 hex chars
    expect(code).toMatch(/^[0-9a-f-]{36}$/);
  });
});

// ── discover ──────────────────────────────────────────────────────────────────

describe('discover', () => {
  it('OIDC-030 — fetches and returns discovery document', async () => {
    const doc = {
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
      userinfo_endpoint: 'https://auth.example.com/userinfo',
    };
    mockFetch.mockResolvedValueOnce(makeFetchResponse(doc, true, 200));

    const result = await discover('https://auth.example.com', null);
    expect(result.authorization_endpoint).toBe('https://auth.example.com/authorize');
    expect(result.token_endpoint).toBe('https://auth.example.com/token');
  });

  it('OIDC-031 — throws when discovery fetch fails', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({}, false, 404));

    await expect(
      discover('https://bad.example.com', null)
    ).rejects.toThrow('Failed to fetch OIDC discovery document');
  });

  it('OIDC-032 — uses custom discoveryUrl when provided', async () => {
    const doc = {
      authorization_endpoint: 'https://custom.example.com/auth',
      token_endpoint: 'https://custom.example.com/token',
      userinfo_endpoint: 'https://custom.example.com/userinfo',
    };
    mockFetch.mockResolvedValueOnce(makeFetchResponse(doc, true, 200));

    await discover('https://issuer.example.com', 'https://custom.example.com/.well-known/openid-configuration');

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe('https://custom.example.com/.well-known/openid-configuration');
  });

  it('OIDC-033 — defaults to issuer/.well-known/openid-configuration', async () => {
    const doc = {
      authorization_endpoint: 'https://a.example.com/auth',
      token_endpoint: 'https://a.example.com/token',
      userinfo_endpoint: 'https://a.example.com/userinfo',
    };
    mockFetch.mockResolvedValueOnce(makeFetchResponse(doc, true, 200));

    await discover('https://a.example.com', undefined);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe('https://a.example.com/.well-known/openid-configuration');
  });
});

// ── resolveOidcRole ───────────────────────────────────────────────────────────

describe('resolveOidcRole', () => {
  afterEach(() => {
    delete process.env.OIDC_ADMIN_VALUE;
    delete process.env.OIDC_ADMIN_CLAIM;
  });

  it('OIDC-040 — first user is always admin regardless of claims', () => {
    const role = resolveOidcRole({ sub: 'abc', email: 'a@b.com' }, true);
    expect(role).toBe('admin');
  });

  it('OIDC-041 — returns user when OIDC_ADMIN_VALUE is not set', () => {
    delete process.env.OIDC_ADMIN_VALUE;
    const role = resolveOidcRole({ sub: 'abc', email: 'a@b.com', groups: ['admins'] }, false);
    expect(role).toBe('user');
  });

  it('OIDC-042 — returns admin when groups claim contains admin value', () => {
    vi.stubEnv('OIDC_ADMIN_VALUE', 'admins');
    vi.stubEnv('OIDC_ADMIN_CLAIM', 'groups');
    const role = resolveOidcRole({ sub: 'x', email: 'x@y.com', groups: ['users', 'admins'] }, false);
    expect(role).toBe('admin');
  });

  it('OIDC-043 — returns user when groups claim does NOT contain admin value', () => {
    vi.stubEnv('OIDC_ADMIN_VALUE', 'superadmin');
    vi.stubEnv('OIDC_ADMIN_CLAIM', 'groups');
    const role = resolveOidcRole({ sub: 'x', email: 'x@y.com', groups: ['users', 'admins'] }, false);
    expect(role).toBe('user');
  });

  it('OIDC-044 — handles string claim value', () => {
    vi.stubEnv('OIDC_ADMIN_VALUE', 'admin');
    vi.stubEnv('OIDC_ADMIN_CLAIM', 'role');
    const role = resolveOidcRole({ sub: 'x', email: 'x@y.com', role: 'admin' }, false);
    expect(role).toBe('admin');
  });

  it('OIDC-045 — returns user when claim is missing entirely', () => {
    vi.stubEnv('OIDC_ADMIN_VALUE', 'admin');
    vi.stubEnv('OIDC_ADMIN_CLAIM', 'groups');
    const role = resolveOidcRole({ sub: 'x', email: 'x@y.com' }, false);
    expect(role).toBe('user');
  });

  it('OIDC-046 — defaults to groups claim when OIDC_ADMIN_CLAIM not set', () => {
    vi.stubEnv('OIDC_ADMIN_VALUE', 'trek-admin');
    delete process.env.OIDC_ADMIN_CLAIM;
    const role = resolveOidcRole({ sub: 'x', email: 'x@y.com', groups: ['trek-admin'] }, false);
    expect(role).toBe('admin');
  });
});

// ── generateToken ─────────────────────────────────────────────────────────────

describe('generateToken', () => {
  it('OIDC-050 — returns a string with 3 JWT parts', () => {
    const token = generateToken({ id: 42 });
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('OIDC-051 — token payload includes user id', () => {
    const token = generateToken({ id: 99 });
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    expect(payload.id).toBe(99);
  });
});

// ── exchangeCodeForToken ──────────────────────────────────────────────────────

describe('exchangeCodeForToken', () => {
  const doc = {
    authorization_endpoint: 'https://auth.example.com/auth',
    token_endpoint: 'https://auth.example.com/token',
    userinfo_endpoint: 'https://auth.example.com/userinfo',
  };

  it('OIDC-060 — returns token response on success', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({
      access_token: 'at-123',
      id_token: 'it-abc',
    }, true, 200));

    const result = await exchangeCodeForToken(doc, 'auth-code', 'https://app/cb', 'cid', 'secret');
    expect(result.access_token).toBe('at-123');
    expect(result.id_token).toBe('it-abc');
    expect(result._ok).toBe(true);
    expect(result._status).toBe(200);
  });

  it('OIDC-061 — returns _ok=false on 400 from provider', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ error: 'invalid_grant' }, false, 400));

    const result = await exchangeCodeForToken(doc, 'bad-code', 'https://app/cb', 'cid', 'secret');
    expect(result._ok).toBe(false);
    expect(result._status).toBe(400);
  });

  it('OIDC-062 — posts to token_endpoint with correct params', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ access_token: 'tok' }, true, 200));

    await exchangeCodeForToken(doc, 'code-xyz', 'https://redirect.example.com', 'clientA', 'secretB');

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://auth.example.com/token');
    expect(options.method).toBe('POST');
    // body is a URLSearchParams object; convert to string to check fields
    const bodyStr = (options.body as URLSearchParams).toString();
    expect(bodyStr).toContain('code=code-xyz');
    expect(bodyStr).toContain('client_id=clientA');
  });
});

// ── getUserInfo ───────────────────────────────────────────────────────────────

describe('getUserInfo', () => {
  it('OIDC-070 — fetches user info with bearer token', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({
      sub: 'user-abc',
      email: 'user@example.com',
      name: 'Alice Example',
    }, true, 200));

    const info = await getUserInfo('https://auth.example.com/userinfo', 'bearer-token-xyz');
    expect(info.sub).toBe('user-abc');
    expect(info.email).toBe('user@example.com');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer bearer-token-xyz');
  });
});

// ── frontendUrl ───────────────────────────────────────────────────────────────

describe('frontendUrl', () => {
  it('OIDC-080 — in test (non-production) returns localhost:5173 prefix', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    const url = frontendUrl('/oidc/callback');
    expect(url).toBe('http://localhost:5173/oidc/callback');
    process.env.NODE_ENV = original;
  });
});

// ── getAppUrl ─────────────────────────────────────────────────────────────────

import { getAppUrl, touchLastLogin } from '../../../src/services/oidcService';

describe('getAppUrl', () => {
  afterEach(() => {
    delete process.env.APP_URL;
    mockGet.mockReset();
  });

  it('OIDC-090 — returns APP_URL from environment', () => {
    vi.stubEnv('APP_URL', 'https://trek.example.com');
    const url = getAppUrl();
    expect(url).toBe('https://trek.example.com');
  });

  it('OIDC-091 — returns null when neither env nor DB has APP_URL', () => {
    delete process.env.APP_URL;
    mockGet.mockReturnValue(undefined);
    const url = getAppUrl();
    expect(url).toBeNull();
  });
});

// ── touchLastLogin ────────────────────────────────────────────────────────────

describe('touchLastLogin', () => {
  it('OIDC-100 — calls DB update for last_login', () => {
    touchLastLogin(42);
    expect(mockRun).toHaveBeenCalledOnce();
  });
});

// ── findOrCreateUser ──────────────────────────────────────────────────────────

// We need bcryptjs mocked to avoid slow hashing in user-creation paths
vi.mock('bcryptjs', () => ({
  default: {
    hashSync: vi.fn(() => '$2a$10$mockedHashForTesting'),
    compareSync: vi.fn(() => true),
  },
  hashSync: vi.fn(() => '$2a$10$mockedHashForTesting'),
  compareSync: vi.fn(() => true),
}));

import { findOrCreateUser } from '../../../src/services/oidcService';

const mockOidcConfig = {
  issuer: 'https://auth.example.com',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  displayName: 'My SSO',
  discoveryUrl: null,
  allowRegistration: true,
  defaultRole: 'user' as const,
};

const mockUserInfo = {
  sub: 'oidc-sub-12345',
  email: 'alice@example.com',
  name: 'Alice Smith',
};

describe('findOrCreateUser', () => {
  afterEach(() => {
    mockGet.mockReset();
    mockRun.mockReset();
    delete process.env.OIDC_ADMIN_VALUE;
    delete process.env.OIDC_ADMIN_CLAIM;
    vi.unstubAllEnvs();
  });

  it('OIDC-110 — returns existing user found by oidc_sub', () => {
    const existingUser = { id: 1, username: 'alice', email: 'alice@example.com', role: 'user', oidc_sub: 'oidc-sub-12345', oidc_issuer: 'https://auth.example.com' };
    mockGet.mockReturnValueOnce(existingUser); // sub lookup hits

    const result = findOrCreateUser(mockUserInfo, mockOidcConfig);
    expect('user' in result).toBe(true);
    if ('user' in result) {
      expect(result.user.email).toBe('alice@example.com');
    }
  });

  it('OIDC-111 — links OIDC identity when user found by email but not yet linked', () => {
    const existingUser = { id: 2, username: 'bob', email: 'alice@example.com', role: 'user', oidc_sub: null, oidc_issuer: null };
    mockGet.mockReturnValueOnce(undefined)  // sub lookup: miss
          .mockReturnValueOnce(existingUser); // email lookup: hit

    const result = findOrCreateUser(mockUserInfo, mockOidcConfig);
    expect('user' in result).toBe(true);
    // DB UPDATE should have been called to link the sub
    expect(mockRun).toHaveBeenCalledOnce();
  });

  it('OIDC-112 — updates role when OIDC_ADMIN_VALUE is set and role changed', () => {
    vi.stubEnv('OIDC_ADMIN_VALUE', 'admins');
    vi.stubEnv('OIDC_ADMIN_CLAIM', 'groups');
    const existingUser = { id: 3, username: 'charlie', email: 'alice@example.com', role: 'user', oidc_sub: 'oidc-sub-12345', oidc_issuer: 'https://auth.example.com' };
    mockGet.mockReturnValueOnce(existingUser);

    // userInfo has groups: ['admins'] so resolved role is 'admin', but user.role is 'user' -> update
    const result = findOrCreateUser(
      { ...mockUserInfo, groups: ['admins'] },
      mockOidcConfig,
    );
    expect('user' in result).toBe(true);
    if ('user' in result) {
      expect(result.user.role).toBe('admin');
    }
    // Role UPDATE should have been called
    expect(mockRun).toHaveBeenCalledOnce();
  });

  it('OIDC-113 — creates new user when no existing user and first user registration', () => {
    // sub lookup: miss
    mockGet.mockReturnValueOnce(undefined)
          // email lookup: miss
          .mockReturnValueOnce(undefined)
          // user count: 0 (first user)
          .mockReturnValueOnce({ count: 0 })
          // username collision check: no collision
          .mockReturnValueOnce(undefined);
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 42 });

    const result = findOrCreateUser(mockUserInfo, mockOidcConfig);
    expect('user' in result).toBe(true);
    if ('user' in result) {
      expect(result.user.id).toBe(42);
      // First user should be admin
      expect(result.user.role).toBe('admin');
    }
  });

  it('OIDC-114 — returns error when registration is disabled and no invite', () => {
    mockGet.mockReturnValueOnce(undefined)  // sub lookup
          .mockReturnValueOnce(undefined)  // email lookup
          .mockReturnValueOnce({ count: 5 })  // user count: not first
          // no inviteToken -> skip invite check
          // registration setting check
          .mockReturnValueOnce({ value: 'false' }); // registration disabled

    const result = findOrCreateUser(mockUserInfo, mockOidcConfig);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('registration_disabled');
    }
  });

  it('OIDC-115 — creates new user when registration is open', () => {
    mockGet.mockReturnValueOnce(undefined)  // sub lookup
          .mockReturnValueOnce(undefined)  // email lookup
          .mockReturnValueOnce({ count: 3 })  // user count: not first
          // registration setting check
          .mockReturnValueOnce({ value: 'true' })  // registration enabled
          // username collision check
          .mockReturnValueOnce(undefined);
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 10 });

    const result = findOrCreateUser(mockUserInfo, mockOidcConfig);
    expect('user' in result).toBe(true);
    if ('user' in result) {
      expect(result.user.id).toBe(10);
      expect(result.user.role).toBe('user'); // not first user
    }
  });

  it('OIDC-116 — avoids username collision by appending suffix', () => {
    mockGet.mockReturnValueOnce(undefined)  // sub lookup
          .mockReturnValueOnce(undefined)  // email lookup
          .mockReturnValueOnce({ count: 1 })  // user count
          .mockReturnValueOnce(undefined)  // registration setting (not found -> use default)
          .mockReturnValueOnce({ id: 5 });   // username collision: existing user
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 99 });

    const result = findOrCreateUser(mockUserInfo, mockOidcConfig);
    expect('user' in result).toBe(true);
    if ('user' in result) {
      // Username should have been suffixed
      expect(result.user.username).toMatch(/AliceSmith_\d+/);
    }
  });
});
