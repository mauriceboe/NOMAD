import { createRequire } from 'module';
import semver from 'semver';
import { db } from '../db/database.js';
import { SYSTEM_NOTICES } from './registry.js';
import { evaluate } from './conditions.js';
import type { SystemNotice, SystemNoticeDTO } from './types.js';

function getCurrentAppVersion(): string {
  const fromEnv = semver.valid(process.env.APP_VERSION ?? '');
  if (fromEnv) return fromEnv;
  try {
    const pkg = require('../../package.json') as { version?: string };
    return semver.valid(pkg.version ?? '') ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function isNoticeVersionActive(n: SystemNotice, currentAppVersion: string): boolean {
  const appVersion = semver.coerce(currentAppVersion)?.version ?? '0.0.0';
  if (n.minVersion !== undefined) {
    const min = semver.valid(n.minVersion);
    if (!min) { console.warn(`[systemNotices] "${n.id}" invalid minVersion "${n.minVersion}" — skipping`); return false; }
    if (semver.lt(appVersion, min)) return false;
  }
  if (n.maxVersion !== undefined) {
    const max = semver.valid(n.maxVersion);
    if (!max) { console.warn(`[systemNotices] "${n.id}" invalid maxVersion "${n.maxVersion}" — skipping`); return false; }
    if (semver.gte(appVersion, max)) return false;
  }
  return true;
}

function severityWeight(s: string): number {
  return s === 'critical' ? 2 : s === 'warn' ? 1 : 0;
}

export function getActiveNoticesFor(userId: number): SystemNoticeDTO[] {
  const user = db.prepare(
    'SELECT login_count, first_seen_version, role FROM users WHERE id = ?'
  ).get(userId) as { login_count: number; first_seen_version: string; role: string } | undefined;

  if (!user) return [];

  const { count: tripCount } = db.prepare(
    'SELECT COUNT(*) AS count FROM trips WHERE user_id = ?'
  ).get(userId) as { count: number };

  const dismissedIds = new Set<string>(
    (db.prepare('SELECT notice_id FROM user_notice_dismissals WHERE user_id = ?')
      .all(userId) as Array<{ notice_id: string }>)
      .map(r => r.notice_id)
  );

  const now = new Date();
  const currentAppVersion = getCurrentAppVersion();
  const ctx = { user: { ...user, noTrips: tripCount }, currentAppVersion, now };

  return SYSTEM_NOTICES
    .filter(n => {
      if (dismissedIds.has(n.id)) return false;
      if (!isNoticeVersionActive(n, currentAppVersion)) return false;
      return evaluate(n, ctx);
    })
    .sort((a, b) => {
      const pw = (b.priority ?? 0) - (a.priority ?? 0);
      if (pw !== 0) return pw;
      const sw = severityWeight(b.severity) - severityWeight(a.severity);
      if (sw !== 0) return sw;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    })
    .map(({ conditions: _c, publishedAt: _p, minVersion: _mn, maxVersion: _mx, priority: _pr, ...dto }) => dto);
}

export function dismissNotice(userId: number, noticeId: string): boolean {
  const exists = SYSTEM_NOTICES.some(n => n.id === noticeId);
  if (!exists) return false;
  db.prepare(`
    INSERT OR IGNORE INTO user_notice_dismissals (user_id, notice_id, dismissed_at)
    VALUES (?, ?, ?)
  `).run(userId, noticeId, Date.now());
  return true;
}
