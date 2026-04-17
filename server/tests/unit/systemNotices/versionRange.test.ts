import { describe, it, expect } from 'vitest';
import { isNoticeVersionActive } from '../../../src/systemNotices/service.js';
import type { SystemNotice } from '../../../src/systemNotices/types.js';

const base: SystemNotice = {
  id: 'test-notice',
  display: 'modal',
  severity: 'info',
  titleKey: 'k',
  bodyKey: 'k',
  dismissible: true,
  conditions: [],
  publishedAt: '2026-01-01T00:00:00Z',
};

describe('isNoticeVersionActive', () => {
  it('passes when no bounds are set', () => {
    expect(isNoticeVersionActive(base, '3.5.0')).toBe(true);
  });

  it('passes when app version equals minVersion (inclusive)', () => {
    expect(isNoticeVersionActive({ ...base, minVersion: '3.0.0' }, '3.0.0')).toBe(true);
  });

  it('fails when app version is below minVersion', () => {
    expect(isNoticeVersionActive({ ...base, minVersion: '3.0.0' }, '2.9.9')).toBe(false);
  });

  it('fails when app version equals maxVersion (exclusive upper bound)', () => {
    expect(isNoticeVersionActive({ ...base, maxVersion: '3.0.0' }, '3.0.0')).toBe(false);
  });

  it('fails when app version exceeds maxVersion', () => {
    expect(isNoticeVersionActive({ ...base, maxVersion: '3.0.0' }, '3.0.1')).toBe(false);
  });

  it('passes when app version is just below maxVersion', () => {
    expect(isNoticeVersionActive({ ...base, maxVersion: '3.0.0' }, '2.9.9')).toBe(true);
  });

  it('passes when app version is inside [minVersion, maxVersion)', () => {
    expect(isNoticeVersionActive({ ...base, minVersion: '3.0.0', maxVersion: '3.9.9' }, '3.5.2')).toBe(true);
  });

  it('treats prerelease app version as base release (semver.coerce)', () => {
    expect(isNoticeVersionActive({ ...base, minVersion: '3.0.0' }, '3.0.0-pre.42')).toBe(true);
  });

  it('skips notice and returns false when minVersion is invalid semver', () => {
    expect(isNoticeVersionActive({ ...base, minVersion: 'not-semver' }, '3.0.0')).toBe(false);
  });

  it('skips notice and returns false when maxVersion is invalid semver', () => {
    expect(isNoticeVersionActive({ ...base, maxVersion: 'garbage' }, '3.0.0')).toBe(false);
  });
});
