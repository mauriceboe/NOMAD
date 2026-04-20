# Offline Mode and PWA

TREK can be installed as a Progressive Web App (PWA) and used without an internet connection for previously synced trips.

## Install as an app (PWA)

TREK must be served over **HTTPS** — the install prompt does not appear on plain HTTP.

**iOS (Safari):**
1. Open TREK in Safari.
2. Tap the Share button.
3. Select **Add to Home Screen**.

**Android (Chrome / Edge):**
1. Open TREK in the browser.
2. Tap the browser menu.
3. Select **Install app** or **Add to Home Screen**.

Once installed, TREK launches in **standalone** mode (fullscreen, no browser UI) using the TREK icon.

## What works offline

TREK uses Workbox service-worker caching plus an IndexedDB database (Dexie) for structured trip data. The following content is available offline after the first sync:

**Service-worker cache (Workbox)**

| Content | Cache name | Strategy | Duration | Max entries |
|---------|------------|----------|----------|-------------|
| CartoDB / OpenStreetMap map tiles | `map-tiles` | CacheFirst | 30 days | 1 000 |
| Leaflet / CDN assets (unpkg) | `cdn-libs` | CacheFirst | 365 days | 30 |
| API responses (trips, places, bookings, etc.) | `api-data` | NetworkFirst (5 s timeout) | 24 hours | 200 |
| Cover images and avatars (`/uploads/covers`, `/uploads/avatars`) | `user-uploads` | CacheFirst | 7 days | 300 |
| App shell (HTML / JS / CSS) | precache | Precached | Until next deploy | — |

> **Note:** The API cache excludes sensitive endpoints — `/api/auth`, `/api/admin`, `/api/backup`, and `/api/settings` are always fetched from the network.

**IndexedDB (Dexie) — structured trip data**

On login, after each trip-list refresh, and on WebSocket reconnect, TREK runs a background sync that writes full trip bundles into IndexedDB:

- Trips, days, places, packing items, to-dos, budget items, reservations, accommodations, trip members, tags, and categories.
- Non-photo file attachments (PDFs, documents, etc.) are downloaded and stored as blobs in IndexedDB.
- Map tiles are pre-fetched into the service-worker `map-tiles` cache for zoom levels 10–16 across each trip's bounding box (capped at ~50 MB of tiles per sync).

**Sync scope and eviction**

- Only ongoing and future trips are cached (trips whose `end_date` is today or later, or has no end date).
- Trips that ended more than 7 days ago are automatically evicted from IndexedDB on the next sync.

## Offline Cache (Settings → Offline)

The **Offline Cache** section under Settings → Offline shows the current state of the local cache.

<!-- TODO: screenshot: Offline tab showing cached trips -->

**Stats panel:**
- **Cached trips** — number of trips stored in IndexedDB (Dexie).
- **Pending changes** — number of actions taken offline that are queued to sync.

**Actions:**
- **Re-sync now** — forces a full sync with the server. Disabled when you are offline.
- **Clear cache** — removes all offline trip data from IndexedDB. You can re-sync any time while online.

Each cached trip entry shows the trip name, date range, place count, and file count, plus the time of the last successful sync.

## Limitations

- New trips created while offline are queued and synced when connectivity is restored.
- Photo uploads require connectivity; non-photo file attachments are pre-cached automatically during sync.
- Real-time collaboration features require an active WebSocket connection.
- Mapbox GL tiles are not cached by the service worker (Mapbox manages its own tile cache internally).

## See also

- [User-Settings](User-Settings)
- [Display-Settings](Display-Settings)
