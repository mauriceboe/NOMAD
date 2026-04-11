import { http, HttpResponse } from 'msw';

export const addonHandlers = [
  http.get('/api/addons', () => {
    return HttpResponse.json({
      addons: [
        { id: 'vacay', name: 'Vacay', type: 'feature', icon: 'calendar', enabled: true },
        { id: 'atlas', name: 'Atlas', type: 'feature', icon: 'map', enabled: true },
      ],
    });
  }),
];
