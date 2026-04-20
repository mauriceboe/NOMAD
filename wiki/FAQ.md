# FAQ

## Do I need a Google Maps API key?

No. When no Google Maps key is configured, TREK automatically falls back to OpenStreetMap (Nominatim) for place search — no API key or account required. If you want richer place data (photos, ratings, opening hours), an admin can optionally add a Google Maps key in [User Settings](User-Settings).

## Can I use TREK offline?

Yes. TREK is a Progressive Web App. After your first visit, the service worker (powered by Workbox) caches map tiles (Carto and OpenStreetMap), non-sensitive API responses, uploaded covers and avatars, and all static assets. Subsequent visits work without a network connection for already-cached content. See [Offline Mode and PWA](Offline-Mode-and-PWA) for installation instructions.

> **Note:** Auth, admin, backup, and settings endpoints are intentionally excluded from the offline cache.

## How many MCP tokens can I create?

Each user can create up to **10 static API tokens**. Static tokens are deprecated — migrate to OAuth 2.1 when possible.

For OAuth 2.1, each user can register up to **10 OAuth clients**. The default limit for concurrent MCP sessions is **20 per user** (configurable via `MCP_MAX_SESSION_PER_USER`). See [MCP Setup](MCP-Setup).

> **Admin:** MCP must be enabled in Admin Panel > Addons before any user can access it.

## Where is my data stored?

| Type | Path |
|------|------|
| Database | `./data/travel.db` (SQLite) |
| Uploads | `./uploads/` |
| Logs | `./data/logs/trek.log` (auto-rotated) |
| Backups | `./data/backups/` |

When running in Docker, mount `./data` and `./uploads` as volumes so your data survives container updates. See [Install: Docker Compose](Install-Docker-Compose).

## How do I update TREK?

Pull the new image and recreate the container. Your data is in the mounted volumes and is never modified by the update process. See [Updating](Updating) for the exact commands.

## Can I restrict who can register?

Yes. An admin can disable open registration so that new accounts can only be created via invite links. See [Admin: Users and Invites](Admin-Users-and-Invites).

## Does TREK support single sign-on?

Yes, via OpenID Connect (OIDC). Compatible providers include Google, Authentik, Keycloak, and any standard OIDC-compliant IdP. Set `OIDC_ONLY=true` to disable password login entirely. See [OIDC SSO](OIDC-SSO).
