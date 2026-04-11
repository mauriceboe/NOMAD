import { describe, it, expect, beforeEach } from 'vitest';
import { useTripStore } from '../../../src/store/tripStore';
import { resetAllStores } from '../../helpers/store';
import { buildTrip, buildPlace } from '../../helpers/factories';

beforeEach(() => {
  resetAllStores();
});

describe('remoteEventHandler > trip', () => {
  it('FE-WSEVT-TRIP-001: trip:updated replaces trip in state', () => {
    const originalTrip = buildTrip({ id: 1, name: 'Paris Trip' });
    useTripStore.setState({ trip: originalTrip });
    const updatedTrip = buildTrip({ id: 1, name: 'Paris & Lyon Trip' });
    useTripStore.getState().handleRemoteEvent({ type: 'trip:updated', trip: updatedTrip });
    const { trip } = useTripStore.getState();
    expect(trip?.name).toBe('Paris & Lyon Trip');
  });

  it('FE-WSEVT-TRIP-002: trip:updated does not affect other state fields', () => {
    const existingPlace = buildPlace({ id: 55, name: 'Eiffel Tower' });
    useTripStore.setState({
      trip: buildTrip({ id: 1, name: 'Original' }),
      places: [existingPlace],
    });
    const updatedTrip = buildTrip({ id: 1, name: 'Updated' });
    useTripStore.getState().handleRemoteEvent({ type: 'trip:updated', trip: updatedTrip });
    const { places } = useTripStore.getState();
    expect(places).toHaveLength(1);
    expect(places[0].id).toBe(55);
  });
});
