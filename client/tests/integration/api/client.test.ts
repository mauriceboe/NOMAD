import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../helpers/msw/server';
import { buildUser } from '../../helpers/factories';

// The global setup.ts mocks websocket with getSocketId returning null.
// We need to be able to control what getSocketId returns per-test.
// Re-mock here to get full control.
vi.mock('../../../src/api/websocket', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  getSocketId: vi.fn(() => 'mock-socket-id'),
  setRefetchCallback: vi.fn(),
  joinTrip: vi.fn(),
  leaveTrip: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
}));

const wsMock = await import('../../../src/api/websocket');

// Import the API client AFTER the mock is set up so it picks up our getSocketId mock
const {
  authApi,
  tripsApi,
  placesApi,
  packingApi,
  inAppNotificationsApi,
  shareApi,
  backupApi,
  daysApi,
  assignmentsApi,
  tagsApi,
  categoriesApi,
  adminApi,
  addonsApi,
  mapsApi,
  budgetApi,
  filesApi,
  reservationsApi,
  weatherApi,
  settingsApi,
  accommodationsApi,
  dayNotesApi,
  collabApi,
  notificationsApi,
} = await import('../../../src/api/client');

describe('API client interceptors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: socket ID available
    (wsMock.getSocketId as ReturnType<typeof vi.fn>).mockReturnValue('mock-socket-id');
  });

  afterEach(() => {
    // Reset window.location to a neutral path
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'http://localhost/', pathname: '/', search: '', hash: '' },
    });
  });

  it('FE-API-001: requests include X-Socket-Id header when getSocketId returns a value', async () => {
    let receivedSocketId: string | null = null;

    server.use(
      http.get('/api/auth/me', ({ request }) => {
        receivedSocketId = request.headers.get('X-Socket-Id');
        return HttpResponse.json({ user: buildUser() });
      })
    );

    await authApi.me();

    expect(receivedSocketId).toBe('mock-socket-id');
  });

  it('FE-API-002: X-Socket-Id header is absent when getSocketId returns null', async () => {
    (wsMock.getSocketId as ReturnType<typeof vi.fn>).mockReturnValue(null);
    let receivedSocketId: string | null = 'sentinel';

    server.use(
      http.get('/api/auth/me', ({ request }) => {
        receivedSocketId = request.headers.get('X-Socket-Id');
        return HttpResponse.json({ user: buildUser() });
      })
    );

    await authApi.me();

    expect(receivedSocketId).toBeNull();
  });

  it('FE-API-003: 401 with AUTH_REQUIRED → redirects to /login with redirect param', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'http://localhost/', pathname: '/dashboard', search: '', hash: '' },
    });

    server.use(
      http.get('/api/auth/me', () => {
        return HttpResponse.json({ code: 'AUTH_REQUIRED' }, { status: 401 });
      })
    );

    try {
      await authApi.me();
    } catch {
      // Expected to reject
    }

    expect(window.location.href).toBe('/login?redirect=%2Fdashboard');
  });

  it('FE-API-003b: 401 without AUTH_REQUIRED code does not redirect', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'http://localhost/dashboard', pathname: '/dashboard', search: '' },
    });

    const originalHref = window.location.href;

    server.use(
      http.get('/api/auth/me', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      })
    );

    try {
      await authApi.me();
    } catch {
      // Expected to reject
    }

    expect(window.location.href).toBe(originalHref);
  });

  it('FE-API-003c: 401 on /login page does not redirect', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'http://localhost/login', pathname: '/login', search: '' },
    });

    server.use(
      http.get('/api/auth/me', () => {
        return HttpResponse.json({ code: 'AUTH_REQUIRED' }, { status: 401 });
      })
    );

    try {
      await authApi.me();
    } catch {
      // Expected to reject
    }

    // href should NOT have been changed to /login?redirect=...
    expect(window.location.href).toBe('http://localhost/login');
  });

  it('FE-API-004: 403 with MFA_REQUIRED → redirects to /settings?mfa=required', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'http://localhost/', pathname: '/dashboard', search: '' },
    });

    server.use(
      http.get('/api/auth/me', () => {
        return HttpResponse.json({ code: 'MFA_REQUIRED' }, { status: 403 });
      })
    );

    try {
      await authApi.me();
    } catch {
      // Expected to reject
    }

    expect(window.location.href).toBe('/settings?mfa=required');
  });

  it('FE-API-004b: 403 with MFA_REQUIRED on /settings page does not redirect', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'http://localhost/settings', pathname: '/settings', search: '' },
    });

    server.use(
      http.get('/api/auth/me', () => {
        return HttpResponse.json({ code: 'MFA_REQUIRED' }, { status: 403 });
      })
    );

    try {
      await authApi.me();
    } catch {
      // Expected to reject
    }

    // Should NOT redirect when already on /settings
    expect(window.location.href).toBe('http://localhost/settings');
  });

  it('FE-API-005: successful API call returns response data', async () => {
    const user = buildUser();

    server.use(
      http.get('/api/auth/me', () => {
        return HttpResponse.json({ user });
      })
    );

    const data = await authApi.me();

    expect(data).toMatchObject({ user: { id: user.id, email: user.email } });
  });

  it('FE-API-006: socket ID header reflects current value from getSocketId at request time', async () => {
    const headers: Array<string | null> = [];

    (wsMock.getSocketId as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce('socket-A')
      .mockReturnValueOnce('socket-B');

    server.use(
      http.get('/api/auth/me', ({ request }) => {
        headers.push(request.headers.get('X-Socket-Id'));
        return HttpResponse.json({ user: buildUser() });
      })
    );

    await authApi.me();
    await authApi.me();

    expect(headers[0]).toBe('socket-A');
    expect(headers[1]).toBe('socket-B');
  });

  it('FE-API-007: non-401/403 errors are passed through as rejections', async () => {
    server.use(
      http.get('/api/auth/me', () => {
        return HttpResponse.json({ error: 'Internal error' }, { status: 500 });
      })
    );

    await expect(authApi.me()).rejects.toThrow();
  });

  // ── 401 edge cases ───────────────────────────────────────────────────────────

  it('FE-API-008: 401 AUTH_REQUIRED on /register path does not redirect', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'http://localhost/register', pathname: '/register', search: '' },
    });

    server.use(
      http.get('/api/auth/me', () => {
        return HttpResponse.json({ code: 'AUTH_REQUIRED' }, { status: 401 });
      })
    );

    try { await authApi.me(); } catch { /* expected */ }

    expect(window.location.href).toBe('http://localhost/register');
  });

  it('FE-API-009: 401 AUTH_REQUIRED on /shared/:token path does not redirect', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'http://localhost/shared/abc123', pathname: '/shared/abc123', search: '' },
    });

    server.use(
      http.get('/api/auth/me', () => {
        return HttpResponse.json({ code: 'AUTH_REQUIRED' }, { status: 401 });
      })
    );

    try { await authApi.me(); } catch { /* expected */ }

    expect(window.location.href).toBe('http://localhost/shared/abc123');
  });

  it('FE-API-010: 401 AUTH_REQUIRED still rejects the promise even when redirect fires', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'http://localhost/dashboard', pathname: '/dashboard', search: '' },
    });

    server.use(
      http.get('/api/auth/me', () => {
        return HttpResponse.json({ code: 'AUTH_REQUIRED' }, { status: 401 });
      })
    );

    await expect(authApi.me()).rejects.toThrow();
  });

  // ── 403 edge cases ───────────────────────────────────────────────────────────

  it('FE-API-011: 403 without MFA_REQUIRED code does not redirect', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'http://localhost/dashboard', pathname: '/dashboard', search: '' },
    });

    server.use(
      http.get('/api/auth/me', () => {
        return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
      })
    );

    try { await authApi.me(); } catch { /* expected */ }

    expect(window.location.href).toBe('http://localhost/dashboard');
  });

  it('FE-API-012: 403 MFA_REQUIRED still rejects the promise after redirect fires', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'http://localhost/dashboard', pathname: '/dashboard', search: '' },
    });

    server.use(
      http.get('/api/auth/me', () => {
        return HttpResponse.json({ code: 'MFA_REQUIRED' }, { status: 403 });
      })
    );

    await expect(authApi.me()).rejects.toThrow();
  });

  // ── backupApi.download ───────────────────────────────────────────────────────

  it('FE-API-013: backupApi.download creates a temp anchor and clicks it', async () => {
    // backupApi.download uses native fetch (not axios). Mock fetch directly and
    // use a plain-object Response duck-type to avoid MSW patching the Response
    // constructor (which calls blob.stream() — not implemented in jsdom's Blob).
    const blob = new Blob(['zip-bytes'], { type: 'application/zip' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(blob),
    } as unknown as Response);
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    // Spy on createElement to intercept the anchor click
    const originalCreate = document.createElement.bind(document);
    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { writable: true, value: clickSpy });
      }
      return el;
    });

    await expect(backupApi.download('backup.zip')).resolves.toBeUndefined();
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('FE-API-014: backupApi.download throws when response is not ok', async () => {
    server.use(
      http.get('/api/backup/download/missing.zip', () => {
        return new HttpResponse(null, { status: 404 });
      })
    );

    await expect(backupApi.download('missing.zip')).rejects.toThrow('Download failed');
  });

  // ── API namespace URL spot-checks ────────────────────────────────────────────

  it('FE-API-015: tripsApi.list() makes GET to /api/trips', async () => {
    server.use(
      http.get('/api/trips', () => HttpResponse.json([]))
    );

    const result = await tripsApi.list();
    expect(result).toEqual([]);
  });

  it('FE-API-016: tripsApi.get(42) makes GET to /api/trips/42', async () => {
    let hitUrl = '';
    server.use(
      http.get('/api/trips/42', ({ request }) => {
        hitUrl = new URL(request.url).pathname;
        return HttpResponse.json({ id: 42 });
      })
    );

    await tripsApi.get(42);
    expect(hitUrl).toBe('/api/trips/42');
  });

  it('FE-API-017: placesApi.create posts to /api/trips/1/places and returns data directly', async () => {
    const place = { id: 1, name: 'Paris', trip_id: 1 };
    server.use(
      http.post('/api/trips/1/places', () => HttpResponse.json(place))
    );

    const result = await placesApi.create(1, { name: 'Paris' });
    expect(result).toMatchObject({ name: 'Paris' });
  });

  it('FE-API-018: packingApi.bulkImport posts correct payload', async () => {
    let receivedBody: unknown;
    server.use(
      http.post('/api/trips/1/packing/import', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ imported: 1 });
      })
    );

    await packingApi.bulkImport(1, [{ name: 'Sunscreen' }]);
    expect(receivedBody).toMatchObject({ items: [{ name: 'Sunscreen' }] });
  });

  it('FE-API-019: inAppNotificationsApi.list passes unread_only query param', async () => {
    let searchParams: URLSearchParams | null = null;
    server.use(
      http.get('/api/notifications/in-app', ({ request }) => {
        searchParams = new URL(request.url).searchParams;
        return HttpResponse.json([]);
      })
    );

    await inAppNotificationsApi.list({ unread_only: true });
    expect(searchParams?.get('unread_only')).toBe('true');
  });

  it('FE-API-020: shareApi.getSharedTrip hits /api/shared/tok123', async () => {
    let hitPath = '';
    server.use(
      http.get('/api/shared/tok123', ({ request }) => {
        hitPath = new URL(request.url).pathname;
        return HttpResponse.json({ token: 'tok123' });
      })
    );

    const result = await shareApi.getSharedTrip('tok123');
    expect(hitPath).toBe('/api/shared/tok123');
    expect(result).toMatchObject({ token: 'tok123' });
  });

  // ── authApi method spot-checks ───────────────────────────────────────────────

  it('FE-API-021: authApi.login posts email and password to /api/auth/login', async () => {
    const user = buildUser();
    let receivedBody: unknown;
    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ user });
      })
    );

    const result = await authApi.login({ email: 'a@b.com', password: 'pass' });
    expect(receivedBody).toMatchObject({ email: 'a@b.com', password: 'pass' });
    expect(result).toMatchObject({ user: { id: user.id } });
  });

  it('FE-API-022: authApi.uploadAvatar sends multipart/form-data', async () => {
    let contentType = '';
    server.use(
      http.post('/api/auth/avatar', ({ request }) => {
        contentType = request.headers.get('Content-Type') ?? '';
        return HttpResponse.json({ avatar_url: '/uploads/avatar.jpg' });
      })
    );

    const formData = new FormData();
    formData.append('avatar', new Blob(['img'], { type: 'image/jpeg' }), 'avatar.jpg');

    await authApi.uploadAvatar(formData);
    expect(contentType).toMatch(/multipart\/form-data/);
  });

  it('FE-API-023: authApi.mcpTokens.create posts name to /api/auth/mcp-tokens', async () => {
    let receivedBody: unknown;
    server.use(
      http.post('/api/auth/mcp-tokens', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ id: 1, name: 'My Token', token: 'tok' });
      })
    );

    await authApi.mcpTokens.create('My Token');
    expect(receivedBody).toMatchObject({ name: 'My Token' });
  });
});

describe('API namespace smoke tests', () => {
  it('daysApi.list fetches trip days', async () => {
    server.use(http.get('/api/trips/1/days', () => HttpResponse.json([])));
    await expect(daysApi.list(1)).resolves.toEqual([]);
  });

  it('assignmentsApi.list fetches day assignments', async () => {
    server.use(http.get('/api/trips/1/days/1/assignments', () => HttpResponse.json([])));
    await expect(assignmentsApi.list(1, 1)).resolves.toEqual([]);
  });

  it('tagsApi.list fetches tags', async () => {
    server.use(http.get('/api/tags', () => HttpResponse.json([])));
    await expect(tagsApi.list()).resolves.toEqual([]);
  });

  it('categoriesApi.list fetches categories', async () => {
    server.use(http.get('/api/categories', () => HttpResponse.json([])));
    await expect(categoriesApi.list()).resolves.toEqual([]);
  });

  it('adminApi.users fetches admin users', async () => {
    server.use(http.get('/api/admin/users', () => HttpResponse.json([])));
    await expect(adminApi.users()).resolves.toEqual([]);
  });

  it('addonsApi.enabled fetches enabled addons', async () => {
    server.use(http.get('/api/addons', () => HttpResponse.json([])));
    await expect(addonsApi.enabled()).resolves.toEqual([]);
  });

  it('mapsApi.search posts query', async () => {
    server.use(http.post('/api/maps/search', () => HttpResponse.json({ results: [] })));
    await expect(mapsApi.search('Paris')).resolves.toMatchObject({ results: [] });
  });

  it('budgetApi.list fetches budget items', async () => {
    server.use(http.get('/api/trips/1/budget', () => HttpResponse.json([])));
    await expect(budgetApi.list(1)).resolves.toEqual([]);
  });

  it('filesApi.list fetches trip files', async () => {
    server.use(http.get('/api/trips/1/files', () => HttpResponse.json([])));
    await expect(filesApi.list(1)).resolves.toEqual([]);
  });

  it('reservationsApi.list fetches reservations', async () => {
    server.use(http.get('/api/trips/1/reservations', () => HttpResponse.json([])));
    await expect(reservationsApi.list(1)).resolves.toEqual([]);
  });

  it('weatherApi.get fetches weather data', async () => {
    server.use(http.get('/api/weather', () => HttpResponse.json({ temp: 20 })));
    await expect(weatherApi.get(48.8, 2.3, '2025-06-01')).resolves.toMatchObject({ temp: 20 });
  });

  it('settingsApi.get fetches settings', async () => {
    server.use(http.get('/api/settings', () => HttpResponse.json({ dark_mode: false })));
    await expect(settingsApi.get()).resolves.toMatchObject({ dark_mode: false });
  });

  it('accommodationsApi.list fetches accommodations', async () => {
    server.use(http.get('/api/trips/1/accommodations', () => HttpResponse.json([])));
    await expect(accommodationsApi.list(1)).resolves.toEqual([]);
  });

  it('dayNotesApi.list fetches day notes', async () => {
    server.use(http.get('/api/trips/1/days/1/notes', () => HttpResponse.json([])));
    await expect(dayNotesApi.list(1, 1)).resolves.toEqual([]);
  });

  it('collabApi.getNotes fetches collab notes', async () => {
    server.use(http.get('/api/trips/1/collab/notes', () => HttpResponse.json([])));
    await expect(collabApi.getNotes(1)).resolves.toEqual([]);
  });

  it('notificationsApi.getPreferences fetches preferences', async () => {
    server.use(http.get('/api/notifications/preferences', () => HttpResponse.json({ email: true })));
    await expect(notificationsApi.getPreferences()).resolves.toMatchObject({ email: true });
  });

  it('inAppNotificationsApi.unreadCount fetches unread count', async () => {
    server.use(http.get('/api/notifications/in-app/unread-count', () => HttpResponse.json({ count: 3 })));
    await expect(inAppNotificationsApi.unreadCount()).resolves.toMatchObject({ count: 3 });
  });

  it('inAppNotificationsApi.markRead marks a notification read', async () => {
    server.use(http.put('/api/notifications/in-app/5/read', () => HttpResponse.json({ ok: true })));
    await expect(inAppNotificationsApi.markRead(5)).resolves.toMatchObject({ ok: true });
  });

  it('inAppNotificationsApi.markAllRead marks all notifications read', async () => {
    server.use(http.put('/api/notifications/in-app/read-all', () => HttpResponse.json({ ok: true })));
    await expect(inAppNotificationsApi.markAllRead()).resolves.toMatchObject({ ok: true });
  });

  it('inAppNotificationsApi.delete deletes a notification', async () => {
    server.use(http.delete('/api/notifications/in-app/5', () => HttpResponse.json({ ok: true })));
    await expect(inAppNotificationsApi.delete(5)).resolves.toMatchObject({ ok: true });
  });

  it('inAppNotificationsApi.markUnread marks a notification unread', async () => {
    server.use(http.put('/api/notifications/in-app/5/unread', () => HttpResponse.json({ ok: true })));
    await expect(inAppNotificationsApi.markUnread(5)).resolves.toMatchObject({ ok: true });
  });

  it('inAppNotificationsApi.deleteAll deletes all notifications', async () => {
    server.use(http.delete('/api/notifications/in-app/all', () => HttpResponse.json({ ok: true })));
    await expect(inAppNotificationsApi.deleteAll()).resolves.toMatchObject({ ok: true });
  });

  it('inAppNotificationsApi.respond posts a response', async () => {
    server.use(http.post('/api/notifications/in-app/5/respond', () => HttpResponse.json({ ok: true })));
    await expect(inAppNotificationsApi.respond(5, 'positive')).resolves.toMatchObject({ ok: true });
  });

  it('notificationsApi.updatePreferences updates preferences', async () => {
    server.use(http.put('/api/notifications/preferences', () => HttpResponse.json({ ok: true })));
    await expect(notificationsApi.updatePreferences({ email: { trip_invite: true } })).resolves.toMatchObject({ ok: true });
  });

  it('backupApi.list fetches backup list', async () => {
    server.use(http.get('/api/backup/list', () => HttpResponse.json([])));
    await expect(backupApi.list()).resolves.toEqual([]);
  });

  // ── tripsApi additional methods ──────────────────────────────────────────────

  it('tripsApi.create posts new trip', async () => {
    server.use(http.post('/api/trips', () => HttpResponse.json({ id: 1, name: 'Test' })));
    await expect(tripsApi.create({ name: 'Test' })).resolves.toMatchObject({ id: 1 });
  });

  it('tripsApi.update puts trip data', async () => {
    server.use(http.put('/api/trips/1', () => HttpResponse.json({ id: 1 })));
    await expect(tripsApi.update(1, { name: 'Updated' })).resolves.toMatchObject({ id: 1 });
  });

  it('tripsApi.delete deletes a trip', async () => {
    server.use(http.delete('/api/trips/1', () => HttpResponse.json({ ok: true })));
    await expect(tripsApi.delete(1)).resolves.toMatchObject({ ok: true });
  });

  it('tripsApi.getMembers fetches trip members', async () => {
    server.use(http.get('/api/trips/1/members', () => HttpResponse.json([])));
    await expect(tripsApi.getMembers(1)).resolves.toEqual([]);
  });

  it('tripsApi.copy copies a trip', async () => {
    server.use(http.post('/api/trips/1/copy', () => HttpResponse.json({ id: 99 })));
    await expect(tripsApi.copy(1)).resolves.toMatchObject({ id: 99 });
  });

  // ── placesApi additional methods ─────────────────────────────────────────────

  it('placesApi.list fetches places', async () => {
    server.use(http.get('/api/trips/1/places', () => HttpResponse.json([])));
    await expect(placesApi.list(1)).resolves.toEqual([]);
  });

  it('placesApi.get fetches a place', async () => {
    server.use(http.get('/api/trips/1/places/5', () => HttpResponse.json({ id: 5 })));
    await expect(placesApi.get(1, 5)).resolves.toMatchObject({ id: 5 });
  });

  it('placesApi.update updates a place', async () => {
    server.use(http.put('/api/trips/1/places/5', () => HttpResponse.json({ id: 5 })));
    await expect(placesApi.update(1, 5, { name: 'Rome' })).resolves.toMatchObject({ id: 5 });
  });

  it('placesApi.delete deletes a place', async () => {
    server.use(http.delete('/api/trips/1/places/5', () => HttpResponse.json({ ok: true })));
    await expect(placesApi.delete(1, 5)).resolves.toMatchObject({ ok: true });
  });

  // ── packingApi additional methods ────────────────────────────────────────────

  it('packingApi.list fetches packing items', async () => {
    server.use(http.get('/api/trips/1/packing', () => HttpResponse.json([])));
    await expect(packingApi.list(1)).resolves.toEqual([]);
  });

  it('packingApi.create creates a packing item', async () => {
    server.use(http.post('/api/trips/1/packing', () => HttpResponse.json({ id: 1, name: 'Towel' })));
    await expect(packingApi.create(1, { name: 'Towel' })).resolves.toMatchObject({ id: 1 });
  });

  it('packingApi.delete deletes a packing item', async () => {
    server.use(http.delete('/api/trips/1/packing/1', () => HttpResponse.json({ ok: true })));
    await expect(packingApi.delete(1, 1)).resolves.toMatchObject({ ok: true });
  });

  // ── assignmentsApi additional methods ────────────────────────────────────────

  it('assignmentsApi.create creates an assignment', async () => {
    server.use(http.post('/api/trips/1/days/1/assignments', () => HttpResponse.json({ id: 1 })));
    await expect(assignmentsApi.create(1, 1, { place_id: 5 })).resolves.toMatchObject({ id: 1 });
  });

  it('assignmentsApi.delete deletes an assignment', async () => {
    server.use(http.delete('/api/trips/1/days/1/assignments/1', () => HttpResponse.json({ ok: true })));
    await expect(assignmentsApi.delete(1, 1, 1)).resolves.toMatchObject({ ok: true });
  });

  it('assignmentsApi.reorder reorders assignments', async () => {
    server.use(http.put('/api/trips/1/days/1/assignments/reorder', () => HttpResponse.json({ ok: true })));
    await expect(assignmentsApi.reorder(1, 1, [3, 1, 2])).resolves.toMatchObject({ ok: true });
  });

  // ── daysApi additional methods ───────────────────────────────────────────────

  it('daysApi.create creates a day', async () => {
    server.use(http.post('/api/trips/1/days', () => HttpResponse.json({ id: 1 })));
    await expect(daysApi.create(1, { date: '2025-06-01' })).resolves.toMatchObject({ id: 1 });
  });

  it('daysApi.delete deletes a day', async () => {
    server.use(http.delete('/api/trips/1/days/1', () => HttpResponse.json({ ok: true })));
    await expect(daysApi.delete(1, 1)).resolves.toMatchObject({ ok: true });
  });

  // ── tagsApi / categoriesApi additional methods ────────────────────────────────

  it('tagsApi.create creates a tag', async () => {
    server.use(http.post('/api/tags', () => HttpResponse.json({ id: 1, name: 'Fun' })));
    await expect(tagsApi.create({ name: 'Fun' })).resolves.toMatchObject({ id: 1 });
  });

  it('tagsApi.delete deletes a tag', async () => {
    server.use(http.delete('/api/tags/1', () => HttpResponse.json({ ok: true })));
    await expect(tagsApi.delete(1)).resolves.toMatchObject({ ok: true });
  });

  it('categoriesApi.create creates a category', async () => {
    server.use(http.post('/api/categories', () => HttpResponse.json({ id: 1, name: 'Food' })));
    await expect(categoriesApi.create({ name: 'Food' })).resolves.toMatchObject({ id: 1 });
  });

  it('categoriesApi.delete deletes a category', async () => {
    server.use(http.delete('/api/categories/1', () => HttpResponse.json({ ok: true })));
    await expect(categoriesApi.delete(1)).resolves.toMatchObject({ ok: true });
  });

  // ── adminApi additional methods ───────────────────────────────────────────────

  it('adminApi.stats fetches admin stats', async () => {
    server.use(http.get('/api/admin/stats', () => HttpResponse.json({ trips: 5 })));
    await expect(adminApi.stats()).resolves.toMatchObject({ trips: 5 });
  });

  it('adminApi.createUser creates a user', async () => {
    server.use(http.post('/api/admin/users', () => HttpResponse.json({ id: 10 })));
    await expect(adminApi.createUser({ email: 'x@x.com' })).resolves.toMatchObject({ id: 10 });
  });

  // ── budgetApi additional methods ─────────────────────────────────────────────

  it('budgetApi.create creates a budget item', async () => {
    server.use(http.post('/api/trips/1/budget', () => HttpResponse.json({ id: 1 })));
    await expect(budgetApi.create(1, { name: 'Hotel' })).resolves.toMatchObject({ id: 1 });
  });

  it('budgetApi.delete deletes a budget item', async () => {
    server.use(http.delete('/api/trips/1/budget/1', () => HttpResponse.json({ ok: true })));
    await expect(budgetApi.delete(1, 1)).resolves.toMatchObject({ ok: true });
  });

  // ── reservationsApi additional methods ───────────────────────────────────────

  it('reservationsApi.create creates a reservation', async () => {
    server.use(http.post('/api/trips/1/reservations', () => HttpResponse.json({ id: 1 })));
    await expect(reservationsApi.create(1, { name: 'Hotel' })).resolves.toMatchObject({ id: 1 });
  });

  it('reservationsApi.delete deletes a reservation', async () => {
    server.use(http.delete('/api/trips/1/reservations/1', () => HttpResponse.json({ ok: true })));
    await expect(reservationsApi.delete(1, 1)).resolves.toMatchObject({ ok: true });
  });

  // ── settingsApi additional methods ───────────────────────────────────────────

  it('settingsApi.set updates a setting', async () => {
    server.use(http.put('/api/settings', () => HttpResponse.json({ ok: true })));
    await expect(settingsApi.set('dark_mode', true)).resolves.toMatchObject({ ok: true });
  });

  // ── accommodationsApi additional methods ─────────────────────────────────────

  it('accommodationsApi.create creates accommodation', async () => {
    server.use(http.post('/api/trips/1/accommodations', () => HttpResponse.json({ id: 1 })));
    await expect(accommodationsApi.create(1, { name: 'Hotel' })).resolves.toMatchObject({ id: 1 });
  });

  it('accommodationsApi.delete deletes accommodation', async () => {
    server.use(http.delete('/api/trips/1/accommodations/1', () => HttpResponse.json({ ok: true })));
    await expect(accommodationsApi.delete(1, 1)).resolves.toMatchObject({ ok: true });
  });

  // ── dayNotesApi additional methods ───────────────────────────────────────────

  it('dayNotesApi.create creates a day note', async () => {
    server.use(http.post('/api/trips/1/days/1/notes', () => HttpResponse.json({ id: 1 })));
    await expect(dayNotesApi.create(1, 1, { text: 'Hello' })).resolves.toMatchObject({ id: 1 });
  });

  it('dayNotesApi.delete deletes a day note', async () => {
    server.use(http.delete('/api/trips/1/days/1/notes/1', () => HttpResponse.json({ ok: true })));
    await expect(dayNotesApi.delete(1, 1, 1)).resolves.toMatchObject({ ok: true });
  });

  // ── collabApi additional methods ─────────────────────────────────────────────

  it('collabApi.createNote creates a note', async () => {
    server.use(http.post('/api/trips/1/collab/notes', () => HttpResponse.json({ id: 1 })));
    await expect(collabApi.createNote(1, { title: 'Note' })).resolves.toMatchObject({ id: 1 });
  });

  it('collabApi.deleteNote deletes a note', async () => {
    server.use(http.delete('/api/trips/1/collab/notes/1', () => HttpResponse.json({ ok: true })));
    await expect(collabApi.deleteNote(1, 1)).resolves.toMatchObject({ ok: true });
  });

  // ── backupApi additional methods ─────────────────────────────────────────────

  it('backupApi.getAutoSettings fetches auto backup settings', async () => {
    server.use(http.get('/api/backup/auto-settings', () => HttpResponse.json({ enabled: true })));
    await expect(backupApi.getAutoSettings()).resolves.toMatchObject({ enabled: true });
  });

  it('backupApi.delete deletes a backup', async () => {
    server.use(http.delete('/api/backup/backup.zip', () => HttpResponse.json({ ok: true })));
    await expect(backupApi.delete('backup.zip')).resolves.toMatchObject({ ok: true });
  });

  // ── shareApi additional methods ───────────────────────────────────────────────

  it('shareApi.createLink creates a share link', async () => {
    server.use(http.post('/api/trips/1/share-link', () => HttpResponse.json({ token: 'abc' })));
    await expect(shareApi.createLink(1)).resolves.toMatchObject({ token: 'abc' });
  });

  it('shareApi.deleteLink deletes a share link', async () => {
    server.use(http.delete('/api/trips/1/share-link', () => HttpResponse.json({ ok: true })));
    await expect(shareApi.deleteLink(1)).resolves.toMatchObject({ ok: true });
  });

  // ── notificationsApi additional methods ───────────────────────────────────────

  it('notificationsApi.testWebhook tests webhook endpoint', async () => {
    server.use(http.post('/api/notifications/test-webhook', () => HttpResponse.json({ ok: true })));
    await expect(notificationsApi.testWebhook('http://example.com')).resolves.toMatchObject({ ok: true });
  });

  it('notificationsApi.testSmtp tests smtp endpoint', async () => {
    server.use(http.post('/api/notifications/test-smtp', () => HttpResponse.json({ ok: true })));
    await expect(notificationsApi.testSmtp('user@example.com')).resolves.toMatchObject({ ok: true });
  });

  // ── mapsApi additional methods ────────────────────────────────────────────────

  it('mapsApi.reverse fetches reverse geocode', async () => {
    server.use(http.get('/api/maps/reverse', () => HttpResponse.json({ address: 'Paris' })));
    await expect(mapsApi.reverse(48.8, 2.3)).resolves.toMatchObject({ address: 'Paris' });
  });

  // ── collabApi messaging methods ───────────────────────────────────────────────

  it('collabApi.getMessages fetches messages', async () => {
    server.use(http.get('/api/trips/1/collab/messages', () => HttpResponse.json([])));
    await expect(collabApi.getMessages(1)).resolves.toEqual([]);
  });

  it('collabApi.sendMessage sends a message', async () => {
    server.use(http.post('/api/trips/1/collab/messages', () => HttpResponse.json({ id: 1 })));
    await expect(collabApi.sendMessage(1, { text: 'Hello' })).resolves.toMatchObject({ id: 1 });
  });

  it('collabApi.deleteMessage deletes a message', async () => {
    server.use(http.delete('/api/trips/1/collab/messages/1', () => HttpResponse.json({ ok: true })));
    await expect(collabApi.deleteMessage(1, 1)).resolves.toMatchObject({ ok: true });
  });

  it('collabApi.reactMessage reacts to a message', async () => {
    server.use(http.post('/api/trips/1/collab/messages/1/react', () => HttpResponse.json({ ok: true })));
    await expect(collabApi.reactMessage(1, 1, '👍')).resolves.toMatchObject({ ok: true });
  });

  it('collabApi.getPolls fetches polls', async () => {
    server.use(http.get('/api/trips/1/collab/polls', () => HttpResponse.json([])));
    await expect(collabApi.getPolls(1)).resolves.toEqual([]);
  });

  it('backupApi.uploadRestore uploads and restores a backup', async () => {
    server.use(http.post('/api/backup/upload-restore', () => HttpResponse.json({ ok: true })));
    const file = new File(['data'], 'backup.zip', { type: 'application/zip' });
    await expect(backupApi.uploadRestore(file)).resolves.toMatchObject({ ok: true });
  });

  it('backupApi.restore restores a named backup', async () => {
    server.use(http.post('/api/backup/restore/backup.zip', () => HttpResponse.json({ ok: true })));
    await expect(backupApi.restore('backup.zip')).resolves.toMatchObject({ ok: true });
  });

  it('backupApi.create creates a backup', async () => {
    server.use(http.post('/api/backup/create', () => HttpResponse.json({ filename: 'backup.zip' })));
    await expect(backupApi.create()).resolves.toMatchObject({ filename: 'backup.zip' });
  });
});
