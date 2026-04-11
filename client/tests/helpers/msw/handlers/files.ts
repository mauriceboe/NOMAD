import { http, HttpResponse } from 'msw';
import { buildTripFile } from '../../factories';

export const filesHandlers = [
  http.get('/api/trips/:id/files', ({ params }) => {
    return HttpResponse.json({
      files: [buildTripFile({ trip_id: Number(params.id) })],
    });
  }),

  http.post('/api/trips/:id/files', ({ params }) => {
    const file = buildTripFile({ trip_id: Number(params.id) });
    return HttpResponse.json({ file });
  }),

  http.delete('/api/trips/:id/files/:fileId', () => {
    return HttpResponse.json({ success: true });
  }),
];
