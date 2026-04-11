import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlaceSelection } from '../../../src/hooks/usePlaceSelection';

// FE-HOOK-SEL-001 onwards

describe('usePlaceSelection', () => {
  it('FE-HOOK-SEL-001: initially both IDs are null', () => {
    const { result } = renderHook(() => usePlaceSelection());
    expect(result.current.selectedPlaceId).toBeNull();
    expect(result.current.selectedAssignmentId).toBeNull();
  });

  it('FE-HOOK-SEL-002: setSelectedPlaceId sets selectedPlaceId', () => {
    const { result } = renderHook(() => usePlaceSelection());
    act(() => { result.current.setSelectedPlaceId(42); });
    expect(result.current.selectedPlaceId).toBe(42);
  });

  it('FE-HOOK-SEL-003: setSelectedPlaceId clears selectedAssignmentId', () => {
    const { result } = renderHook(() => usePlaceSelection());
    // First set an assignment via selectAssignment
    act(() => { result.current.selectAssignment(99, 10); });
    expect(result.current.selectedAssignmentId).toBe(99);

    // Now change the place — assignment must be cleared
    act(() => { result.current.setSelectedPlaceId(20); });
    expect(result.current.selectedPlaceId).toBe(20);
    expect(result.current.selectedAssignmentId).toBeNull();
  });

  it('FE-HOOK-SEL-004: selectAssignment sets both selectedAssignmentId and selectedPlaceId', () => {
    const { result } = renderHook(() => usePlaceSelection());
    act(() => { result.current.selectAssignment(7, 3); });
    expect(result.current.selectedAssignmentId).toBe(7);
    expect(result.current.selectedPlaceId).toBe(3);
  });

  it('FE-HOOK-SEL-005: setSelectedPlaceId(null) resets selectedPlaceId to null and clears assignment', () => {
    const { result } = renderHook(() => usePlaceSelection());
    act(() => { result.current.selectAssignment(5, 1); });
    act(() => { result.current.setSelectedPlaceId(null); });
    expect(result.current.selectedPlaceId).toBeNull();
    expect(result.current.selectedAssignmentId).toBeNull();
  });

  it('FE-HOOK-SEL-006: selectAssignment(null, null) clears both IDs', () => {
    const { result } = renderHook(() => usePlaceSelection());
    act(() => { result.current.selectAssignment(5, 1); });
    act(() => { result.current.selectAssignment(null, null); });
    expect(result.current.selectedAssignmentId).toBeNull();
    expect(result.current.selectedPlaceId).toBeNull();
  });

  it('FE-HOOK-SEL-007: selecting a different place after an assignment clears the assignment', () => {
    const { result } = renderHook(() => usePlaceSelection());
    act(() => { result.current.selectAssignment(11, 5); });
    // Switch to a different place without going through selectAssignment
    act(() => { result.current.setSelectedPlaceId(99); });
    expect(result.current.selectedPlaceId).toBe(99);
    expect(result.current.selectedAssignmentId).toBeNull();
  });
});
