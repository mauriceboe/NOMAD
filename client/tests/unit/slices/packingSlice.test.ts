import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { useTripStore } from '../../../src/store/tripStore';
import { resetAllStores, seedStore } from '../../helpers/store';
import { buildPackingItem } from '../../helpers/factories';
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

describe('packingSlice', () => {
  describe('addPackingItem', () => {
    it('FE-PACKING-001: addPackingItem calls API and appends item to packingItems', async () => {
      const existing = buildPackingItem({ trip_id: 1, name: 'Existing' });
      seedStore(useTripStore, { packingItems: [existing] });

      const result = await useTripStore.getState().addPackingItem(1, { name: 'Toothbrush', quantity: 1 });

      expect(result.name).toBe('Toothbrush');
      const items = useTripStore.getState().packingItems;
      expect(items).toHaveLength(2);
      // addPackingItem appends (not prepends)
      expect(items[items.length - 1].name).toBe('Toothbrush');
    });

    it('FE-PACKING-002: addPackingItem on failure throws', async () => {
      server.use(
        http.post('/api/trips/1/packing', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 })
        ),
      );

      await expect(
        useTripStore.getState().addPackingItem(1, { name: 'Fail item' })
      ).rejects.toThrow();
    });
  });

  describe('updatePackingItem', () => {
    it('FE-PACKING-003: updatePackingItem replaces item in array by id', async () => {
      const item = buildPackingItem({ id: 10, trip_id: 1, name: 'Old name', quantity: 1 });
      seedStore(useTripStore, { packingItems: [item] });

      server.use(
        http.put('/api/trips/1/packing/10', async ({ request }) => {
          const body = await request.json() as Record<string, unknown>;
          return HttpResponse.json({ item: { ...item, ...body } });
        }),
      );

      const result = await useTripStore.getState().updatePackingItem(1, 10, { name: 'New name' });

      expect(result.name).toBe('New name');
      expect(useTripStore.getState().packingItems[0].name).toBe('New name');
    });
  });

  describe('deletePackingItem', () => {
    it('FE-PACKING-004: deletePackingItem optimistically removes item, rollback on failure', async () => {
      const item = buildPackingItem({ id: 10, trip_id: 1 });
      seedStore(useTripStore, { packingItems: [item] });

      server.use(
        http.delete('/api/trips/1/packing/10', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 })
        ),
      );

      await expect(useTripStore.getState().deletePackingItem(1, 10)).rejects.toThrow();

      expect(useTripStore.getState().packingItems).toHaveLength(1);
      expect(useTripStore.getState().packingItems[0].id).toBe(10);
    });

    it('FE-PACKING-004b: deletePackingItem success removes item', async () => {
      const item1 = buildPackingItem({ id: 10, trip_id: 1 });
      const item2 = buildPackingItem({ id: 20, trip_id: 1 });
      seedStore(useTripStore, { packingItems: [item1, item2] });

      await useTripStore.getState().deletePackingItem(1, 10);

      const items = useTripStore.getState().packingItems;
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(20);
    });
  });

  describe('togglePackingItem', () => {
    it('FE-PACKING-005: togglePackingItem sets checked optimistically', async () => {
      const item = buildPackingItem({ id: 10, trip_id: 1, checked: 0 });
      seedStore(useTripStore, { packingItems: [item] });

      server.use(
        http.put('/api/trips/1/packing/10', async ({ request }) => {
          const body = await request.json() as Record<string, unknown>;
          return HttpResponse.json({ item: { ...item, ...body } });
        }),
      );

      await useTripStore.getState().togglePackingItem(1, 10, true);

      expect(useTripStore.getState().packingItems[0].checked).toBe(1);
    });

    it('FE-PACKING-006: togglePackingItem rolls back checked on API failure', async () => {
      const item = buildPackingItem({ id: 10, trip_id: 1, checked: 0 });
      seedStore(useTripStore, { packingItems: [item] });

      server.use(
        http.put('/api/trips/1/packing/10', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 })
        ),
      );

      // toggle does NOT throw on error (silent rollback)
      await useTripStore.getState().togglePackingItem(1, 10, true);

      // Should be rolled back to original value
      expect(useTripStore.getState().packingItems[0].checked).toBe(0);
    });
  });
});
