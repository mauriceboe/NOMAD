import type { SystemNotice } from './types.js';
import { registerPredicate } from './conditions.js';
import { db } from '../db/database.js';

registerPredicate('whitespace-collision-detected', () => {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'whitespace_migration_collision'").get() as { value: string } | undefined;
  return row?.value === 'true';
});

/**
 * SYSTEM NOTICE REGISTRY
 *
 * Rules for authoring:
 * - NEVER remove or renumber entries — dismissal tracking is keyed by `id`.
 * - `id` must be globally unique and stable across deployments.
 * - Title: ≤40 chars, sentence case, no trailing punctuation.
 * - Body: markdown (modal) or plain text (banner/toast). ≤400/140/80 chars.
 * - CTA label: ≤20 chars, a verb.
 * - Never hardcode version numbers/dates in translated strings — use bodyParams.
 * - See plans/system-notices/00-overview.md for full authoring guidelines.
 */
export const SYSTEM_NOTICES: SystemNotice[] = [
  // ── 3.0.0 upgrade notices (shown as a multipage modal to pre-3.0 users) ─────

  {
    // Page 1 — breaking change first (warn → sorts before the two info notices)
    id: 'v3-photos',
    display: 'modal',
    severity: 'warn',
    icon: 'ImageOff',
    titleKey: 'system_notice.v3_photos.title',
    bodyKey:  'system_notice.v3_photos.body',
    dismissible: true,
    conditions: [{ kind: 'existingUserBeforeVersion', version: '3.0.0' }],
    publishedAt: '2026-04-16T00:00:00Z',
    priority: 90,
    minVersion: '3.0.0',
    maxVersion: '4.0.0',
  },

  {
    // Page 2 — flagship feature (only when Journey addon is enabled)
    id: 'v3-journey',
    display: 'modal',
    severity: 'info',
    icon: 'BookOpen',
    titleKey: 'system_notice.v3_journey.title',
    bodyKey:  'system_notice.v3_journey.body',
    highlights: [
      { labelKey: 'system_notice.v3_journey.highlight_timeline', iconName: 'CalendarDays' },
      { labelKey: 'system_notice.v3_journey.highlight_photos',   iconName: 'Images' },
      { labelKey: 'system_notice.v3_journey.highlight_share',    iconName: 'Globe' },
      { labelKey: 'system_notice.v3_journey.highlight_export',   iconName: 'FileText' },
    ],
    cta: {
      kind: 'nav',
      labelKey: 'system_notice.v3_journey.cta_label',
      href: '/journey',
    },
    dismissible: true,
    conditions: [
      { kind: 'existingUserBeforeVersion', version: '3.0.0' },
      { kind: 'addonEnabled', addonId: 'journey' },
    ],
    publishedAt: '2026-04-16T00:00:00Z',
    priority: 80,
    minVersion: '3.0.0',
    maxVersion: '4.0.0',
  },

  {
    // Page 3 — MCP OAuth 2.1 upgrade (only when MCP addon is enabled)
    id: 'v3-mcp',
    display: 'modal',
    severity: 'warn',
    icon: 'Bot',
    titleKey: 'system_notice.v3_mcp.title',
    bodyKey:  'system_notice.v3_mcp.body',
    highlights: [
      { labelKey: 'system_notice.v3_mcp.highlight_oauth',      iconName: 'KeyRound' },
      { labelKey: 'system_notice.v3_mcp.highlight_scopes',     iconName: 'ShieldCheck' },
      { labelKey: 'system_notice.v3_mcp.highlight_deprecated', iconName: 'AlertTriangle' },
      { labelKey: 'system_notice.v3_mcp.highlight_tools',      iconName: 'Wrench' },
    ],
    dismissible: true,
    conditions: [
      { kind: 'existingUserBeforeVersion', version: '3.0.0' },
      { kind: 'addonEnabled', addonId: 'mcp' },
    ],
    publishedAt: '2026-04-16T00:00:00Z',
    priority: 75,
    minVersion: '3.0.0',
    maxVersion: '4.0.0',
  },

  {
    // Page 4 — other highlights
    id: 'v3-features',
    display: 'modal',
    severity: 'info',
    icon: 'Sparkles',
    titleKey: 'system_notice.v3_features.title',
    bodyKey:  'system_notice.v3_features.body',
    highlights: [
      { labelKey: 'system_notice.v3_features.highlight_dashboard', iconName: 'LayoutDashboard' },
      { labelKey: 'system_notice.v3_features.highlight_offline',   iconName: 'WifiOff' },
      { labelKey: 'system_notice.v3_features.highlight_search',    iconName: 'Search' },
      { labelKey: 'system_notice.v3_features.highlight_import',    iconName: 'FileInput' },
    ],
    dismissible: true,
    conditions: [{ kind: 'existingUserBeforeVersion', version: '3.0.0' }],
    publishedAt: '2026-04-16T00:00:00Z',
    priority: 70,
    minVersion: '3.0.0',
    maxVersion: '4.0.0',
  },

  {
    // Page 1 — personal thank-you from the creator (shown first)
    id: 'v3-thankyou',
    display: 'modal',
    severity: 'info',
    icon: 'Heart',
    titleKey: 'system_notice.v3_thankyou.title',
    bodyKey:  'system_notice.v3_thankyou.body',
    dismissible: true,
    conditions: [{ kind: 'existingUserBeforeVersion', version: '3.0.0' }],
    publishedAt: '2026-04-16T00:00:00Z',
    priority: 95,
    minVersion: '3.0.0',
    maxVersion: '4.0.0',
  },

  // ── 3.0.14 admin notice — whitespace migration collision ───────────────────

  {
    id: 'v3014-whitespace-collision',
    display: 'banner',
    severity: 'warn',
    icon: 'AlertTriangle',
    titleKey: 'system_notice.v3014_whitespace_collision.title',
    bodyKey:  'system_notice.v3014_whitespace_collision.body',
    dismissible: true,
    conditions: [
      { kind: 'existingUserBeforeVersion', version: '3.0.14' },
      { kind: 'role', roles: ['admin'] },
      { kind: 'custom', id: 'whitespace-collision-detected' },
    ],
    publishedAt: '2026-05-03T00:00:00Z',
    priority: 85,
    minVersion: '3.0.14',
  },

  // ── Onboarding ─────────────────────────────────────────────────────────────

  {
    id: 'welcome-v1',
    display: 'modal',
    severity: 'info',
    icon: 'Sparkles',
    titleKey: 'system_notice.welcome_v1.title',
    bodyKey: 'system_notice.welcome_v1.body',
    highlights: [
      { labelKey: 'system_notice.welcome_v1.highlight_plan',    iconName: 'Map' },
      { labelKey: 'system_notice.welcome_v1.highlight_share',   iconName: 'Users' },
      { labelKey: 'system_notice.welcome_v1.highlight_offline', iconName: 'WifiOff' },
    ],
    cta: {
      kind: 'action',
      labelKey: 'system_notice.welcome_v1.cta_label',
      actionId: 'open:trip-create',
    },
    dismissible: true,
    conditions: [{ kind: 'firstLogin' }],
    publishedAt: '2026-04-16T00:00:00Z',
    priority: 100,
  },
];
