import { db } from '../db/database';

// Add new condition identifiers here as the app grows.
type ConditionFn = (userId: number) => boolean;

const CONDITIONS: Record<string, ConditionFn> = {
};

interface Notice {
  id: string;
  title_key: string;
  body_key: string;
  cta_label_key?: string | null;
  cta_url?: string | null;
  cta_action?: string | null;
  priority: number;
}

export function getPendingNotices(userId: number): Notice[] {
  const rows = db
    .prepare(`
      SELECT id, title_key, body_key, cta_label_key, cta_url, cta_action, priority, condition
      FROM notices
      WHERE active = 1
        AND id NOT IN (
          SELECT notice_id FROM user_notices WHERE user_id = ?
        )
      ORDER BY priority ASC
    `)
    .all(userId) as (Notice & { condition?: string | null })[];

  return rows.filter((n) => {
    if (!n.condition) return true;
    const fn = CONDITIONS[n.condition];
    return fn ? fn(userId) : false; // unknown condition → don't show
  });
}

export function dismissNotice(userId: number, noticeId: string): boolean {
  const notice = db
    .prepare('SELECT id FROM notices WHERE id = ? AND active = 1')
    .get(noticeId);
  if (!notice) return false;

  db.prepare(`
    INSERT OR IGNORE INTO user_notices (user_id, notice_id, dismissed_at)
    VALUES (?, ?, unixepoch())
  `).run(userId, noticeId);

  return true;
}
