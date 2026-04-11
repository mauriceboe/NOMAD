import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useInAppNotificationStore } from '../../../src/store/inAppNotificationStore';
import { resetAllStores } from '../../helpers/store';

// Capture the listener registered via addListener so we can simulate WS events
let capturedListener: ((event: Record<string, unknown>) => void) | null = null;

vi.mock('../../../src/api/websocket', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  getSocketId: vi.fn(() => null),
  setRefetchCallback: vi.fn(),
  joinTrip: vi.fn(),
  leaveTrip: vi.fn(),
  addListener: vi.fn((fn) => {
    capturedListener = fn;
  }),
  removeListener: vi.fn(),
}));

const wsMock = await import('../../../src/api/websocket');

// Import the hook after the mock is in place
const { useInAppNotificationListener } = await import('../../../src/hooks/useInAppNotificationListener');

describe('useInAppNotificationListener', () => {
  beforeEach(() => {
    capturedListener = null;
    resetAllStores();
    vi.clearAllMocks();
    // Re-capture after clear
    (wsMock.addListener as ReturnType<typeof vi.fn>).mockImplementation((fn) => {
      capturedListener = fn;
    });
  });

  it('FE-HOOK-NOTIFLISTENER-001: on mount, addListener is called once', () => {
    const { unmount } = renderHook(() => useInAppNotificationListener());
    expect(wsMock.addListener).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('FE-HOOK-NOTIFLISTENER-002: on unmount, removeListener is called with the same function', () => {
    const { unmount } = renderHook(() => useInAppNotificationListener());

    const registeredFn = (wsMock.addListener as ReturnType<typeof vi.fn>).mock.calls[0][0];
    unmount();

    expect(wsMock.removeListener).toHaveBeenCalledWith(registeredFn);
  });

  it('FE-HOOK-NOTIFLISTENER-003: notification:new event calls handleNewNotification on the store', () => {
    const handleNew = vi.fn();
    useInAppNotificationStore.setState({ handleNewNotification: handleNew } as any);

    const { unmount } = renderHook(() => useInAppNotificationListener());

    expect(capturedListener).toBeTypeOf('function');

    const notification = {
      id: 1, type: 'simple', scope: 'trip', target: 1, sender_id: null, sender_username: null,
      sender_avatar: null, recipient_id: 2, title_key: 'test', title_params: '{}',
      text_key: 'test_body', text_params: '{}', positive_text_key: null, negative_text_key: null,
      response: null, navigate_text_key: null, navigate_target: null, is_read: 0,
      created_at: '2025-01-01T00:00:00Z',
    };

    act(() => {
      capturedListener!({ type: 'notification:new', notification });
    });

    expect(handleNew).toHaveBeenCalledWith(notification);
    unmount();
  });

  it('FE-HOOK-NOTIFLISTENER-004: notification:updated event calls handleUpdatedNotification on the store', () => {
    const handleUpdated = vi.fn();
    useInAppNotificationStore.setState({ handleUpdatedNotification: handleUpdated } as any);

    const { unmount } = renderHook(() => useInAppNotificationListener());

    const notification = {
      id: 5, type: 'simple', scope: 'user', target: 1, sender_id: null, sender_username: null,
      sender_avatar: null, recipient_id: 2, title_key: 'updated', title_params: '{}',
      text_key: 'updated_body', text_params: '{}', positive_text_key: null, negative_text_key: null,
      response: 'positive', navigate_text_key: null, navigate_target: null, is_read: 1,
      created_at: '2025-01-01T00:00:00Z',
    };

    act(() => {
      capturedListener!({ type: 'notification:updated', notification });
    });

    expect(handleUpdated).toHaveBeenCalledWith(notification);
    unmount();
  });

  it('FE-HOOK-NOTIFLISTENER-005: unrelated event types are ignored', () => {
    const handleNew = vi.fn();
    const handleUpdated = vi.fn();
    useInAppNotificationStore.setState({
      handleNewNotification: handleNew,
      handleUpdatedNotification: handleUpdated,
    } as any);

    const { unmount } = renderHook(() => useInAppNotificationListener());

    act(() => {
      capturedListener!({ type: 'place:created', data: {} });
    });

    expect(handleNew).not.toHaveBeenCalled();
    expect(handleUpdated).not.toHaveBeenCalled();
    unmount();
  });

  it('FE-HOOK-NOTIFLISTENER-006: notification:new actually updates the store unreadCount', () => {
    renderHook(() => useInAppNotificationListener());

    const initialCount = useInAppNotificationStore.getState().unreadCount;

    act(() => {
      capturedListener!({
        type: 'notification:new',
        notification: {
          id: 99, type: 'simple', scope: 'trip', target: 1, sender_id: null, sender_username: null,
          sender_avatar: null, recipient_id: 2, title_key: 'test', title_params: {},
          text_key: 'body', text_params: {}, positive_text_key: null, negative_text_key: null,
          response: null, navigate_text_key: null, navigate_target: null, is_read: false,
          created_at: '2025-01-01T00:00:00Z',
        },
      });
    });

    expect(useInAppNotificationStore.getState().unreadCount).toBe(initialCount + 1);
  });

  it('FE-HOOK-NOTIFLISTENER-007: notification:updated updates the notification in the store', () => {
    // Seed a notification
    useInAppNotificationStore.setState({
      notifications: [{
        id: 10, type: 'simple', scope: 'trip', target: 1, sender_id: null, sender_username: null,
        sender_avatar: null, recipient_id: 2, title_key: 'test', title_params: {},
        text_key: 'body', text_params: {}, positive_text_key: null, negative_text_key: null,
        response: null, navigate_text_key: null, navigate_target: null, is_read: false,
        created_at: '2025-01-01T00:00:00Z',
      }],
    });

    renderHook(() => useInAppNotificationListener());

    act(() => {
      capturedListener!({
        type: 'notification:updated',
        notification: {
          id: 10, type: 'simple', scope: 'trip', target: 1, sender_id: null, sender_username: null,
          sender_avatar: null, recipient_id: 2, title_key: 'test', title_params: {},
          text_key: 'body', text_params: {}, positive_text_key: null, negative_text_key: null,
          response: 'positive', navigate_text_key: null, navigate_target: null, is_read: true,
          created_at: '2025-01-01T00:00:00Z',
        },
      });
    });

    const updated = useInAppNotificationStore.getState().notifications.find((n) => n.id === 10);
    expect(updated?.response).toBe('positive');
    expect(updated?.is_read).toBe(true);
  });

  it('FE-HOOK-NOTIFLISTENER-008: multiple events processed correctly in sequence', () => {
    const { unmount } = renderHook(() => useInAppNotificationListener());

    const initial = useInAppNotificationStore.getState().unreadCount;

    act(() => {
      capturedListener!({
        type: 'notification:new',
        notification: {
          id: 101, type: 'simple', scope: 'trip', target: 1, sender_id: null, sender_username: null,
          sender_avatar: null, recipient_id: 2, title_key: 'k1', title_params: {},
          text_key: 'b1', text_params: {}, positive_text_key: null, negative_text_key: null,
          response: null, navigate_text_key: null, navigate_target: null, is_read: false,
          created_at: '2025-01-01T00:00:00Z',
        },
      });
      capturedListener!({
        type: 'notification:new',
        notification: {
          id: 102, type: 'simple', scope: 'trip', target: 1, sender_id: null, sender_username: null,
          sender_avatar: null, recipient_id: 2, title_key: 'k2', title_params: {},
          text_key: 'b2', text_params: {}, positive_text_key: null, negative_text_key: null,
          response: null, navigate_text_key: null, navigate_target: null, is_read: false,
          created_at: '2025-01-01T00:00:00Z',
        },
      });
    });

    expect(useInAppNotificationStore.getState().unreadCount).toBe(initial + 2);
    unmount();
  });

  it('FE-HOOK-NOTIFLISTENER-009: listener added on mount is the same one removed on unmount', () => {
    const { unmount } = renderHook(() => useInAppNotificationListener());

    const addedFn = (wsMock.addListener as ReturnType<typeof vi.fn>).mock.calls[0][0];
    unmount();
    const removedFn = (wsMock.removeListener as ReturnType<typeof vi.fn>).mock.calls[0][0];

    expect(addedFn).toBe(removedFn);
  });

  it('FE-HOOK-NOTIFLISTENER-010: after unmount, listener no longer processes events', () => {
    const handleNew = vi.fn();
    useInAppNotificationStore.setState({ handleNewNotification: handleNew } as any);

    const { unmount } = renderHook(() => useInAppNotificationListener());
    unmount();

    // capturedListener is captured but the component is unmounted
    // The removeListener was called — the actual implementation would have unregistered it
    // We verify removeListener was called (the cleanup ran)
    expect(wsMock.removeListener).toHaveBeenCalled();
  });
});
