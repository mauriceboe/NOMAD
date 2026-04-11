import { http, HttpResponse } from 'msw';

export const notificationHandlers = [
  http.get('/api/notifications/in-app', ({ request }) => {
    const url = new URL(request.url);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    const allNotifications = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      type: 'simple',
      scope: 'trip',
      target: 1,
      sender_id: 2,
      sender_username: 'alice',
      sender_avatar: null,
      recipient_id: 1,
      title_key: 'notif.title',
      title_params: '{}',
      text_key: 'notif.text',
      text_params: '{}',
      positive_text_key: null,
      negative_text_key: null,
      response: null,
      navigate_text_key: null,
      navigate_target: null,
      is_read: i < 5 ? 0 : 1,
      created_at: '2025-01-01T00:00:00.000Z',
    }));

    const page = allNotifications.slice(offset, offset + limit);

    return HttpResponse.json({
      notifications: page,
      total: allNotifications.length,
      unread_count: 5,
    });
  }),

  http.get('/api/notifications/in-app/unread-count', () => {
    return HttpResponse.json({ count: 5 });
  }),

  http.put('/api/notifications/in-app/:id/read', () => {
    return HttpResponse.json({ success: true });
  }),

  http.put('/api/notifications/in-app/:id/unread', () => {
    return HttpResponse.json({ success: true });
  }),

  http.put('/api/notifications/in-app/read-all', () => {
    return HttpResponse.json({ success: true });
  }),

  http.delete('/api/notifications/in-app/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  http.delete('/api/notifications/in-app/all', () => {
    return HttpResponse.json({ success: true });
  }),

  http.post('/api/notifications/in-app/:id/respond', async ({ request, params }) => {
    const body = await request.json() as { response: string };
    return HttpResponse.json({
      notification: {
        id: Number(params.id),
        type: 'boolean',
        scope: 'trip',
        target: 1,
        sender_id: 2,
        sender_username: 'alice',
        sender_avatar: null,
        recipient_id: 1,
        title_key: 'notif.title',
        title_params: '{}',
        text_key: 'notif.text',
        text_params: '{}',
        positive_text_key: 'accept',
        negative_text_key: 'decline',
        response: body.response,
        navigate_text_key: null,
        navigate_target: null,
        is_read: 1,
        created_at: '2025-01-01T00:00:00.000Z',
      },
    });
  }),
];
