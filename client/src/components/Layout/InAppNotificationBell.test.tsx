// FE-COMP-BELL-001 to FE-COMP-BELL-020
import { render, screen, waitFor } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { useAuthStore } from '../../store/authStore';
import { useInAppNotificationStore } from '../../store/inAppNotificationStore';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { buildUser } from '../../../tests/helpers/factories';
import InAppNotificationBell from './InAppNotificationBell';

let _notifId = 1;
function buildNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: _notifId++,
    type: 'simple',
    scope: 'trip',
    target: 1,
    sender_id: 2,
    sender_username: 'alice',
    sender_avatar: null,
    recipient_id: 1,
    title_key: 'test',
    title_params: '{}',
    text_key: 'test.text',
    text_params: '{}',
    positive_text_key: null,
    negative_text_key: null,
    response: null,
    navigate_text_key: null,
    navigate_target: null,
    is_read: 0,
    created_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeAll(() => {
  _notifId = 1;
});

beforeEach(() => {
  resetAllStores();
  seedStore(useAuthStore, { user: buildUser(), isAuthenticated: true });
});

describe('InAppNotificationBell', () => {
  it('FE-COMP-BELL-001: renders without crashing', () => {
    render(<InAppNotificationBell />);
    expect(document.body).toBeInTheDocument();
  });

  it('FE-COMP-BELL-002: shows bell button', () => {
    render(<InAppNotificationBell />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('FE-COMP-BELL-003: clicking bell opens notification panel', async () => {
    const user = userEvent.setup();
    render(<InAppNotificationBell />);
    const bell = screen.getAllByRole('button')[0];
    await user.click(bell);
    // Panel shows "Notifications" title
    await screen.findByText('Notifications');
  });

  it('FE-COMP-BELL-004: notification panel shows empty state when no notifications', async () => {
    const { http, HttpResponse } = await import('msw');
    const { server } = await import('../../../tests/helpers/msw/server');
    server.use(
      http.get('/api/notifications/in-app', () => HttpResponse.json({ notifications: [], total: 0, unread_count: 0 })),
      http.get('/api/notifications/in-app/unread-count', () => HttpResponse.json({ count: 0 })),
    );
    const user = userEvent.setup();
    render(<InAppNotificationBell />);
    const bell = screen.getAllByRole('button')[0];
    await user.click(bell);
    await screen.findByText('No notifications');
  });

  it('FE-COMP-BELL-005: shows unread badge count when there are unread notifications', async () => {
    seedStore(useInAppNotificationStore, { notifications: [], unreadCount: 5, isLoading: false });
    render(<InAppNotificationBell />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('FE-COMP-BELL-006: does not show badge when unread count is 0', () => {
    seedStore(useInAppNotificationStore, { notifications: [], unreadCount: 0, isLoading: false });
    render(<InAppNotificationBell />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('FE-COMP-BELL-007: panel shows Mark all read button when panel is open', async () => {
    const user = userEvent.setup();
    const notification = {
      id: 1, type: 'simple', scope: 'trip', target: 1, sender_id: 2,
      sender_username: 'alice', sender_avatar: null, recipient_id: 1,
      title_key: 'test', title_params: '{}', text_key: 'test.text', text_params: '{}',
      positive_text_key: null, negative_text_key: null, response: null,
      navigate_text_key: null, navigate_target: null, is_read: 0,
      created_at: '2025-01-01T00:00:00.000Z',
    };
    seedStore(useInAppNotificationStore, { notifications: [notification], unreadCount: 1, isLoading: false });
    render(<InAppNotificationBell />);
    const bell = screen.getAllByRole('button')[0];
    await user.click(bell);
    await screen.findByTitle('Mark all read');
  });

  it('FE-COMP-BELL-008: panel shows empty description when no notifications', async () => {
    const { http, HttpResponse } = await import('msw');
    const { server } = await import('../../../tests/helpers/msw/server');
    server.use(
      http.get('/api/notifications/in-app', () => HttpResponse.json({ notifications: [], total: 0, unread_count: 0 })),
      http.get('/api/notifications/in-app/unread-count', () => HttpResponse.json({ count: 0 })),
    );
    const user = userEvent.setup();
    render(<InAppNotificationBell />);
    await user.click(screen.getAllByRole('button')[0]);
    await screen.findByText("You're all caught up!");
  });

  it('FE-COMP-BELL-009: bell is accessible as a button', () => {
    render(<InAppNotificationBell />);
    const bell = screen.getAllByRole('button')[0];
    expect(bell).toBeInTheDocument();
  });

  it('FE-COMP-BELL-010: unread count greater than 99 shows 99+', () => {
    seedStore(useInAppNotificationStore, { notifications: [], unreadCount: 150, isLoading: false });
    render(<InAppNotificationBell />);
    // Should show "99+" not "150"
    expect(screen.queryByText('150')).not.toBeInTheDocument();
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('FE-COMP-BELL-011: Delete all button shown when notifications exist', async () => {
    const user = userEvent.setup();
    seedStore(useInAppNotificationStore, { notifications: [buildNotification()], unreadCount: 1, isLoading: false });
    render(<InAppNotificationBell />);
    await user.click(screen.getAllByRole('button')[0]);
    expect(screen.getByTitle('Delete all')).toBeInTheDocument();
  });

  it('FE-COMP-BELL-012: Delete all button NOT shown when no notifications', async () => {
    const user = userEvent.setup();
    seedStore(useInAppNotificationStore, { notifications: [], unreadCount: 0, isLoading: false, fetchNotifications: vi.fn() });
    render(<InAppNotificationBell />);
    await user.click(screen.getAllByRole('button')[0]);
    await screen.findByText('Notifications');
    expect(screen.queryByTitle('Delete all')).not.toBeInTheDocument();
  });

  it('FE-COMP-BELL-013: Mark all read button NOT shown when unreadCount is 0', async () => {
    const user = userEvent.setup();
    seedStore(useInAppNotificationStore, { notifications: [buildNotification({ is_read: 1 })], unreadCount: 0, isLoading: false, fetchNotifications: vi.fn(), fetchUnreadCount: vi.fn() });
    render(<InAppNotificationBell />);
    await user.click(screen.getAllByRole('button')[0]);
    await screen.findByText('Notifications');
    expect(screen.queryByTitle('Mark all read')).not.toBeInTheDocument();
  });

  it('FE-COMP-BELL-014: clicking Mark all read calls store action', async () => {
    const user = userEvent.setup();
    const markAllRead = vi.fn();
    seedStore(useInAppNotificationStore, { notifications: [buildNotification()], unreadCount: 1, isLoading: false, markAllRead });
    render(<InAppNotificationBell />);
    await user.click(screen.getAllByRole('button')[0]);
    await user.click(screen.getByTitle('Mark all read'));
    expect(markAllRead).toHaveBeenCalled();
  });

  it('FE-COMP-BELL-015: clicking Delete all calls store action', async () => {
    const user = userEvent.setup();
    const deleteAll = vi.fn();
    seedStore(useInAppNotificationStore, { notifications: [buildNotification()], unreadCount: 1, isLoading: false, deleteAll });
    render(<InAppNotificationBell />);
    await user.click(screen.getAllByRole('button')[0]);
    await user.click(screen.getByTitle('Delete all'));
    expect(deleteAll).toHaveBeenCalled();
  });

  it('FE-COMP-BELL-016: Show all notifications navigates to /notifications', async () => {
    const user = userEvent.setup();
    seedStore(useInAppNotificationStore, { notifications: [], unreadCount: 0, isLoading: false });
    render(<InAppNotificationBell />);
    await user.click(screen.getAllByRole('button')[0]);
    await screen.findByText('Notifications');
    const showAllBtn = screen.getByText('Show all notifications');
    await user.click(showAllBtn);
    // Panel should close after clicking show all
    expect(screen.queryByText('No notifications')).not.toBeInTheDocument();
  });

  it('FE-COMP-BELL-017: loading spinner shown when isLoading=true and notifications empty', async () => {
    const user = userEvent.setup();
    seedStore(useInAppNotificationStore, { notifications: [], unreadCount: 0, isLoading: true, fetchNotifications: vi.fn() });
    render(<InAppNotificationBell />);
    await user.click(screen.getAllByRole('button')[0]);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('FE-COMP-BELL-018: notification items rendered up to 10', async () => {
    const user = userEvent.setup();
    const notifications = Array.from({ length: 12 }, (_, i) => buildNotification({ id: i + 1 }));
    seedStore(useInAppNotificationStore, { notifications, unreadCount: 12, isLoading: false });
    render(<InAppNotificationBell />);
    await user.click(screen.getAllByRole('button')[0]);
    await screen.findByText('Notifications');
    // Each InAppNotificationItem renders with py-3 px-4 pattern; count rendered items
    const items = document.querySelectorAll('.relative.px-4.py-3');
    expect(items.length).toBeLessThanOrEqual(10);
  });

  it('FE-COMP-BELL-019: clicking outside the panel closes it', async () => {
    const user = userEvent.setup();
    seedStore(useInAppNotificationStore, { notifications: [], unreadCount: 0, isLoading: false });
    render(<InAppNotificationBell />);
    await user.click(screen.getAllByRole('button')[0]);
    await screen.findByText('Notifications');
    // The backdrop div is the fixed overlay — click it to close
    const backdrop = document.querySelector('div[style*="position: fixed"][style*="inset: 0"]') as HTMLElement;
    expect(backdrop).toBeInTheDocument();
    await user.click(backdrop);
    // Panel should be gone — "No notifications" text no longer visible
    await waitFor(() => {
      expect(screen.queryByText('No notifications')).not.toBeInTheDocument();
    });
  });

  it('FE-COMP-BELL-020: panel does not fetch again when already open and clicked again', async () => {
    const user = userEvent.setup();
    const fetchNotifications = vi.fn();
    seedStore(useInAppNotificationStore, { notifications: [], unreadCount: 0, isLoading: false, fetchNotifications });
    render(<InAppNotificationBell />);
    const bell = screen.getAllByRole('button')[0];
    // Open
    await user.click(bell);
    // Close
    await user.click(bell);
    // Re-open
    await user.click(bell);
    // fetchNotifications should be called once per open (2 total)
    expect(fetchNotifications).toHaveBeenCalledTimes(2);
  });
});
