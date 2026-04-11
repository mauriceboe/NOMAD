import { http, HttpResponse } from 'msw';
import { buildDayNote } from '../../factories';

export const dayNotesHandlers = [
  http.get('/api/trips/:id/days/:dayId/notes', ({ params }) => {
    return HttpResponse.json({
      notes: [buildDayNote({ day_id: Number(params.dayId) })],
    });
  }),

  http.post('/api/trips/:id/days/:dayId/notes', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const note = buildDayNote({ day_id: Number(params.dayId), ...body });
    return HttpResponse.json({ note });
  }),

  http.put('/api/trips/:id/days/:dayId/notes/:noteId', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const note = buildDayNote({ id: Number(params.noteId), day_id: Number(params.dayId), ...body });
    return HttpResponse.json({ note });
  }),

  http.delete('/api/trips/:id/days/:dayId/notes/:noteId', () => {
    return HttpResponse.json({ success: true });
  }),

  http.put('/api/trips/:id/days/:dayId', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ day: { id: Number(params.dayId), trip_id: Number(params.id), ...body } });
  }),
];
