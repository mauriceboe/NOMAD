import { describe, it, expect } from 'vitest';
import { swapItems } from '../../../src/utils/reorder';

// FE-UTIL-020 onwards

const items = [
  { id: 10 },
  { id: 20 },
  { id: 30 },
  { id: 40 },
];

describe('swapItems', () => {
  it('FE-UTIL-020: swaps item up with its predecessor', () => {
    const result = swapItems(items, 1, 'up');
    expect(result).toEqual([20, 10, 30, 40]);
  });

  it('FE-UTIL-021: swaps item down with its successor', () => {
    const result = swapItems(items, 1, 'down');
    expect(result).toEqual([10, 30, 20, 40]);
  });

  it('FE-UTIL-022: returns null when moving first item up (out of bounds)', () => {
    expect(swapItems(items, 0, 'up')).toBeNull();
  });

  it('FE-UTIL-023: returns null when moving last item down (out of bounds)', () => {
    expect(swapItems(items, items.length - 1, 'down')).toBeNull();
  });

  it('FE-UTIL-024: swaps first and second items when moving index 1 up', () => {
    const result = swapItems(items, 1, 'up');
    expect(result![0]).toBe(20);
    expect(result![1]).toBe(10);
  });

  it('FE-UTIL-025: returns an array of IDs (not objects)', () => {
    const result = swapItems(items, 0, 'down');
    expect(Array.isArray(result)).toBe(true);
    expect(typeof result![0]).toBe('number');
  });

  it('FE-UTIL-026: does not mutate the original array', () => {
    const original = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const snapshot = original.map((o) => o.id);
    swapItems(original, 0, 'down');
    expect(original.map((o) => o.id)).toEqual(snapshot);
  });

  it('FE-UTIL-027: returns null for a single-element array moving down', () => {
    expect(swapItems([{ id: 5 }], 0, 'down')).toBeNull();
  });

  it('FE-UTIL-028: returns null for a single-element array moving up', () => {
    expect(swapItems([{ id: 5 }], 0, 'up')).toBeNull();
  });

  it('FE-UTIL-029: swaps last two items when moving second-to-last down', () => {
    const result = swapItems(items, items.length - 2, 'down');
    expect(result).toEqual([10, 20, 40, 30]);
  });
});
