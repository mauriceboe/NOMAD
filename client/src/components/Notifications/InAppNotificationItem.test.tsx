// FE-COMP-NOTIF-001 to FE-COMP-NOTIF-010
import { render, screen, waitFor } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useInAppNotificationStore } from '../../store/inAppNotificationStore';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { buildUser, buildSettings } from '../../../tests/helpers/factories';
import InAppNotificationItem from './InAppNotificationItem';

const buildNotification = (overrides = {}) => ({
  id: 1,
  type: 'simple',
  scope: 'trip',
  target: 1,
  sender_id: 2,
  sender_username: 'alice',
  sender_avatar: null,
  recipient_id: 1,
  title_key: 'notifications.title',
  title_params: '{}',
  text_key: 'notifications.empty',
  text_params: '{}',
  positive_text_key: null,
  negative_text_key: null,
  response: null,
  navigate_text_key: null,
  navigate_target: null,
  is_read: 0,
  created_at: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => {
  resetAllStores();
  seedStore(useAuthStore, { user: buildUser(), isAuthenticated: true });
  seedStore(useSettingsStore, { settings: buildSettings() });
});

describe('InAppNotificationItem', () => {
  it('FE-COMP-NOTIF-001: renders without crashing', () => {
    render(<InAppNotificationItem notification={buildNotification()} />);
    expect(document.body).toBeInTheDocument();
  });

  it('FE-COMP-NOTIF-002: shows sender avatar initial letter', () => {
    render(<InAppNotificationItem notification={buildNotification({ sender_username: 'bob' })} />);
    // Avatar shows first letter uppercase: "B"
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('FE-COMP-NOTIF-003: shows notification title text', () => {
    render(<InAppNotificationItem notification={buildNotification({ title_key: 'notifications.title' })} />);
    // t('notifications.title') = "Notifications"
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('FE-COMP-NOTIF-004: shows notification body text', () => {
    render(<InAppNotificationItem notification={buildNotification({ text_key: 'notifications.empty' })} />);
    // t('notifications.empty') = "No notifications"
    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('FE-COMP-NOTIF-005: shows Mark as read button for unread notification', () => {
    render(<InAppNotificationItem notification={buildNotification({ is_read: 0 })} />);
    expect(screen.getByTitle('Mark as read')).toBeInTheDocument();
  });

  it('FE-COMP-NOTIF-006: does not show Mark as read button for read notification', () => {
    render(<InAppNotificationItem notification={buildNotification({ is_read: 1 })} />);
    expect(screen.queryByTitle('Mark as read')).not.toBeInTheDocument();
  });

  it('FE-COMP-NOTIF-007: shows Delete button', () => {
    render(<InAppNotificationItem notification={buildNotification()} />);
    expect(screen.getByTitle('Delete')).toBeInTheDocument();
  });

  it('FE-COMP-NOTIF-008: clicking Mark as read calls markRead', async () => {
    const user = userEvent.setup();
    const markRead = vi.fn().mockResolvedValue(undefined);
    seedStore(useInAppNotificationStore, { markRead });
    render(<InAppNotificationItem notification={buildNotification({ id: 42, is_read: 0 })} />);
    await user.click(screen.getByTitle('Mark as read'));
    expect(markRead).toHaveBeenCalledWith(42);
  });

  it('FE-COMP-NOTIF-009: clicking Delete calls deleteNotification', async () => {
    const user = userEvent.setup();
    const deleteNotification = vi.fn().mockResolvedValue(undefined);
    seedStore(useInAppNotificationStore, { deleteNotification });
    render(<InAppNotificationItem notification={buildNotification({ id: 99 })} />);
    await user.click(screen.getByTitle('Delete'));
    expect(deleteNotification).toHaveBeenCalledWith(99);
  });

  it('FE-COMP-NOTIF-010: shows relative timestamp', () => {
    render(<InAppNotificationItem notification={buildNotification({ created_at: new Date().toISOString() })} />);
    // Recent notification shows "just now"
    expect(screen.getByText('just now')).toBeInTheDocument();
  });
});
