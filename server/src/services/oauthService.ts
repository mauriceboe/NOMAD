import crypto, { randomBytes, createHash, randomUUID } from 'crypto';
import { db } from '../db/database';
import { isAddonEnabled } from './adminService';
import { validateScopes } from '../mcp/scopes';
import { ADDON_IDS } from '../addons';
import { User } from '../types';
import { writeAudit, logWarn } from './auditLog';
import { revokeUserSessionsForClient } from '../mcp/sessionManager';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCESS_TOKEN_TTL_S   = 60 * 60;                          // 1 hour
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;        // 30 days rolling
const AUTH_CODE_TTL_MS     = 2 * 60 * 1000;                   // 2 minutes

// PKCE format (RFC 7636)
const CODE_CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;
const CODE_VERIFIER_RE  = /^[A-Za-z0-9\-._~]{43,128}$/;

// ---------------------------------------------------------------------------
// In-memory auth code store (short-lived, no need for DB persistence)
// ---------------------------------------------------------------------------

interface PendingCode {
  clientId: string;
  userId: number;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  expiresAt: number;
}

const pendingCodes = new Map<string, PendingCode>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pendingCodes) {
    if (now > entry.expiresAt) pendingCodes.delete(key);
  }
}, 60_000).unref();

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------

interface OAuthClientRow {
  id: string;
  user_id: number;
  name: string;
  client_id: string;
  client_secret_hash: string;
  redirect_uris: string;   // JSON array
  allowed_scopes: string;  // JSON array
  created_at: string;
  is_public: number;       // 0 | 1 (SQLite boolean)
  created_via: string;     // 'settings_ui' | 'browser-registration'
}

interface OAuthTokenRow {
  id: number;
  client_id: string;
  user_id: number;
  access_token_hash: string;
  refresh_token_hash: string;
  scopes: string;           // JSON array
  access_token_expires_at: string;
  refresh_token_expires_at: string;
  revoked_at: string | null;
  parent_token_id: number | null;
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Constant-time comparison of two hex-encoded SHA-256 hashes. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch { return false; }
}

function generateAccessToken(): string {
  return 'trekoa_' + randomBytes(24).toString('hex');
}

function generateRefreshToken(): string {
  return 'trekrf_' + randomBytes(24).toString('hex');
}

// ---------------------------------------------------------------------------
// Client management (self-service, gated by MCP addon)
// ---------------------------------------------------------------------------

export function listOAuthClients(userId: number): Record<string, unknown>[] {
  const rows = db.prepare(
    'SELECT id, user_id, name, client_id, redirect_uris, allowed_scopes, created_at, is_public, created_via FROM oauth_clients WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId) as OAuthClientRow[];
  return rows.map(r => ({
    ...r,
    is_public: Boolean(r.is_public),
    redirect_uris: JSON.parse(r.redirect_uris),
    allowed_scopes: JSON.parse(r.allowed_scopes),
  }));
}

/** Returns true if the URI is a valid OAuth redirect target (HTTPS or localhost). */
export function isValidRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function createOAuthClient(
  userId: number,
  name: string,
  redirectUris: string[],
  allowedScopes: string[],
  ip?: string | null,
  options?: { isPublic?: boolean; createdVia?: string },
): { error?: string; status?: number; client?: Record<string, unknown> } {
  if (!name?.trim()) return { error: 'Name is required', status: 400 };
  if (name.trim().length > 100) return { error: 'Name must be 100 characters or less', status: 400 };
  if (!redirectUris || redirectUris.length === 0) return { error: 'At least one redirect URI is required', status: 400 };
  if (redirectUris.length > 10) return { error: 'Maximum 10 redirect URIs per client', status: 400 };

  for (const uri of redirectUris) {
    let parsed: URL;
    try {
      parsed = new URL(uri);
    } catch {
      return { error: `Invalid redirect URI: ${uri}`, status: 400 };
    }
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      return { error: `Redirect URI must use HTTPS (localhost exempt): ${uri}`, status: 400 };
    }
  }

  if (!allowedScopes || allowedScopes.length === 0) return { error: 'At least one scope is required', status: 400 };
  const { valid, invalid } = validateScopes(allowedScopes);
  if (!valid) return { error: `Invalid scopes: ${invalid.join(', ')}`, status: 400 };

  const count = (db.prepare('SELECT COUNT(*) as count FROM oauth_clients WHERE user_id = ?').get(userId) as { count: number }).count;
  if (count >= 10) return { error: 'Maximum of 10 OAuth clients per user', status: 400 };

  const isPublic    = options?.isPublic ?? false;
  const createdVia  = options?.createdVia ?? 'settings_ui';
  const id          = randomUUID();
  const clientId    = randomUUID();
  // Public clients have no usable secret; store an opaque random value to satisfy NOT NULL.
  const rawSecret   = isPublic ? null : 'trekcs_' + randomBytes(24).toString('hex');
  const secretHash  = rawSecret ? hashToken(rawSecret) : randomBytes(32).toString('hex');

  db.prepare(
    'INSERT INTO oauth_clients (id, user_id, name, client_id, client_secret_hash, redirect_uris, allowed_scopes, is_public, created_via) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, userId, name.trim(), clientId, secretHash, JSON.stringify(redirectUris), JSON.stringify(allowedScopes), isPublic ? 1 : 0, createdVia);

  const row = db.prepare(
    'SELECT id, user_id, name, client_id, redirect_uris, allowed_scopes, created_at, is_public, created_via FROM oauth_clients WHERE id = ?'
  ).get(id) as OAuthClientRow;

  writeAudit({ userId, action: 'oauth.client.create', details: { client_id: clientId, name: name.trim(), is_public: isPublic }, ip });

  return {
    client: {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      client_id: row.client_id,
      redirect_uris: JSON.parse(row.redirect_uris),
      allowed_scopes: JSON.parse(row.allowed_scopes),
      created_at: row.created_at,
      is_public: Boolean(row.is_public),
      created_via: row.created_via,
      // client_secret only present for confidential clients — shown once, not stored in plain text
      ...(rawSecret ? { client_secret: rawSecret } : {}),
    },
  };
}

export function rotateOAuthClientSecret(
  userId: number,
  clientRowId: string,
  ip?: string | null,
): { error?: string; status?: number; client_secret?: string } {
  const row = db.prepare('SELECT id, client_id, is_public FROM oauth_clients WHERE id = ? AND user_id = ?').get(clientRowId, userId) as OAuthClientRow | undefined;
  if (!row) return { error: 'Client not found', status: 404 };
  if (row.is_public) return { error: 'Public clients do not use a client secret', status: 400 };

  const rawSecret  = 'trekcs_' + randomBytes(24).toString('hex');
  const secretHash = hashToken(rawSecret);

  db.prepare('UPDATE oauth_clients SET client_secret_hash = ? WHERE id = ?').run(secretHash, clientRowId);

  // Revoke all existing tokens for this client so old sessions are invalidated
  db.prepare("UPDATE oauth_tokens SET revoked_at = datetime('now') WHERE client_id = ? AND revoked_at IS NULL").run(row.client_id);

  // Terminate active MCP sessions for this (user, client) pair

  revokeUserSessionsForClient(userId, row.client_id);

  writeAudit({ userId, action: 'oauth.client.rotate_secret', details: { client_id: row.client_id }, ip });

  return { client_secret: rawSecret };
}

export function deleteOAuthClient(
  userId: number,
  clientRowId: string,
  ip?: string | null,
): { error?: string; status?: number; success?: boolean } {
  const row = db.prepare('SELECT id, client_id FROM oauth_clients WHERE id = ? AND user_id = ?').get(clientRowId, userId) as OAuthClientRow | undefined;
  if (!row) return { error: 'Client not found', status: 404 };
  db.prepare('DELETE FROM oauth_clients WHERE id = ?').run(clientRowId);
  writeAudit({ userId, action: 'oauth.client.delete', details: { client_id: row.client_id }, ip });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Auth code (in-memory, 2-minute TTL)
// ---------------------------------------------------------------------------

export function createAuthCode(params: {
  clientId: string;
  userId: number;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}): string {
  const rawCode = randomBytes(32).toString('hex');
  pendingCodes.set(rawCode, { ...params, expiresAt: Date.now() + AUTH_CODE_TTL_MS });
  return rawCode;
}

export function consumeAuthCode(code: string): PendingCode | null {
  const entry = pendingCodes.get(code);
  if (!entry) return null;
  pendingCodes.delete(code);
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}

// ---------------------------------------------------------------------------
// Consent management
// ---------------------------------------------------------------------------

export function getConsent(clientId: string, userId: number): string[] | null {
  const row = db.prepare(
    'SELECT scopes FROM oauth_consents WHERE client_id = ? AND user_id = ?'
  ).get(clientId, userId) as { scopes: string } | undefined;
  return row ? JSON.parse(row.scopes) : null;
}

export function saveConsent(clientId: string, userId: number, scopes: string[], ip?: string | null): void {
  // Union existing consent with newly approved scopes (M5: never narrow stored consent)
  const existing = getConsent(clientId, userId) ?? [];
  const merged = Array.from(new Set([...existing, ...scopes]));
  db.prepare(
    'INSERT OR REPLACE INTO oauth_consents (client_id, user_id, scopes, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
  ).run(clientId, userId, JSON.stringify(merged));
  writeAudit({ userId, action: 'oauth.consent.grant', details: { client_id: clientId, scopes: merged }, ip });
}

export function isConsentSufficient(existingScopes: string[], requestedScopes: string[]): boolean {
  return requestedScopes.every(s => existingScopes.includes(s));
}

// ---------------------------------------------------------------------------
// Token issuance
// ---------------------------------------------------------------------------

export function issueTokens(
  clientId: string,
  userId: number,
  scopes: string[],
  parentTokenId: number | null = null,
): {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
} {
  const rawAccess   = generateAccessToken();
  const rawRefresh  = generateRefreshToken();
  const accessHash  = hashToken(rawAccess);
  const refreshHash = hashToken(rawRefresh);

  const now           = new Date();
  const accessExpiry  = new Date(now.getTime() + ACCESS_TOKEN_TTL_S * 1000);
  const refreshExpiry = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);

  db.prepare(`
    INSERT INTO oauth_tokens
      (client_id, user_id, access_token_hash, refresh_token_hash, scopes, access_token_expires_at, refresh_token_expires_at, parent_token_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(clientId, userId, accessHash, refreshHash, JSON.stringify(scopes), accessExpiry.toISOString(), refreshExpiry.toISOString(), parentTokenId);

  return {
    access_token:  rawAccess,
    refresh_token: rawRefresh,
    token_type:    'Bearer',
    expires_in:    ACCESS_TOKEN_TTL_S,
    scope:         scopes.join(' '),
  };
}

// ---------------------------------------------------------------------------
// Token verification (used by MCP handler on every request)
// ---------------------------------------------------------------------------

export interface OAuthTokenInfo {
  user: User;
  scopes: string[];
  clientId: string;
}

export function getUserByAccessToken(rawToken: string): OAuthTokenInfo | null {
  const hash = hashToken(rawToken);
  const row = db.prepare(`
    SELECT ot.scopes, ot.revoked_at, ot.access_token_expires_at,
           ot.user_id, ot.client_id, u.username, u.email, u.role
    FROM oauth_tokens ot
    JOIN users u ON ot.user_id = u.id
    WHERE ot.access_token_hash = ?
  `).get(hash) as (OAuthTokenRow & { username: string; email: string; role: string }) | undefined;

  if (!row) return null;
  if (row.revoked_at) return null;
  if (new Date(row.access_token_expires_at) < new Date()) return null;

  return {
    user: { id: row.user_id, username: row.username, email: row.email, role: row.role as 'admin' | 'user' },
    scopes: JSON.parse(row.scopes),
    clientId: row.client_id,
  };
}

// ---------------------------------------------------------------------------
// Token refresh (rotation + replay detection)
// ---------------------------------------------------------------------------

/** Walk parent_token_id upward to find the root token id of this rotation chain. */
function findChainRoot(tokenId: number): number {
  let current = tokenId;
  for (let i = 0; i < 100; i++) {
    const row = db.prepare('SELECT id, parent_token_id FROM oauth_tokens WHERE id = ?').get(current) as { id: number; parent_token_id: number | null } | undefined;
    if (!row || row.parent_token_id === null) return current;
    current = row.parent_token_id;
  }
  return current;
}

/** Revoke all tokens in the rotation chain rooted at rootId. Returns affected ids. */
function revokeChain(rootId: number): number[] {
  const rows = db.prepare(`
    WITH RECURSIVE chain(id) AS (
      SELECT id FROM oauth_tokens WHERE id = ?
      UNION ALL
      SELECT t.id FROM oauth_tokens t JOIN chain c ON t.parent_token_id = c.id
    )
    SELECT id FROM chain
  `).all(rootId) as { id: number }[];
  const ids = rows.map(r => r.id);
  if (ids.length > 0) {
    db.prepare(
      `UPDATE oauth_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id IN (${ids.map(() => '?').join(',')}) AND revoked_at IS NULL`
    ).run(...ids);
  }
  return ids;
}

export function refreshTokens(
  rawRefreshToken: string,
  clientId: string,
  clientSecret: string | undefined,
  ip?: string | null,
): { error?: string; status?: number; tokens?: ReturnType<typeof issueTokens> } {
  const client = db.prepare('SELECT client_id, client_secret_hash, is_public FROM oauth_clients WHERE client_id = ?').get(clientId) as OAuthClientRow | undefined;
  if (!client) return { error: 'invalid_client', status: 401 };
  if (!client.is_public) {
    if (!clientSecret || !timingSafeEqualHex(hashToken(clientSecret), client.client_secret_hash)) {
      return { error: 'invalid_client', status: 401 };
    }
  }

  const hash = hashToken(rawRefreshToken);
  const row = db.prepare(`
    SELECT id, client_id, user_id, scopes, refresh_token_expires_at, revoked_at, parent_token_id
    FROM oauth_tokens WHERE refresh_token_hash = ?
  `).get(hash) as OAuthTokenRow | undefined;

  if (!row) return { error: 'invalid_grant', status: 400 };
  if (row.client_id !== clientId) return { error: 'invalid_grant', status: 400 };

  // ---- Replay detection (C3) ----
  if (row.revoked_at) {
    // A revoked refresh token was replayed — assume token theft. Cascade-revoke the chain.
    const rootId = findChainRoot(row.id);
    revokeChain(rootId);

  
    revokeUserSessionsForClient(row.user_id, clientId);

    writeAudit({
      userId: row.user_id,
      action: 'oauth.token.replay_detected',
      details: { client_id: clientId },
      ip,
    });
    logWarn(`[OAuth] Refresh token replay detected for user=${row.user_id} client=${clientId} ip=${ip ?? '-'}`);

    return { error: 'invalid_grant', status: 400 };
  }

  if (new Date(row.refresh_token_expires_at) < new Date()) return { error: 'invalid_grant', status: 400 };

  // Revoke old pair immediately (rotation) and issue new pair linked to old row
  db.prepare('UPDATE oauth_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);

  // Terminate active MCP sessions for the old token's client so client must re-authenticate

  revokeUserSessionsForClient(row.user_id, clientId);

  const tokens = issueTokens(clientId, row.user_id, JSON.parse(row.scopes), row.id);
  writeAudit({ userId: row.user_id, action: 'oauth.token.refresh', details: { client_id: clientId }, ip });

  return { tokens };
}

// ---------------------------------------------------------------------------
// Token revocation
// ---------------------------------------------------------------------------

export function revokeToken(rawToken: string, clientId: string, userId?: number, ip?: string | null): void {
  const hash = hashToken(rawToken);

  // Get the user_id for the token so we can revoke its MCP sessions
  const row = db.prepare(
    'SELECT user_id FROM oauth_tokens WHERE (access_token_hash = ? OR refresh_token_hash = ?) AND client_id = ?'
  ).get(hash, hash, clientId) as { user_id: number } | undefined;

  db.prepare(`
    UPDATE oauth_tokens
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE (access_token_hash = ? OR refresh_token_hash = ?) AND client_id = ?
  `).run(hash, hash, clientId);

  const affectedUserId = row?.user_id ?? userId;
  if (affectedUserId) {
  
    revokeUserSessionsForClient(affectedUserId, clientId);
    writeAudit({ userId: affectedUserId, action: 'oauth.token.revoke', details: { client_id: clientId, method: 'token' }, ip });
  }
}

// ---------------------------------------------------------------------------
// Active session listing (for user settings page)
// ---------------------------------------------------------------------------

export function listOAuthSessions(userId: number): Record<string, unknown>[] {
  const rows = db.prepare(`
    SELECT ot.id, ot.client_id, oc.name AS client_name, ot.scopes,
           ot.access_token_expires_at, ot.refresh_token_expires_at, ot.created_at
    FROM oauth_tokens ot
    JOIN oauth_clients oc ON ot.client_id = oc.client_id
    WHERE ot.user_id = ?
      AND ot.revoked_at IS NULL
      AND ot.refresh_token_expires_at > CURRENT_TIMESTAMP
    ORDER BY ot.created_at DESC
  `).all(userId) as Record<string, unknown>[];
  return rows.map(r => ({ ...r, scopes: JSON.parse(r.scopes as string) }));
}

export function revokeSession(
  userId: number,
  sessionId: number,
  ip?: string | null,
): { error?: string; status?: number; success?: boolean } {
  const row = db.prepare('SELECT id, client_id FROM oauth_tokens WHERE id = ? AND user_id = ?').get(sessionId, userId) as { id: number; client_id: string } | undefined;
  if (!row) return { error: 'Session not found', status: 404 };

  db.prepare('UPDATE oauth_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?').run(sessionId);


  revokeUserSessionsForClient(userId, row.client_id);

  writeAudit({ userId, action: 'oauth.token.revoke', details: { client_id: row.client_id, method: 'session' }, ip });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Authorize request validation (option A: called by SPA via GET /api/oauth/authorize/validate)
// ---------------------------------------------------------------------------

export interface AuthorizeParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state?: string;
  code_challenge: string;
  code_challenge_method: string;
}

export interface ValidateAuthorizeResult {
  valid: boolean;
  error?: string;
  error_description?: string;
  client?: { name: string; allowed_scopes: string[] };
  scopes?: string[];
  /** true when user is logged in but consent UI must be shown */
  consentRequired?: boolean;
  /** true when the request is valid but user is not authenticated */
  loginRequired?: boolean;
}

export function validateAuthorizeRequest(
  params: AuthorizeParams,
  userId: number | null,
): ValidateAuthorizeResult {
  if (!isAddonEnabled(ADDON_IDS.MCP)) {
    return { valid: false, error: 'mcp_disabled', error_description: 'MCP is not enabled on this server' };
  }

  if (params.response_type !== 'code') {
    return { valid: false, error: 'unsupported_response_type', error_description: 'Only response_type=code is supported' };
  }

  if (!params.code_challenge || params.code_challenge_method !== 'S256') {
    return { valid: false, error: 'invalid_request', error_description: 'PKCE with code_challenge_method=S256 is required (OAuth 2.1)' };
  }

  // H1: Enforce code_challenge format (RFC 7636 §4.2)
  if (!CODE_CHALLENGE_RE.test(params.code_challenge)) {
    return { valid: false, error: 'invalid_request', error_description: 'code_challenge must be 43 base64url characters (S256)' };
  }

  if (!params.client_id) {
    return { valid: false, error: 'invalid_request', error_description: 'client_id is required' };
  }

  const client = db.prepare('SELECT * FROM oauth_clients WHERE client_id = ?').get(params.client_id) as OAuthClientRow | undefined;
  if (!client) {
    return { valid: false, error: 'invalid_client', error_description: 'Unknown client_id' };
  }

  const allowedUris: string[] = JSON.parse(client.redirect_uris);
  if (!params.redirect_uri || !allowedUris.includes(params.redirect_uri)) {
    return { valid: false, error: 'invalid_redirect_uri', error_description: 'redirect_uri does not match any registered URI' };
  }

  const requestedScopes = (params.scope || '').split(' ').filter(Boolean);
  if (requestedScopes.length === 0) {
    return { valid: false, error: 'invalid_scope', error_description: 'At least one scope is required' };
  }

  const allowedScopes: string[] = JSON.parse(client.allowed_scopes);
  // Narrow to the intersection: drop scopes the client isn't permitted for rather
  // than rejecting the whole request (per OAuth 2.0 §3.3 scope narrowing).
  const grantedScopes = requestedScopes.filter(s => allowedScopes.includes(s));
  if (grantedScopes.length === 0) {
    return { valid: false, error: 'invalid_scope', error_description: 'None of the requested scopes are permitted for this client' };
  }

  if (userId === null) {
    // H3: return only the minimum required fields — do NOT expose scopes, client.name, or
    // allowed_scopes to unauthenticated callers to prevent client enumeration.
    return { valid: true, loginRequired: true };
  }

  const existingConsent = getConsent(params.client_id, userId);
  const consentRequired = !existingConsent || !isConsentSufficient(existingConsent, grantedScopes);

  return {
    valid: true,
    client: { name: client.name, allowed_scopes: allowedScopes },
    scopes: grantedScopes,
    consentRequired,
  };
}

// ---------------------------------------------------------------------------
// PKCE verification
// ---------------------------------------------------------------------------

export function verifyPKCE(codeVerifier: string, codeChallenge: string): boolean {
  // H1: validate code_verifier format before hashing
  if (!CODE_VERIFIER_RE.test(codeVerifier)) return false;

  const expected = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  // Constant-time compare (both are base64url strings of equal length for S256)
  if (expected.length !== codeChallenge.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(codeChallenge));
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// Client authentication (for token endpoint)
// ---------------------------------------------------------------------------

export function authenticateClient(clientId: string, clientSecret: string | undefined): OAuthClientRow | null {
  const client = db.prepare('SELECT * FROM oauth_clients WHERE client_id = ?').get(clientId) as OAuthClientRow | undefined;
  if (!client) return null;
  if (client.is_public) {
    // Public clients are identified by client_id alone — PKCE provides the security guarantee.
    return client;
  }
  // H4: constant-time comparison to prevent timing side-channel
  if (!clientSecret) return null;
  if (!timingSafeEqualHex(hashToken(clientSecret), client.client_secret_hash)) return null;
  return client;
}
