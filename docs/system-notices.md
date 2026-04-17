# System Notices — Technical Documentation & Dev Guide

System notices are server-evaluated, user-targeted messages shown in the TREK UI as modals, banners, or toasts. They are used for onboarding, upgrade announcements, breaking change warnings, and time-boxed campaigns. Every aspect — targeting, display, copy, and dismissal — is controlled from one place: the server-side registry.

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [Data flow](#2-data-flow)
3. [Database schema](#3-database-schema)
4. [The notice registry](#4-the-notice-registry)
5. [Notice fields reference](#5-notice-fields-reference)
6. [Condition system](#6-condition-system)
7. [Display types](#7-display-types)
8. [CTAs (call to action)](#8-ctas-call-to-action)
9. [i18n — translation keys](#9-i18n--translation-keys)
10. [Client store & dismissal](#10-client-store--dismissal)
11. [Sorting & priority](#11-sorting--priority)
12. [How-to recipes](#12-how-to-recipes)
13. [Testing](#13-testing)
14. [Rules & constraints](#14-rules--constraints)

---

## 1. Architecture overview

```
server/src/systemNotices/
├── types.ts        — TypeScript types (SystemNotice, NoticeCondition, …)
├── registry.ts     — Authoritative list of all notices (edit here to add/change/remove)
├── conditions.ts   — Condition evaluators + custom predicate registry
└── service.ts      — Queries DB, evaluates conditions, sorts, strips server-only fields

server/src/routes/systemNotices.ts   — REST endpoints

client/src/store/systemNoticeStore.ts             — Zustand store (fetch + optimistic dismiss)
client/src/components/SystemNotices/
├── SystemNoticeHost.tsx    — Renders all three channels (modal / banner / toast)
├── SystemNoticeModal.tsx   — Modal renderer (pager, animations, keyboard nav)
├── SystemNoticeBanner.tsx  — Banner + toast renderers
└── noticeActions.ts        — Client-side action registry for action-kind CTAs

client/src/pages/Trips/noticeActions.ts   — Example domain action registration
```

There are **no database rows for notice definitions**. The registry is code-only. The database only stores which notices a user has dismissed.

---

## 2. Data flow

```
1. User authenticates
        │
        ▼
2. authStore.loadUser() completes
        │
        ▼
3. SystemNoticeHost mounts → calls useSystemNoticeStore.fetch()
        │   (also triggered on cold page reload if store not yet loaded)
        ▼
4. GET /api/system-notices/active
        │
        ▼
5. service.getActiveNoticesFor(userId)
   ├── reads user row  (login_count, first_seen_version, role)
   ├── counts user trips
   ├── reads user_notice_dismissals
   ├── filters SYSTEM_NOTICES:
   │     – not dismissed
   │     – within [minVersion, maxVersion) range for the running app version
   │     – all conditions pass (AND logic)
   ├── sorts by priority → severity → publishedAt (desc)
   └── strips server-only fields (conditions, publishedAt, minVersion, maxVersion, priority)
        │
        ▼
6. Client receives SystemNoticeDTO[]
        │
        ▼
7. SystemNoticeHost partitions by display type
   ├── modal  → ModalRenderer  (multi-page pager, slide transitions)
   ├── banner → BannerRenderer (sticky top bar, max 2)
   └── toast  → ToastRenderer  (fires window.__addToast, auto-dismisses)
        │
        ▼
8. User dismisses → POST /api/system-notices/:id/dismiss
   ├── Server: INSERT OR IGNORE into user_notice_dismissals
   └── Client: optimistic remove from store (retry once on failure)
```

---

## 3. Database schema

Added in **migration 101** (`server/src/db/migrations.ts`).

### `users` columns (added by migration 101)

| Column | Type | Default | Purpose |
|---|---|---|---|
| `first_seen_version` | `TEXT` | `'0.0.0'` | App version at account creation. Used by `existingUserBeforeVersion` condition. Backfilled users get `'0.0.0'`. |
| `login_count` | `INTEGER` | `0` | Incremented on each successful login. Used by `firstLogin` condition. |

### `user_notice_dismissals`

| Column | Type | Notes |
|---|---|---|
| `user_id` | `INTEGER` | FK → `users.id` CASCADE DELETE |
| `notice_id` | `TEXT` | Matches `SystemNotice.id` from registry |
| `dismissed_at` | `INTEGER` | Unix ms timestamp |

Primary key: `(user_id, notice_id)` — dismissals are idempotent.

---

## 4. The notice registry

**`server/src/systemNotices/registry.ts`** is the single source of truth. Add, change, or retire notices here.

```typescript
export const SYSTEM_NOTICES: SystemNotice[] = [
  {
    id: 'my-notice',           // ← globally unique, never reuse
    display: 'modal',
    severity: 'info',
    titleKey: 'system_notice.my_notice.title',
    bodyKey:  'system_notice.my_notice.body',
    dismissible: true,
    conditions: [{ kind: 'firstLogin' }],
    publishedAt: '2026-05-01T00:00:00Z',
    priority: 50,
  },
];
```

### The golden rule for IDs

**Never remove or renumber an entry. Never reuse an ID.**

Dismissals are stored in the database keyed by `id`. Removing an entry means dismissed users would see it again if you ever add a notice with the same ID. If a notice is no longer needed, set `maxVersion` to the upper version on which it should appear (e.g. `4.0.0` means show notice until `4.0.0` is reached) — do not delete the entry.

---

## 5. Notice fields reference

### Required fields

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Globally unique, stable identifier. Use kebab-case, descriptive, version-scoped when appropriate (`v3-photos`, `welcome-v1`). Max recommended length: 40 chars. |
| `display` | `'modal' \| 'banner' \| 'toast'` | How the notice is rendered. See [§7 Display types](#7-display-types). |
| `severity` | `'info' \| 'warn' \| 'critical'` | Affects colour scheme and accessibility role. `critical` notices cannot be toasts. |
| `titleKey` | `string` | i18n key for the title. |
| `bodyKey` | `string` | i18n key for the body. Markdown supported in modals; plain text only in banners/toasts. |
| `dismissible` | `boolean` | If `false`, the X button and ESC key are hidden/blocked. Use only for `critical` notices that require action before proceeding. |
| `conditions` | `NoticeCondition[]` | Empty array (`[]`) means always shown (same as `[{ kind: 'always' }]`). All conditions must pass (AND logic). |
| `publishedAt` | `string` | ISO 8601 date. Used as a tiebreaker in sorting. Set to the deployment date. |

### Optional fields

| Field | Type | Description |
|---|---|---|
| `priority` | `number` | Higher number = shown first. Primary sort key. Default: `0`. |
| `minVersion` | `string` | Lowest app version (inclusive, semver) that should show this notice. Omit for no lower bound. |
| `maxVersion` | `string` | Upper bound (exclusive, semver) — notice is hidden once this version ships. `maxVersion: '4.0.0'` means shown on `< 4.0.0`. Omit for no upper bound. |
| `icon` | `string` | Lucide icon name (e.g. `'Sparkles'`, `'ImageOff'`). Shown in the modal's severity icon circle. Falls back to the severity default icon if absent or unrecognised. |
| `bodyParams` | `Record<string, string>` | Interpolation parameters for `bodyKey`. Values replace `{key}` placeholders in the translated string. **Never hardcode version numbers or dates directly in translation strings — use this instead.** |
| `media` | `NoticeMedia` | Image to display in the modal. See below. |
| `highlights` | `Array<{ labelKey: string; iconName?: string }>` | Bullet-point feature list rendered below the body in modals. Each entry is a translation key + optional Lucide icon name. |
| `cta` | `NoticeCta` | Primary action button. See [§8 CTAs](#8-ctas-call-to-action). |

> **Version bounds:** The range is `[minVersion, maxVersion)` — lower bound inclusive, upper bound exclusive. So `maxVersion: '4.0.0'` hides the notice once the app reaches 4.0.0. Both bounds are compared after stripping prerelease/build metadata via `semver.coerce`, so a server running `3.0.0-pre.42` is treated as `3.0.0` — consistent with `existingUserBeforeVersion` and staging environments behave like production.

### `NoticeMedia`

```typescript
interface NoticeMedia {
  src: string;          // URL or path
  srcDark?: string;     // Optional dark-mode variant
  altKey: string;       // i18n key for alt text
  placement?: 'hero' | 'inline';  // default: 'hero' (full-width above body)
  aspectRatio?: string; // CSS aspect-ratio value, default '16/9'
}
```

### Character limits

| Field | Modal | Banner | Toast |
|---|---|---|---|
| Title | ≤ 40 chars | ≤ 40 chars | ≤ 40 chars |
| Body | ≤ 400 chars (markdown) | ≤ 140 chars (plain) | ≤ 80 chars (plain) |
| CTA label | ≤ 20 chars, a verb | ≤ 20 chars | ≤ 20 chars |

---

## 6. Condition system

Conditions are evaluated **server-side** on every `GET /api/system-notices/active` call. The client never sees conditions — only the filtered result.

All conditions in `conditions[]` must pass (AND logic). To implement OR logic, create multiple notices with overlapping IDs is not possible — instead use a `custom` predicate with internal OR logic.

### Built-in conditions

#### `always`
```typescript
{ kind: 'always' }
```
Always passes. Equivalent to an empty `conditions` array.

---

#### `firstLogin`
```typescript
{ kind: 'firstLogin' }
```
Passes when `users.login_count <= 1`. The counter is incremented during login, so this fires on the first fetch after the very first login. Useful for onboarding notices.

---

#### `noTrips`
```typescript
{ kind: 'noTrips' }
```
Passes when the user has zero trips. Often combined with `firstLogin`.

---

#### `existingUserBeforeVersion`
```typescript
{ kind: 'existingUserBeforeVersion', version: '3.0.0' }
```
Passes when:
- `users.first_seen_version < version` (user existed before this version)
- AND the running app version `>= version` (the version has been deployed)

Backfilled/legacy users have `first_seen_version = '0.0.0'` and always pass the first condition. Use this for upgrade announcements targeting users who were around before a breaking change.

---

#### `dateWindow`
```typescript
{ kind: 'dateWindow', startsAt: '2026-06-01T00:00:00Z', endsAt: '2026-07-01T00:00:00Z' }
```
Passes when the current server time is inside `[startsAt, endsAt]`. `endsAt` is optional (open-ended). Use for campaigns, maintenance banners, and time-limited promotions.

---

#### `role`
```typescript
{ kind: 'role', roles: ['admin'] }
// or both roles:
{ kind: 'role', roles: ['admin', 'user'] }
```
Passes when the user's role is in the given list.

---

#### `addonEnabled`
```typescript
{ kind: 'addonEnabled', addonId: 'journey' }
```
Passes when the named addon is enabled in admin settings. Addon IDs are the string values in `server/src/addons.ts` (`ADDON_IDS`). Use this to gate notices that promote features behind an addon.

---

#### `custom`
```typescript
{ kind: 'custom', id: 'my-predicate-id' }
```
Delegates evaluation to a predicate registered server-side with `registerPredicate`. This is the escape hatch for logic not covered by the built-in conditions.

**Registering a custom predicate:**

```typescript
// server/src/systemNotices/conditions.ts exports registerPredicate
import { registerPredicate } from '../systemNotices/conditions.js';

registerPredicate('has-immich-configured', (ctx) => {
  // ctx.user = { login_count, first_seen_version, role, noTrips }
  // ctx.currentAppVersion = string
  // ctx.now = Date
  return someDbCheck(ctx.user);
});
```

Register predicates at application startup before the first `getActiveNoticesFor` call.

---

### Combining conditions (AND)

```typescript
conditions: [
  { kind: 'existingUserBeforeVersion', version: '3.0.0' },
  { kind: 'addonEnabled', addonId: 'journey' },
]
// Only shows to pre-3.0 users AND only if the journey addon is enabled.
```

---

## 7. Display types

### `modal`

Full-screen overlay with backdrop. On mobile: bottom sheet with drag-to-dismiss. On desktop: centered card.

**Features:**
- Markdown body (via `react-markdown` + `remark-gfm` + `rehype-sanitize`)
- Optional hero or inline image
- Optional highlights list (icon + label bullets)
- Optional CTA button + "Not now" link
- OK button when no CTA is defined
- **Multi-page pager**: when multiple modal notices are active simultaneously, they are rendered as a paginated single modal with prev/next arrows, dot indicators, `N / M` counter, and keyboard arrow navigation
- Slide transition between pages
- ESC to dismiss all (if current notice is dismissible)
- CTA and OK dismiss **all** active modal notices, not just the current page
- "Not now" dismisses only the current page

**Non-dismissible modals** (`dismissible: false`): X button, ESC key, and pager navigation are all disabled until the user acts on the CTA. Use only for `critical` severity.

---

### `banner`

Sticky top bar below the navigation. Slides in with a translate-Y animation.

**Constraints:**
- Maximum 2 banners shown simultaneously (the 2 highest-priority active banners)
- Plain text only (no markdown)
- RTL-aware left-border accent
- Reports its height via a CSS variable `--banner-stack-h` for layout reflow

---

### `toast`

Fires the global `window.__addToast` toast system. Auto-dismisses after 6 s (`info`) or 9 s (`warn`). The notice is dismissed from the store after the toast expires.

**Constraints:**
- `critical` severity is not allowed as a toast — the renderer logs a warning and auto-dismisses it instead
- Plain text only
- No interaction (no CTA rendered via toast)

---

## 8. CTAs (call to action)

A CTA renders as the primary blue button in modals and as an underline link in banners. There are two kinds.

### `nav` — navigate to a route

```typescript
cta: {
  kind: 'nav',
  labelKey: 'system_notice.my_notice.cta_label',
  href: '/journey',
}
```

On click: navigates to `href` using React Router, then **dismisses all active modal notices** (or the current banner notice). The label is resolved through the i18n system.

---

### `action` — run a registered client-side handler

```typescript
cta: {
  kind: 'action',
  labelKey: 'system_notice.my_notice.cta_label',
  actionId: 'open:trip-create',
  dismissOnAction: true,  // default true — set false to keep notice open after action
}
```

On click: looks up `actionId` in the client-side action registry and calls the handler, then **dismisses all active modal notices**.

**To add a new action:**

1. Create (or extend) a `noticeActions.ts` file in the relevant feature directory:

```typescript
// client/src/pages/MyFeature/noticeActions.ts
import { registerNoticeAction } from '../../components/SystemNotices/noticeActions.js';

registerNoticeAction('open:my-feature', ({ navigate }) => {
  navigate('/my-feature?from=notice');
});
```

2. Import it as a side-effect in `client/src/App.tsx`:

```typescript
import './pages/MyFeature/noticeActions.js'
```

3. The registry integrity test (`server/tests/unit/systemNotices/registry.test.ts`) automatically scans all `noticeActions.ts` files and verifies that every `actionId` in the registry is registered. The test will fail if you add an `actionId` to the registry without registering it on the client.

**Action handler signature:**

```typescript
(ctx: NoticeActionContext) => void | Promise<void>

interface NoticeActionContext {
  navigate: NavigateFunction; // React Router navigate function
}
```

### Dismiss behaviour summary

| Trigger | What is dismissed |
|---|---|
| X button (modal) | All active modal notices |
| ESC key | All active modal notices (if current is dismissible) |
| CTA button | All active modal notices |
| OK button (no CTA) | All active modal notices |
| "Not now" link | Current page only |
| Banner dismiss (X) | That banner only |
| Backdrop click (modal) | Current page only |
| Swipe down (mobile) | Current page only |
| Toast expires | That toast only |

---

## 9. i18n — translation keys

Every notice field that is user-visible (`titleKey`, `bodyKey`, CTA `labelKey`, highlight `labelKey`, media `altKey`) is an i18n key resolved through `useTranslation().t()`. The key string is what gets stored in the registry; the display value lives in the translation files.

**Translation files location:** `client/src/i18n/translations/` (15 files: `en`, `de`, `fr`, `es`, `it`, `nl`, `pl`, `cs`, `hu`, `ru`, `zh`, `zhTw`, `ar`, `br`, `id`)

### Key naming convention

```
system_notice.<notice_id_snake>.<field>
```

Examples:
```
system_notice.welcome_v1.title
system_notice.welcome_v1.body
system_notice.welcome_v1.cta_label
system_notice.welcome_v1.highlight_plan
system_notice.welcome_v1.hero_alt
```

### Adding keys

Add the English key to `client/src/i18n/translations/en.ts` first, then replicate to the other 14 files. Group related notice keys together with a comment:

```typescript
// System notices — my feature
'system_notice.my_notice.title': 'My feature is here',
'system_notice.my_notice.body': 'Here is what changed.',
'system_notice.my_notice.cta_label': 'Explore',
```

### `bodyParams` interpolation

For values that vary at runtime (version numbers, dates, counts), use `{placeholder}` syntax in the translation string and pass `bodyParams` in the registry entry:

```typescript
// In registry:
bodyKey: 'system_notice.my_notice.body',
bodyParams: { version: '3.1.0', date: '1 May 2026' },

// In en.ts:
'system_notice.my_notice.body': 'TREK {version} was released on {date}.',
```

**Never hardcode dynamic values directly in translation strings.** The interpolation runs client-side in `ModalRenderer` before rendering.

### Multiline bodies (modals only)

Use `\n\n` (escaped, not literal newlines) for paragraph breaks in modal body strings:

```typescript
'system_notice.my_notice.body': 'First paragraph.\n\nSecond paragraph.',
```

Literal newlines in single-quoted TypeScript strings cause a parse error.

### Pager i18n keys

The pager UI uses its own keys (already present in all 15 files):

```
system_notice.pager.prev       → "Previous notice"
system_notice.pager.next       → "Next notice"
system_notice.pager.counter    → "{current} / {total}"
system_notice.pager.goto       → "Go to notice {n}"
system_notice.pager.position   → "Notice {current} of {total}"  (aria-live)
```

---

## 10. Client store & dismissal

`client/src/store/systemNoticeStore.ts` (Zustand, no persistence).

| Action | Behaviour |
|---|---|
| `fetch()` | `GET /api/system-notices/active`. Fails silently (non-critical). Sets `loaded = true` regardless. |
| `dismiss(id)` | Optimistic: removes notice from store immediately. POSTs to `/api/system-notices/{id}/dismiss` in background with one retry on failure. |

`SystemNoticeHost` triggers `fetch()` on mount if `loaded === false`. Auth store also triggers it after login, so on a fresh login the fetch happens exactly once.

---

## 11. Sorting & priority

Notices are sorted before being sent to the client. The sort order is:

1. **`priority`** (descending) — primary key. Higher number appears first.
2. **`severity`** (descending) — tiebreaker: `critical` (2) > `warn` (1) > `info` (0).
3. **`publishedAt`** (descending) — final tiebreaker: more recent notices first.

This means `priority` always wins over severity. Assign priorities deliberately so the intended reading order is preserved when multiple notices are active simultaneously.

Current priority allocations in the registry:

| Range | Use |
|---|---|
| 100 | Onboarding / first-login |
| 80–90 | Major version upgrade notices |
| 50–70 | Feature announcements |
| 10–40 | Campaigns, banners |
| 0 (default) | Miscellaneous |

---

## 12. How-to recipes

### Add a new modal notice

1. **Registry** — add an entry to `SYSTEM_NOTICES` in `server/src/systemNotices/registry.ts`:

```typescript
{
  id: 'my-feature-v2',
  display: 'modal',
  severity: 'info',
  icon: 'Zap',
  titleKey: 'system_notice.my_feature_v2.title',
  bodyKey:  'system_notice.my_feature_v2.body',
  highlights: [
    { labelKey: 'system_notice.my_feature_v2.highlight_one', iconName: 'Check' },
  ],
  cta: {
    kind: 'nav',
    labelKey: 'system_notice.my_feature_v2.cta_label',
    href: '/my-feature',
  },
  dismissible: true,
  conditions: [{ kind: 'existingUserBeforeVersion', version: '2.0.0' }],
  publishedAt: '2026-06-01T00:00:00Z',
  priority: 60,
},
```

2. **i18n** — add keys to `client/src/i18n/translations/en.ts` and the 14 other language files.

3. **Test** — run `cd server && npx vitest run tests/unit/systemNotices/` to verify registry integrity.

---

### Add a notice with an action CTA

1. Create the action handler in the relevant feature directory:

```typescript
// client/src/pages/MyFeature/noticeActions.ts
import { registerNoticeAction } from '../../components/SystemNotices/noticeActions.js';

registerNoticeAction('open:my-feature-dialog', ({ navigate }) => {
  navigate('/my-feature?dialog=welcome');
});
```

2. Import it in `client/src/App.tsx`:

```typescript
import './pages/MyFeature/noticeActions.js'
```

3. Reference the `actionId` in the registry:

```typescript
cta: {
  kind: 'action',
  labelKey: 'system_notice.my_notice.cta_label',
  actionId: 'open:my-feature-dialog',
},
```

The registry integrity test will catch any `actionId` that appears in the registry but lacks a `registerNoticeAction` call.

---

### Retire a notice (stop showing it)

**Do not delete the entry.** Set `maxVersion` to the last app version on which the notice should appear. Once the app is upgraded past that version, the service filters it out automatically. The database row for dismissed users remains harmless.

```typescript
{
  id: 'old-campaign',
  // ... all existing fields unchanged ...
  maxVersion: '3.1.0',   // hidden once 3.1.0 ships (exclusive upper bound)
}
```

To scope a notice to a specific version window (e.g. a v3-only announcement), combine both bounds:

```typescript
{
  id: 'v3-only',
  minVersion: '3.0.0',
  maxVersion: '4.0.0',   // shown on >= 3.0.0 and < 4.0.0
}
```

---

### Show a notice only during a campaign window

Combine `dateWindow` with any other targeting conditions:

```typescript
conditions: [
  { kind: 'dateWindow', startsAt: '2026-06-15T00:00:00Z', endsAt: '2026-06-30T23:59:59Z' },
  { kind: 'role', roles: ['admin'] },
],
```

---

### Show a notice only if an addon is enabled

```typescript
conditions: [
  { kind: 'addonEnabled', addonId: 'journey' },
],
```

Addon IDs are the string values in `server/src/addons.ts` → `ADDON_IDS`.

---

### Add a custom condition

```typescript
// server/src/startup.ts (or wherever your bootstrap code runs)
import { registerPredicate } from './systemNotices/conditions.js';

registerPredicate('has-no-profile-photo', (ctx) => {
  const row = db.prepare('SELECT avatar FROM users WHERE id = ?').get(ctx.user.id);
  return !row?.avatar;
});
```

Then reference it in the registry:

```typescript
conditions: [{ kind: 'custom', id: 'has-no-profile-photo' }],
```

---

### Create a multipage upgrade announcement

Give multiple notices the same `conditions` and adjacent `priority` values. The pager groups all active modal notices together automatically — no extra wiring required.

```typescript
// Page 1 — breaking change (higher priority, warn severity)
{ id: 'v4-breaking', priority: 90, severity: 'warn', conditions: [{ kind: 'existingUserBeforeVersion', version: '4.0.0' }], ... },

// Page 2 — new feature (lower priority, info severity)
{ id: 'v4-feature',  priority: 80, severity: 'info', conditions: [{ kind: 'existingUserBeforeVersion', version: '4.0.0' }], ... },
```

Users who have already dismissed page 1 will only see page 2 on their next session.

---

## 13. Testing

### Server unit tests

**`server/tests/unit/systemNotices/conditions.test.ts`**

Tests each condition kind in isolation using `evaluate()` directly. No DB required.

**`server/tests/unit/systemNotices/registry.test.ts`**

Validates registry integrity:
- No duplicate `id` values
- All `action` CTA `actionId`s have a corresponding `registerNoticeAction()` call in the client source (scanned via regex — no JSON file needed)
- All `publishedAt` values parse as valid ISO dates

Run: `cd server && npx vitest run tests/unit/systemNotices/`

**`server/tests/integration/systemNotices.test.ts`**

Integration tests against a real in-memory SQLite database:
- `GET /api/system-notices/active` returns 401 without auth, returns correct notices per user state
- `POST /api/system-notices/:id/dismiss` stores the dismissal and filters on subsequent requests
- Dismissing an unknown ID returns 404

Run: `cd server && npx vitest run tests/integration/systemNotices.test.ts`

---

### Client unit tests

**`client/src/components/SystemNotices/SystemNoticeModal.test.tsx`**

Tests `ModalRenderer` with fake timers (`vi.useFakeTimers()`) and MSW for the dismiss endpoint. Key helpers:

```typescript
// Flush the 500 ms grace delay that gates the modal's visible state
async function flushGraceDelay() {
  await act(async () => { vi.runAllTimers(); });
}

// Minimal notice factory
function makeNotice(overrides?: Partial<SystemNoticeDTO>): SystemNoticeDTO
```

Covered cases (FE-SN-MODAL-001 to 018):
- Grace delay before visibility
- Dismiss button, X button, ESC key
- Non-dismissible notices (all affordances blocked)
- CTA nav button — dismisses all notices
- Body param interpolation
- Pager: counter, dots, prev/next buttons, keyboard arrows, dot click, non-dismissible lock
- Dismiss-does-not-skip regression
- X and ESC dismiss all in multipage scenario
- Last notice close

Run: `cd client && npm run test -- SystemNoticeModal`

---

### Running all notice tests

```bash
cd server && npx vitest run tests/unit/systemNotices/ tests/integration/systemNotices.test.ts
cd client && npm run test -- SystemNoticeModal
```

---

## 14. Rules & constraints

| Rule | Reason |
|---|---|
| Never delete or reuse a notice `id` | Dismissal records are keyed by `id`. Deletion causes dismissed users to see the notice again. |
| Never use literal newlines in translation strings | Single-quoted TS strings with literal newlines cause esbuild parse errors. Use `\n\n` (escaped). |
| Never hardcode version numbers or dates in translation strings | Use `bodyParams` so strings stay translatable without retranslation per release. |
| `critical` severity must have `dismissible: false` | `critical` toasts are auto-dismissed with a warning; a dismissible critical modal is inconsistent UX. |
| `critical` must not use `display: 'toast'` | The toast renderer logs a warning and auto-dismisses critical toasts rather than showing them. |
| CTA labels ≤ 20 chars, sentence case, a verb | Consistent button copy across the app. |
| Priorities must be set explicitly for upgrade notices | Adjacent notices form a multipage group; ordering matters for the reading flow. |
| `action` CTA `actionId` must be registered client-side | The registry integrity test enforces this. Add both the registry entry and the `registerNoticeAction` call in the same PR. |
| `maxVersion` over deletion for retiring notices | See §12. Deletion would cause dismissed users to re-see the notice if the ID were ever reused. |
