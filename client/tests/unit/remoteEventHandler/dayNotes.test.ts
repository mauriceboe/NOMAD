import { describe, it, expect, beforeEach } from 'vitest';
import { useTripStore } from '../../../src/store/tripStore';
import { resetAllStores } from '../../helpers/store';
import { buildDayNote } from '../../helpers/factories';

beforeEach(() => {
  resetAllStores();
});

describe('remoteEventHandler > dayNotes', () => {
  const seedData = () => {
    useTripStore.setState({
      dayNotes: {
        '10': [buildDayNote({ id: 1, day_id: 10, text: 'Original' })],
        '20': [],
      },
    });
  };

  it('FE-WSEVT-DAYNOTE-001: dayNote:created adds note to correct day', () => {
    seedData();
    const newNote = buildDayNote({ id: 99, day_id: 10, text: 'New note' });
    useTripStore.getState().handleRemoteEvent({ type: 'dayNote:created', dayId: 10, note: newNote });
    const { dayNotes } = useTripStore.getState();
    expect(dayNotes['10']).toHaveLength(2);
    expect(dayNotes['10'].find(n => n.id === 99)).toBeDefined();
  });

  it('FE-WSEVT-DAYNOTE-002: dayNote:created is idempotent — no duplicate if same ID', () => {
    seedData();
    const duplicate = buildDayNote({ id: 1, day_id: 10, text: 'Duplicate' });
    useTripStore.getState().handleRemoteEvent({ type: 'dayNote:created', dayId: 10, note: duplicate });
    const { dayNotes } = useTripStore.getState();
    expect(dayNotes['10']).toHaveLength(1);
    expect(dayNotes['10'][0].text).toBe('Original');
  });

  it('FE-WSEVT-DAYNOTE-003: dayNote:updated replaces note in correct day', () => {
    seedData();
    const updated = buildDayNote({ id: 1, day_id: 10, text: 'Updated text' });
    useTripStore.getState().handleRemoteEvent({ type: 'dayNote:updated', dayId: 10, note: updated });
    const { dayNotes } = useTripStore.getState();
    expect(dayNotes['10'][0].text).toBe('Updated text');
  });

  it('FE-WSEVT-DAYNOTE-004: dayNote:deleted removes note from correct day', () => {
    seedData();
    useTripStore.getState().handleRemoteEvent({ type: 'dayNote:deleted', dayId: 10, noteId: 1 });
    const { dayNotes } = useTripStore.getState();
    expect(dayNotes['10']).toHaveLength(0);
  });

  it('FE-WSEVT-DAYNOTE-005: operations on day 10 do not affect day 20', () => {
    seedData();
    const newNote = buildDayNote({ id: 50, day_id: 10, text: 'Day 10 note' });
    useTripStore.getState().handleRemoteEvent({ type: 'dayNote:created', dayId: 10, note: newNote });
    const { dayNotes } = useTripStore.getState();
    expect(dayNotes['20']).toHaveLength(0);
  });
});
