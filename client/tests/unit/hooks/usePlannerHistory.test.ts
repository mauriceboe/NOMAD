import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlannerHistory } from '../../../src/hooks/usePlannerHistory';

// FE-HOOK-HIST-001 onwards

describe('usePlannerHistory', () => {
  it('FE-HOOK-HIST-001: starts with canUndo=false and lastActionLabel=null', () => {
    const { result } = renderHook(() => usePlannerHistory());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.lastActionLabel).toBeNull();
  });

  it('FE-HOOK-HIST-002: pushing an entry sets canUndo=true and lastActionLabel', () => {
    const { result } = renderHook(() => usePlannerHistory());
    act(() => {
      result.current.pushUndo('Delete place', vi.fn());
    });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.lastActionLabel).toBe('Delete place');
  });

  it('FE-HOOK-HIST-003: calling undo fires the undo function and sets canUndo=false', async () => {
    const { result } = renderHook(() => usePlannerHistory());
    const undoFn = vi.fn();
    act(() => {
      result.current.pushUndo('Add place', undoFn);
    });
    await act(async () => {
      await result.current.undo();
    });
    expect(undoFn).toHaveBeenCalledOnce();
    expect(result.current.canUndo).toBe(false);
  });

  it('FE-HOOK-HIST-004: multiple entries stack in LIFO order', () => {
    const { result } = renderHook(() => usePlannerHistory());
    act(() => {
      result.current.pushUndo('First', vi.fn());
      result.current.pushUndo('Second', vi.fn());
      result.current.pushUndo('Third', vi.fn());
    });
    expect(result.current.lastActionLabel).toBe('Third');
  });

  it('FE-HOOK-HIST-005: undo consumes entries in LIFO order', async () => {
    const { result } = renderHook(() => usePlannerHistory());
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    act(() => {
      result.current.pushUndo('First', fn1);
      result.current.pushUndo('Second', fn2);
    });
    await act(async () => { await result.current.undo(); });
    expect(fn2).toHaveBeenCalledOnce();
    expect(fn1).not.toHaveBeenCalled();
    expect(result.current.lastActionLabel).toBe('First');

    await act(async () => { await result.current.undo(); });
    expect(fn1).toHaveBeenCalledOnce();
    expect(result.current.canUndo).toBe(false);
  });

  it('FE-HOOK-HIST-006: caps history at 30 entries', () => {
    const { result } = renderHook(() => usePlannerHistory());
    act(() => {
      for (let i = 0; i < 31; i++) {
        result.current.pushUndo(`Action ${i}`, vi.fn());
      }
    });
    // After 31 pushes with cap=30, the oldest entry (Action 0) should be dropped.
    // canUndo must be true and the stack should not exceed 30.
    expect(result.current.canUndo).toBe(true);
    expect(result.current.lastActionLabel).toBe('Action 30');
  });

  it('FE-HOOK-HIST-007: undo on an empty stack does not throw', async () => {
    const { result } = renderHook(() => usePlannerHistory());
    await expect(
      act(async () => { await result.current.undo(); })
    ).resolves.not.toThrow();
    expect(result.current.canUndo).toBe(false);
  });

  it('FE-HOOK-HIST-008: undo still sets canUndo=false after consuming the last entry', async () => {
    const { result } = renderHook(() => usePlannerHistory());
    act(() => { result.current.pushUndo('Only', vi.fn()); });
    await act(async () => { await result.current.undo(); });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.lastActionLabel).toBeNull();
  });
});
