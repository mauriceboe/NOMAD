import { http, HttpResponse } from 'msw';
import { buildTrip, buildDay, buildPlace } from '../../factories';

export const sharedHandlers = [
  http.get('/api/shared/:token', ({ params }) => {
    const { token } = params;

    if (token === 'invalid-token' || token === 'expired-token') {
      return new HttpResponse(null, { status: 404 });
    }

    const trip = { ...buildTrip({ start_date: '2026-07-01', end_date: '2026-07-05' }), title: 'Shared Paris Trip' };
    const day1 = buildDay({ trip_id: trip.id, date: '2026-07-01' });
    const place1 = buildPlace({ trip_id: trip.id, name: 'Eiffel Tower', lat: 48.8584, lng: 2.2945 });

    return HttpResponse.json({
      trip,
      days: [day1],
      assignments: {},
      dayNotes: {},
      places: [place1],
      reservations: [],
      accommodations: [],
      packing: [],
      budget: [],
      categories: [],
      permissions: {
        share_bookings: true,
        share_packing: false,
        share_budget: false,
        share_collab: false,
      },
      collab: [],
    });
  }),
];
