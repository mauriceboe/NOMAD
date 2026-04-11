import { describe, it, expect, beforeEach } from 'vitest';
import { useTripStore } from '../../../src/store/tripStore';
import { resetAllStores } from '../../helpers/store';
import { buildPackingItem } from '../../helpers/factories';

beforeEach(() => {
  resetAllStores();
});

describe('remoteEventHandler > packing', () => {
  const seedData = () => {
    useTripStore.setState({
      packingItems: [buildPackingItem({ id: 1, name: 'Sunscreen' })],
    });
  };

  it('FE-WSEVT-PACK-001: packing:created adds item to packingItems', () => {
    seedData();
    const newItem = buildPackingItem({ id: 99, name: 'Hat' });
    useTripStore.getState().handleRemoteEvent({ type: 'packing:created', item: newItem });
    const { packingItems } = useTripStore.getState();
    expect(packingItems).toHaveLength(2);
    expect(packingItems.find(i => i.id === 99)).toBeDefined();
  });

  it('FE-WSEVT-PACK-002: packing:created is idempotent — no duplicate if same ID', () => {
    seedData();
    const duplicate = buildPackingItem({ id: 1, name: 'Sunscreen Duplicate' });
    useTripStore.getState().handleRemoteEvent({ type: 'packing:created', item: duplicate });
    const { packingItems } = useTripStore.getState();
    expect(packingItems).toHaveLength(1);
    expect(packingItems[0].name).toBe('Sunscreen');
  });

  it('FE-WSEVT-PACK-003: packing:updated replaces item in array', () => {
    seedData();
    const updated = buildPackingItem({ id: 1, name: 'SPF 50 Sunscreen' });
    useTripStore.getState().handleRemoteEvent({ type: 'packing:updated', item: updated });
    const { packingItems } = useTripStore.getState();
    expect(packingItems[0].name).toBe('SPF 50 Sunscreen');
  });

  it('FE-WSEVT-PACK-004: packing:deleted removes item by ID', () => {
    seedData();
    useTripStore.getState().handleRemoteEvent({ type: 'packing:deleted', itemId: 1 });
    const { packingItems } = useTripStore.getState();
    expect(packingItems).toHaveLength(0);
  });
});
