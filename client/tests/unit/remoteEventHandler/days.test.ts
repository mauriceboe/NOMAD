import { describe, it, expect, beforeEach } from 'vitest';
import { useTripStore } from '../../../src/store/tripStore';
import { resetAllStores } from '../../helpers/store';
import { buildDay, buildAssignment, buildDayNote } from '../../helpers/factories';

beforeEach(() => {
  resetAllStores();
});

describe('remoteEventHandler > days', () => {
  const seedData = () => {
    useTripStore.setState({
      days: [buildDay({ id: 10 }), buildDay({ id: 20 })],
      assignments: {
        '10': [buildAssignment({ id: 100, day_id: 10 })],
        '20': [],
      },
      dayNotes: {
        '10': [buildDayNote({ id: 1, day_id: 10 })],
        '20': [],
      },
    });
  };

  it('FE-WSEVT-DAY-001: day:created adds day to days array', () => {
    seedData();
    const newDay = buildDay({ id: 30 });
    useTripStore.getState().handleRemoteEvent({ type: 'day:created', day: newDay });
    const { days } = useTripStore.getState();
    expect(days).toHaveLength(3);
    expect(days.find(d => d.id === 30)).toBeDefined();
  });

  it('FE-WSEVT-DAY-002: day:created is idempotent — no duplicate if same ID', () => {
    seedData();
    const duplicate = buildDay({ id: 10 });
    useTripStore.getState().handleRemoteEvent({ type: 'day:created', day: duplicate });
    const { days } = useTripStore.getState();
    expect(days).toHaveLength(2);
  });

  it('FE-WSEVT-DAY-003: day:updated replaces day in days array', () => {
    seedData();
    const updated = buildDay({ id: 10, title: 'New Title' });
    useTripStore.getState().handleRemoteEvent({ type: 'day:updated', day: updated });
    const { days } = useTripStore.getState();
    const day10 = days.find(d => d.id === 10);
    expect(day10?.title).toBe('New Title');
  });

  it('FE-WSEVT-DAY-004: day:deleted removes day from days array', () => {
    seedData();
    useTripStore.getState().handleRemoteEvent({ type: 'day:deleted', dayId: 10 });
    const { days } = useTripStore.getState();
    expect(days).toHaveLength(1);
    expect(days.find(d => d.id === 10)).toBeUndefined();
  });

  it('FE-WSEVT-DAY-005: day:deleted removes the assignments key for deleted day', () => {
    seedData();
    useTripStore.getState().handleRemoteEvent({ type: 'day:deleted', dayId: 10 });
    const { assignments } = useTripStore.getState();
    expect('10' in assignments).toBe(false);
  });

  it('FE-WSEVT-DAY-006: day:deleted removes the dayNotes key for deleted day', () => {
    seedData();
    useTripStore.getState().handleRemoteEvent({ type: 'day:deleted', dayId: 10 });
    const { dayNotes } = useTripStore.getState();
    expect('10' in dayNotes).toBe(false);
  });

  it('FE-WSEVT-DAY-007: day:deleted does not remove other days assignments/dayNotes', () => {
    seedData();
    useTripStore.getState().handleRemoteEvent({ type: 'day:deleted', dayId: 10 });
    const { assignments, dayNotes } = useTripStore.getState();
    expect('20' in assignments).toBe(true);
    expect('20' in dayNotes).toBe(true);
  });
});
