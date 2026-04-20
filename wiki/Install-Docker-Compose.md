# Install: Docker Compose

Production-ready setup using Docker Compose with security hardening enabled.

## Compose File

Create a `docker-compose.yml` with the following content (taken directly from the repository):

```yaml
services:
  app:
    image: mauriceboe/trek:latest
    container_name: trek
    read_only: true
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETUID
      - SETGID
    tmpfs:
      - /tmp:noexec,nosuid,size=64m
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - ENCRYPTION_KEY=${ENCRYPTION_KEY:-} # Recommended. Generate with: openssl rand -hex 32. If unset, falls back to data/.jwt_secret (existing installs) or auto-generates a key (fresh installs).
      - TZ=${TZ:-UTC} # Timezone for logs, reminders and scheduled tasks (e.g. Europe/Berlin)
      - LOG_LEVEL=${LOG_LEVEL:-info} # info = concise user actions; debug = verbose admin-level details
#      - DEFAULT_LANGUAGE=en # Default language on the login page for users with no saved preference. Browser/OS language is auto-detected first; this is the fallback. Supported: de, en, es, fr, hu, nl, br, cs, pl, ru, zh, zh-TW, it, ar
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-} # Comma-separated origins for CORS and email notification links
#      - FORCE_HTTPS=true # Optional. Enables HTTPS redirect, HSTS, CSP upgrade-insecure-requests, and secure cookies behind a TLS proxy
#      - COOKIE_SECURE=false # Escape hatch: force session cookies over plain HTTP even in production. Not recommended.
#      - TRUST_PROXY=1 # Trusted proxy count for X-Forwarded-For / X-Forwarded-Proto. Required for FORCE_HTTPS to work.
#      - ALLOW_INTERNAL_NETWORK=false # Set to true if Immich or other services are hosted on your local network (RFC-1918 IPs). Loopback and link-local addresses remain blocked regardless.
#      - APP_URL=https://trek.example.com # Public base URL — required when OIDC is enabled (must match the redirect URI registered with your IdP); also used as base URL for links in email notifications
#      - OIDC_ISSUER=https://auth.example.com # OpenID Connect provider URL
#      - OIDC_CLIENT_ID=trek # OpenID Connect client ID
#      - OIDC_CLIENT_SECRET=supersecret # OpenID Connect client secret
#      - OIDC_DISPLAY_NAME=SSO # Label shown on the SSO login button
#      - OIDC_ONLY=false # Set true to force SSO-only mode: disables password login and registration, overrides Admin > Settings toggles, cannot be changed at runtime
#      - OIDC_ADMIN_CLAIM=groups # OIDC claim used to identify admin users
#      - OIDC_ADMIN_VALUE=app-trek-admins # Value of the OIDC claim that grants admin role
#      - OIDC_SCOPE=openid email profile # Fully overrides the default. Add extra scopes as needed (e.g. add groups if using OIDC_ADMIN_CLAIM)
#      - OIDC_DISCOVERY_URL= # Override the OIDC discovery endpoint for providers with non-standard paths (e.g. Authentik)
#      - ADMIN_EMAIL=admin@trek.local # Initial admin e-mail — only used on first boot when no users exist
#      - ADMIN_PASSWORD=changeme      # Initial admin password — only used on first boot when no users exist
#      - MCP_RATE_LIMIT=300 # Max MCP API requests per user per minute (default: 300)
#      - MCP_MAX_SESSION_PER_USER=20 # Max concurrent MCP sessions per user (default: 20)
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
```

## Security Hardening Explained

The compose file ships with several hardening options enabled by default:

| Setting | What it does |
|---|---|
| `read_only: true` | Mounts the container filesystem read-only; only the two named volumes and `/tmp` are writable |
| `security_opt: no-new-privileges:true` | Prevents the process from gaining additional Linux privileges via setuid/setgid executables |
| `cap_drop: [ALL]` | Drops all Linux capabilities from the container |
| `cap_add: [CHOWN, SETUID, SETGID]` | Adds back only the capabilities needed for the entrypoint to drop privileges to the `node` user |
| `tmpfs: /tmp:noexec,nosuid,size=64m` | Mounts a 64 MB in-memory `/tmp`; required because the container root is read-only |

## Volumes

| Host path | Container path | Contents |
|---|---|---|
| `./data` | `/app/data` | SQLite database, logs, `.jwt_secret`, `.encryption_key` |
| `./uploads` | `/app/uploads` | Uploaded files (photos, documents, covers, avatars) |

## Environment Variables

The compose file reads variables from a `.env` file placed alongside `docker-compose.yml`. At minimum, set:

```bash
# .env
ENCRYPTION_KEY=<output of: openssl rand -hex 32>
TZ=Europe/Berlin
ALLOWED_ORIGINS=https://trek.example.com
APP_URL=https://trek.example.com
```

Uncomment and fill in the OIDC, initial setup, or MCP variables as needed. For a full description of every variable, see [Environment-Variables].

## Start TREK

```bash
docker compose up -d
```

Check the logs:

```bash
docker compose logs -f
```

## HTTPS and Reverse Proxy

This compose file is designed for deployments where a reverse proxy (nginx, Caddy, Traefik) terminates TLS in front of TREK. To enable HTTPS redirects and secure cookies, uncomment `FORCE_HTTPS=true` and `TRUST_PROXY=1`.

See [Reverse-Proxy] for complete proxy configuration examples.

## Next Steps

- [Environment-Variables] — full variable reference
- [Reverse-Proxy] — HTTPS configuration
- [Updating] — how to pull a new image
