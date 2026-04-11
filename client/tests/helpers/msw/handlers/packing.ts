import { http, HttpResponse } from 'msw';
import { buildPackingItem } from '../../factories';

export const packingHandlers = [
  http.get('/api/trips/:id/packing', ({ params }) => {
    return HttpResponse.json({
      items: [buildPackingItem({ trip_id: Number(params.id) })],
    });
  }),

  http.post('/api/trips/:id/packing', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const item = buildPackingItem({ trip_id: Number(params.id), ...body });
    return HttpResponse.json({ item });
  }),

  http.put('/api/trips/:id/packing/:itemId', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const item = buildPackingItem({ id: Number(params.itemId), trip_id: Number(params.id), ...body });
    return HttpResponse.json({ item });
  }),

  http.delete('/api/trips/:id/packing/:itemId', () => {
    return HttpResponse.json({ success: true });
  }),
];
