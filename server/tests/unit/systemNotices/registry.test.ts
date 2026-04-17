import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import semver from 'semver';
import { SYSTEM_NOTICES } from '../../../src/systemNotices/registry.js';

/** Collect all actionIds registered via registerNoticeAction() in client source files. */
function collectRegisteredActionIds(): Set<string> {
  const clientSrc = path.resolve(__dirname, '../../../../client/src');
  const ids = new Set<string>();
  const queue = [clientSrc];
  while (queue.length) {
    const dir = queue.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { queue.push(full); continue; }
      if (!entry.name.endsWith('noticeActions.ts') && !entry.name.endsWith('noticeActions.js')) continue;
      const src = fs.readFileSync(full, 'utf8');
      for (const m of src.matchAll(/registerNoticeAction\(\s*['"]([^'"]+)['"]/g)) {
        ids.add(m[1]);
      }
    }
  }
  return ids;
}

describe('registry integrity', () => {
  it('has no duplicate ids', () => {
    const ids = SYSTEM_NOTICES.map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all action CTAs reference a registered actionId', () => {
    const registeredActionIds = collectRegisteredActionIds();
    const actionCtaIds = SYSTEM_NOTICES
      .filter(n => n.cta?.kind === 'action')
      .map(n => (n.cta as { actionId: string }).actionId);

    for (const id of actionCtaIds) {
      expect(registeredActionIds, `actionId "${id}" not found in any client noticeActions.ts`).toContain(id);
    }
  });

  it('all publishedAt are valid ISO dates', () => {
    for (const n of SYSTEM_NOTICES) {
      expect(() => new Date(n.publishedAt).toISOString()).not.toThrow();
    }
  });

  it('minVersion and maxVersion are valid semver when set, and minVersion <= maxVersion when both set', () => {
    for (const n of SYSTEM_NOTICES) {
      if (n.minVersion !== undefined) {
        expect(semver.valid(n.minVersion), `notice "${n.id}" has invalid minVersion "${n.minVersion}"`).not.toBeNull();
      }
      if (n.maxVersion !== undefined) {
        expect(semver.valid(n.maxVersion), `notice "${n.id}" has invalid maxVersion "${n.maxVersion}"`).not.toBeNull();
      }
      if (n.minVersion && n.maxVersion) {
        expect(
          semver.lte(n.minVersion, n.maxVersion),
          `notice "${n.id}": minVersion ${n.minVersion} > maxVersion ${n.maxVersion}`
        ).toBe(true);
      }
    }
  });
});
