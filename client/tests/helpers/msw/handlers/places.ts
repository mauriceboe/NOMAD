import { http, HttpResponse } from 'msw';
import { buildPlace } from '../../factories';

export const placesHandlers = [
  http.get('/api/trips/:id/places', ({ params }) => {
    const tripId = Number(params.id);
    return HttpResponse.json({ places: [buildPlace({ trip_id: tripId }), buildPlace({ trip_id: tripId })] });
  }),

  http.post('/api/trips/:id/places', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const place = buildPlace({ trip_id: Number(params.id), ...body });
    return HttpResponse.json({ place });
  }),

  http.put('/api/trips/:id/places/:placeId', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const place = buildPlace({ id: Number(params.placeId), trip_id: Number(params.id), ...body });
    return HttpResponse.json({ place });
  }),

  http.delete('/api/trips/:id/places/:placeId', () => {
    return HttpResponse.json({ success: true });
  }),
];
