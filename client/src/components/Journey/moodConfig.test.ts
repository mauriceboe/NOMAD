// FE-COMP-MOOD-001 to FE-COMP-MOOD-005

import { describe, it, expect } from 'vitest';
import { MOODS, WEATHERS, getMood, moodColor, tagColors, TAG_STYLES, MOOD_DEFAULT_COLOR } from './moodConfig';

describe('moodConfig', () => {
  it('FE-COMP-MOOD-001: MOODS contains all five mood definitions', () => {
    const ids = MOODS.map(m => m.id);
    expect(ids).toEqual(['amazing', 'good', 'neutral', 'tired', 'rough']);
    expect(MOODS).toHaveLength(5);
  });

  it('FE-COMP-MOOD-002: every mood has valid hex color and css var', () => {
    for (const mood of MOODS) {
      expect(mood.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(mood.cssVar).toMatch(/^var\(--mood-.+\)$/);
      expect(mood.icon).toBeDefined();
      expect(mood.label).toBeTruthy();
    }
  });

  it('FE-COMP-MOOD-003: getMood returns correct mood or undefined', () => {
    expect(getMood('amazing')?.id).toBe('amazing');
    expect(getMood('rough')?.color).toBe('#9B8EC4');
    expect(getMood('nonexistent')).toBeUndefined();
    expect(getMood(null)).toBeUndefined();
    expect(getMood(undefined)).toBeUndefined();
  });

  it('FE-COMP-MOOD-004: moodColor returns css var or fallback', () => {
    expect(moodColor('good')).toBe('var(--mood-good)');
    expect(moodColor(null)).toBe('var(--journal-faint)');
    expect(moodColor('unknown')).toBe('var(--journal-faint)');
  });

  it('FE-COMP-MOOD-005: WEATHERS contains all eight entries with icons', () => {
    expect(WEATHERS).toHaveLength(8);
    const ids = WEATHERS.map(w => w.id);
    expect(ids).toContain('sunny');
    expect(ids).toContain('snowy');
    expect(ids).toContain('stormy');
    for (const w of WEATHERS) {
      expect(w.icon).toBeDefined();
      expect(w.label).toBeTruthy();
    }
  });
});

describe('tagColors', () => {
  it('FE-COMP-MOOD-006: returns known tag colors for light and dark mode', () => {
    const light = tagColors('hidden gem', false);
    expect(light.bg).toBe('#dcfce7');
    expect(light.fg).toBe('#166534');

    const dark = tagColors('hidden gem', true);
    expect(dark.bg).toBe('rgba(22,101,52,0.2)');
    expect(dark.fg).toBe('#86efac');
  });

  it('FE-COMP-MOOD-007: returns fallback colors for unknown tags', () => {
    const light = tagColors('random tag', false);
    expect(light.bg).toBe('rgba(0,0,0,0.05)');
    expect(light.fg).toBe('#374151');

    const dark = tagColors('random tag', true);
    expect(dark.bg).toBe('rgba(255,255,255,0.07)');
    expect(dark.fg).toBe('#a1a1aa');
  });
});
