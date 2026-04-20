# Security Hardening

A production TREK deployment checklist. All items reference actual TREK configuration options.

## Encryption & Secrets

- [ ] Set a strong `ENCRYPTION_KEY` (generate with `openssl rand -hex 32`). See [Encryption-Key-Rotation](Encryption-Key-Rotation).
- [ ] Back up `ENCRYPTION_KEY` separately from the database backup ZIP — losing it makes all stored API keys and secrets unreadable. Stored secrets use AES-256-GCM encryption derived from this key.
- [ ] Rotate `ENCRYPTION_KEY` if it may have been exposed. See [Encryption-Key-Rotation](Encryption-Key-Rotation).
- [ ] Do **not** set `JWT_SECRET` via environment variable. TREK auto-generates it on first start, persists it to `data/.jwt_secret`, and manages rotation through the Admin Panel. Setting it via env var would override any rotation performed through the UI on next restart.

## HTTPS & Network

- [ ] Run TREK behind a TLS-terminating reverse proxy (nginx, Caddy, Traefik). See [Reverse-Proxy](Reverse-Proxy).
- [ ] Set `TRUST_PROXY=1` so client IPs are captured correctly in the audit log. In `NODE_ENV=production` this defaults to `1` automatically, but set it explicitly if you use a non-standard proxy hop count.
- [ ] Set `FORCE_HTTPS=true` to enable HSTS (`max-age=31536000`), redirect HTTP to HTTPS, and add `upgrade-insecure-requests` to the CSP. Requires `TRUST_PROXY` — omitting it causes a redirect loop.
- [ ] Keep `ALLOW_INTERNAL_NETWORK=false` unless Immich or Synology is on your LAN. See [Internal-Network-Access](Internal-Network-Access). Note: loopback (`127.x`, `::1`) and link-local (`169.254.x`) addresses are always blocked regardless of this setting.

## Authentication

- [ ] Enable two-factor authentication for your admin account. See [Two-Factor-Authentication](Two-Factor-Authentication).
- [ ] Require MFA for all users via [Admin-Permissions](Admin-Permissions) if your use case demands it. Note: you must have MFA enabled on your own admin account before you can enforce it globally.
- [ ] Disable open registration if you control who can access the instance. See [Admin-Users-and-Invites](Admin-Users-and-Invites).
- [ ] Rotate the JWT signing secret if a session may have been leaked: Admin Panel → Admin → Rotate JWT Secret (`POST /api/admin/rotate-jwt-secret`). This invalidates all active sessions immediately.

## Session Security

TREK stores sessions as JWTs in an httpOnly `trek_session` cookie (SameSite=Lax, 24-hour expiry). The `secure` flag is set automatically when `NODE_ENV=production` or `FORCE_HTTPS=true`. Tokens are also accepted via `Authorization: Bearer` header for MCP and API clients.

- [ ] Ensure `FORCE_HTTPS=true` (or `NODE_ENV=production`) so the `trek_session` cookie carries the `secure` flag and is never sent over plain HTTP.
- [ ] Set `COOKIE_SECURE=false` only as a temporary escape hatch for LAN testing without TLS — do not use in production.

## Password Policy

TREK enforces a minimum password policy on all registrations and password changes:

- Minimum 8 characters
- Must contain uppercase, lowercase, digit, and special character
- Common passwords and fully-repetitive strings are rejected
- Passwords are hashed with bcrypt (cost factor 12)

No configuration is required; this policy is always active.

## Rate Limiting

Built-in in-memory rate limits protect authentication endpoints:

| Endpoint | Limit | Window |
|---|---|---|
| Login / Register / Invite | 10 attempts | 15 minutes |
| MFA verify-login / enable | 5 attempts | 15 minutes |
| Password change | 5 attempts | 15 minutes |
| MCP token creation | 5 attempts | 15 minutes |

These limits are per source IP. If TREK is behind a reverse proxy, set `TRUST_PROXY` so the real client IP is used rather than the proxy's IP.

## Content Security Policy

Helmet applies a strict CSP on all responses. Key directives:

- `default-src 'self'`
- `script-src 'self' 'wasm-unsafe-eval'` (no `unsafe-inline`)
- `object-src 'none'`
- `frame-src 'none'`
- `frameAncestors 'self'` (prevents clickjacking from external frames)
- `upgrade-insecure-requests` (added automatically when `FORCE_HTTPS=true`)

## Backups

- [ ] Enable auto-backup with an appropriate retention window. See [Backups](Backups).
- [ ] Store backups off-site — copy backup ZIPs to a separate location outside the TREK host.

## Monitoring

- [ ] Review the audit log periodically for unexpected logins or admin changes. See [Audit-Log](Audit-Log).
- [ ] Check for TREK updates regularly. See [Admin-GitHub-Releases](Admin-GitHub-Releases) and [Updating](Updating).

## See also

- [Encryption-Key-Rotation](Encryption-Key-Rotation)
- [Reverse-Proxy](Reverse-Proxy)
- [Internal-Network-Access](Internal-Network-Access)
- [Two-Factor-Authentication](Two-Factor-Authentication)
- [Admin-Permissions](Admin-Permissions)
- [Admin-Users-and-Invites](Admin-Users-and-Invites)
- [Backups](Backups)
- [Audit-Log](Audit-Log)
- [Admin-GitHub-Releases](Admin-GitHub-Releases)
- [Updating](Updating)
- [Environment-Variables](Environment-Variables)
