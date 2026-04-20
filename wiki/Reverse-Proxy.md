# Reverse Proxy

Putting TREK behind a TLS-terminating reverse proxy is strongly recommended for production.

## Why HTTPS Matters for TREK

- **PWA install** requires HTTPS — browsers block "Add to Home Screen" on plain HTTP.
- **Session cookies** — the `trek_session` cookie is marked `secure` in production, so it won't be sent over HTTP.
- **OIDC / SSO** — identity providers require the redirect URI to use HTTPS.
- **MCP** — the MCP API requires HTTPS for OAuth 2.1 auth.

## Two Hard Requirements

Whatever proxy you use, it must satisfy two constraints:

1. **WebSocket upgrades on `/ws`** — TREK uses WebSockets for real-time sync. Set `proxy_read_timeout 86400` (Nginx) or rely on Caddy's automatic upgrade handling.
2. **Body size ≥ 500 MB** — backup restore ZIPs can include the full uploads directory. Set `client_max_body_size 500m` (Nginx) or `request_body_max_size 500mb` (Caddy) if you restore large backups.

## Nginx

```nginx
server {
    listen 80;
    server_name trek.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name trek.yourdomain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        # File uploads are capped at 50 MB; backup restore ZIPs can include the full
        # uploads directory and may exceed that — raise this value if restores fail.
        client_max_body_size 500m;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Needed for backup restore uploads — can exceed the Nginx default of 1 MB.
        client_max_body_size 500m;
    }
}
```

Key lines:
- `proxy_read_timeout 86400` — keeps WebSocket connections alive (86400 s = 24 h).
- `client_max_body_size 500m` — allows large backup restore uploads; set in both locations.
- `X-Forwarded-Proto $scheme` — tells TREK whether the original request was HTTPS; required for `FORCE_HTTPS` redirect and cookie security to work correctly.

## Caddy

Caddy handles WebSocket upgrades automatically:

```
trek.yourdomain.com {
    reverse_proxy localhost:3000
}
```

For large backup restores, add:

```
trek.yourdomain.com {
    request_body max_size 500mb
    reverse_proxy localhost:3000
}
```

## HTTPS Environment Variables

Four variables control how TREK behaves behind a proxy. They work as a group:

| Variable | Purpose | Default |
|---|---|---|
| `FORCE_HTTPS` | When `true`: 301-redirects HTTP→HTTPS (except `/api/health`), sends HSTS (`max-age=31536000`), adds CSP `upgrade-insecure-requests`, forces cookie `secure` flag | `false` |
| `TRUST_PROXY` | Number of trusted proxy hops. Lets Express read the real client IP from `X-Forwarded-For`. Automatically set to `1` in production even if not explicitly configured. | `1` (production), off (development) |
| `COOKIE_SECURE` | Controls the `secure` flag on `trek_session`. Auto-derived as `true` when `NODE_ENV=production` or `FORCE_HTTPS=true`. Set to `false` explicitly to allow cookies over plain HTTP (e.g. LAN testing without TLS). | auto |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins (e.g. `https://trek.example.com`). In production without this set, all cross-origin requests are blocked. In development without this set, all origins are allowed. | blocked in prod, open in dev |

> **Note on `FORCE_HTTPS` and proxy headers:** The HTTPS redirect reads `X-Forwarded-Proto` directly from the incoming headers — it does not depend on Express's `trust proxy` setting. If you set `FORCE_HTTPS=true` and your reverse proxy correctly sends `X-Forwarded-Proto: https`, the redirect will work regardless of `TRUST_PROXY`. However, you still need `TRUST_PROXY` set so Express resolves the correct client IP from `X-Forwarded-For`.

If you access TREK directly on `http://<host>:3000` without a proxy, leave `FORCE_HTTPS` unset and do not set `TRUST_PROXY`.

See [Environment-Variables] for full documentation of these and all other variables.

## Next Steps

- [Environment-Variables] — full variable reference including OIDC
- [Install-Docker-Compose] — production compose file with proxy-ready env vars
