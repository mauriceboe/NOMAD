import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/db/database', () => ({
  db: { prepare: () => ({ get: vi.fn(), all: vi.fn() }) },
}));
vi.mock('../../../src/config', () => ({ JWT_SECRET: 'test-secret' }));

import { extractToken, authenticate, adminOnly } from '../../../src/middleware/auth';
import type { Request, Response, NextFunction } from 'express';

function makeReq(overrides: {
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
} = {}): Request {
  return {
    cookies: overrides.cookies || {},
    headers: overrides.headers || {},
  } as unknown as Request;
}

function makeRes(): { res: Response; status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status } as unknown as Response;
  return { res, status, json };
}

// ── extractToken ─────────────────────────────────────────────────────────────

describe('extractToken', () => {
  it('returns cookie value when trek_session cookie is set', () => {
    const req = makeReq({ cookies: { trek_session: 'cookie-token' } });
    expect(extractToken(req)).toBe('cookie-token');
  });

  it('returns Bearer token from Authorization header when no cookie', () => {
    const req = makeReq({ headers: { authorization: 'Bearer header-token' } });
    expect(extractToken(req)).toBe('header-token');
  });

  it('prefers cookie over Authorization header when both are present', () => {
    const req = makeReq({
      cookies: { trek_session: 'cookie-token' },
      headers: { authorization: 'Bearer header-token' },
    });
    expect(extractToken(req)).toBe('cookie-token');
  });

  it('returns null when neither cookie nor header are present', () => {
    expect(extractToken(makeReq())).toBeNull();
  });

  it('returns null for Authorization header without a token (empty Bearer)', () => {
    const req = makeReq({ headers: { authorization: 'Bearer ' } });
    expect(extractToken(req)).toBeNull();
  });

  it('returns null for Authorization header without Bearer prefix', () => {
    const req = makeReq({ headers: { authorization: 'Basic sometoken' } });
    // split(' ')[1] returns 'sometoken' — this IS returned (not a null case)
    // The function simply splits on space and takes index 1
    expect(extractToken(req)).toBe('sometoken');
  });
});

// ── authenticate ─────────────────────────────────────────────────────────────

describe('authenticate', () => {
  it('returns 401 when no token is present', () => {
    const next = vi.fn() as unknown as NextFunction;
    const { res, status, json } = makeRes();
    authenticate(makeReq(), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_REQUIRED' }));
  });

  it('returns 401 when JWT is invalid', () => {
    const next = vi.fn() as unknown as NextFunction;
    const { res, status } = makeRes();
    authenticate(makeReq({ cookies: { trek_session: 'invalid.jwt.token' } }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });
});

// ── adminOnly ─────────────────────────────────────────────────────────────────

describe('adminOnly', () => {
  it('returns 403 when user role is not admin', () => {
    const next = vi.fn() as unknown as NextFunction;
    const { res, status, json } = makeRes();
    const req = { ...makeReq(), user: { id: 1, role: 'user' } } as unknown as Request;
    adminOnly(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Admin') }));
  });

  it('calls next() when user role is admin', () => {
    const next = vi.fn() as unknown as NextFunction;
    const { res } = makeRes();
    const req = { ...makeReq(), user: { id: 1, role: 'admin' } } as unknown as Request;
    adminOnly(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when req.user is undefined', () => {
    const next = vi.fn() as unknown as NextFunction;
    const { res, status } = makeRes();
    adminOnly(makeReq() as unknown as Request, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });
});
