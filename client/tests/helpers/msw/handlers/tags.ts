import { http, HttpResponse } from 'msw';
import { buildTag, buildCategory } from '../../factories';

export const tagsHandlers = [
  http.get('/api/tags', () => {
    return HttpResponse.json({ tags: [buildTag(), buildTag()] });
  }),

  http.post('/api/tags', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const tag = buildTag(body);
    return HttpResponse.json({ tag });
  }),

  http.get('/api/categories', () => {
    return HttpResponse.json({ categories: [buildCategory(), buildCategory()] });
  }),

  http.post('/api/categories', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const category = buildCategory(body);
    return HttpResponse.json({ category });
  }),
];
