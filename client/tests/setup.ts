import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './helpers/msw/server';

// Mock the websocket module so stores don't try to open real connections
vi.mock('../src/api/websocket', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  getSocketId: vi.fn(() => null),
  setRefetchCallback: vi.fn(),
}));

// MSW lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
afterAll(() => server.close());

// ── jsdom stubs ────────────────────────────────────────────────────────────────

// window.matchMedia — used by dark mode / responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// IntersectionObserver — used by lazy loading
// Must use a class or regular function (not arrow function) so 'new IntersectionObserver()' works
class _MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  root = null
  rootMargin = ''
  thresholds: ReadonlyArray<number> = []
  takeRecords = vi.fn(() => [])
  constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
}
globalThis.IntersectionObserver = _MockIntersectionObserver as unknown as typeof IntersectionObserver;

// ResizeObserver — used by resizable panels
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as unknown as typeof ResizeObserver;

// URL.createObjectURL / revokeObjectURL — Node 22 URL.createObjectURL requires
// a native node:buffer Blob; passing a jsdom Blob throws ERR_INVALID_ARG_TYPE.
// Tests that need blob URLs should mock fetch to return node:buffer Blobs so
// the real URL.createObjectURL works. For tests that only need the method to
// exist without returning a real URL, stub it here as a vi.fn fallback.
if (typeof URL.createObjectURL === 'undefined') {
  Object.defineProperty(URL, 'createObjectURL', { writable: true, configurable: true, value: vi.fn(() => 'blob:mock') });
  Object.defineProperty(URL, 'revokeObjectURL', { writable: true, configurable: true, value: vi.fn() });
}

// Element.prototype.scrollIntoView — jsdom doesn't implement it
Element.prototype.scrollIntoView = vi.fn();
