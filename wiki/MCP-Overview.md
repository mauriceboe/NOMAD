# MCP Overview

TREK includes a built-in [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server. MCP is an open standard that lets AI assistants read and modify data in external services through a structured API. When the MCP addon is enabled on your TREK instance, AI clients such as Claude.ai, Claude Desktop, Cursor, VS Code, and others can connect directly to your trips.

## What you can do

Once connected, an AI assistant can work with your TREK data in a single conversation:

- Create and update trips, days, and itineraries
- Search for real-world places and add them to your trip
- Build and manage packing lists and to-do items
- Track budgets and expenses across trip members
- Create reservations, transport bookings, and accommodations
- Send collab messages and notes to other trip members
- Mark countries and regions as visited in Atlas
- Log vacation days in Vacay
- Write journey entries across multiple trips

Changes made through MCP are broadcast to all connected clients in real-time — exactly like changes made in the web UI.

## Requirements

- **MCP addon enabled** — an administrator must enable the MCP addon (`mcp`) from the Admin Panel before the `/mcp` endpoint becomes available and the MCP section appears in user settings.
- **`APP_URL` set** — the `APP_URL` environment variable must be configured to your TREK instance's public URL so that OAuth discovery works correctly. Without it, clients that use OAuth 2.1 cannot complete authentication.

## Rate limits and session limits

| Setting | Default | Environment variable |
|---|---|---|
| Requests per minute per user | 300 | `MCP_RATE_LIMIT` |
| Max concurrent sessions per user | 20 | `MCP_MAX_SESSION_PER_USER` |

Rate limits are tracked per user–client pair, so each OAuth client has its own independent window. Sessions expire after 1 hour of inactivity.

## Endpoint

```
https://<your-trek-instance>/mcp
```

If the MCP addon is not enabled, this endpoint returns `403`. If authentication fails, it returns `401`.

> **Admin:** Enable the MCP addon in [Admin-Addons](Admin-Addons). Set `APP_URL` for OAuth discovery. Revoke tokens and manage OAuth clients from [Admin-MCP-Tokens](Admin-MCP-Tokens). Adjust rate and session limits with `MCP_RATE_LIMIT` and `MCP_MAX_SESSION_PER_USER` — see [Environment-Variables](Environment-Variables).

## Next steps

1. [MCP-Setup](MCP-Setup) — connect your AI client
2. [MCP-Scopes](MCP-Scopes) — choose the right permissions
3. [MCP-Tools-and-Resources](MCP-Tools-and-Resources) — browse available tools
