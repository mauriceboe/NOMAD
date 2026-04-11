import { http, HttpResponse } from 'msw';
import { buildTrip, buildDay, buildUser } from '../../factories';

export const tripsHandlers = [
  // List all trips (active or archived)
  http.get('/api/trips', ({ request }) => {
    const url = new URL(request.url);
    const archived = url.searchParams.get('archived');
    if (archived) {
      return HttpResponse.json({ trips: [] });
    }
    const trip1 = buildTrip({ title: 'Paris Adventure', start_date: '2026-07-01', end_date: '2026-07-10' });
    const trip2 = buildTrip({ title: 'Tokyo Trip', start_date: '2026-09-01', end_date: '2026-09-15' });
    return HttpResponse.json({ trips: [trip1, trip2] });
  }),

  http.get('/api/trips/:id', ({ params }) => {
    const trip = buildTrip({ id: Number(params.id) });
    return HttpResponse.json({ trip });
  }),

  http.get('/api/trips/:id/days', ({ params }) => {
    const tripId = Number(params.id);
    const day1 = buildDay({ trip_id: tripId, assignments: [], notes_items: [] });
    const day2 = buildDay({ trip_id: tripId, assignments: [], notes_items: [] });
    return HttpResponse.json({ days: [day1, day2] });
  }),

  http.put('/api/trips/:id', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const trip = buildTrip({ id: Number(params.id), ...body });
    return HttpResponse.json({ trip });
  }),

  http.post('/api/trips', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const trip = buildTrip({ ...body });
    return HttpResponse.json({ trip });
  }),

  http.get('/api/trips/:id/members', ({ params }) => {
    const owner = buildUser();
    return HttpResponse.json({ owner, members: [] });
  }),

  http.get('/api/trips/:id/accommodations', () => {
    return HttpResponse.json({ accommodations: [] });
  }),

  http.delete('/api/trips/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  http.post('/api/trips/:id/copy', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const trip = buildTrip({ id: Number(params.id) + 1000, ...body });
    return HttpResponse.json({ trip });
  }),
];
