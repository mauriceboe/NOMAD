import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/helpers/msw/server';
import { resetAllStores, seedStore } from '../../tests/helpers/store';
import { buildUser } from '../../tests/helpers/factories';
import { useAuthStore } from '../store/authStore';
import { useInAppNotificationStore } from '../store/inAppNotificationStore';
import InAppNotificationsPage from './InAppNotificationsPage';

// Mock InAppNotificationItem to simplify rendering
vi.mock('../components/Notifications/InAppNotificationItem', () => ({
  default: ({ notification }: { notification: { id: number; is_read: number } }) => (
    <div
      data-testid={`notification-${notification.id}`}
      data-read={notification.is_read}
    >
      Notification {notification.id}
    </div>
  ),
}));

beforeEach(() => {
  resetAllStores();
  seedStore(useAuthStore, { isAuthenticated: true, user: buildUser() });
});

describe('InAppNotificationsPage', () => {
  describe('FE-PAGE-NOTIFPAGE-001: Notification list loads on mount', () => {
    it('fetches and displays notifications on mount', async () => {
      render(<InAppNotificationsPage />);

      // Default handler returns 20 notifications (offset 0..19 from 25 total)
      await waitFor(() => {
        expect(screen.getByTestId('notification-1')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-NOTIFPAGE-002: Unread notifications shown with indicator', () => {
    it('shows unread count badge when there are unread notifications', async () => {
      render(<InAppNotificationsPage />);

      // Default handler returns unread_count: 5
      // The badge shows the count as a span inside the heading
      await waitFor(() => {
        // The "5" badge appears next to the Notifications heading
        const badges = screen.getAllByText('5');
        expect(badges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('FE-PAGE-NOTIFPAGE-003: Mark all read button', () => {
    it('shows "Mark all read" button when there are unread notifications', async () => {
      render(<InAppNotificationsPage />);

      await waitFor(() => {
        // Button has "Mark all read" text (possibly hidden on mobile via CSS class)
        // In jsdom, CSS "hidden" class doesn't actually hide elements
        expect(screen.getByRole('button', { name: /mark all read/i })).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-NOTIFPAGE-004: Delete all button', () => {
    it('shows "Delete all" button when there are notifications', async () => {
      render(<InAppNotificationsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete all/i })).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-NOTIFPAGE-005: Empty state when no notifications', () => {
    it('shows empty state when API returns no notifications', async () => {
      server.use(
        http.get('/api/notifications/in-app', () => {
          return HttpResponse.json({
            notifications: [],
            total: 0,
            unread_count: 0,
          });
        }),
      );

      render(<InAppNotificationsPage />);

      await waitFor(() => {
        expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-NOTIFPAGE-006: Filter toggle', () => {
    it('renders "All" and "Unread" filter buttons', async () => {
      render(<InAppNotificationsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument();
      });

      // The unread filter button uses t('notifications.unreadOnly') = 'Unread'
      expect(screen.getByRole('button', { name: /^unread$/i })).toBeInTheDocument();
    });
  });

  describe('FE-PAGE-NOTIFPAGE-007: Unread only filter hides read notifications', () => {
    it('clicking Unread filter shows only unread notifications', async () => {
      const user = userEvent.setup();

      // Seed store with known mix of read/unread
      const unreadNotif = {
        id: 100, is_read: 0, type: 'simple',
        scope: 'trip', target: 1, sender_id: 2,
        sender_username: 'alice', sender_avatar: null,
        recipient_id: 1, title_key: 'n', title_params: '{}',
        text_key: 'n', text_params: '{}',
        positive_text_key: null, negative_text_key: null,
        response: null, navigate_text_key: null, navigate_target: null,
        created_at: '2025-01-01T00:00:00Z',
      };
      const readNotif = {
        id: 101, is_read: 1, type: 'simple',
        scope: 'trip', target: 1, sender_id: 2,
        sender_username: 'alice', sender_avatar: null,
        recipient_id: 1, title_key: 'n', title_params: '{}',
        text_key: 'n', text_params: '{}',
        positive_text_key: null, negative_text_key: null,
        response: null, navigate_text_key: null, navigate_target: null,
        created_at: '2025-01-01T00:00:00Z',
      };

      seedStore(useInAppNotificationStore, {
        notifications: [unreadNotif, readNotif],
        unreadCount: 1,
        total: 2,
        isLoading: false,
        hasMore: false,
        fetchNotifications: vi.fn(),
        markAllRead: vi.fn(),
        deleteAll: vi.fn(),
      } as any);

      render(<InAppNotificationsPage />);

      // Both notifications start visible
      await waitFor(() => {
        expect(screen.getByTestId('notification-100')).toBeInTheDocument();
        expect(screen.getByTestId('notification-101')).toBeInTheDocument();
      });

      // Click "Unread" filter
      await user.click(screen.getByRole('button', { name: /^unread$/i }));

      // Only unread notification should be visible
      await waitFor(() => {
        expect(screen.getByTestId('notification-100')).toBeInTheDocument();
        expect(screen.queryByTestId('notification-101')).not.toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-NOTIFPAGE-008: Page title', () => {
    it('shows "Notifications" heading', async () => {
      render(<InAppNotificationsPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });

      expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/notifications/i);
    });
  });

  describe('FE-PAGE-NOTIFPAGE-009: Notification total count', () => {
    it('shows total notification count in the subtitle', async () => {
      render(<InAppNotificationsPage />);

      await waitFor(() => {
        // "25 notifications" (total from default handler)
        expect(screen.getByText(/25 notifications/i)).toBeInTheDocument();
      });
    });
  });
});
