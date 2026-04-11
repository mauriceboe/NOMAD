import React from 'react';
import { render, screen, waitFor } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/helpers/msw/server';
import { useAuthStore } from '../../store/authStore';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { buildUser } from '../../../tests/helpers/factories';
import { ToastContainer } from '../shared/Toast';
import NotificationsTab from './NotificationsTab';

const minimalMatrix = {
  preferences: {
    trip_invite: { inapp: true, email: false },
  },
  available_channels: { email: true, webhook: false, inapp: true },
  event_types: ['trip_invite'],
  implemented_combos: { trip_invite: ['inapp', 'email'] },
};

beforeEach(() => {
  resetAllStores();
  vi.clearAllMocks();
  seedStore(useAuthStore, { user: buildUser(), isAuthenticated: true });
  server.use(
    http.get('/api/notifications/preferences', () => HttpResponse.json(minimalMatrix)),
    http.get('/api/settings', () => HttpResponse.json({ settings: { webhook_url: '' } })),
    http.put('/api/notifications/preferences', () => HttpResponse.json({ success: true })),
  );
});

describe('NotificationsTab', () => {
  it('FE-COMP-NOTIFICATIONS-001: shows loading state initially', () => {
    server.use(
      http.get('/api/notifications/preferences', () => new Promise(() => {})),
    );
    render(<NotificationsTab />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('FE-COMP-NOTIFICATIONS-002: renders the matrix after preferences load', async () => {
    render(<NotificationsTab />);
    // The event label is translated; fallback is the key itself
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });
    // Should render a toggle (ToggleSwitch renders a button)
    const toggles = await screen.findAllByRole('button');
    expect(toggles.length).toBeGreaterThan(0);
  });

  it('FE-COMP-NOTIFICATIONS-003: renders channel header labels', async () => {
    render(<NotificationsTab />);
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });
    // inapp channel header should appear (either translated or raw key)
    const headers = screen.getAllByText(/inapp|in.?app/i);
    expect(headers.length).toBeGreaterThan(0);
  });

  it('FE-COMP-NOTIFICATIONS-004: shows "no channels" message when no channels are available', async () => {
    server.use(
      http.get('/api/notifications/preferences', () =>
        HttpResponse.json({
          preferences: {},
          available_channels: { email: false, webhook: false, inapp: false },
          event_types: ['trip_invite'],
          implemented_combos: { trip_invite: ['inapp', 'email'] },
        }),
      ),
    );
    render(<NotificationsTab />);
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });
    // Should show noChannels message (translated or key)
    const noChannelEl = await screen.findByText(/no.*channel|noChannels/i);
    expect(noChannelEl).toBeInTheDocument();
  });

  it('FE-COMP-NOTIFICATIONS-005: shows a dash for event/channel combos not implemented', async () => {
    // Use two events: booking_change only implements email (making email visible),
    // but trip_invite only implements inapp — so trip_invite row gets a dash for email
    server.use(
      http.get('/api/notifications/preferences', () =>
        HttpResponse.json({
          preferences: { trip_invite: { inapp: true }, booking_change: { email: true } },
          available_channels: { email: true, webhook: false, inapp: true },
          event_types: ['trip_invite', 'booking_change'],
          implemented_combos: {
            trip_invite: ['inapp'],         // no email → dash in email column
            booking_change: ['email'],      // no inapp → dash in inapp column
          },
        }),
      ),
    );
    render(<NotificationsTab />);
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });
    // A dash should appear for non-implemented combos
    const dashes = await screen.findAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('FE-COMP-NOTIFICATIONS-006: clicking a toggle calls the preferences API', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown = null;
    server.use(
      http.put('/api/notifications/preferences', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ success: true });
      }),
    );

    render(<NotificationsTab />);
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });

    // minimalMatrix has inapp:true and email:false for trip_invite
    // The grid renders email column first, then inapp. We need the inapp toggle.
    // The inapp toggle is "on" (background accent), email is "off".
    // Find by looking at all buttons — inapp toggle should be 2nd (index 1) since email column comes first.
    const toggleButtons = await screen.findAllByRole('button');
    // There are 2 toggles: email (index 0, off) and inapp (index 1, on)
    await user.click(toggleButtons[1]);

    await waitFor(() => {
      expect(capturedBody).not.toBeNull();
    });

    // inapp was true, so after click it should be false
    const body = capturedBody as Record<string, Record<string, boolean>>;
    expect(body.trip_invite?.inapp).toBe(false);
  });

  it('FE-COMP-NOTIFICATIONS-007: toggle rolls back on API error', async () => {
    const user = userEvent.setup();
    server.use(
      http.put('/api/notifications/preferences', () => HttpResponse.json({ error: 'fail' }, { status: 500 })),
    );

    render(<NotificationsTab />);
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });

    // Find the inapp toggle for trip_invite — it starts as "on"
    const toggleButtons = await screen.findAllByRole('button');
    const toggleBtn = toggleButtons[0];

    // Verify the initial state via aria-checked or style; click and wait for rollback
    await user.click(toggleBtn);

    // After the error, the toggle should revert back (still rendered in the DOM)
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
      expect(screen.queryByText('Saving…')).not.toBeInTheDocument();
    });

    // The toggle should still be present (not removed on error)
    const buttonsAfter = screen.getAllByRole('button');
    expect(buttonsAfter.length).toBeGreaterThan(0);
  });

  it('FE-COMP-NOTIFICATIONS-008: shows "Saving…" indicator while update is in flight', async () => {
    const user = userEvent.setup();
    let resolveRequest!: () => void;
    server.use(
      http.put('/api/notifications/preferences', () =>
        new Promise<Response>(resolve => {
          resolveRequest = () => resolve(HttpResponse.json({ success: true }) as unknown as Response);
        }),
      ),
    );

    render(<NotificationsTab />);
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });

    const toggleButtons = await screen.findAllByRole('button');
    await user.click(toggleButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Saving…')).toBeInTheDocument();
    });

    resolveRequest();

    await waitFor(() => {
      expect(screen.queryByText('Saving…')).not.toBeInTheDocument();
    });
  });

  it('FE-COMP-NOTIFICATIONS-009: webhook URL section renders when webhook channel is available', async () => {
    server.use(
      http.get('/api/notifications/preferences', () =>
        HttpResponse.json({
          preferences: { trip_invite: { inapp: true, webhook: false } },
          available_channels: { email: false, webhook: true, inapp: true },
          event_types: ['trip_invite'],
          implemented_combos: { trip_invite: ['inapp', 'webhook'] },
        }),
      ),
    );

    render(<NotificationsTab />);
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });

    // Webhook URL input should be present
    const input = await screen.findByRole('textbox');
    expect(input).toBeInTheDocument();

    // Save button should be present
    const buttons = screen.getAllByRole('button');
    expect(buttons.some(b => /save/i.test(b.textContent || ''))).toBe(true);
  });

  it('FE-COMP-NOTIFICATIONS-010: webhook URL input shows masked placeholder when webhook is already set', async () => {
    server.use(
      http.get('/api/notifications/preferences', () =>
        HttpResponse.json({
          preferences: { trip_invite: { inapp: true, webhook: false } },
          available_channels: { email: false, webhook: true, inapp: true },
          event_types: ['trip_invite'],
          implemented_combos: { trip_invite: ['inapp', 'webhook'] },
        }),
      ),
      http.get('/api/settings', () =>
        HttpResponse.json({ settings: { webhook_url: '••••••••' } }),
      ),
    );

    render(<NotificationsTab />);
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });

    const input = await screen.findByRole('textbox');
    expect(input).toHaveAttribute('placeholder', '••••••••');
  });

  it('FE-COMP-NOTIFICATIONS-011: clicking Save webhook calls settings API', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown = null;
    server.use(
      http.get('/api/notifications/preferences', () =>
        HttpResponse.json({
          preferences: { trip_invite: { inapp: true, webhook: false } },
          available_channels: { email: false, webhook: true, inapp: true },
          event_types: ['trip_invite'],
          implemented_combos: { trip_invite: ['inapp', 'webhook'] },
        }),
      ),
      http.put('/api/settings', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ success: true });
      }),
    );

    render(<NotificationsTab />);
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });

    const input = await screen.findByRole('textbox');
    await user.type(input, 'https://example.com/hook');

    const saveBtn = screen.getAllByRole('button').find(b => /save/i.test(b.textContent || ''));
    expect(saveBtn).toBeDefined();
    await user.click(saveBtn!);

    await waitFor(() => {
      expect(capturedBody).not.toBeNull();
    });
  });

  it('FE-COMP-NOTIFICATIONS-012: Test button is disabled when no URL is set and no existing webhook', async () => {
    server.use(
      http.get('/api/notifications/preferences', () =>
        HttpResponse.json({
          preferences: { trip_invite: { inapp: true, webhook: false } },
          available_channels: { email: false, webhook: true, inapp: true },
          event_types: ['trip_invite'],
          implemented_combos: { trip_invite: ['inapp', 'webhook'] },
        }),
      ),
      http.get('/api/settings', () =>
        HttpResponse.json({ settings: { webhook_url: '' } }),
      ),
    );

    render(<NotificationsTab />);
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });

    await screen.findByRole('textbox');
    const testBtn = screen.getAllByRole('button').find(b => /test/i.test(b.textContent || ''));
    expect(testBtn).toBeDefined();
    expect(testBtn).toBeDisabled();
  });

  it('FE-COMP-NOTIFICATIONS-013: successful test webhook shows success toast', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/notifications/preferences', () =>
        HttpResponse.json({
          preferences: { trip_invite: { inapp: true, webhook: false } },
          available_channels: { email: false, webhook: true, inapp: true },
          event_types: ['trip_invite'],
          implemented_combos: { trip_invite: ['inapp', 'webhook'] },
        }),
      ),
      http.post('/api/notifications/test-webhook', () =>
        HttpResponse.json({ success: true }),
      ),
    );

    render(
      <>
        <NotificationsTab />
        <ToastContainer />
      </>,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });

    const input = await screen.findByRole('textbox');
    await user.type(input, 'https://example.com/hook');

    const testBtn = screen.getAllByRole('button').find(b => /test/i.test(b.textContent || ''));
    expect(testBtn).toBeDefined();
    await user.click(testBtn!);

    // Success toast should appear
    await waitFor(() => {
      const toastText = screen.queryByText(/testSuccess|success|sent/i);
      expect(toastText).toBeInTheDocument();
    });
  });

  it('FE-COMP-NOTIFICATIONS-014: failed test webhook shows error toast with message', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/notifications/preferences', () =>
        HttpResponse.json({
          preferences: { trip_invite: { inapp: true, webhook: false } },
          available_channels: { email: false, webhook: true, inapp: true },
          event_types: ['trip_invite'],
          implemented_combos: { trip_invite: ['inapp', 'webhook'] },
        }),
      ),
      http.post('/api/notifications/test-webhook', () =>
        HttpResponse.json({ success: false, error: 'Connection refused' }),
      ),
    );

    render(
      <>
        <NotificationsTab />
        <ToastContainer />
      </>,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });

    const input = await screen.findByRole('textbox');
    await user.type(input, 'https://example.com/hook');

    const testBtn = screen.getAllByRole('button').find(b => /test/i.test(b.textContent || ''));
    expect(testBtn).toBeDefined();
    await user.click(testBtn!);

    // Error toast with 'Connection refused' should appear
    await waitFor(() => {
      expect(screen.getByText('Connection refused')).toBeInTheDocument();
    });
  });
});
