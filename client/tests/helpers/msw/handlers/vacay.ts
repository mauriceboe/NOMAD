import { http, HttpResponse } from 'msw';

export const vacayHandlers = [
  http.get('/api/addons/vacay/plan', () => {
    return HttpResponse.json({
      plan: {
        id: 1,
        holidays_enabled: false,
        holidays_region: null,
        holiday_calendars: [],
        block_weekends: true,
        carry_over_enabled: false,
        company_holidays_enabled: false,
      },
      users: [{ id: 1, username: 'user1', color: '#3b82f6' }],
      pendingInvites: [],
      incomingInvites: [],
      isOwner: true,
      isFused: false,
    });
  }),

  http.put('/api/addons/vacay/plan', () => {
    return HttpResponse.json({
      plan: {
        id: 1,
        holidays_enabled: true,
        holidays_region: null,
        holiday_calendars: [],
        block_weekends: true,
        carry_over_enabled: false,
        company_holidays_enabled: false,
      },
    });
  }),

  http.get('/api/addons/vacay/years', () => {
    return HttpResponse.json({ years: [2025, 2026] });
  }),

  http.post('/api/addons/vacay/years', () => {
    return HttpResponse.json({ years: [2025, 2026, 2027] });
  }),

  http.delete('/api/addons/vacay/years/:year', () => {
    return HttpResponse.json({ years: [2025] });
  }),

  http.get('/api/addons/vacay/entries/:year', () => {
    return HttpResponse.json({
      entries: [
        { date: '2025-06-15', user_id: 1 },
        { date: '2025-06-16', user_id: 1 },
      ],
      companyHolidays: [],
    });
  }),

  http.post('/api/addons/vacay/entries/toggle', () => {
    return HttpResponse.json({ success: true });
  }),

  http.post('/api/addons/vacay/entries/company-holiday', () => {
    return HttpResponse.json({ success: true });
  }),

  http.get('/api/addons/vacay/stats/:year', () => {
    return HttpResponse.json({
      stats: [{ user_id: 1, vacation_days: 30, used: 2 }],
    });
  }),

  http.put('/api/addons/vacay/stats/:year', () => {
    return HttpResponse.json({ success: true });
  }),

  http.get('/api/addons/vacay/holidays/countries', () => {
    return HttpResponse.json({ countries: ['DE', 'US', 'FR'] });
  }),

  http.get('/api/addons/vacay/holidays/:year/:country', () => {
    return HttpResponse.json([
      { date: '2025-12-25', name: 'Christmas', localName: 'Weihnachten', global: true, counties: null },
      { date: '2025-01-01', name: 'New Year', localName: 'Neujahr', global: true, counties: null },
    ]);
  }),

  http.put('/api/addons/vacay/color', () => {
    return HttpResponse.json({ success: true });
  }),

  http.post('/api/addons/vacay/invite', () => {
    return HttpResponse.json({ success: true });
  }),

  http.post('/api/addons/vacay/invite/accept', () => {
    return HttpResponse.json({ success: true });
  }),

  http.post('/api/addons/vacay/invite/decline', () => {
    return HttpResponse.json({ success: true });
  }),

  http.post('/api/addons/vacay/invite/cancel', () => {
    return HttpResponse.json({ success: true });
  }),

  http.post('/api/addons/vacay/dissolve', () => {
    return HttpResponse.json({ success: true });
  }),

  http.post('/api/addons/vacay/plan/holiday-calendars', () => {
    return HttpResponse.json({
      calendar: { id: 1, plan_id: 1, region: 'DE', label: null, color: '#ef4444', sort_order: 0 },
    });
  }),

  http.put('/api/addons/vacay/plan/holiday-calendars/:id', () => {
    return HttpResponse.json({
      calendar: { id: 1, plan_id: 1, region: 'US', label: 'US Holidays', color: '#3b82f6', sort_order: 0 },
    });
  }),

  http.delete('/api/addons/vacay/plan/holiday-calendars/:id', () => {
    return HttpResponse.json({ success: true });
  }),
];
