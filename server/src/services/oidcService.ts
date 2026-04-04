import crypto from 'crypto';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { db } from '../db/database';
import { JWT_SECRET } from '../config';
import { User } from '../types';
import { decrypt_api_key } from './apiKeyCrypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OidcDiscoveryDoc {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  _issuer?: string;
}

export interface OidcTokenResponse {
  access_token?: string;
  id_token?: string;
  token_type?: string;
}

export interface OidcUserInfo {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  groups?: string[];
  roles?: string[];
  [key: string]: unknown;
}

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  displayName: string;
  discoveryUrl: string | null;
}

// ---------------------------------------------------------------------------
// Constants / TTLs
// ---------------------------------------------------------------------------

const AUTH_CODE_TTL = 60000;          // 1 minute
const AUTH_CODE_CLEANUP = 30000;      // 30 seconds
const STATE_TTL = 5 * 60 * 1000;     // 5 minutes
const STATE_CLEANUP = 60 * 1000;      // 1 minute
const DISCOVERY_TTL = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// State management – pending OIDC states
// ---------------------------------------------------------------------------

const pendingStates = new Map<string, { createdAt: number; redirectUri: string; inviteToken?: string }>();

setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingStates) {
    if (now - data.createdAt > STATE_TTL) pendingStates.delete(state);
  }
}, STATE_CLEANUP);

export function createState(redirectUri: string, inviteToken?: string): string {
  const state = crypto.randomBytes(32).toString('hex');
  pendingStates.set(state, { createdAt: Date.now(), redirectUri, inviteToken });
  return state;
}

export function consumeState(state: string) {
  const pending = pendingStates.get(state);
  if (!pending) return null;
  pendingStates.delete(state);
  return pending;
}

// ---------------------------------------------------------------------------
// Auth code management – short-lived codes exchanged for JWT
// ---------------------------------------------------------------------------

const authCodes = new Map<string, { token: string; created: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of authCodes) {
    if (now - entry.created > AUTH_CODE_TTL) authCodes.delete(code);
  }
}, AUTH_CODE_CLEANUP);

export function createAuthCode(token: string): string {
  const { v4: uuidv4 } = require('uuid');
  const authCode: string = uuidv4();
  authCodes.set(authCode, { token, created: Date.now() });
  return authCode;
}

export function consumeAuthCode(code: string): { token: string } | { error: string } {
  const entry = authCodes.get(code);
  if (!entry) return { error: 'Invalid or expired code' };
  authCodes.delete(code);
  if (Date.now() - entry.created > AUTH_CODE_TTL) return { error: 'Code expired' };
  return { token: entry.token };
}

// ---------------------------------------------------------------------------
// OIDC configuration (env + DB)
// ---------------------------------------------------------------------------

export function getOidcConfig(): OidcConfig | null {
  const get = (key: string) =>
    (db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined)?.value || null;

  const issuer = process.env.OIDC_ISSUER || get('oidc_issuer');
  const clientId = process.env.OIDC_CLIENT_ID || get('oidc_client_id');
  const clientSecret = process.env.OIDC_CLIENT_SECRET || decrypt_api_key(get('oidc_client_secret'));
  const displayName = process.env.OIDC_DISPLAY_NAME || get('oidc_display_name') || 'SSO';
  const discoveryUrl = process.env.OIDC_DISCOVERY_URL || get('oidc_discovery_url') || null;

  if (!issuer || !clientId || !clientSecret) return null;
  return { issuer: issuer.replace(/\/+$/, ''), clientId, clientSecret, displayName, discoveryUrl };
}

// ---------------------------------------------------------------------------
// Discovery document (cached, 1 h TTL)
// ---------------------------------------------------------------------------

let discoveryCache: OidcDiscoveryDoc | null = null;
let discoveryCacheTime = 0;

export async function discover(issuer: string, discoveryUrl?: string | null): Promise<OidcDiscoveryDoc> {
  const url = discoveryUrl || `${issuer}/.well-known/openid-configuration`;
  if (discoveryCache && Date.now() - discoveryCacheTime < DISCOVERY_TTL && discoveryCache._issuer === url) {
    return discoveryCache;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch OIDC discovery document');
  const doc = (await res.json()) as OidcDiscoveryDoc;
  doc._issuer = url;
  discoveryCache = doc;
  discoveryCacheTime = Date.now();
  return doc;
}

// ---------------------------------------------------------------------------
// Role resolution via OIDC claims
// ---------------------------------------------------------------------------

export function resolveOidcRole(userInfo: OidcUserInfo, isFirstUser: boolean): 'admin' | 'user' {
  if (isFirstUser) return 'admin';
  const adminValue = process.env.OIDC_ADMIN_VALUE;
  if (!adminValue) return 'user';
  const claimKey = process.env.OIDC_ADMIN_CLAIM || 'groups';
  const claimData = userInfo[claimKey];
  if (Array.isArray(claimData)) {
    return claimData.some((v) => String(v) === adminValue) ? 'admin' : 'user';
  }
  if (typeof claimData === 'string') {
    return claimData === adminValue ? 'admin' : 'user';
  }
  return 'user';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function frontendUrl(path: string): string {
  const base = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173';
  return base + path;
}

export function generateToken(user: { id: number }): string {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h', algorithm: 'HS256' });
}

export function getAppUrl(): string | null {
  return (
    process.env.APP_URL ||
    (db.prepare("SELECT value FROM app_settings WHERE key = 'app_url'").get() as { value: string } | undefined)?.value ||
    null
  );
}

// ---------------------------------------------------------------------------
// Token exchange with OIDC provider
// ---------------------------------------------------------------------------

export async function exchangeCodeForToken(
  doc: OidcDiscoveryDoc,
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<OidcTokenResponse & { _ok: boolean; _status: number }> {
  const tokenRes = await fetch(doc.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const tokenData = (await tokenRes.json()) as OidcTokenResponse;
  return { ...tokenData, _ok: tokenRes.ok, _status: tokenRes.status };
}

// ---------------------------------------------------------------------------
// Fetch userinfo from OIDC provider
// ---------------------------------------------------------------------------

export async function getUserInfo(userinfoEndpoint: string, accessToken: string): Promise<OidcUserInfo> {
  const res = await fetch(userinfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return (await res.json()) as OidcUserInfo;
}

// ---------------------------------------------------------------------------
// Find or create user by OIDC sub / email
// ---------------------------------------------------------------------------

export function findOrCreateUser(
  userInfo: OidcUserInfo,
  config: OidcConfig,
  inviteToken?: string,
): { user: User } | { error: string } {
  const email = userInfo.email!.toLowerCase();
  const name = userInfo.name || userInfo.preferred_username || email.split('@')[0];
  const sub = userInfo.sub;

  // Try to find existing user by sub, then by email
  let user = db.prepare('SELECT * FROM users WHERE oidc_sub = ? AND oidc_issuer = ?').get(sub, config.issuer) as User | undefined;
  if (!user) {
    user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email) as User | undefined;
  }

  if (user) {
    // Link OIDC identity if not yet linked
    if (!user.oidc_sub) {
      db.prepare('UPDATE users SET oidc_sub = ?, oidc_issuer = ? WHERE id = ?').run(sub, config.issuer, user.id);
    }
    // Update role based on OIDC claims on every login (if claim mapping is configured)
    if (process.env.OIDC_ADMIN_VALUE) {
      const newRole = resolveOidcRole(userInfo, false);
      if (user.role !== newRole) {
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, user.id);
        user = { ...user, role: newRole } as User;
      }
    }
    return { user };
  }

  // --- New user registration ---
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  const isFirstUser = userCount === 0;

  let validInvite: any = null;
  if (inviteToken) {
    validInvite = db.prepare('SELECT * FROM invite_tokens WHERE token = ?').get(inviteToken);
    if (validInvite) {
      if (validInvite.max_uses > 0 && validInvite.used_count >= validInvite.max_uses) validInvite = null;
      if (validInvite?.expires_at && new Date(validInvite.expires_at) < new Date()) validInvite = null;
    }
  }

  if (!isFirstUser && !validInvite) {
    const setting = db.prepare("SELECT value FROM app_settings WHERE key = 'allow_registration'").get() as
      | { value: string }
      | undefined;
    if (setting?.value === 'false') {
      return { error: 'registration_disabled' };
    }
  }

  const role = resolveOidcRole(userInfo, isFirstUser);
  const randomPass = crypto.randomBytes(32).toString('hex');
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync(randomPass, 10);

  // Username: sanitize and avoid collisions
  let username = name.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 30) || 'user';
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username);
  if (existing) username = `${username}_${Date.now() % 10000}`;

  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash, role, oidc_sub, oidc_issuer) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(username, email, hash, role, sub, config.issuer);

  if (validInvite) {
    const updated = db.prepare(
      'UPDATE invite_tokens SET used_count = used_count + 1 WHERE id = ? AND (max_uses = 0 OR used_count < max_uses)',
    ).run(validInvite.id);
    if (updated.changes === 0) {
      console.warn(`[OIDC] Invite token ${inviteToken?.slice(0, 8)}... exceeded max_uses (race condition)`);
    }
  }

  user = { id: Number(result.lastInsertRowid), username, email, role } as User;
  return { user };
}

// ---------------------------------------------------------------------------
// Update last_login timestamp
// ---------------------------------------------------------------------------

export function touchLastLogin(userId: number): void {
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
}
