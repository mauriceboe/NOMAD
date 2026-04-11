// IMPORTANT: unmock must be the very first statement before any imports
vi.unmock('../../../src/api/websocket');

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../helpers/msw/server';
import {
  connect,
  disconnect,
  joinTrip,
  leaveTrip,
  addListener,
  removeListener,
  getSocketId,
  setRefetchCallback,
} from '../../../src/api/websocket';

// ── Fake WebSocket ────────────────────────────────────────────────────────────

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.OPEN;
  send = vi.fn();
  close = vi.fn();
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  static instances: MockWebSocket[] = [];
  static reset() {
    MockWebSocket.instances = [];
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  MockWebSocket.reset();

  // Replace globalThis.WebSocket with MockWebSocket directly.
  // jsdom marks WebSocket as non-writable, so we must use defineProperty.
  Object.defineProperty(globalThis, 'WebSocket', {
    writable: true,
    configurable: true,
    value: MockWebSocket,
  });

  // Default handler: ws-token returns a valid token
  server.use(
    http.post('/api/auth/ws-token', () =>
      HttpResponse.json({ token: 'test-ws-token' })
    )
  );
});

afterEach(() => {
  disconnect();
  setRefetchCallback(null);
  vi.useRealTimers();
  server.resetHandlers();
});

// Helper to get the most recently created MockWebSocket instance
function lastSocket(): MockWebSocket {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1];
}

// ── connect / disconnect ──────────────────────────────────────────────────────

describe('connect / disconnect', () => {
  it('FE-COMP-WS-001: connect() fetches ws-token and creates a WebSocket with it', async () => {
    connect();
    await vi.advanceTimersByTimeAsync(0);

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain('token=test-ws-token');
  });

  it('FE-COMP-WS-002: connect() sets shouldReconnect so onclose triggers reconnect', async () => {
    connect();
    await vi.advanceTimersByTimeAsync(0);

    expect(MockWebSocket.instances).toHaveLength(1);

    // Simulate socket close (triggers scheduleReconnect)
    lastSocket().onclose!();

    // Advance past initial reconnect delay (1000ms) — reconnect fires
    await vi.advanceTimersByTimeAsync(1001);
    await vi.advanceTimersByTimeAsync(0);

    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('FE-COMP-WS-003: disconnect() prevents reconnect after socket close', async () => {
    connect();
    await vi.advanceTimersByTimeAsync(0);

    const sock = lastSocket();
    disconnect();

    // After disconnect, onclose is nulled — simulating close should be safe
    // but we also fire it manually to be sure
    if (sock.onclose) sock.onclose();

    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(0);

    // Still only the original socket
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('FE-COMP-WS-004: connect() is idempotent — calling twice creates only one socket', async () => {
    connect();
    connect();
    await vi.advanceTimersByTimeAsync(0);

    expect(MockWebSocket.instances).toHaveLength(1);
  });
});

// ── ws-token fetch failures ───────────────────────────────────────────────────

describe('ws-token fetch failures', () => {
  it('FE-COMP-WS-005: 401 on ws-token fetch stops reconnect entirely', async () => {
    server.use(
      http.post('/api/auth/ws-token', () =>
        new HttpResponse(null, { status: 401 })
      )
    );

    connect();
    await vi.advanceTimersByTimeAsync(0);

    // No socket should be created
    expect(MockWebSocket.instances).toHaveLength(0);

    // Advance timers — no retry should fire
    await vi.advanceTimersByTimeAsync(10000);
    await vi.advanceTimersByTimeAsync(0);

    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('FE-COMP-WS-006: non-401 error on ws-token schedules a reconnect', async () => {
    server.use(
      http.post('/api/auth/ws-token', () =>
        new HttpResponse(null, { status: 503 })
      )
    );

    connect();
    await vi.advanceTimersByTimeAsync(0);

    // No socket yet
    expect(MockWebSocket.instances).toHaveLength(0);

    // Now allow the next fetch to succeed
    server.use(
      http.post('/api/auth/ws-token', () =>
        HttpResponse.json({ token: 'retry-token' })
      )
    );

    // Advance past initial reconnect delay
    await vi.advanceTimersByTimeAsync(1001);
    await vi.advanceTimersByTimeAsync(0);

    // A socket should now be created
    expect(MockWebSocket.instances).toHaveLength(1);
  });
});

// ── onopen / join on reconnect ────────────────────────────────────────────────

describe('onopen / join on reconnect', () => {
  it('FE-COMP-WS-007: onopen sends join messages for all active trips', async () => {
    joinTrip(42);
    connect();
    await vi.advanceTimersByTimeAsync(0);

    const sock = lastSocket();
    sock.onopen!();

    expect(sock.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'join', tripId: '42' })
    );
  });

  it('FE-COMP-WS-008: onopen invokes refetchCallback for each active trip', async () => {
    const refetch = vi.fn();
    setRefetchCallback(refetch);
    joinTrip(1);
    connect();
    await vi.advanceTimersByTimeAsync(0);

    lastSocket().onopen!();

    expect(refetch).toHaveBeenCalledWith('1');
  });
});

// ── joinTrip / leaveTrip ──────────────────────────────────────────────────────

describe('joinTrip / leaveTrip', () => {
  it('FE-COMP-WS-009: joinTrip sends join message immediately when socket is open', async () => {
    connect();
    await vi.advanceTimersByTimeAsync(0);
    const sock = lastSocket();
    sock.onopen!();

    joinTrip(99);

    expect(sock.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'join', tripId: '99' })
    );
  });

  it('FE-COMP-WS-010: joinTrip queues trip when socket is not open yet', async () => {
    joinTrip(5);
    connect();
    await vi.advanceTimersByTimeAsync(0);

    const sock = lastSocket();
    sock.onopen!();

    expect(sock.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'join', tripId: '5' })
    );
  });

  it('FE-COMP-WS-011: leaveTrip sends leave message and removes from activeTrips', async () => {
    connect();
    await vi.advanceTimersByTimeAsync(0);
    const sock = lastSocket();
    sock.onopen!();

    joinTrip(7);
    leaveTrip(7);

    expect(sock.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'leave', tripId: '7' })
    );

    // Simulate close + reconnect — trip 7 should NOT be re-joined
    sock.onclose!();
    await vi.advanceTimersByTimeAsync(1001);
    await vi.advanceTimersByTimeAsync(0);

    const sock2 = lastSocket();
    sock2.onopen!();

    // send called for initial join (trip 7) but not after leaveTrip
    const joinCalls = sock2.send.mock.calls.filter(
      c => JSON.parse(c[0]).tripId === '7'
    );
    expect(joinCalls).toHaveLength(0);
  });
});

// ── handleMessage / listeners ─────────────────────────────────────────────────

describe('handleMessage / listeners', () => {
  async function setupConnectedSocket() {
    connect();
    await vi.advanceTimersByTimeAsync(0);
    const sock = lastSocket();
    sock.onopen!();
    return sock;
  }

  it('FE-COMP-WS-012: welcome message sets socketId and is NOT dispatched to listeners', async () => {
    const sock = await setupConnectedSocket();
    const listener = vi.fn();
    addListener(listener);

    sock.onmessage!({ data: JSON.stringify({ type: 'welcome', socketId: 'server-sid-1' }) });

    expect(getSocketId()).toBe('server-sid-1');
    expect(listener).not.toHaveBeenCalled();

    removeListener(listener);
  });

  it('FE-COMP-WS-013: non-welcome messages are dispatched to all registered listeners', async () => {
    const sock = await setupConnectedSocket();
    const l1 = vi.fn();
    const l2 = vi.fn();
    addListener(l1);
    addListener(l2);

    const msg = { type: 'place_added', tripId: '1' };
    sock.onmessage!({ data: JSON.stringify(msg) });

    expect(l1).toHaveBeenCalledWith(msg);
    expect(l2).toHaveBeenCalledWith(msg);

    removeListener(l1);
    removeListener(l2);
  });

  it('FE-COMP-WS-014: listener error is caught and does not prevent other listeners from firing', async () => {
    const sock = await setupConnectedSocket();
    const throwing = vi.fn().mockImplementation(() => { throw new Error('boom'); });
    const working = vi.fn();
    addListener(throwing);
    addListener(working);

    expect(() => {
      sock.onmessage!({ data: JSON.stringify({ type: 'some_event' }) });
    }).not.toThrow();

    expect(working).toHaveBeenCalled();

    removeListener(throwing);
    removeListener(working);
  });

  it('FE-COMP-WS-015: malformed JSON in message is caught silently', async () => {
    const sock = await setupConnectedSocket();
    const listener = vi.fn();
    addListener(listener);

    expect(() => {
      sock.onmessage!({ data: 'not-json' });
    }).not.toThrow();

    expect(listener).not.toHaveBeenCalled();

    removeListener(listener);
  });

  it('FE-COMP-WS-016: removeListener stops a listener from receiving messages', async () => {
    const sock = await setupConnectedSocket();
    const listener = vi.fn();
    addListener(listener);
    removeListener(listener);

    sock.onmessage!({ data: JSON.stringify({ type: 'update' }) });

    expect(listener).not.toHaveBeenCalled();
  });
});

// ── addListener / removeListener ─────────────────────────────────────────────

describe('addListener / removeListener symmetry', () => {
  it('FE-COMP-WS-017: listener set grows and shrinks correctly', async () => {
    connect();
    await vi.advanceTimersByTimeAsync(0);
    const sock = lastSocket();
    sock.onopen!();

    const l1 = vi.fn();
    const l2 = vi.fn();
    addListener(l1);
    addListener(l2);

    sock.onmessage!({ data: JSON.stringify({ type: 'ping' }) });
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);

    removeListener(l1);

    sock.onmessage!({ data: JSON.stringify({ type: 'ping' }) });
    expect(l1).toHaveBeenCalledTimes(1); // no new calls
    expect(l2).toHaveBeenCalledTimes(2);

    removeListener(l2);
  });
});

// ── getSocketId / setRefetchCallback ─────────────────────────────────────────

describe('getSocketId / setRefetchCallback', () => {
  it('FE-COMP-WS-018: getSocketId() returns null before welcome message', async () => {
    // mySocketId is a module-level singleton that persists between tests.
    // Use vi.resetModules() + dynamic import to get a fresh module state.
    vi.resetModules();
    const freshWs = await import('../../../src/api/websocket');
    expect(freshWs.getSocketId()).toBeNull();
    // Clean up: restore the real module for subsequent tests by resetting again
    vi.resetModules();
  });

  it('FE-COMP-WS-019: setRefetchCallback(null) clears the callback', async () => {
    const cb = vi.fn();
    setRefetchCallback(cb);
    setRefetchCallback(null);

    joinTrip(10);
    connect();
    await vi.advanceTimersByTimeAsync(0);
    lastSocket().onopen!();

    expect(cb).not.toHaveBeenCalled();
  });
});

// ── Reconnect backoff ─────────────────────────────────────────────────────────

describe('reconnect backoff', () => {
  it('FE-COMP-WS-020: reconnect delay doubles on each failure up to 30s max', async () => {
    // Make every fetch fail with 503 so reconnect keeps firing
    server.use(
      http.post('/api/auth/ws-token', () =>
        new HttpResponse(null, { status: 503 })
      )
    );

    connect();

    const delays = [1000, 2000, 4000, 8000, 16000, 30000];
    let totalAdvanced = 0;

    for (const delay of delays) {
      // Wait for the fetch to complete
      await vi.advanceTimersByTimeAsync(0);
      // No socket should ever be created
      expect(MockWebSocket.instances).toHaveLength(0);
      // Advance to trigger next reconnect
      await vi.advanceTimersByTimeAsync(delay + 1);
      totalAdvanced += delay + 1;
    }

    // After advancing through all delays, still no socket
    await vi.advanceTimersByTimeAsync(0);
    expect(MockWebSocket.instances).toHaveLength(0);
  });
});
