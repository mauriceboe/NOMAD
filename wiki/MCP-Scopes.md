# MCP Scopes

OAuth scopes control exactly which data your AI client can read or write in TREK. You select scopes during the OAuth consent screen or when pre-creating an OAuth client. You can revoke access at any time by deleting the OAuth client or token from **Settings → Integrations → MCP**.

![OAuth consent screen](assets/OAuthConsentDCR.png)

## All scopes

TREK defines 27 scopes across 13 groups.

| Group | Scope | Permission |
|---|---|---|
| **Trips** | `trips:read` | View trips, days, day notes, and members |
| | `trips:write` | Create, update, and delete trips, days, day notes, and accommodations; manage members; duplicate trips |
| | `trips:delete` | Permanently delete entire trips (irreversible) |
| | `trips:share` | Create, update, and revoke public share links for trips |
| **Places** | `places:read` | Read places, day assignments, tags, and categories |
| | `places:write` | Create, update, and delete places, assignments, and tags |
| **Atlas** | `atlas:read` | Read visited countries, regions, and bucket list |
| | `atlas:write` | Mark countries and regions visited, manage bucket list |
| **Packing** | `packing:read` | Read packing items, bags, and category assignees |
| | `packing:write` | Add, update, delete, toggle, and reorder packing items and bags |
| **To-dos** | `todos:read` | Read trip to-do items and category assignees |
| | `todos:write` | Create, update, toggle, delete, and reorder to-do items |
| **Budget** | `budget:read` | Read budget items and expense breakdown |
| | `budget:write` | Create, update, and delete budget items |
| **Reservations** | `reservations:read` | Read reservations and accommodation details |
| | `reservations:write` | Create, update, delete, and reorder reservations |
| **Collaboration** | `collab:read` | Read collab notes, polls, and messages |
| | `collab:write` | Create, update, and delete collab notes, polls, and messages |
| **Notifications** | `notifications:read` | Read in-app notifications and unread counts |
| | `notifications:write` | Mark notifications as read or unread (individually or all at once) |
| **Vacation** | `vacay:read` | Read vacation planning data, entries, and stats |
| | `vacay:write` | Create and manage vacation entries, holidays, and team plans |
| **Geo** | `geo:read` | Search locations, resolve map URLs, and reverse-geocode coordinates |
| **Weather** | `weather:read` | Fetch weather forecasts for trip locations and dates |
| **Journey** | `journey:read` | Read journeys, entries, and contributor list |
| | `journey:write` | Create, update, and delete journeys and their entries |
| | `journey:share` | Create, update, and revoke public share links for journeys |

## Scope rules

- A `:write` scope implies `:read` access for the same group (e.g. `budget:write` also grants read access to budget data).
- Any `trips:*` scope (`trips:read`, `trips:write`, `trips:delete`, or `trips:share`) grants trip read access.
- `journey:read` or `journey:write` grants journey read access. `journey:share` alone does **not** grant read access — it only enables managing public share links.
- `list_trips` and `get_trip_summary` are always available regardless of scope — they are navigation tools.
- Static tokens and web session JWTs have full access equivalent to all scopes.
- Addon-gated tools (Atlas, Collab, Vacay, Journey) require both the relevant scope **and** the corresponding addon to be enabled by an admin.

## Choosing the right scopes

Grant only what you need. Some examples:

| Use case | Minimum scopes |
|---|---|
| Read-only AI assistant | All `:read` scopes relevant to your data |
| Full trip planner | All scopes except `:delete` (use the Claude.ai or Claude Desktop preset) |
| Budget review only | `trips:read` + `budget:read` |
| Packing list assistant | `trips:read` + `packing:read` + `packing:write` |
| Journey writer | `trips:read` + `journey:read` + `journey:write` |

The preset buttons in **Settings → Integrations → MCP → OAuth Clients** fill in a reasonable scope set for common clients. VS Code defaults to read-only scopes; Claude.ai and Claude Desktop default to all scopes except `:delete`.

## Related

- [MCP-Setup](MCP-Setup)
- [MCP-Tools-and-Resources](MCP-Tools-and-Resources)
