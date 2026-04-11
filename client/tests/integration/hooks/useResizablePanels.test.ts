import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { useResizablePanels } from '../../../src/hooks/useResizablePanels';

describe('useResizablePanels', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('FE-HOOK-PANELS-001: default leftWidth is 340 when localStorage is empty', () => {
    const { result } = renderHook(() => useResizablePanels());
    expect(result.current.leftWidth).toBe(340);
  });

  it('FE-HOOK-PANELS-002: default rightWidth is 300 when localStorage is empty', () => {
    const { result } = renderHook(() => useResizablePanels());
    expect(result.current.rightWidth).toBe(300);
  });

  it('FE-HOOK-PANELS-003: leftWidth loaded from localStorage when set', () => {
    localStorage.setItem('sidebarLeftWidth', '400');
    const { result } = renderHook(() => useResizablePanels());
    expect(result.current.leftWidth).toBe(400);
  });

  it('FE-HOOK-PANELS-004: rightWidth loaded from localStorage when set', () => {
    localStorage.setItem('sidebarRightWidth', '350');
    const { result } = renderHook(() => useResizablePanels());
    expect(result.current.rightWidth).toBe(350);
  });

  it('FE-HOOK-PANELS-005: startResizeLeft sets body cursor to col-resize', () => {
    const { result } = renderHook(() => useResizablePanels());
    act(() => {
      result.current.startResizeLeft();
    });
    expect(document.body.style.cursor).toBe('col-resize');
  });

  it('FE-HOOK-PANELS-006: startResizeRight sets body cursor to col-resize', () => {
    const { result } = renderHook(() => useResizablePanels());
    act(() => {
      result.current.startResizeRight();
    });
    expect(document.body.style.cursor).toBe('col-resize');
  });

  it('FE-HOOK-PANELS-007: mousedown → mousemove → mouseup updates leftWidth and persists to localStorage', async () => {
    const { result } = renderHook(() => useResizablePanels());

    act(() => {
      result.current.startResizeLeft();
    });

    // mousemove with clientX=350 → w = max(200, min(520, 350-10)) = 340
    act(() => {
      fireEvent.mouseMove(document, { clientX: 350 });
    });

    expect(result.current.leftWidth).toBe(340);
    expect(localStorage.getItem('sidebarLeftWidth')).toBe('340');

    act(() => {
      fireEvent.mouseUp(document);
    });

    expect(document.body.style.cursor).toBe('');
  });

  it('FE-HOOK-PANELS-008: mousedown → mousemove → mouseup updates rightWidth and persists to localStorage', () => {
    // Set window.innerWidth for the right panel calculation
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });

    const { result } = renderHook(() => useResizablePanels());

    act(() => {
      result.current.startResizeRight();
    });

    // mousemove with clientX=800 → w = max(200, min(520, 1200-800-10)) = max(200, min(520, 390)) = 390
    act(() => {
      fireEvent.mouseMove(document, { clientX: 800 });
    });

    expect(result.current.rightWidth).toBe(390);
    expect(localStorage.getItem('sidebarRightWidth')).toBe('390');

    act(() => {
      fireEvent.mouseUp(document);
    });

    expect(document.body.style.cursor).toBe('');
  });

  it('FE-HOOK-PANELS-009: min width constraint (200) is enforced for left panel', () => {
    const { result } = renderHook(() => useResizablePanels());

    act(() => {
      result.current.startResizeLeft();
    });

    // clientX=50 → w = max(200, min(520, 50-10)) = max(200, 40) = 200
    act(() => {
      fireEvent.mouseMove(document, { clientX: 50 });
    });

    expect(result.current.leftWidth).toBe(200);
  });

  it('FE-HOOK-PANELS-010: max width constraint (520) is enforced for left panel', () => {
    const { result } = renderHook(() => useResizablePanels());

    act(() => {
      result.current.startResizeLeft();
    });

    // clientX=600 → w = max(200, min(520, 600-10)) = min(520, 590) = 520
    act(() => {
      fireEvent.mouseMove(document, { clientX: 600 });
    });

    expect(result.current.leftWidth).toBe(520);
  });

  it('FE-HOOK-PANELS-011: mousemove without prior startResize does nothing', () => {
    const { result } = renderHook(() => useResizablePanels());

    const initialLeft = result.current.leftWidth;
    const initialRight = result.current.rightWidth;

    act(() => {
      fireEvent.mouseMove(document, { clientX: 400 });
    });

    expect(result.current.leftWidth).toBe(initialLeft);
    expect(result.current.rightWidth).toBe(initialRight);
  });

  it('FE-HOOK-PANELS-012: body userSelect set to none during resize, cleared on mouseup', () => {
    const { result } = renderHook(() => useResizablePanels());

    act(() => {
      result.current.startResizeLeft();
    });

    expect(document.body.style.userSelect).toBe('none');

    act(() => {
      fireEvent.mouseUp(document);
    });

    expect(document.body.style.userSelect).toBe('');
  });

  it('FE-HOOK-PANELS-013: leftCollapsed and rightCollapsed default to false', () => {
    const { result } = renderHook(() => useResizablePanels());
    expect(result.current.leftCollapsed).toBe(false);
    expect(result.current.rightCollapsed).toBe(false);
  });

  it('FE-HOOK-PANELS-014: setLeftCollapsed and setRightCollapsed are exposed', () => {
    const { result } = renderHook(() => useResizablePanels());
    expect(result.current.setLeftCollapsed).toBeTypeOf('function');
    expect(result.current.setRightCollapsed).toBeTypeOf('function');
  });
});
