import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../helpers/msw/server';
import { useInAppNotificationStore } from '../../../src/store/inAppNotificationStore';
import { resetAllStores } from '../../helpers/store';

// Raw notification factory matching the server shape (is_read as 0/1, params as strings)
function buildRawNotif(overrides: Record<string, unknown> = {}) {
  const id = Math.floor(Math.random() * 100000);
  return {
    id,
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
    is_read: 0,
    created_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  resetAllStores();
});

describe('inAppNotificationStore', () => {
  describe('FE-NOTIF-001: fetchNotifications() loads first page', () => {
    it('populates notifications, total, and unreadCount', async () => {
      await useInAppNotificationStore.getState().fetchNotifications();
      const state = useInAppNotificationStore.getState();

      expect(state.notifications.length).toBeGreaterThan(0);
      expect(state.total).toBeGreaterThan(0);
      expect(state.unreadCount).toBe(5);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('FE-NOTIF-002: Pagination — loading more appends to list', () => {
    it('appends additional notifications when fetchNotifications is called again', async () => {
      // First page
      await useInAppNotificationStore.getState().fetchNotifications(true);
      const firstPageCount = useInAppNotificationStore.getState().notifications.length;
      const total = useInAppNotificationStore.getState().total;

      // Only test pagination if there are more items
      if (firstPageCount < total) {
        await useInAppNotificationStore.getState().fetchNotifications();
        const state = useInAppNotificationStore.getState();
        expect(state.notifications.length).toBeGreaterThan(firstPageCount);
      } else {
        // All notifications fit in one page
        expect(firstPageCount).toBe(total);
      }
    });
  });

  describe('FE-NOTIF-003: markRead(id)', () => {
    it('updates is_read to true for the notification', async () => {
      // Seed with an unread notification
      const unread = buildRawNotif({ id: 42, is_read: 0 });
      useInAppNotificationStore.setState({
        notifications: [{ ...unread, title_params: {}, text_params: {}, is_read: false }] as never,
        unreadCount: 1,
      });

      await useInAppNotificationStore.getState().markRead(42);
      const state = useInAppNotificationStore.getState();

      const notif = state.notifications.find((n) => n.id === 42);
      expect(notif?.is_read).toBe(true);
      expect(state.unreadCount).toBe(0);
    });
  });

  describe('FE-NOTIF-004: handleNewNotification() prepends to list', () => {
    it('adds a new notification at the start of the list', () => {
      // Seed existing notifications
      useInAppNotificationStore.setState({
        notifications: [{ ...buildRawNotif({ id: 1 }), title_params: {}, text_params: {}, is_read: false }] as never,
        total: 1,
        unreadCount: 1,
      });

      const newRaw = buildRawNotif({ id: 99 });
      useInAppNotificationStore.getState().handleNewNotification(newRaw as never);

      const state = useInAppNotificationStore.getState();
      expect(state.notifications[0].id).toBe(99);
      expect(state.notifications.length).toBe(2);
      expect(state.total).toBe(2);
      expect(state.unreadCount).toBe(2);
    });
  });

  describe('FE-NOTIF-005: handleUpdatedNotification() updates existing notification', () => {
    it('replaces the notification in the list', () => {
      useInAppNotificationStore.setState({
        notifications: [{ ...buildRawNotif({ id: 7, is_read: 0 }), title_params: {}, text_params: {}, is_read: false }] as never,
        total: 1,
        unreadCount: 1,
      });

      const updated = buildRawNotif({ id: 7, is_read: 1 });
      useInAppNotificationStore.getState().handleUpdatedNotification(updated as never);

      const state = useInAppNotificationStore.getState();
      const notif = state.notifications.find((n) => n.id === 7);
      expect(notif?.is_read).toBe(true);
    });
  });

  describe('FE-NOTIF-006: Unread count is correct', () => {
    it('unreadCount matches the number of unread notifications', async () => {
      await useInAppNotificationStore.getState().fetchNotifications(true);
      const state = useInAppNotificationStore.getState();

      // The mock returns 5 unread from the server
      expect(state.unreadCount).toBe(5);
    });
  });

  describe('FE-STORE-NOTIF-007: fetchNotifications early-return when already loading', () => {
    it('does not fetch when isLoading is true', async () => {
      useInAppNotificationStore.setState({ isLoading: true });

      await useInAppNotificationStore.getState().fetchNotifications();
      const state = useInAppNotificationStore.getState();

      expect(state.notifications).toEqual([]);
      expect(state.isLoading).toBe(true);
    });
  });

  describe('FE-STORE-NOTIF-008: fetchNotifications(reset=true) resets existing list', () => {
    it('replaces seeded notifications with fresh data', async () => {
      // Seed store with 3 notifications
      useInAppNotificationStore.setState({
        notifications: [
          { ...buildRawNotif({ id: 901 }), title_params: {}, text_params: {}, is_read: false },
          { ...buildRawNotif({ id: 902 }), title_params: {}, text_params: {}, is_read: false },
          { ...buildRawNotif({ id: 903 }), title_params: {}, text_params: {}, is_read: false },
        ] as never,
        total: 3,
      });

      await useInAppNotificationStore.getState().fetchNotifications(true);
      const state = useInAppNotificationStore.getState();

      // Should not contain seeded IDs
      expect(state.notifications.find(n => n.id === 901)).toBeUndefined();
      expect(state.notifications.find(n => n.id === 902)).toBeUndefined();
      expect(state.notifications.find(n => n.id === 903)).toBeUndefined();
      // Should contain data from MSW (IDs 1-20)
      expect(state.notifications.length).toBe(20);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('FE-STORE-NOTIF-009: hasMore is set correctly', () => {
    it('hasMore is true when more items exist, false when all loaded', async () => {
      // Default MSW returns 25 total, 20 per page
      await useInAppNotificationStore.getState().fetchNotifications(true);
      expect(useInAppNotificationStore.getState().hasMore).toBe(true);

      // Second page: offset=20, returns 5 items, total=25 => 25 >= 25 => hasMore=false
      await useInAppNotificationStore.getState().fetchNotifications();
      expect(useInAppNotificationStore.getState().hasMore).toBe(false);
    });
  });

  describe('FE-STORE-NOTIF-010: fetchUnreadCount updates unreadCount', () => {
    it('sets unreadCount from server response', async () => {
      useInAppNotificationStore.setState({ unreadCount: 0 });

      await useInAppNotificationStore.getState().fetchUnreadCount();
      expect(useInAppNotificationStore.getState().unreadCount).toBe(5);
    });
  });

  describe('FE-STORE-NOTIF-011: markUnread(id)', () => {
    it('sets is_read to false and increments unreadCount', async () => {
      useInAppNotificationStore.setState({
        notifications: [{ ...buildRawNotif({ id: 50, is_read: 1 }), title_params: {}, text_params: {}, is_read: true }] as never,
        unreadCount: 0,
      });

      await useInAppNotificationStore.getState().markUnread(50);
      const state = useInAppNotificationStore.getState();

      expect(state.notifications.find(n => n.id === 50)?.is_read).toBe(false);
      expect(state.unreadCount).toBe(1);
    });
  });

  describe('FE-STORE-NOTIF-012: markAllRead()', () => {
    it('marks all notifications as read and sets unreadCount to 0', async () => {
      useInAppNotificationStore.setState({
        notifications: [
          { ...buildRawNotif({ id: 60 }), title_params: {}, text_params: {}, is_read: false },
          { ...buildRawNotif({ id: 61 }), title_params: {}, text_params: {}, is_read: false },
          { ...buildRawNotif({ id: 62 }), title_params: {}, text_params: {}, is_read: false },
        ] as never,
        unreadCount: 3,
      });

      await useInAppNotificationStore.getState().markAllRead();
      const state = useInAppNotificationStore.getState();

      expect(state.notifications.every(n => n.is_read === true)).toBe(true);
      expect(state.unreadCount).toBe(0);
    });
  });

  describe('FE-STORE-NOTIF-013: deleteNotification removes unread item and decrements counts', () => {
    it('removes notification and decrements total and unreadCount', async () => {
      useInAppNotificationStore.setState({
        notifications: [{ ...buildRawNotif({ id: 5 }), title_params: {}, text_params: {}, is_read: false }] as never,
        total: 3,
        unreadCount: 1,
      });

      await useInAppNotificationStore.getState().deleteNotification(5);
      const state = useInAppNotificationStore.getState();

      expect(state.notifications.find(n => n.id === 5)).toBeUndefined();
      expect(state.total).toBe(2);
      expect(state.unreadCount).toBe(0);
    });
  });

  describe('FE-STORE-NOTIF-014: deleteNotification on read item does not decrement unreadCount', () => {
    it('decrements total but not unreadCount', async () => {
      useInAppNotificationStore.setState({
        notifications: [{ ...buildRawNotif({ id: 6, is_read: 1 }), title_params: {}, text_params: {}, is_read: true }] as never,
        total: 2,
        unreadCount: 0,
      });

      await useInAppNotificationStore.getState().deleteNotification(6);
      const state = useInAppNotificationStore.getState();

      expect(state.total).toBe(1);
      expect(state.unreadCount).toBe(0);
    });
  });

  describe('FE-STORE-NOTIF-015: deleteAll clears all state', () => {
    it('resets notifications, total, unreadCount, and hasMore', async () => {
      useInAppNotificationStore.setState({
        notifications: [
          { ...buildRawNotif({ id: 70 }), title_params: {}, text_params: {}, is_read: false },
          { ...buildRawNotif({ id: 71 }), title_params: {}, text_params: {}, is_read: false },
        ] as never,
        total: 2,
        unreadCount: 2,
        hasMore: true,
      });

      await useInAppNotificationStore.getState().deleteAll();
      const state = useInAppNotificationStore.getState();

      expect(state.notifications).toEqual([]);
      expect(state.total).toBe(0);
      expect(state.unreadCount).toBe(0);
      expect(state.hasMore).toBe(false);
    });
  });

  describe('FE-STORE-NOTIF-016: respondToBoolean updates notification', () => {
    it('updates response and is_read from server', async () => {
      useInAppNotificationStore.setState({
        notifications: [{
          ...buildRawNotif({ id: 10, type: 'boolean' }),
          title_params: {},
          text_params: {},
          is_read: false,
        }] as never,
        unreadCount: 1,
      });

      await useInAppNotificationStore.getState().respondToBoolean(10, 'positive');
      const state = useInAppNotificationStore.getState();

      const notif = state.notifications.find(n => n.id === 10);
      expect(notif?.response).toBe('positive');
      expect(notif?.is_read).toBe(true);
    });
  });

  describe('FE-STORE-NOTIF-017: normalizeNotification coerces stringified params', () => {
    it('parses JSON string params into objects', () => {
      const raw = buildRawNotif({
        id: 200,
        title_params: '{"trip":"Rome"}',
        text_params: '{"user":"alice"}',
      });

      useInAppNotificationStore.getState().handleNewNotification(raw as never);
      const notif = useInAppNotificationStore.getState().notifications.find(n => n.id === 200);

      expect(notif?.title_params).toEqual({ trip: 'Rome' });
      expect(notif?.text_params).toEqual({ user: 'alice' });
    });
  });

  describe('FE-STORE-NOTIF-018: normalizeNotification handles already-parsed params', () => {
    it('stores object params without error', () => {
      const raw = buildRawNotif({
        id: 201,
        title_params: {},
        text_params: { key: 'value' },
      });

      expect(() => {
        useInAppNotificationStore.getState().handleNewNotification(raw as never);
      }).not.toThrow();

      const notif = useInAppNotificationStore.getState().notifications.find(n => n.id === 201);
      expect(notif?.title_params).toEqual({});
      expect(notif?.text_params).toEqual({ key: 'value' });
    });
  });

  describe('FE-STORE-NOTIF-019: fetchUnreadCount is best-effort', () => {
    it('does not throw on server error and preserves state', async () => {
      useInAppNotificationStore.setState({ unreadCount: 3 });

      server.use(
        http.get('/api/notifications/in-app/unread-count', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      await expect(useInAppNotificationStore.getState().fetchUnreadCount()).resolves.not.toThrow();
      expect(useInAppNotificationStore.getState().unreadCount).toBe(3);
    });
  });
});
