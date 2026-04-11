import { http, HttpResponse } from 'msw';
import { buildTodoItem } from '../../factories';

export const todoHandlers = [
  http.get('/api/trips/:id/todo', ({ params }) => {
    return HttpResponse.json({
      items: [buildTodoItem({ trip_id: Number(params.id) })],
    });
  }),

  http.post('/api/trips/:id/todo', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const item = buildTodoItem({ trip_id: Number(params.id), ...body });
    return HttpResponse.json({ item });
  }),

  http.put('/api/trips/:id/todo/:itemId', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const item = buildTodoItem({ id: Number(params.itemId), trip_id: Number(params.id), ...body });
    return HttpResponse.json({ item });
  }),

  http.delete('/api/trips/:id/todo/:itemId', () => {
    return HttpResponse.json({ success: true });
  }),
];
