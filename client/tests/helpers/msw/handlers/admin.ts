import { http, HttpResponse } from 'msw';
import { buildUser, buildAdmin } from '../../factories';

export const adminHandlers = [
  http.get('/api/admin/users', () => {
    const user1 = buildUser({ username: 'alice', email: 'alice@example.com' });
    const admin1 = buildAdmin({ username: 'admin', email: 'admin@example.com' });
    return HttpResponse.json({ users: [admin1, user1] });
  }),

  http.post('/api/admin/users', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const user = buildUser({ ...body });
    return HttpResponse.json({ user });
  }),

  http.put('/api/admin/users/:id', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const user = buildUser({ id: Number(params.id), ...body });
    return HttpResponse.json({ user });
  }),

  http.delete('/api/admin/users/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  http.get('/api/admin/stats', () => {
    return HttpResponse.json({
      totalUsers: 2,
      totalTrips: 5,
      totalPlaces: 42,
      totalFiles: 8,
    });
  }),

  http.get('/api/admin/invites', () => {
    return HttpResponse.json({ invites: [] });
  }),

  http.post('/api/admin/invites', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ invite: { id: 1, token: 'test-invite-token', ...body } });
  }),

  http.delete('/api/admin/invites/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  http.get('/api/admin/oidc', () => {
    return HttpResponse.json({
      issuer: '',
      client_id: '',
      client_secret: '',
      client_secret_set: false,
      display_name: '',
      oidc_only: false,
      discovery_url: '',
    });
  }),

  http.put('/api/admin/oidc', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...body });
  }),

  http.get('/api/admin/version-check', () => {
    return HttpResponse.json({ update_available: false, latest: '1.0.0', current: '1.0.0' });
  }),

  http.get('/api/admin/bag-tracking', () => {
    return HttpResponse.json({ enabled: false });
  }),

  http.put('/api/admin/bag-tracking', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ enabled: body.enabled });
  }),

  http.get('/api/admin/addons', () => {
    return HttpResponse.json({ addons: [] });
  }),

  http.get('/api/admin/packing-templates', () => {
    return HttpResponse.json({ templates: [] });
  }),

  http.get('/api/admin/audit-log', () => {
    return HttpResponse.json({ logs: [], total: 0 });
  }),

  http.get('/api/admin/mcp-tokens', () => {
    return HttpResponse.json({ tokens: [] });
  }),

  http.get('/api/admin/permissions', () => {
    return HttpResponse.json({ permissions: {} });
  }),

  http.get('/api/admin/notification-preferences', () => {
    return HttpResponse.json({
      event_types: [],
      available_channels: {},
      implemented_combos: {},
      preferences: {},
    });
  }),

  // Auth settings endpoints used by AdminPage
  http.get('/api/auth/app-settings', () => {
    return HttpResponse.json({});
  }),

  http.put('/api/auth/app-settings', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...body });
  }),

  http.get('/api/auth/me/settings', () => {
    return HttpResponse.json({ settings: { maps_api_key: '', openweather_api_key: '' } });
  }),

  http.get('/api/auth/validate-keys', () => {
    return HttpResponse.json({ maps: true, weather: true });
  }),
];
