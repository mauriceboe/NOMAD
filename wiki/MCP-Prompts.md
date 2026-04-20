# MCP Prompts

TREK includes built-in MCP prompts — pre-built context loaders that tell your AI client how to summarize or present your trip data in a structured way. Prompts are a standard MCP feature: compatible clients can invoke them by name to get a ready-made starting point for common tasks.

## Built-in prompts

| Prompt | Addon required | Description |
|---|---|---|
| `trip-summary` | — | Loads a formatted summary of a trip: dates, member list, day count, number of places per day, packing progress, budget total, reservation count, and collab note count. Use this before asking the AI to plan or modify a trip. |
| `packing-list` | Packing | Returns the full packing checklist for a trip, grouped by category, with each item marked checked or unchecked. |
| `budget-overview` | Budget | Returns a budget summary for a trip — total spend, breakdown by category (sorted descending), and a per-person cost estimate. |
| `token_auth_notice` | — | Deprecation notice for sessions authenticated with a static `trek_` token. Only available in static-token sessions. Explains that the token will stop working in a future version and how to migrate to OAuth 2.1. |

`packing-list` and `budget-overview` are only registered when the corresponding addon is enabled on your TREK instance.

`token_auth_notice` is only registered when the current session was authenticated with a legacy static API token — it does not appear in OAuth sessions.

## How to use prompts

In a compatible MCP client (such as Claude.ai or Claude Desktop), prompts typically appear as slash commands or in a prompts panel. You select the prompt, supply any required arguments (such as a `tripId`), and the client sends the formatted context to the AI before your next message.

For example, invoking `trip-summary` with a trip ID gives the AI a compact snapshot of that trip — days, members, budget, packing — without needing to call multiple tools one by one.

## Related

- [MCP-Tools-and-Resources](MCP-Tools-and-Resources)
- [MCP-Setup](MCP-Setup)
