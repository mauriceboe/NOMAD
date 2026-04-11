import { http, HttpResponse } from 'msw';
import { buildBudgetItem } from '../../factories';

export const budgetHandlers = [
  http.get('/api/trips/:id/budget', ({ params }) => {
    return HttpResponse.json({
      items: [buildBudgetItem({ trip_id: Number(params.id) })],
    });
  }),

  http.post('/api/trips/:id/budget', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const item = buildBudgetItem({ trip_id: Number(params.id), ...body });
    return HttpResponse.json({ item });
  }),

  http.put('/api/trips/:id/budget/:itemId', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const item = buildBudgetItem({ id: Number(params.itemId), trip_id: Number(params.id), ...body });
    return HttpResponse.json({ item });
  }),

  http.delete('/api/trips/:id/budget/:itemId', () => {
    return HttpResponse.json({ success: true });
  }),

  http.put('/api/trips/:id/budget/:itemId/members', async ({ params, request }) => {
    const body = await request.json() as { user_ids: number[] };
    const members = body.user_ids.map(uid => ({ user_id: uid, paid: false }));
    const item = buildBudgetItem({ id: Number(params.itemId), trip_id: Number(params.id), persons: body.user_ids.length, members });
    return HttpResponse.json({ members, item });
  }),

  http.put('/api/trips/:id/budget/:itemId/members/:userId/paid', async ({ params, request }) => {
    const body = await request.json() as { paid: boolean };
    return HttpResponse.json({ success: true, paid: body.paid });
  }),
];
