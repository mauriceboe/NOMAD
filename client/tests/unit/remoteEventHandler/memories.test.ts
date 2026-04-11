import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useTripStore } from '../../../src/store/tripStore';
import { resetAllStores } from '../../helpers/store';
import { buildPlace } from '../../helpers/factories';

beforeEach(() => {
  resetAllStores();
});

describe('remoteEventHandler > memories', () => {
  it('FE-WSEVT-MEM-001: memories:updated dispatches CustomEvent on window', () => {
    const received: Event[] = [];
    const handler = (e: Event) => received.push(e);
    window.addEventListener('memories:updated', handler);
    useTripStore.getState().handleRemoteEvent({ type: 'memories:updated', photos: [] });
    window.removeEventListener('memories:updated', handler);
    expect(received).toHaveLength(1);
  });

  it('FE-WSEVT-MEM-002: memories:updated event type is correct', () => {
    const received: Event[] = [];
    const handler = (e: Event) => received.push(e);
    window.addEventListener('memories:updated', handler);
    useTripStore.getState().handleRemoteEvent({ type: 'memories:updated', photos: [] });
    window.removeEventListener('memories:updated', handler);
    expect(received[0].type).toBe('memories:updated');
  });

  it('FE-WSEVT-MEM-003: memories:updated event detail contains the payload', () => {
    const received: CustomEvent[] = [];
    const handler = (e: Event) => received.push(e as CustomEvent);
    window.addEventListener('memories:updated', handler);
    const payload = { photos: [{ id: 1, url: '/photo.jpg' }] };
    useTripStore.getState().handleRemoteEvent({ type: 'memories:updated', ...payload });
    window.removeEventListener('memories:updated', handler);
    expect(received[0].detail).toMatchObject(payload);
  });

  it('FE-WSEVT-MEM-004: memories:updated does not modify store state', () => {
    const places = [buildPlace({ id: 42, name: 'Eiffel Tower' })];
    useTripStore.setState({ places });
    useTripStore.getState().handleRemoteEvent({ type: 'memories:updated', photos: [] });
    const { places: afterPlaces } = useTripStore.getState();
    expect(afterPlaces).toHaveLength(1);
    expect(afterPlaces[0].id).toBe(42);
  });

  it('FE-WSEVT-MEM-005: memories:updated fires exactly once per event', () => {
    const received: Event[] = [];
    const handler = (e: Event) => received.push(e);
    window.addEventListener('memories:updated', handler);
    useTripStore.getState().handleRemoteEvent({ type: 'memories:updated', photos: [] });
    useTripStore.getState().handleRemoteEvent({ type: 'memories:updated', photos: [] });
    window.removeEventListener('memories:updated', handler);
    expect(received).toHaveLength(2);
  });
});
