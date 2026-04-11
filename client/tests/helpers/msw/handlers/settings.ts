import { http, HttpResponse } from 'msw';
import { buildSettings } from '../../factories';

export const settingsHandlers = [
  http.get('/api/settings', () => {
    return HttpResponse.json({ settings: buildSettings() });
  }),

  http.put('/api/settings', () => {
    return HttpResponse.json({ success: true });
  }),

  http.post('/api/settings/bulk', () => {
    return HttpResponse.json({ success: true });
  }),
];
