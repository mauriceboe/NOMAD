import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { useDayNotes } from '../../../src/hooks/useDayNotes';
import { useTripStore } from '../../../src/store/tripStore';
import { TranslationProvider } from '../../../src/i18n/TranslationContext';
import { server } from '../../helpers/msw/server';
import { buildDayNote } from '../../helpers/factories';
import { resetAllStores } from '../../helpers/store';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(TranslationProvider, null, children);

const TRIP_ID = 1;
const DAY_ID = 10;

describe('useDayNotes', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('FE-HOOK-DAYNOTES-001: initial noteUi state is empty', () => {
    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });
    expect(result.current.noteUi).toEqual({});
  });

  it('FE-HOOK-DAYNOTES-002: initial dayNotes comes from tripStore', () => {
    const note = buildDayNote({ day_id: DAY_ID });
    useTripStore.setState({ dayNotes: { [String(DAY_ID)]: [note] } });

    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });
    expect(result.current.dayNotes[String(DAY_ID)]).toEqual([note]);
  });

  it('FE-HOOK-DAYNOTES-003: openAddNote sets mode=add and default sort order', () => {
    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    act(() => {
      result.current.openAddNote(DAY_ID, () => []);
    });

    expect(result.current.noteUi[DAY_ID]).toMatchObject({
      mode: 'add',
      text: '',
      sortOrder: 0, // maxKey(-1) + 1 = 0
    });
  });

  it('FE-HOOK-DAYNOTES-004: openAddNote calculates sortOrder as max(sortKey) + 1 from merged items', () => {
    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    const getMergedItems = () => [
      { type: 'note' as const, sortKey: 5, data: buildDayNote() },
      { type: 'note' as const, sortKey: 10, data: buildDayNote() },
    ];

    act(() => {
      result.current.openAddNote(DAY_ID, getMergedItems);
    });

    expect(result.current.noteUi[DAY_ID]).toMatchObject({
      mode: 'add',
      sortOrder: 11, // max(5,10) + 1
    });
  });

  it('FE-HOOK-DAYNOTES-005: openEditNote sets mode=edit with note data', () => {
    const note = buildDayNote({ id: 99, text: 'Hello', time: '10:00', icon: 'Star' });
    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    act(() => {
      result.current.openEditNote(DAY_ID, note);
    });

    expect(result.current.noteUi[DAY_ID]).toMatchObject({
      mode: 'edit',
      noteId: 99,
      text: 'Hello',
      time: '10:00',
      icon: 'Star',
    });
  });

  it('FE-HOOK-DAYNOTES-006: cancelNote removes the UI entry for that day', () => {
    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    act(() => {
      result.current.openAddNote(DAY_ID, () => []);
    });
    expect(result.current.noteUi[DAY_ID]).toBeDefined();

    act(() => {
      result.current.cancelNote(DAY_ID);
    });
    expect(result.current.noteUi[DAY_ID]).toBeUndefined();
  });

  it('FE-HOOK-DAYNOTES-007: saveNote with empty text is a no-op', async () => {
    const spy = vi.fn();
    server.use(
      http.post('/api/trips/:id/days/:dayId/notes', () => {
        spy();
        return HttpResponse.json({ note: buildDayNote() });
      })
    );

    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    act(() => {
      result.current.setNoteUi({ [DAY_ID]: { mode: 'add', text: '', time: '', icon: 'FileText', sortOrder: 0 } });
    });

    await act(async () => {
      await result.current.saveNote(DAY_ID);
    });

    expect(spy).not.toHaveBeenCalled();
    // noteUi remains set (no cancelNote was called)
    expect(result.current.noteUi[DAY_ID]).toBeDefined();
  });

  it('FE-HOOK-DAYNOTES-008: saveNote in add mode calls addDayNote and clears UI', async () => {
    const createdNote = buildDayNote({ day_id: DAY_ID, text: 'New note' });
    server.use(
      http.post('/api/trips/:id/days/:dayId/notes', async () => {
        return HttpResponse.json({ note: createdNote });
      })
    );

    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    act(() => {
      result.current.setNoteUi({
        [DAY_ID]: { mode: 'add', text: 'New note', time: '', icon: 'FileText', sortOrder: 0 },
      });
    });

    await act(async () => {
      await result.current.saveNote(DAY_ID);
    });

    // UI should be cleared after successful save
    expect(result.current.noteUi[DAY_ID]).toBeUndefined();
  });

  it('FE-HOOK-DAYNOTES-009: saveNote in edit mode calls updateDayNote and clears UI', async () => {
    const noteId = 55;
    const updatedNote = buildDayNote({ id: noteId, day_id: DAY_ID, text: 'Updated' });
    server.use(
      http.put('/api/trips/:id/days/:dayId/notes/:noteId', async () => {
        return HttpResponse.json({ note: updatedNote });
      })
    );

    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    act(() => {
      result.current.setNoteUi({
        [DAY_ID]: { mode: 'edit', noteId, text: 'Updated', time: '', icon: 'FileText' },
      });
    });

    await act(async () => {
      await result.current.saveNote(DAY_ID);
    });

    expect(result.current.noteUi[DAY_ID]).toBeUndefined();
  });

  it('FE-HOOK-DAYNOTES-010: deleteNote calls deleteDayNote on the store', async () => {
    const note = buildDayNote({ id: 77, day_id: DAY_ID });
    useTripStore.setState({ dayNotes: { [String(DAY_ID)]: [note] } });

    server.use(
      http.delete('/api/trips/:id/days/:dayId/notes/:noteId', () => {
        return HttpResponse.json({ success: true });
      })
    );

    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    await act(async () => {
      await result.current.deleteNote(DAY_ID, 77);
    });

    // Note should be removed from the store
    const dayNotes = useTripStore.getState().dayNotes[String(DAY_ID)] || [];
    expect(dayNotes.find((n) => n.id === 77)).toBeUndefined();
  });

  it('FE-HOOK-DAYNOTES-011: saveNote on API error shows toast', async () => {
    const toastSpy = vi.fn();
    window.__addToast = toastSpy;

    server.use(
      http.post('/api/trips/:id/days/:dayId/notes', () => {
        return HttpResponse.json({ error: 'Server error' }, { status: 500 });
      })
    );

    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    act(() => {
      result.current.setNoteUi({
        [DAY_ID]: { mode: 'add', text: 'Test note', time: '', icon: 'FileText', sortOrder: 0 },
      });
    });

    await act(async () => {
      await result.current.saveNote(DAY_ID);
    });

    expect(toastSpy).toHaveBeenCalledWith(expect.any(String), 'error', undefined);
    delete window.__addToast;
  });

  it('FE-HOOK-DAYNOTES-012: deleteNote on API error shows toast', async () => {
    const toastSpy = vi.fn();
    window.__addToast = toastSpy;

    const note = buildDayNote({ id: 88, day_id: DAY_ID });
    useTripStore.setState({ dayNotes: { [String(DAY_ID)]: [note] } });

    server.use(
      http.delete('/api/trips/:id/days/:dayId/notes/:noteId', () => {
        return HttpResponse.json({ error: 'Server error' }, { status: 500 });
      })
    );

    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    await act(async () => {
      await result.current.deleteNote(DAY_ID, 88);
    });

    expect(toastSpy).toHaveBeenCalledWith(expect.any(String), 'error', undefined);
    delete window.__addToast;
  });

  it('FE-HOOK-DAYNOTES-013: moveNote up calculates midpoint sort order', async () => {
    let capturedBody: Record<string, unknown> = {};
    server.use(
      http.put('/api/trips/:id/days/:dayId/notes/:noteId', async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ note: buildDayNote() });
      })
    );

    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    const noteA = buildDayNote({ id: 1 });
    const noteB = buildDayNote({ id: 2 });
    const noteC = buildDayNote({ id: 3 });

    // merged items with sortKeys 0, 2, 4
    const getMergedItems = () => [
      { type: 'note' as const, sortKey: 0, data: noteA },
      { type: 'note' as const, sortKey: 2, data: noteB },
      { type: 'note' as const, sortKey: 4, data: noteC },
    ];

    // Move noteC (idx=2) up → new order should be between idx=0 and idx=1 → (0+2)/2 = 1
    await act(async () => {
      await result.current.moveNote(DAY_ID, noteC.id, 'up', getMergedItems);
    });

    expect(capturedBody.sort_order).toBe(1); // (sortKey[0] + sortKey[1]) / 2 = (0+2)/2
  });

  it('FE-HOOK-DAYNOTES-014: moveNote down calculates midpoint sort order', async () => {
    let capturedBody: Record<string, unknown> = {};
    server.use(
      http.put('/api/trips/:id/days/:dayId/notes/:noteId', async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ note: buildDayNote() });
      })
    );

    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    const noteA = buildDayNote({ id: 1 });
    const noteB = buildDayNote({ id: 2 });
    const noteC = buildDayNote({ id: 3 });

    const getMergedItems = () => [
      { type: 'note' as const, sortKey: 0, data: noteA },
      { type: 'note' as const, sortKey: 2, data: noteB },
      { type: 'note' as const, sortKey: 4, data: noteC },
    ];

    // Move noteA (idx=0) down → new order between idx=1 and idx=2 → (2+4)/2 = 3
    await act(async () => {
      await result.current.moveNote(DAY_ID, noteA.id, 'down', getMergedItems);
    });

    expect(capturedBody.sort_order).toBe(3); // (sortKey[1] + sortKey[2]) / 2 = (2+4)/2
  });

  it('FE-HOOK-DAYNOTES-015: moveNote up at index 0 is a no-op', async () => {
    const spy = vi.fn();
    server.use(
      http.put('/api/trips/:id/days/:dayId/notes/:noteId', () => {
        spy();
        return HttpResponse.json({ note: buildDayNote() });
      })
    );

    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    const noteA = buildDayNote({ id: 1 });
    const getMergedItems = () => [
      { type: 'note' as const, sortKey: 0, data: noteA },
    ];

    await act(async () => {
      await result.current.moveNote(DAY_ID, noteA.id, 'up', getMergedItems);
    });

    expect(spy).not.toHaveBeenCalled();
  });

  it('FE-HOOK-DAYNOTES-016: moveNote down at last index is a no-op', async () => {
    const spy = vi.fn();
    server.use(
      http.put('/api/trips/:id/days/:dayId/notes/:noteId', () => {
        spy();
        return HttpResponse.json({ note: buildDayNote() });
      })
    );

    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    const noteA = buildDayNote({ id: 1 });
    const getMergedItems = () => [
      { type: 'note' as const, sortKey: 0, data: noteA },
    ];

    await act(async () => {
      await result.current.moveNote(DAY_ID, noteA.id, 'down', getMergedItems);
    });

    expect(spy).not.toHaveBeenCalled();
  });

  it('FE-HOOK-DAYNOTES-017: moveNote down at last item uses sortKey + 1', async () => {
    let capturedBody: Record<string, unknown> = {};
    server.use(
      http.put('/api/trips/:id/days/:dayId/notes/:noteId', async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ note: buildDayNote() });
      })
    );

    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    const noteA = buildDayNote({ id: 1 });
    const noteB = buildDayNote({ id: 2 });

    const getMergedItems = () => [
      { type: 'note' as const, sortKey: 5, data: noteA },
      { type: 'note' as const, sortKey: 10, data: noteB },
    ];

    // Move noteA (idx=0) down — only 2 items, so idx < length-1 is false after going down
    // direction=down, idx=0, length=2, idx < length-2 is false (0 < 0), so newSortOrder = sortKey[1]+1 = 11
    await act(async () => {
      await result.current.moveNote(DAY_ID, noteA.id, 'down', getMergedItems);
    });

    expect(capturedBody.sort_order).toBe(11); // sortKey[idx+1] + 1 = 10 + 1
  });

  it('FE-HOOK-DAYNOTES-018: moveNote on error shows toast', async () => {
    const toastSpy = vi.fn();
    window.__addToast = toastSpy;

    server.use(
      http.put('/api/trips/:id/days/:dayId/notes/:noteId', () => {
        return HttpResponse.json({ error: 'Server error' }, { status: 500 });
      })
    );

    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    const noteA = buildDayNote({ id: 1 });
    const noteB = buildDayNote({ id: 2 });

    const getMergedItems = () => [
      { type: 'note' as const, sortKey: 0, data: noteA },
      { type: 'note' as const, sortKey: 1, data: noteB },
    ];

    await act(async () => {
      await result.current.moveNote(DAY_ID, noteA.id, 'down', getMergedItems);
    });

    expect(toastSpy).toHaveBeenCalledWith(expect.any(String), 'error', undefined);
    delete window.__addToast;
  });

  it('FE-HOOK-DAYNOTES-019: moveNote up with only 1 item before uses sortKey - 1', async () => {
    let capturedBody: Record<string, unknown> = {};
    server.use(
      http.put('/api/trips/:id/days/:dayId/notes/:noteId', async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ note: buildDayNote() });
      })
    );

    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    const noteA = buildDayNote({ id: 1 });
    const noteB = buildDayNote({ id: 2 });

    const getMergedItems = () => [
      { type: 'note' as const, sortKey: 5, data: noteA },
      { type: 'note' as const, sortKey: 10, data: noteB },
    ];

    // Move noteB (idx=1) up — idx >= 2 is false, so newSortOrder = sortKey[idx-1] - 1 = 5-1 = 4
    await act(async () => {
      await result.current.moveNote(DAY_ID, noteB.id, 'up', getMergedItems);
    });

    expect(capturedBody.sort_order).toBe(4); // sortKey[0] - 1 = 5 - 1
  });

  it('FE-HOOK-DAYNOTES-020: openAddNote calls expandDay if provided', () => {
    const expandDay = vi.fn();
    const { result } = renderHook(() => useDayNotes(TRIP_ID), { wrapper });

    act(() => {
      result.current.openAddNote(DAY_ID, () => [], expandDay);
    });

    expect(expandDay).toHaveBeenCalledWith(DAY_ID);
  });
});

// Type augment for window.__addToast
declare global {
  interface Window {
    __addToast?: (message: string, type: string, duration?: number) => void;
  }
}
