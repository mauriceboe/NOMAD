# User Settings

The Settings page lets you personalise every aspect of TREK — appearance, maps, notifications, offline behaviour, and your account.

<!-- TODO: screenshot: user settings page tabs -->

## Navigating to Settings

Open the user menu in the top navigation bar and select **Settings**. The page opens on the **Display** tab by default.

If your account requires MFA setup, TREK redirects you directly to the **Account** tab (via `?mfa=required`).

## Tabs

| Tab | Purpose | Shown when |
|-----|---------|------------|
| Display | Color mode, language, temperature unit, time format, route calculation, booking route labels, and blur booking codes | Always |
| Map | Map provider (Leaflet or Mapbox GL), tile presets, Mapbox style and token, 3D buildings, high-quality mode, default map center and zoom | Always |
| Notifications | Email, webhook, ntfy, and in-app notification preferences | Always |
| Integrations | Photo providers (Immich, Synology, etc.) and MCP OAuth clients / API tokens | Only when the Memories or MCP addon is enabled |
| Offline | Cached trips, pending changes, re-sync and clear cache | Always |
| Account | Username, email, password, MFA (TOTP + backup codes), avatar, delete account | Always |
| About | App version, links to Ko-fi / Buy Me a Coffee / Discord / GitHub (bug reports, feature requests) / Wiki | Only when version metadata is available |

## Display tab

The Display tab controls the following preferences, all saved immediately on change:

- **Color mode** — Light, Dark, or Auto (follows the OS setting).
- **Language** — Displayed as a button grid on desktop and a dropdown on mobile.
- **Temperature unit** — Celsius (°C) or Fahrenheit (°F).
- **Time format** — 24h (14:30) or 12h (2:30 PM).
- **Route calculation** — Enable or disable automatic route calculation between places.
- **Booking route labels** — Show or hide labels on booking routes on the map.
- **Blur booking codes** — Blur confirmation codes and reference numbers (useful when screen-sharing).

## Map tab

The Map tab requires an explicit **Save** action after making changes.

**Provider** — choose between:

- **Leaflet** — Classic 2D raster tiles. You can pick from built-in presets (OpenStreetMap, OpenStreetMap DE, CartoDB Light/Dark, Stadia Smooth) or enter a custom tile URL template.
- **Mapbox GL** (Experimental) — Vector tiles with 3D buildings and terrain. Requires a public Mapbox access token (`pk.*`). Supports built-in style presets (Mapbox Standard, Standard Satellite, Streets, Outdoors, Light, Dark, Satellite, Satellite Streets, Navigation Day, Navigation Night) or a custom `mapbox://styles/USER/ID` URL. Additional options:
  - **3D Buildings & Terrain** — Pitch and real 3D building extrusions (works on every style including satellite).
  - **High Quality Mode** (Experimental) — Antialiasing + globe projection for sharper edges. May impact performance on lower-end devices.

> Atlas always uses Leaflet regardless of the provider setting.

**Default map position** — Set the default latitude, longitude, and zoom level. You can also click directly on the map preview to set the center.

## Account tab summary

The Account tab lets you:

- Edit your **username** and **email address**.
- Change your **password** (hidden when the server runs in OIDC-only mode — see [OIDC-SSO](OIDC-SSO)).
- Set up or disable **two-factor authentication** (TOTP). After enabling MFA, backup codes are shown once and can be copied, downloaded, or printed. See [Two-Factor-Authentication](Two-Factor-Authentication).
- Upload or remove your **profile avatar**.
- **Delete your account** (irreversible; blocked if you are the only admin).

If your account was linked via SSO, an **SSO** badge appears next to your role and the OIDC issuer domain is shown below it.

## Integrations tab

The Integrations tab is only visible when the **Memories** or **MCP** addon is enabled. It contains:

- **Photo Providers** — Configure Immich, Synology Photos, and other photo integrations (always shown when the Integrations tab is visible).
- **MCP section** (only when MCP addon is enabled):
  - Shows the MCP server endpoint URL.
  - **OAuth Clients** sub-tab — Create and manage OAuth 2.1 clients (with redirect URIs and scopes). Quick-fill presets are provided for Claude.ai, Claude Desktop, Cursor, VS Code, Windsurf, and Zed. Active OAuth sessions can be viewed and revoked here.
  - **API Tokens** sub-tab (Deprecated) — Create and manage personal bearer tokens for direct MCP access.

## See also

- [Display-Settings](Display-Settings)
- [Map-Settings](Map-Settings)
- [Notifications](Notifications)
- [Offline-Mode-and-PWA](Offline-Mode-and-PWA)
- [Two-Factor-Authentication](Two-Factor-Authentication)
- [Languages](Languages)
