import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { useTripStore } from '../../../src/store/tripStore';
import { resetAllStores, seedStore } from '../../helpers/store';
import { buildBudgetItem, buildReservation } from '../../helpers/factories';
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

describe('budgetSlice', () => {
  describe('loadBudgetItems', () => {
    it('FE-BUDGET-001: loadBudgetItems fetches and replaces budgetItems', async () => {
      seedStore(useTripStore, { budgetItems: [] });

      const item = buildBudgetItem({ trip_id: 1 });
      server.use(
        http.get('/api/trips/1/budget', () => HttpResponse.json({ items: [item] })),
      );

      await useTripStore.getState().loadBudgetItems(1);

      expect(useTripStore.getState().budgetItems).toHaveLength(1);
      expect(useTripStore.getState().budgetItems[0].id).toBe(item.id);
    });
  });

  describe('addBudgetItem', () => {
    it('FE-BUDGET-002: addBudgetItem appends to budgetItems', async () => {
      const existing = buildBudgetItem({ trip_id: 1 });
      seedStore(useTripStore, { budgetItems: [existing] });

      const result = await useTripStore.getState().addBudgetItem(1, { name: 'Hotel', amount: 200 });

      expect(result.name).toBe('Hotel');
      expect(useTripStore.getState().budgetItems).toHaveLength(2);
    });

    it('FE-BUDGET-003: addBudgetItem on failure throws', async () => {
      server.use(
        http.post('/api/trips/1/budget', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 })
        ),
      );

      await expect(
        useTripStore.getState().addBudgetItem(1, { name: 'Fail' })
      ).rejects.toThrow();
    });
  });

  describe('updateBudgetItem', () => {
    it('FE-BUDGET-004: updateBudgetItem replaces item in array', async () => {
      const item = buildBudgetItem({ id: 10, trip_id: 1, name: 'Old', amount: 100 });
      seedStore(useTripStore, { budgetItems: [item] });

      server.use(
        http.put('/api/trips/1/budget/10', async ({ request }) => {
          const body = await request.json() as Record<string, unknown>;
          return HttpResponse.json({ item: { ...item, ...body } });
        }),
      );

      const result = await useTripStore.getState().updateBudgetItem(1, 10, { name: 'Updated', amount: 150 });

      expect(result.name).toBe('Updated');
      expect(useTripStore.getState().budgetItems[0].name).toBe('Updated');
    });

    it('FE-BUDGET-005: updateBudgetItem with total_price triggers loadReservations when reservation_id present', async () => {
      const item = buildBudgetItem({ id: 10, trip_id: 1, amount: 100 });
      const initialReservation = buildReservation({ trip_id: 1 });
      const newReservation = buildReservation({ trip_id: 1, name: 'Refreshed Reservation' });
      seedStore(useTripStore, {
        budgetItems: [item],
        reservations: [initialReservation],
      });

      server.use(
        http.put('/api/trips/1/budget/10', async ({ request }) => {
          const body = await request.json() as Record<string, unknown>;
          // Return item with reservation_id to trigger loadReservations
          return HttpResponse.json({ item: { ...item, ...body, reservation_id: 42 } });
        }),
        http.get('/api/trips/1/reservations', () =>
          HttpResponse.json({ reservations: [newReservation] })
        ),
      );

      await useTripStore.getState().updateBudgetItem(1, 10, { total_price: 200 } as Record<string, unknown>);

      // Wait for the async loadReservations to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(useTripStore.getState().reservations).toHaveLength(1);
      expect(useTripStore.getState().reservations[0].name).toBe('Refreshed Reservation');
    });
  });

  describe('deleteBudgetItem', () => {
    it('FE-BUDGET-006: deleteBudgetItem optimistically removes item, rolls back on failure', async () => {
      const item = buildBudgetItem({ id: 10, trip_id: 1 });
      seedStore(useTripStore, { budgetItems: [item] });

      server.use(
        http.delete('/api/trips/1/budget/10', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 })
        ),
      );

      await expect(useTripStore.getState().deleteBudgetItem(1, 10)).rejects.toThrow();

      expect(useTripStore.getState().budgetItems).toHaveLength(1);
      expect(useTripStore.getState().budgetItems[0].id).toBe(10);
    });

    it('FE-BUDGET-006b: deleteBudgetItem success removes item', async () => {
      const item1 = buildBudgetItem({ id: 10, trip_id: 1 });
      const item2 = buildBudgetItem({ id: 20, trip_id: 1 });
      seedStore(useTripStore, { budgetItems: [item1, item2] });

      await useTripStore.getState().deleteBudgetItem(1, 10);

      expect(useTripStore.getState().budgetItems).toHaveLength(1);
      expect(useTripStore.getState().budgetItems[0].id).toBe(20);
    });
  });

  describe('setBudgetItemMembers', () => {
    it('FE-BUDGET-007: setBudgetItemMembers updates members array on item', async () => {
      const item = buildBudgetItem({ id: 10, trip_id: 1, members: [] });
      seedStore(useTripStore, { budgetItems: [item] });

      const members = [{ user_id: 1, paid: false }, { user_id: 2, paid: false }];
      server.use(
        http.put('/api/trips/1/budget/10/members', () =>
          HttpResponse.json({ members, item: { ...item, persons: 2, members } })
        ),
      );

      const result = await useTripStore.getState().setBudgetItemMembers(1, 10, [1, 2]);

      expect(result.members).toHaveLength(2);
      const updatedItem = useTripStore.getState().budgetItems.find(i => i.id === 10);
      expect(updatedItem?.members).toHaveLength(2);
      expect(updatedItem?.persons).toBe(2);
    });
  });

  describe('toggleBudgetMemberPaid', () => {
    it('FE-BUDGET-008: toggleBudgetMemberPaid updates paid status after API success', async () => {
      const member = { user_id: 5, paid: false };
      const item = buildBudgetItem({ id: 10, trip_id: 1, members: [member] });
      seedStore(useTripStore, { budgetItems: [item] });

      await useTripStore.getState().toggleBudgetMemberPaid(1, 10, 5, true);

      const updatedItem = useTripStore.getState().budgetItems.find(i => i.id === 10);
      const updatedMember = updatedItem?.members.find(m => m.user_id === 5);
      expect(updatedMember?.paid).toBe(true);
    });
  });
});
