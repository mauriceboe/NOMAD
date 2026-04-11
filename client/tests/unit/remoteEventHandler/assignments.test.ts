import { describe, it, expect, beforeEach } from 'vitest';
import { useTripStore } from '../../../src/store/tripStore';
import { resetAllStores } from '../../helpers/store';
import { buildDay, buildAssignment, buildPlace } from '../../helpers/factories';

beforeEach(() => {
  resetAllStores();
});

describe('remoteEventHandler > assignments', () => {
  const seedData = () => {
    useTripStore.setState({
      days: [buildDay({ id: 10 }), buildDay({ id: 20 })],
      assignments: {
        '10': [buildAssignment({ id: 100, day_id: 10 })],
        '20': [],
      },
    });
  };

  it('FE-WSEVT-ASSIGN-001: assignment:created adds assignment to correct day', () => {
    seedData();
    const newAssignment = buildAssignment({ id: 200, day_id: 20 });
    useTripStore.getState().handleRemoteEvent({ type: 'assignment:created', assignment: newAssignment });
    const { assignments } = useTripStore.getState();
    expect(assignments['20']).toHaveLength(1);
    expect(assignments['20'][0].id).toBe(200);
    expect(assignments['10']).toHaveLength(1);
  });

  it('FE-WSEVT-ASSIGN-002: assignment:created is idempotent — no duplicate if same ID', () => {
    seedData();
    const duplicate = buildAssignment({ id: 100, day_id: 10 });
    useTripStore.getState().handleRemoteEvent({ type: 'assignment:created', assignment: duplicate });
    const { assignments } = useTripStore.getState();
    expect(assignments['10']).toHaveLength(1);
  });

  it('FE-WSEVT-ASSIGN-003: assignment:created replaces temp (negative) ID assignment with same place_id', () => {
    const place = buildPlace({ id: 55 });
    const tempAssignment = buildAssignment({ id: -1, day_id: 10, place, place_id: place.id });
    useTripStore.setState({
      days: [buildDay({ id: 10 })],
      assignments: { '10': [tempAssignment] },
    });
    const realAssignment = buildAssignment({ id: 500, day_id: 10, place, place_id: place.id });
    useTripStore.getState().handleRemoteEvent({ type: 'assignment:created', assignment: realAssignment });
    const { assignments } = useTripStore.getState();
    expect(assignments['10']).toHaveLength(1);
    expect(assignments['10'][0].id).toBe(500);
  });

  it('FE-WSEVT-ASSIGN-004: assignment:updated merges updated data into correct day', () => {
    seedData();
    const updated = buildAssignment({ id: 100, day_id: 10, notes: 'Updated notes' });
    useTripStore.getState().handleRemoteEvent({ type: 'assignment:updated', assignment: updated });
    const { assignments } = useTripStore.getState();
    expect(assignments['10'][0].notes).toBe('Updated notes');
  });

  it('FE-WSEVT-ASSIGN-005: assignment:deleted removes assignment from day', () => {
    seedData();
    useTripStore.getState().handleRemoteEvent({ type: 'assignment:deleted', assignmentId: 100, dayId: 10 });
    const { assignments } = useTripStore.getState();
    expect(assignments['10']).toHaveLength(0);
  });

  it('FE-WSEVT-ASSIGN-006: assignment:moved removes from old day and adds to new day', () => {
    const movedAssignment = buildAssignment({ id: 100, day_id: 20 });
    useTripStore.setState({
      days: [buildDay({ id: 10 }), buildDay({ id: 20 })],
      assignments: {
        '10': [movedAssignment],
        '20': [],
      },
    });
    useTripStore.getState().handleRemoteEvent({
      type: 'assignment:moved',
      assignment: movedAssignment,
      oldDayId: 10,
      newDayId: 20,
    });
    const { assignments } = useTripStore.getState();
    expect(assignments['10']).toHaveLength(0);
    expect(assignments['20']).toHaveLength(1);
    expect(assignments['20'][0].id).toBe(100);
  });

  it('FE-WSEVT-ASSIGN-007: assignment:reordered updates order_index values', () => {
    const a1 = buildAssignment({ id: 1, day_id: 10, order_index: 0 });
    const a2 = buildAssignment({ id: 2, day_id: 10, order_index: 1 });
    const a3 = buildAssignment({ id: 3, day_id: 10, order_index: 2 });
    useTripStore.setState({
      assignments: { '10': [a1, a2, a3] },
    });
    useTripStore.getState().handleRemoteEvent({
      type: 'assignment:reordered',
      dayId: 10,
      orderedIds: [3, 1, 2],
    });
    const { assignments } = useTripStore.getState();
    const reordered = assignments['10'];
    const item3 = reordered.find(a => a.id === 3);
    const item1 = reordered.find(a => a.id === 1);
    const item2 = reordered.find(a => a.id === 2);
    expect(item3?.order_index).toBe(0);
    expect(item1?.order_index).toBe(1);
    expect(item2?.order_index).toBe(2);
  });
});
