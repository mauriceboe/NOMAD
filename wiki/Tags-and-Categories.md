# Tags and Categories

TREK has a labeling system: **Global Place Categories** (admin-managed, shared across all users).


<!-- TODO: screenshot: tag list on place detail -->

## Global Place Categories

Categories classify places across all trips. Every user sees the same set of categories.

**Fields per category:**

- **Name** — displayed in the place form and sidebar filter.
- **Color** — used for the colored icon background on map markers and in the places sidebar. Default: `#6366f1`.
- **Icon** — a Lucide icon name (e.g. `MapPin`, `Coffee`, `Mountain`). The UI form defaults to `MapPin`; the database-level fallback is the 📍 emoji, which is also resolved to the `MapPin` Lucide icon at render time.

Categories appear in:

- The **place form** when adding or editing a place.
- The **places sidebar** as filter options.
- **Map markers** — the category icon and color are used to style each place's marker pin.
- **Map tooltips** — hovering a marker shows the category name and icon.

> **Admin:** Create and manage categories in [Admin-Categories](Admin-Categories). Only admins can create, edit, or delete categories. All users can read them.

## When to use which

| Use case | Use |
|---|---|
| Classifying a place by type (Restaurant, Museum, Hiking Trail…) | **Category** |
| Personal labels you want to apply to specific places | **Tag** |

## See also

- [Places-and-Search](Places-and-Search)
- [Admin-Categories](Admin-Categories)
- [MCP-Overview](MCP-Overview)
