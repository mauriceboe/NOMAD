# Troubleshooting

## WebSocket not connecting / real-time sync broken

**Cause:** Your reverse proxy is not forwarding WebSocket upgrade headers on the `/ws` path.

**Fix:** Add the following to your proxy config for the `/ws` location:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

Without these headers, the WebSocket handshake fails and real-time sync will not work. See [Reverse Proxy](Reverse-Proxy) for a complete nginx and Caddy configuration. Caddy handles WebSocket upgrades automatically.

---

## HTTPS redirect loop

**Cause:** `FORCE_HTTPS=true` is set but your reverse proxy is not forwarding the `X-Forwarded-Proto: https` header, so every request looks like plain HTTP and gets redirected indefinitely.

**Fix:** Ensure your proxy passes the `X-Forwarded-Proto` header to TREK. Also set `TRUST_PROXY=1` so that Express uses the forwarded IP for rate limiting and audit logs:

```yaml
environment:
  - FORCE_HTTPS=true
  - TRUST_PROXY=1
```

> **Note:** The `/api/health` endpoint is always exempt from the HTTPS redirect so that Docker health checks continue to work over plain HTTP.

If you are accessing TREK directly on `http://<host>:3000` with no proxy, remove `FORCE_HTTPS` entirely. See [Environment Variables](Environment-Variables).

---

## Encrypted settings lost / API keys not working after migration

**Cause:** The `ENCRYPTION_KEY` was changed or lost. All API keys, SMTP passwords, OIDC client secrets, and MFA TOTP secrets are encrypted at rest using this key. Without the original key, decryption fails.

**Fix:** See [Encryption Key Rotation](Encryption-Key-Rotation) for the migration script that re-encrypts data under a new key. If the original key is gone entirely, the encrypted values are unrecoverable and must be re-entered in the admin panel.

> **Note:** If you upgraded from an older version without setting `ENCRYPTION_KEY`, the server uses the following resolution order on startup: (1) `ENCRYPTION_KEY` env var, (2) `data/.encryption_key` file, (3) one-time fallback to `data/.jwt_secret` for legacy upgrades — the value is immediately written to `data/.encryption_key` so JWT rotation cannot break decryption later, (4) auto-generated fresh key for brand-new installs. Check `data/.encryption_key` for the key currently in use.

---

## Locked out of MFA / lost authenticator

**Fix:** If you still have access to your account, use one of the 10 backup codes generated during MFA setup to complete login. After signing in, go to **Settings > Security** to disable or reconfigure MFA.

If you no longer have access to backup codes and cannot log in, an admin must disable MFA for your account directly in the database, or use the `reset-admin.js` script to regain access to an admin account. There is no per-user MFA reset in the Admin Panel UI — the Admin Panel only controls the global "require MFA for all users" policy. See [Admin: Users and Invites](Admin-Users-and-Invites).

---

## Demo user cannot edit or create

**Cause:** The instance is running with `DEMO_MODE=true`. All write operations are blocked for the demo account by design.

**Fix:** This is intentional behavior for public demo deployments. If you are self-hosting and want full access, remove the `DEMO_MODE` variable (or set it to `false`). See [Demo Mode](Demo-Mode).

---

## Backup restore fails with "file too large"

**Cause:** Your reverse proxy has a default body size limit (commonly 1 MB or 10 MB) that is smaller than the backup ZIP. Backup archives include the full uploads directory and can be large.

**Fix:** Raise the body size limit in your proxy config. TREK's own backup upload cap is 500 MB. For nginx:

```nginx
client_max_body_size 500m;
```

Add this to the `location /` block (or the specific backup route). See [Reverse Proxy](Reverse-Proxy) and [Backups](Backups).

---

## "Cannot find module" on startup

**Likely cause:** A Docker volume mount is missing or the `/app/data` and `/app/uploads` directories are not writable by the container process. TREK automatically creates all required subdirectories on startup (`data/logs`, `data/backups`, `data/tmp`, `uploads/files`, `uploads/covers`, `uploads/avatars`, `uploads/photos`) — if this fails because the volume is read-only or owned by the wrong user, startup will abort.

**Fix:** Check your Docker volume configuration. Both `./data:/app/data` and `./uploads:/app/uploads` must be mounted and writable. Run `docker inspect <container> --format '{{json .Mounts}}'` to verify the mounts are present and point to valid host paths. If the host directories are owned by root, the container's `chown` step (which runs as root before dropping to `node`) should correct permissions automatically — but if your host filesystem is read-only or permissions are locked down, grant write access manually:

```bash
sudo chown -R 1000:1000 ./data ./uploads
```
