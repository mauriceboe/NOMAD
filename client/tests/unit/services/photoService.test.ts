import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Module-level types for dynamic imports
type PhotoServiceModule = typeof import('../../../src/services/photoService');
type ApiClientModule = typeof import('../../../src/api/client');

let svc: PhotoServiceModule;
let mockPlacePhoto: ReturnType<typeof vi.fn>;

// ── Canvas mock helpers ────────────────────────────────────────────────────────

function setupCanvasMock(dataUrl = 'data:image/webp;base64,mock') {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    beginPath: vi.fn(),
    arc: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(dataUrl);
}

// ── Image src interceptor ──────────────────────────────────────────────────────
// jsdom doesn't load images; we override the src setter so onload/onerror fire.

function setupImageAutoLoad(succeed = true) {
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    set(url: string) {
      (this as HTMLImageElement & { _src: string })._src = url;
      // Fire asynchronously so assignment completes before handler runs
      Promise.resolve().then(() => {
        if (succeed && typeof this.onload === 'function') {
          this.onload(new Event('load'));
        } else if (!succeed && typeof this.onerror === 'function') {
          this.onerror(new Event('error'));
        }
      });
    },
    get() {
      return (this as HTMLImageElement & { _src: string })._src ?? '';
    },
  });
}

function restoreImageSrc() {
  // Remove override — jsdom's descriptor is on the prototype, restoring
  // configurable property to original (no-op src) is sufficient for test isolation.
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    set(_url: string) {},
    get() { return ''; },
  });
}

// ── Module reset helpers ───────────────────────────────────────────────────────

async function freshImports() {
  vi.resetModules();
  vi.doMock('../../../src/api/client', () => ({
    mapsApi: { placePhoto: vi.fn() },
  }));
  svc = await import('../../../src/services/photoService');
  const apiClient = await import('../../../src/api/client') as ApiClientModule;
  mockPlacePhoto = vi.mocked(apiClient.mapsApi.placePhoto);
}

// ── Flush all pending microtasks + macrotasks ──────────────────────────────────
const flush = () => new Promise<void>(r => setTimeout(r, 0));

// ==============================================================================

beforeEach(async () => {
  await freshImports();
  setupCanvasMock();
  setupImageAutoLoad(true); // default: image loads succeed so urlToBase64 resolves and .finally() runs
});

afterEach(() => {
  vi.restoreAllMocks();
  restoreImageSrc();
  vi.clearAllMocks();
});

// ==============================================================================
// getCached / isLoading
// ==============================================================================

describe('getCached', () => {
  it('FE-COMP-PHOTO-001: returns undefined for an unknown key', () => {
    expect(svc.getCached('missing')).toBeUndefined();
  });
});

describe('isLoading', () => {
  it('FE-COMP-PHOTO-002: returns false before any fetch', () => {
    expect(svc.isLoading('key')).toBe(false);
  });
});

// ==============================================================================
// fetchPhoto — cache hit
// ==============================================================================

describe('fetchPhoto — cache hit', () => {
  it('FE-COMP-PHOTO-003: callback fires immediately on second call; API called only once', async () => {
    mockPlacePhoto.mockResolvedValue({ photoUrl: 'https://example.com/photo.jpg' });

    const cb1 = vi.fn();
    svc.fetchPhoto('k', 'pid', undefined, undefined, undefined, cb1);
    await flush();

    expect(mockPlacePhoto).toHaveBeenCalledTimes(1);
    expect(cb1).toHaveBeenCalledWith(expect.objectContaining({ photoUrl: 'https://example.com/photo.jpg' }));

    const cb2 = vi.fn();
    svc.fetchPhoto('k', 'pid', undefined, undefined, undefined, cb2);
    // Cache hit → synchronous call, no additional API request
    expect(cb2).toHaveBeenCalledWith(expect.objectContaining({ photoUrl: 'https://example.com/photo.jpg' }));
    expect(mockPlacePhoto).toHaveBeenCalledTimes(1);
  });
});

// ==============================================================================
// fetchPhoto — in-flight deduplication
// ==============================================================================

describe('fetchPhoto — in-flight deduplication', () => {
  it('FE-COMP-PHOTO-004: concurrent calls make only one API request; both callbacks receive result', async () => {
    let resolve!: (v: { photoUrl: string }) => void;
    mockPlacePhoto.mockReturnValue(new Promise<{ photoUrl: string }>(r => { resolve = r; }));

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    svc.fetchPhoto('k', 'pid', undefined, undefined, undefined, cb1);
    svc.fetchPhoto('k', 'pid', undefined, undefined, undefined, cb2);

    expect(mockPlacePhoto).toHaveBeenCalledTimes(1);

    resolve({ photoUrl: 'https://example.com/photo.jpg' });
    await flush();

    expect(cb1).toHaveBeenCalledWith(expect.objectContaining({ photoUrl: 'https://example.com/photo.jpg' }));
    expect(cb2).toHaveBeenCalledWith(expect.objectContaining({ photoUrl: 'https://example.com/photo.jpg' }));
  });
});

// ==============================================================================
// fetchPhoto — photoUrl present
// ==============================================================================

describe('fetchPhoto — photoUrl present', () => {
  it('FE-COMP-PHOTO-005: callback receives entry with photoUrl set and thumbDataUrl null at call time', async () => {
    mockPlacePhoto.mockResolvedValue({ photoUrl: 'https://example.com/photo.jpg' });

    // Capture a shallow clone at the moment of the call, before the entry is mutated by thumb generation
    const snapshots: { photoUrl: string | null; thumbDataUrl: string | null }[] = [];
    const cb = vi.fn((entry: { photoUrl: string | null; thumbDataUrl: string | null }) => {
      snapshots.push({ ...entry });
    });

    svc.fetchPhoto('k', 'pid', undefined, undefined, undefined, cb);
    await flush();

    expect(cb).toHaveBeenCalledTimes(1);
    expect(snapshots[0]).toEqual({ photoUrl: 'https://example.com/photo.jpg', thumbDataUrl: null });
  });

  it('FE-COMP-PHOTO-006: getCached returns the entry after fetch resolves', async () => {
    mockPlacePhoto.mockResolvedValue({ photoUrl: 'https://example.com/photo.jpg' });

    svc.fetchPhoto('k', 'pid');
    await flush();

    const entry = svc.getCached('k');
    expect(entry).toBeDefined();
    expect(entry!.photoUrl).toBe('https://example.com/photo.jpg');
  });

  it('FE-COMP-PHOTO-007: isLoading returns false after fetch completes', async () => {
    mockPlacePhoto.mockResolvedValue({ photoUrl: 'https://example.com/photo.jpg' });

    svc.fetchPhoto('k', 'pid');
    await flush();

    expect(svc.isLoading('k')).toBe(false);
  });
});

// ==============================================================================
// fetchPhoto — photoUrl null
// ==============================================================================

describe('fetchPhoto — photoUrl null', () => {
  it('FE-COMP-PHOTO-008: callback receives null entry when API returns no photoUrl', async () => {
    mockPlacePhoto.mockResolvedValue({});

    const cb = vi.fn();
    svc.fetchPhoto('k', 'pid', undefined, undefined, undefined, cb);
    await flush();

    expect(cb).toHaveBeenCalledWith({ photoUrl: null, thumbDataUrl: null });
    expect(svc.getCached('k')).toEqual({ photoUrl: null, thumbDataUrl: null });
  });
});

// ==============================================================================
// fetchPhoto — API error
// ==============================================================================

describe('fetchPhoto — API error', () => {
  it('FE-COMP-PHOTO-009: callback receives null entry on API rejection', async () => {
    mockPlacePhoto.mockRejectedValue(new Error('Network error'));

    const cb = vi.fn();
    svc.fetchPhoto('k', 'pid', undefined, undefined, undefined, cb);
    await flush();

    expect(cb).toHaveBeenCalledWith({ photoUrl: null, thumbDataUrl: null });
    expect(svc.getCached('k')).toEqual({ photoUrl: null, thumbDataUrl: null });
  });
});

// ==============================================================================
// onPhotoLoaded
// ==============================================================================

describe('onPhotoLoaded', () => {
  it('FE-COMP-PHOTO-010: listener fires once when photo is fetched', async () => {
    mockPlacePhoto.mockResolvedValue({ photoUrl: 'https://example.com/photo.jpg' });

    const fn = vi.fn();
    svc.onPhotoLoaded('k', fn);
    svc.fetchPhoto('k', 'pid');
    await flush();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ photoUrl: 'https://example.com/photo.jpg' }));
  });

  it('FE-COMP-PHOTO-011: unsubscribe prevents callback from being called', async () => {
    mockPlacePhoto.mockResolvedValue({ photoUrl: 'https://example.com/photo.jpg' });

    const fn = vi.fn();
    const unsub = svc.onPhotoLoaded('k', fn);
    unsub();
    svc.fetchPhoto('k', 'pid');
    await flush();

    expect(fn).not.toHaveBeenCalled();
  });
});

// ==============================================================================
// onThumbReady
// ==============================================================================

describe('onThumbReady', () => {
  it('FE-COMP-PHOTO-012: fires when urlToBase64 produces a thumb', async () => {
    mockPlacePhoto.mockResolvedValue({ photoUrl: 'https://example.com/img.jpg' });
    setupImageAutoLoad(true); // trigger img.onload → canvas path runs
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,thumb');

    const fn = vi.fn();
    svc.onThumbReady('k', fn);
    svc.fetchPhoto('k', 'pid');

    // flush microtasks + macrotasks to let urlToBase64 complete
    await flush();
    await flush();

    expect(fn).toHaveBeenCalledWith('data:image/webp;base64,thumb');
    expect(svc.getCached('k')?.thumbDataUrl).toBe('data:image/webp;base64,thumb');
  });

  it('FE-COMP-PHOTO-013: unsubscribe prevents thumb callback', async () => {
    mockPlacePhoto.mockResolvedValue({ photoUrl: 'https://example.com/img.jpg' });
    setupImageAutoLoad(true);

    const fn = vi.fn();
    const unsub = svc.onThumbReady('k', fn);
    unsub();
    svc.fetchPhoto('k', 'pid');

    await flush();
    await flush();

    expect(fn).not.toHaveBeenCalled();
  });
});

// ==============================================================================
// urlToBase64
// ==============================================================================

describe('urlToBase64', () => {
  it('FE-COMP-PHOTO-014: returns null when image fails to load', async () => {
    setupImageAutoLoad(false); // triggers onerror
    const result = await svc.urlToBase64('https://bad-url.jpg');
    expect(result).toBeNull();
  });

  it('FE-COMP-PHOTO-015: returns a data URL string on successful load', async () => {
    setupImageAutoLoad(true);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,abc123');

    const result = await svc.urlToBase64('https://example.com/img.jpg', 48);
    expect(result).toBe('data:image/webp;base64,abc123');
  });

  it('FE-COMP-PHOTO-016: canvas clip/draw path does not throw', async () => {
    setupImageAutoLoad(true);
    await expect(svc.urlToBase64('https://example.com/img.jpg')).resolves.not.toThrow();
  });
});

// ==============================================================================
// getAllThumbs
// ==============================================================================

describe('getAllThumbs', () => {
  it('FE-COMP-PHOTO-017: returns only entries with a non-null thumbDataUrl', async () => {
    // key1: photo with thumb
    mockPlacePhoto.mockResolvedValueOnce({ photoUrl: 'https://example.com/img1.jpg' });
    // key2: no photo, no thumb
    mockPlacePhoto.mockResolvedValueOnce({});

    setupImageAutoLoad(true);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,thumb1');

    svc.fetchPhoto('key1', 'pid1');
    svc.fetchPhoto('key2', 'pid2');

    await flush();
    await flush();

    const thumbs = svc.getAllThumbs();
    expect(Object.keys(thumbs)).toContain('key1');
    expect(thumbs['key1']).toBe('data:image/webp;base64,thumb1');
    expect(Object.keys(thumbs)).not.toContain('key2');
  });
});
