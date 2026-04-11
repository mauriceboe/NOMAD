import { http, HttpResponse } from 'msw';
import { buildAssignment, buildPlace } from '../../factories';

export const assignmentsHandlers = [
  http.post('/api/trips/:id/days/:dayId/assignments', async ({ params, request }) => {
    const body = await request.json() as { place_id: number };
    const place = buildPlace({ id: body.place_id, trip_id: Number(params.id) });
    const assignment = buildAssignment({
      day_id: Number(params.dayId),
      place_id: body.place_id,
      place,
      order_index: 0,
    });
    return HttpResponse.json({ assignment });
  }),

  http.delete('/api/trips/:id/days/:dayId/assignments/:assignmentId', () => {
    return HttpResponse.json({ success: true });
  }),

  http.put('/api/trips/:id/days/:dayId/assignments/reorder', () => {
    return HttpResponse.json({ success: true });
  }),

  http.put('/api/trips/:id/assignments/:assignmentId/move', () => {
    return HttpResponse.json({ success: true });
  }),
];
