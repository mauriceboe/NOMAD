import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/database';
import { JWT_SECRET } from '../config';
import { AuthRequest, OptionalAuthRequest, User } from '../types';
import { applyIdempotency } from './idempotency';
import { isDemoEmail } from '../services/demo';

export function extractToken(req: Request): string | null {
  // Prefer httpOnly cookie; fall back to Authorization: Bearer (MCP, API clients)
  const cookieToken = (req as any).cookies?.trek_session;
  if (cookieToken) return cookieToken;
  const authHeader = req.headers['authorization'];
  return (authHeader && authHeader.split(' ')[1]) || null;
}

/**
 * Verify a JWT and load its user, enforcing the password_version gate.
 *
 * Exported so every auth surface in the codebase (MCP bearer tokens,
 * file download query tokens, the photo-serving route) goes through the
 * same check. A password reset bumps `users.password_version`, which
 * invalidates every JWT that embedded the prior value — but only if
 * every verify path actually compares the claim. Previously several
 * paths called `jwt.verify` directly and skipped the DB lookup, so a
 * stolen token kept working after the victim reset.
 */
export function verifyJwtAndLoadUser(token: string): User | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as { id: number; pv?: number };
    const row = db.prepare(
      'SELECT id, username, email, role, password_version FROM users WHERE id = ?'
    ).get(decoded.id) as (User & { password_version?: number }) | undefined;
    if (!row) return null;
    // Session invalidation: any token whose embedded password_version
    // predates the user's current one is rejected. Tokens issued before
    // the `pv` claim existed (decoded.pv === undefined) are treated as
    // version 0 so legacy sessions keep working until the user resets.
    const tokenPv = typeof decoded.pv === 'number' ? decoded.pv : 0;
    const currentPv = typeof row.password_version === 'number' ? row.password_version : 0;
    if (tokenPv !== currentPv) return null;
    // Don't leak password_version beyond the middleware.
    const { password_version: _pv, ...user } = row;
    return user as User;
  } catch {
    return null;
  }
}

const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: 'Access token required', code: 'AUTH_REQUIRED' });
    return;
  }

  const user = verifyJwtAndLoadUser(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired token', code: 'AUTH_REQUIRED' });
    return;
  }
  (req as AuthRequest).user = user;
  applyIdempotency(req, res, next, user.id);
};

/** Like `authenticate` but rejects requests that don't carry an httpOnly session cookie.
 *  Used on state-mutating OAuth endpoints (consent POST, client CRUD, session revoke)
 *  to prevent Bearer JWT tokens obtained by other means from managing OAuth clients. */
const requireCookieAuth = (req: Request, res: Response, next: NextFunction): void => {
  const cookieToken = (req as any).cookies?.trek_session;
  if (!cookieToken) {
    res.status(401).json({ error: 'Cookie session required for this endpoint', code: 'COOKIE_AUTH_REQUIRED' });
    return;
  }
  const user = verifyJwtAndLoadUser(cookieToken);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session', code: 'AUTH_REQUIRED' });
    return;
  }
  (req as AuthRequest).user = user;
  next();
};

const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = extractToken(req);

  if (!token) {
    (req as OptionalAuthRequest).user = null;
    return next();
  }

  (req as OptionalAuthRequest).user = verifyJwtAndLoadUser(token) || null;
  next();
};

const adminOnly = (req: Request, res: Response, next: NextFunction): void => {
  const authReq = req as AuthRequest;
  if (!authReq.user || authReq.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};

const demoUploadBlock = (req: Request, res: Response, next: NextFunction): void => {
  const authReq = req as AuthRequest;
  if (process.env.DEMO_MODE?.toLowerCase() === 'true' && isDemoEmail(authReq.user?.email)) {
    res.status(403).json({ error: 'Uploads are disabled in demo mode. Self-host TREK for full functionality.' });
    return;
  }
  next();
};

export { authenticate, requireCookieAuth, optionalAuth, adminOnly, demoUploadBlock };
