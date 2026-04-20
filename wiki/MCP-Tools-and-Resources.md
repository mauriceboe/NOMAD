# MCP Tools and Resources

TREK exposes **tools** (read and write actions) and **resources** (read-only `trek://` URIs). Tools are registered per-session based on OAuth scopes and enabled addons.

For addon-gated tools (Packing, To-Dos, Atlas, Collab, Vacay, Journey) and their resources, see [MCP-Addon-Tools](MCP-Addon-Tools).

## Tools

### Trip Summary

| Tool | Description |
|---|---|
| `get_trip_summary` | Full denormalized snapshot of a trip — metadata, members, days with assignments and notes, accommodations, budget, packing, reservations, collab notes, and to-dos in one call. Use this as your context loader before making changes. |

### Compound tools

Compound tools collapse multi-step workflows into a single atomic transaction. If the second step fails, the first is rolled back.

> Use compound tools only when the place or item does not yet exist. For existing records, call the individual tools directly.

| Tool | Wraps | Description |
|---|---|---|
| `create_and_assign_place` | `create_place` + `assign_place_to_day` | Create a place and assign it to a day. Returns `{ place, assignment }`. Requires `places:write`. |
| `create_place_accommodation` | `create_place` + `create_accommodation` | Create a place and book it as an accommodation. Returns `{ place, accommodation }`. Requires `trips:write`. |
| `create_budget_item_with_members` | `create_budget_item` + `set_budget_item_members` | Create a budget item and set splitting members. If `userIds` is omitted, behaves like `create_budget_item`. Returns `{ item }`. Requires `budget:write`. |

### Trips

Requires `trips:read` or `trips:write` scope.

| Tool | Description |
|---|---|
| `list_trips` | List all trips you own or are a member of. Supports `include_archived` flag. |
| `create_trip` | Create a trip with title, dates, and currency. Days are auto-generated from the date range. |
| `update_trip` | Update a trip's title, description, dates, or currency. |
| `delete_trip` | Delete a trip. Owner only. Requires `trips:delete`. |
| `list_trip_members` | List the owner and all collaborators of a trip. |
| `add_trip_member` | Add a user to a trip by username or email. Owner only. |
| `remove_trip_member` | Remove a collaborator from a trip. Owner only. |
| `copy_trip` | Duplicate a trip (days, places, itinerary, packing, budget, reservations). Packing items reset to unchecked. |
| `export_trip_ics` | Export the trip itinerary and reservations as iCalendar (`.ics`) text. |
| `get_share_link` | Get the current public share link for a trip and its permission flags. Requires `trips:share`. |
| `create_share_link` | Create or update the public share link with configurable visibility flags. Requires `trips:share`. |
| `delete_share_link` | Revoke the public share link for a trip. Requires `trips:share`. |

### Places

Requires `places:read` or `places:write` scope.

| Tool | Description |
|---|---|
| `list_places` | List places in a trip, optionally filtered by assignment status, category, tag, or search query. |
| `create_place` | Add a place with name, coordinates, address, category, notes, website, phone, and optional `google_place_id` / `osm_id`. |
| `update_place` | Update any field of an existing place including transport mode, timing, and price. |
| `delete_place` | Remove a place from a trip. Also removes all day assignments. |
| `bulk_delete_places` | Delete multiple places by ID. Removes all day assignments. Cannot be undone. |
| `import_places_from_url` | Import all places from a publicly shared Google Maps or Naver Maps list URL. |
| `list_categories` | List all available place categories with id, name, icon, and color. |
| `search_place` | Search for a place by name or address. Returns `osm_id` and `google_place_id` for use in `create_place`. |

### Day Planning

Requires `trips:read` or `trips:write` scope.

| Tool | Description |
|---|---|
| `update_day` | Set or clear a day's title. |
| `create_day` | Add a new day to a trip with optional date and notes. |
| `delete_day` | Delete a day from a trip. |
| `assign_place_to_day` | Pin a place to a specific day in the itinerary. Requires `places:write`. |
| `unassign_place` | Remove a place assignment from a day. Requires `places:write`. |
| `reorder_day_assignments` | Reorder places within a day by providing assignment IDs in order. Requires `places:write`. |
| `update_assignment_time` | Set start/end times for a place assignment (e.g. `"09:00"` – `"11:30"`). Pass `null` to clear. Requires `places:write`. |
| `move_assignment` | Move a place assignment to a different day. Requires `places:write`. |
| `get_assignment_participants` | Get users participating in a specific place assignment. |
| `set_assignment_participants` | Set participants for a place assignment (replaces current list). |

### Day Notes

Requires `trips:read` or `trips:write` scope.

| Tool | Description |
|---|---|
| `create_day_note` | Add a note to a specific day with optional time label and emoji icon. |
| `update_day_note` | Edit a day note's text, time, or icon. |
| `delete_day_note` | Remove a note from a day. |

### Accommodations

Requires `trips:read` or `trips:write` scope.

| Tool | Description |
|---|---|
| `create_accommodation` | Add an accommodation (hotel, Airbnb, etc.) linked to a place and a check-in/check-out date range. |
| `update_accommodation` | Update fields on an existing accommodation including dates, times, confirmation, and notes. |
| `delete_accommodation` | Delete an accommodation record from a trip. |

### Transport

Requires `reservations:write` scope.

| Tool | Description |
|---|---|
| `create_transport` | Create a transport booking (`flight`, `train`, `car`, `cruise`) with optional multi-stop endpoints, departure/arrival times, and confirmation details. |
| `update_transport` | Update an existing transport booking. Pass `endpoints[]` to replace all stops. |
| `delete_transport` | Delete a transport booking from a trip. |

### Reservations

Requires `reservations:read` or `reservations:write` scope.

| Tool | Description |
|---|---|
| `create_reservation` | Create a pending reservation — hotels, restaurants, events, tours, activities, and other types. |
| `update_reservation` | Update any field including status (`pending` / `confirmed` / `cancelled`). |
| `delete_reservation` | Delete a reservation and its linked accommodation record if applicable. |
| `reorder_reservations` | Reorder reservations within a day. |
| `link_hotel_accommodation` | Set or update a hotel reservation's check-in/out day links and place. |

### Budget

Requires `budget:read` or `budget:write` scope. Budget addon must be enabled.

| Tool | Description |
|---|---|
| `create_budget_item` | Add an expense with name, category, and price. |
| `update_budget_item` | Update an expense's details, split (persons/days), or notes. |
| `delete_budget_item` | Remove a budget item. |
| `set_budget_item_members` | Set which members are splitting a budget item (replaces current list). |
| `toggle_budget_member_paid` | Mark or unmark a member as having paid their share. |

### Tags

Requires `places:read` or `places:write` scope.

| Tool | Description |
|---|---|
| `list_tags` | List all tags belonging to the current user. |
| `create_tag` | Create a new tag (user-scoped label for places) with optional hex color. |
| `update_tag` | Update the name or color of an existing tag. |
| `delete_tag` | Delete a tag (removes it from all attached places). |

### Maps & Weather

| Tool | Scope required | Description |
|---|---|---|
| `get_place_details` | `geo:read` | Fetch detailed information (hours, photos, ratings) about a place by its Google Place ID. |
| `reverse_geocode` | `geo:read` | Get a human-readable address for given coordinates. |
| `resolve_maps_url` | `geo:read` | Resolve a Google Maps share URL to coordinates and place name. |
| `search_airports` | `geo:read` | Search for airports by name, city, or IATA code. Returns IATA code, name, city, country, timezone. |
| `get_airport` | `geo:read` | Look up an airport by IATA code (e.g. `"ZRH"`, `"CDG"`). |
| `get_weather` | `weather:read` | Get a weather forecast for a location and date. |
| `get_detailed_weather` | `weather:read` | Get an hourly/detailed weather forecast for a location and date. |

### Notifications

Requires `notifications:read` or `notifications:write` scope.

| Tool | Description |
|---|---|
| `list_notifications` | List in-app notifications with pagination and optional unread filter. |
| `get_unread_notification_count` | Get the unread notification count. |
| `mark_notification_read` | Mark a notification as read. |
| `mark_notification_unread` | Mark a notification as unread. |
| `mark_all_notifications_read` | Mark all notifications as read. |

---

## Resources

Resources provide read-only access via `trek://` URIs. Read them to understand current state before making changes.

### Core resources

| URI | Scope required | Description |
|---|---|---|
| `trek://trips` | `trips:*` | All trips you own or are a member of |
| `trek://trips/{tripId}` | `trips:*` | Single trip with metadata and member count |
| `trek://trips/{tripId}/days` | `trips:*` | Days of a trip with their assigned places |
| `trek://trips/{tripId}/places` | `places:read` | All places in a trip. Supports `?assignment=all\|unassigned\|assigned` |
| `trek://trips/{tripId}/reservations` | `reservations:read` | Flights, hotels, restaurants, and other reservations |
| `trek://trips/{tripId}/days/{dayId}/notes` | `trips:*` | Notes for a specific day |
| `trek://trips/{tripId}/accommodations` | `trips:*` | Hotels and rentals with check-in/out details |
| `trek://trips/{tripId}/members` | `trips:*` | Owner and collaborators |
| `trek://categories` | (any) | Available place categories (id, name, icon, color) |
| `trek://notifications/in-app` | `notifications:read` | Your in-app notifications (most recent 50, unread first) |

For addon-gated resources (Budget, Packing, To-Dos, Collab, Atlas, Vacay, Journey), see [MCP-Addon-Tools](MCP-Addon-Tools).

---

## Related

- [MCP-Addon-Tools](MCP-Addon-Tools)
- [MCP-Scopes](MCP-Scopes)
- [MCP-Prompts](MCP-Prompts)
- [MCP-Setup](MCP-Setup)
