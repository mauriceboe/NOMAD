import { http, HttpResponse } from 'msw';
import { buildReservation } from '../../factories';

export const reservationsHandlers = [
  http.get('/api/trips/:id/reservations', ({ params }) => {
    return HttpResponse.json({
      reservations: [buildReservation({ trip_id: Number(params.id) })],
    });
  }),

  http.post('/api/trips/:id/reservations', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const reservation = buildReservation({ trip_id: Number(params.id), ...body });
    return HttpResponse.json({ reservation });
  }),

  http.put('/api/trips/:id/reservations/:reservationId', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const reservation = buildReservation({
      id: Number(params.reservationId),
      trip_id: Number(params.id),
      ...body,
    });
    return HttpResponse.json({ reservation });
  }),

  http.delete('/api/trips/:id/reservations/:reservationId', () => {
    return HttpResponse.json({ success: true });
  }),
];
