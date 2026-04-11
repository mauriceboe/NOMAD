// FE-ADMIN-DEVNOTIF-001 to FE-ADMIN-DEVNOTIF-010
import { render, screen, waitFor } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/helpers/msw/server';
import { buildUser } from '../../../tests/helpers/factories';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { useAuthStore } from '../../store/authStore';
import { ToastContainer } from '../shared/Toast';
import DevNotificationsPanel from './DevNotificationsPanel';

const ADMIN_USER = buildUser({ id: 1, username: 'testadmin', role: 'admin' });

beforeEach(() => {
  resetAllStores();
  seedStore(useAuthStore, { user: ADMIN_USER, isAuthenticated: true });
});

afterEach(() => {
  server.resetHandlers();
});

describe('DevNotificationsPanel', () => {
  it('FE-ADMIN-DEVNOTIF-001: "DEV ONLY" badge is always visible', () => {
    render(<><ToastContainer /><DevNotificationsPanel /></>);
    expect(screen.getByText('DEV ONLY')).toBeInTheDocument();
  });

  it('FE-ADMIN-DEVNOTIF-002: four section titles render after data loads', async () => {
    render(<><ToastContainer /><DevNotificationsPanel /></>);
    // Wait for async data to populate conditional sections
    await screen.findByText('Trip-Scoped Events');
    await screen.findByText('User-Scoped Events');
    expect(screen.getByText('Type Testing')).toBeInTheDocument();
    expect(screen.getByText('Admin-Scoped Events')).toBeInTheDocument();
  });

  it('FE-ADMIN-DEVNOTIF-003: trip selector populated from API', async () => {
    render(<><ToastContainer /><DevNotificationsPanel /></>);
    await screen.findByText('Trip-Scoped Events');
    const [tripSelect] = screen.getAllByRole('combobox');
    const options = Array.from(tripSelect.querySelectorAll('option'));
    const labels = options.map(o => o.textContent);
    expect(labels).toContain('Paris Adventure');
    expect(labels).toContain('Tokyo Trip');
  });

  it('FE-ADMIN-DEVNOTIF-004: user selector populated from API', async () => {
    render(<><ToastContainer /><DevNotificationsPanel /></>);
    await screen.findByText('User-Scoped Events');
    const selects = screen.getAllByRole('combobox');
    // Second combobox is the user selector (first is trip selector)
    const userSelect = selects[1];
    const options = Array.from(userSelect.querySelectorAll('option'));
    const labels = options.map(o => o.textContent ?? '');
    expect(labels.some(l => l.includes('admin'))).toBe(true);
    expect(labels.some(l => l.includes('alice'))).toBe(true);
  });

  it('FE-ADMIN-DEVNOTIF-005: clicking "Simple → Me" fires sendTestNotification with correct payload', async () => {
    let capturedBody: Record<string, unknown> | undefined;
    server.use(
      http.post('/api/admin/dev/test-notification', async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    render(<><ToastContainer /><DevNotificationsPanel /></>);
    await screen.findByText('Type Testing');
    await user.click(screen.getByText('Simple → Me').closest('button')!);
    await waitFor(() => expect(capturedBody).toBeDefined());
    expect(capturedBody).toMatchObject({
      event: 'test_simple',
      scope: 'user',
      targetId: ADMIN_USER.id,
    });
  });

  it('FE-ADMIN-DEVNOTIF-006: success toast shown after fire', async () => {
    server.use(
      http.post('/api/admin/dev/test-notification', () =>
        HttpResponse.json({ ok: true }),
      ),
    );
    const user = userEvent.setup();
    render(<><ToastContainer /><DevNotificationsPanel /></>);
    await screen.findByText('Type Testing');
    await user.click(screen.getByText('Simple → Me').closest('button')!);
    await screen.findByText('Sent: simple-me');
  });

  it('FE-ADMIN-DEVNOTIF-007: all buttons disabled while a send is in-flight', async () => {
    server.use(
      http.post('/api/admin/dev/test-notification', async () => {
        await new Promise(() => {}); // never resolves — simulates in-flight
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    render(<><ToastContainer /><DevNotificationsPanel /></>);
    await screen.findByText('Type Testing');

    // Fire the click but do not await — handler never resolves so sending stays true
    void user.click(screen.getByText('Simple → Me').closest('button')!);

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      buttons.forEach(btn => expect(btn).toBeDisabled());
    });
  });

  it('FE-ADMIN-DEVNOTIF-008: error toast shown on API failure', async () => {
    server.use(
      http.post('/api/admin/dev/test-notification', () =>
        HttpResponse.json({ message: 'Server error' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    render(<><ToastContainer /><DevNotificationsPanel /></>);
    await screen.findByText('Type Testing');
    await user.click(screen.getByText('Simple → Me').closest('button')!);
    await screen.findByText(/failed|error/i);
  });

  it('FE-ADMIN-DEVNOTIF-009: changing trip selector updates payload targetId', async () => {
    let capturedBody: Record<string, unknown> | undefined;
    server.use(
      http.post('/api/admin/dev/test-notification', async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    render(<><ToastContainer /><DevNotificationsPanel /></>);
    await screen.findByText('Trip-Scoped Events');

    const [tripSelect] = screen.getAllByRole('combobox');
    const tokyoOption = Array.from(tripSelect.querySelectorAll('option')).find(
      o => o.textContent === 'Tokyo Trip',
    )!;
    const tokyoId = Number(tokyoOption.value);

    await user.selectOptions(tripSelect, 'Tokyo Trip');
    await user.click(screen.getByText('booking_change').closest('button')!);

    await waitFor(() => expect(capturedBody).toBeDefined());
    expect(capturedBody!.targetId).toBe(tokyoId);
  });

  it('FE-ADMIN-DEVNOTIF-010: Trip-Scoped section absent when no trips', async () => {
    server.use(
      http.get('/api/trips', () => HttpResponse.json({ trips: [] })),
    );
    render(<><ToastContainer /><DevNotificationsPanel /></>);
    // Wait for user data to confirm async effects have settled
    await screen.findByText('User-Scoped Events');
    expect(screen.queryByText('Trip-Scoped Events')).not.toBeInTheDocument();
  });
});
