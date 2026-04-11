import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { useTripStore } from '../../../src/store/tripStore';
import { resetAllStores, seedStore } from '../../helpers/store';
import { buildPlace, buildAssignment } from '../../helpers/factories';
import { server } from '../../helpers/msw/server';

vi.mock('../../../src/api/websocket', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  getSocketId: vi.fn(() => null),
  joinTrip: vi.fn(),
  leaveTrip: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  setRefetchCallback: vi.fn(),
}));

beforeEach(() => {
  resetAllStores();
});

describe('assignmentsSlice', () => {
  describe('assignPlaceToDay', () => {
    it('FE-ASSIGN-001: assignPlaceToDay adds optimistic temp ID (negative) immediately', async () => {
      const place = buildPlace({ id: 10, trip_id: 1 });
      seedStore(useTripStore, {
        places: [place],
        assignments: { '1': [] },
      });

      // Don't await — check state mid-flight
      let tempAdded = false;
      server.use(
        http.post('/api/trips/1/days/1/assignments', async () => {
          const state = useTripStore.getState();
          const dayAssignments = state.assignments['1'];
          if (dayAssignments.some(a => a.id < 0)) {
            tempAdded = true;
          }
          const result = buildAssignment({ day_id: 1, place_id: 10, place });
          return HttpResponse.json({ assignment: result });
        }),
      );

      await useTripStore.getState().assignPlaceToDay(1, 1, 10);
      expect(tempAdded).toBe(true);
    });

    it('FE-ASSIGN-002: after API success, temp ID is replaced with real assignment', async () => {
      const place = buildPlace({ id: 10, trip_id: 1 });
      seedStore(useTripStore, {
        places: [place],
        assignments: { '1': [] },
      });

      const realAssignment = buildAssignment({ id: 999, day_id: 1, place_id: 10, place });
      server.use(
        http.post('/api/trips/1/days/1/assignments', () =>
          HttpResponse.json({ assignment: realAssignment })
        ),
      );

      await useTripStore.getState().assignPlaceToDay(1, 1, 10);

      const dayAssignments = useTripStore.getState().assignments['1'];
      expect(dayAssignments).toHaveLength(1);
      expect(dayAssignments[0].id).toBe(999);
      expect(dayAssignments.every(a => a.id > 0)).toBe(true);
    });

    it('FE-ASSIGN-003: on API failure, temp assignment is removed (rollback)', async () => {
      const place = buildPlace({ id: 10, trip_id: 1 });
      seedStore(useTripStore, {
        places: [place],
        assignments: { '1': [] },
      });

      server.use(
        http.post('/api/trips/1/days/1/assignments', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 })
        ),
      );

      await expect(useTripStore.getState().assignPlaceToDay(1, 1, 10)).rejects.toThrow();

      const dayAssignments = useTripStore.getState().assignments['1'];
      expect(dayAssignments).toHaveLength(0);
    });

    it('FE-ASSIGN-001b: returns undefined if place not found in store', async () => {
      seedStore(useTripStore, {
        places: [], // no places seeded
        assignments: { '1': [] },
      });

      const result = await useTripStore.getState().assignPlaceToDay(1, 1, 999);
      expect(result).toBeUndefined();
    });
  });

  describe('removeAssignment', () => {
    it('FE-ASSIGN-004: removeAssignment is optimistically removed, re-added on failure', async () => {
      const place = buildPlace({ id: 10, trip_id: 1 });
      const assignment = buildAssignment({ id: 100, day_id: 1, place });
      seedStore(useTripStore, {
        assignments: { '1': [assignment] },
      });

      server.use(
        http.delete('/api/trips/1/days/1/assignments/100', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 })
        ),
      );

      await expect(useTripStore.getState().removeAssignment(1, 1, 100)).rejects.toThrow();

      // Should be rolled back
      const dayAssignments = useTripStore.getState().assignments['1'];
      expect(dayAssignments).toHaveLength(1);
      expect(dayAssignments[0].id).toBe(100);
    });

    it('FE-ASSIGN-004b: removeAssignment success removes from store', async () => {
      const place = buildPlace({ id: 10, trip_id: 1 });
      const assignment = buildAssignment({ id: 100, day_id: 1, place });
      seedStore(useTripStore, {
        assignments: { '1': [assignment] },
      });

      await useTripStore.getState().removeAssignment(1, 1, 100);

      expect(useTripStore.getState().assignments['1']).toHaveLength(0);
    });
  });

  describe('reorderAssignments', () => {
    it('FE-ASSIGN-005: reorderAssignments updates order_index of assignments', async () => {
      const place1 = buildPlace({ id: 10 });
      const place2 = buildPlace({ id: 20 });
      const a1 = buildAssignment({ id: 1, day_id: 5, order_index: 0, place: place1 });
      const a2 = buildAssignment({ id: 2, day_id: 5, order_index: 1, place: place2 });
      seedStore(useTripStore, {
        assignments: { '5': [a1, a2] },
      });

      await useTripStore.getState().reorderAssignments(1, 5, [2, 1]);

      const dayAssignments = useTripStore.getState().assignments['5'];
      const reorderedA2 = dayAssignments.find(a => a.id === 2);
      const reorderedA1 = dayAssignments.find(a => a.id === 1);
      expect(reorderedA2?.order_index).toBe(0);
      expect(reorderedA1?.order_index).toBe(1);
    });

    it('FE-ASSIGN-005b: reorderAssignments rolls back on failure', async () => {
      const place1 = buildPlace({ id: 10 });
      const place2 = buildPlace({ id: 20 });
      const a1 = buildAssignment({ id: 1, day_id: 5, order_index: 0, place: place1 });
      const a2 = buildAssignment({ id: 2, day_id: 5, order_index: 1, place: place2 });
      seedStore(useTripStore, {
        assignments: { '5': [a1, a2] },
      });

      server.use(
        http.put('/api/trips/1/days/5/assignments/reorder', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 })
        ),
      );

      await expect(useTripStore.getState().reorderAssignments(1, 5, [2, 1])).rejects.toThrow();

      const dayAssignments = useTripStore.getState().assignments['5'];
      expect(dayAssignments.find(a => a.id === 1)?.order_index).toBe(0);
      expect(dayAssignments.find(a => a.id === 2)?.order_index).toBe(1);
    });
  });

  describe('moveAssignment', () => {
    it('FE-ASSIGN-006: moveAssignment removes from source day and adds to target day', async () => {
      const place = buildPlace({ id: 10 });
      const assignment = buildAssignment({ id: 50, day_id: 1, order_index: 0, place });
      seedStore(useTripStore, {
        assignments: {
          '1': [assignment],
          '2': [],
        },
      });

      await useTripStore.getState().moveAssignment(1, 50, 1, 2);

      expect(useTripStore.getState().assignments['1']).toHaveLength(0);
      expect(useTripStore.getState().assignments['2']).toHaveLength(1);
      expect(useTripStore.getState().assignments['2'][0].id).toBe(50);
    });

    it('FE-ASSIGN-007: moveAssignment rolls back on failure', async () => {
      const place = buildPlace({ id: 10 });
      const assignment = buildAssignment({ id: 50, day_id: 1, order_index: 0, place });
      seedStore(useTripStore, {
        assignments: {
          '1': [assignment],
          '2': [],
        },
      });

      server.use(
        http.put('/api/trips/1/assignments/50/move', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 })
        ),
      );

      await expect(useTripStore.getState().moveAssignment(1, 50, 1, 2)).rejects.toThrow();

      // Rolled back: assignment back in day 1
      expect(useTripStore.getState().assignments['1']).toHaveLength(1);
      expect(useTripStore.getState().assignments['1'][0].id).toBe(50);
      expect(useTripStore.getState().assignments['2']).toHaveLength(0);
    });
  });
});
