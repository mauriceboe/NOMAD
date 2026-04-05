/**
 * Unit tests for immichService.ts
 * Covers IMMICH-SVC-001 to IMMICH-SVC-150
 *
 * Tests the DB-only and pure functions of immichService.
 * HTTP-dependent functions (proxyThumbnail, proxyOriginal, browseTimeline, etc.)
 * are tested at the path-level by mocking node-fetch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// immichService uses native global fetch (not node-fetch) — mock it on globalThis
const mockGlobalFetch = vi.fn();
vi.stubGlobal('fetch', mockGlobalFetch);

// ── DB mock — use vi.hoisted so variables are available when vi.mock is hoisted ──
const { mockPrepareGet, mockPrepareAll, mockPrepareRun, mockCanAccessTrip } = vi.hoisted(() => ({
  mockPrepareGet: vi.fn(() => undefined as unknown),
  mockPrepareAll: vi.fn(() => [] as unknown[]),
  mockPrepareRun: vi.fn(() => ({ changes: 0, lastInsertRowid: 1 })),
  mockCanAccessTrip: vi.fn(() => undefined as unknown),
}));

vi.mock('../../../src/db/database', () => ({
  db: {
    prepare: vi.fn(() => ({
      get: mockPrepareGet,
      all: mockPrepareAll,
      run: mockPrepareRun,
    })),
  },
  canAccessTrip: mockCanAccessTrip,
}));

vi.mock('../../../src/services/apiKeyCrypto', () => ({
  decrypt_api_key: vi.fn((v: unknown) => v as string | null),
  maybe_encrypt_api_key: vi.fn((v: unknown) => v),
}));

vi.mock('../../../src/utils/ssrfGuard', () => ({
  checkSsrf: vi.fn().mockResolvedValue({ allowed: true, isPrivate: false, resolvedIp: '1.2.3.4' }),
}));

vi.mock('../../../src/services/auditLog', () => ({
  logInfo: vi.fn(),
  logDebug: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  writeAudit: vi.fn(),
  getClientIp: vi.fn(),
}));

// node-fetch not used in immichService (uses native fetch)
// mockFetch alias kept for compatibility

import {
  isValidAssetId,
  getConnectionSettings,
  listTripPhotos,
  addTripPhotos,
  removeTripPhoto,
  togglePhotoSharing,
  canAccessUserPhoto,
  listAlbumLinks,
  createAlbumLink,
  deleteAlbumLink,
  getImmichCredentials,
  getAssetInfo,
  listAlbums,
  browseTimeline,
  testConnection,
  syncAlbumAssets,
} from '../../../src/services/immichService';

beforeEach(() => {
  mockPrepareGet.mockReset();
  mockPrepareAll.mockReset();
  mockPrepareRun.mockReset();
  mockCanAccessTrip.mockReset();
  mockGlobalFetch.mockReset();
  // Default: no result
  mockPrepareGet.mockReturnValue(undefined);
  mockPrepareAll.mockReturnValue([]);
  mockPrepareRun.mockReturnValue({ changes: 0, lastInsertRowid: 1 });
});

// ── isValidAssetId ────────────────────────────────────────────────────────────

describe('isValidAssetId', () => {
  it('IMMICH-SVC-001 — accepts valid UUID-style IDs', () => {
    expect(isValidAssetId('abc123-def456-ghi789')).toBe(true);
    expect(isValidAssetId('a1b2c3d4e5f6a7b8c9d0')).toBe(true);
  });

  it('IMMICH-SVC-002 — rejects IDs with path traversal characters', () => {
    expect(isValidAssetId('../etc/passwd')).toBe(false);
    expect(isValidAssetId('../../secret')).toBe(false);
    expect(isValidAssetId('asset/id')).toBe(false);
  });

  it('IMMICH-SVC-003 — rejects IDs that exceed 100 characters', () => {
    const longId = 'a'.repeat(101);
    expect(isValidAssetId(longId)).toBe(false);
  });

  it('IMMICH-SVC-004 — accepts IDs with underscores and hyphens', () => {
    expect(isValidAssetId('asset_id-12345')).toBe(true);
  });

  it('IMMICH-SVC-005 — rejects IDs with spaces or special chars', () => {
    expect(isValidAssetId('asset id')).toBe(false);
    expect(isValidAssetId('asset@id')).toBe(false);
    expect(isValidAssetId('asset#id')).toBe(false);
  });

  it('IMMICH-SVC-006 — accepts exactly 100-character IDs', () => {
    const maxId = 'a'.repeat(100);
    expect(isValidAssetId(maxId)).toBe(true);
  });
});

// ── getImmichCredentials ──────────────────────────────────────────────────────

describe('getImmichCredentials', () => {
  it('IMMICH-SVC-010 — returns null when user has no credentials', () => {
    mockPrepareGet.mockReturnValue({ immich_url: null, immich_api_key: null });
    expect(getImmichCredentials(1)).toBeNull();
  });

  it('IMMICH-SVC-011 — returns null when DB has no user', () => {
    mockPrepareGet.mockReturnValue(undefined);
    expect(getImmichCredentials(99)).toBeNull();
  });

  it('IMMICH-SVC-012 — returns credentials when both url and key are present', () => {
    mockPrepareGet.mockReturnValue({
      immich_url: 'https://immich.example.com',
      immich_api_key: 'my-api-key',
    });
    const creds = getImmichCredentials(1);
    expect(creds).not.toBeNull();
    expect(creds!.immich_url).toBe('https://immich.example.com');
    expect(creds!.immich_api_key).toBe('my-api-key');
  });
});

// ── getConnectionSettings ─────────────────────────────────────────────────────

describe('getConnectionSettings', () => {
  it('IMMICH-SVC-020 — returns empty URL and connected:false when no creds', () => {
    mockPrepareGet.mockReturnValue(undefined);
    const settings = getConnectionSettings(1);
    expect(settings.immich_url).toBe('');
    expect(settings.connected).toBe(false);
  });

  it('IMMICH-SVC-021 — returns url and connected:true when creds are set', () => {
    mockPrepareGet.mockReturnValue({
      immich_url: 'https://immich.example.com',
      immich_api_key: 'key-123',
    });
    const settings = getConnectionSettings(1);
    expect(settings.immich_url).toBe('https://immich.example.com');
    expect(settings.connected).toBe(true);
  });
});

// ── listTripPhotos ────────────────────────────────────────────────────────────

describe('listTripPhotos', () => {
  it('IMMICH-SVC-030 — returns empty array when no photos', () => {
    mockPrepareAll.mockReturnValue([]);
    const photos = listTripPhotos('1', 42);
    expect(photos).toEqual([]);
  });

  it('IMMICH-SVC-031 — returns photos from DB', () => {
    const mockPhotos = [
      { immich_asset_id: 'uuid-1', user_id: 42, shared: 1, added_at: '2024-01-01' },
    ];
    mockPrepareAll.mockReturnValue(mockPhotos);
    const photos = listTripPhotos('5', 42);
    expect(photos).toHaveLength(1);
    expect(photos[0]).toMatchObject({ immich_asset_id: 'uuid-1' });
  });
});

// ── addTripPhotos ─────────────────────────────────────────────────────────────

describe('addTripPhotos', () => {
  it('IMMICH-SVC-040 — returns count of added photos', () => {
    mockPrepareRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
    const added = addTripPhotos('1', 42, ['uuid-1', 'uuid-2'], false);
    expect(added).toBe(2);
  });

  it('IMMICH-SVC-041 — returns 0 when all photos already exist (OR IGNORE)', () => {
    mockPrepareRun.mockReturnValue({ changes: 0, lastInsertRowid: 1 });
    const added = addTripPhotos('1', 42, ['uuid-dup'], true);
    expect(added).toBe(0);
  });

  it('IMMICH-SVC-042 — handles empty asset IDs array', () => {
    const added = addTripPhotos('1', 42, [], false);
    expect(added).toBe(0);
    expect(mockPrepareRun).not.toHaveBeenCalled();
  });
});

// ── removeTripPhoto ───────────────────────────────────────────────────────────

describe('removeTripPhoto', () => {
  it('IMMICH-SVC-050 — calls DB DELETE', () => {
    removeTripPhoto('1', 42, 'asset-uuid-1');
    expect(mockPrepareRun).toHaveBeenCalledOnce();
  });
});

// ── togglePhotoSharing ────────────────────────────────────────────────────────

describe('togglePhotoSharing', () => {
  it('IMMICH-SVC-060 — calls DB UPDATE with shared=1 when shared=true', () => {
    togglePhotoSharing('1', 42, 'asset-uuid-1', true);
    expect(mockPrepareRun).toHaveBeenCalledOnce();
    const args = mockPrepareRun.mock.calls[0];
    expect(args[0]).toBe(1); // shared=true -> 1
  });

  it('IMMICH-SVC-061 — calls DB UPDATE with shared=0 when shared=false', () => {
    togglePhotoSharing('1', 42, 'asset-uuid-1', false);
    expect(mockPrepareRun).toHaveBeenCalledOnce();
    const args = mockPrepareRun.mock.calls[0];
    expect(args[0]).toBe(0); // shared=false -> 0
  });
});

// ── canAccessUserPhoto ────────────────────────────────────────────────────────

describe('canAccessUserPhoto', () => {
  it('IMMICH-SVC-070 — returns false when no shared photo row found', () => {
    mockPrepareGet.mockReturnValue(undefined);
    expect(canAccessUserPhoto(1, 2, 'asset-id')).toBe(false);
  });

  it('IMMICH-SVC-071 — returns false when canAccessTrip fails', () => {
    mockPrepareGet.mockReturnValue({ trip_id: 99 });
    mockCanAccessTrip.mockReturnValue(undefined);
    expect(canAccessUserPhoto(1, 2, 'asset-id')).toBe(false);
  });

  it('IMMICH-SVC-072 — returns true when photo is shared and user has trip access', () => {
    mockPrepareGet.mockReturnValue({ trip_id: 5 });
    mockCanAccessTrip.mockReturnValue({ id: 5, user_id: 2 });
    expect(canAccessUserPhoto(1, 2, 'asset-uuid')).toBe(true);
  });
});

// ── listAlbumLinks ────────────────────────────────────────────────────────────

describe('listAlbumLinks', () => {
  it('IMMICH-SVC-080 — returns empty array when no links', () => {
    mockPrepareAll.mockReturnValue([]);
    expect(listAlbumLinks('1')).toEqual([]);
  });

  it('IMMICH-SVC-081 — returns links from DB', () => {
    const links = [{ id: 1, trip_id: '1', immich_album_id: 'album-uuid', username: 'alice' }];
    mockPrepareAll.mockReturnValue(links);
    expect(listAlbumLinks('1')).toEqual(links);
  });
});

// ── createAlbumLink ───────────────────────────────────────────────────────────

describe('createAlbumLink', () => {
  it('IMMICH-SVC-090 — returns success:true on successful insert', () => {
    mockPrepareRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
    const result = createAlbumLink('1', 42, 'album-uuid', 'My Album');
    expect(result.success).toBe(true);
  });

  it('IMMICH-SVC-091 — returns success:false when DB throws', () => {
    mockPrepareRun.mockImplementationOnce(() => { throw new Error('DB error'); });
    const result = createAlbumLink('1', 42, 'album-uuid', 'My Album');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('IMMICH-SVC-092 — uses empty string as album name when not provided', () => {
    mockPrepareRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
    // albumName is optional in behavior; pass empty string
    const result = createAlbumLink('1', 42, 'album-uuid', '');
    expect(result.success).toBe(true);
  });
});

// ── deleteAlbumLink ───────────────────────────────────────────────────────────

describe('deleteAlbumLink', () => {
  it('IMMICH-SVC-100 — calls DB DELETE', () => {
    deleteAlbumLink('link-1', 'trip-1', 42);
    expect(mockPrepareRun).toHaveBeenCalledOnce();
  });
});

// ── getAssetInfo — error paths ────────────────────────────────────────────────

describe('getAssetInfo', () => {
  it('IMMICH-SVC-110 — returns 404 when no credentials', async () => {
    mockPrepareGet.mockReturnValue(undefined);
    const result = await getAssetInfo(1, 'asset-uuid');
    expect(result.error).toBeTruthy();
    expect(result.status).toBe(404);
  });

  it('IMMICH-SVC-111 — returns data when Immich API succeeds', async () => {
    mockPrepareGet.mockReturnValue({
      immich_url: 'https://immich.example.com',
      immich_api_key: 'key-123',
    });
    mockGlobalFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        id: 'asset-uuid',
        fileCreatedAt: '2024-01-01T00:00:00Z',
        originalFileName: 'photo.jpg',
        exifInfo: { exifImageWidth: 1920, exifImageHeight: 1080, make: 'Canon', model: 'EOS' },
      }),
    } as any);

    const result = await getAssetInfo(1, 'asset-uuid');
    expect(result.data).toBeDefined();
    expect(result.data?.id).toBe('asset-uuid');
    expect(result.data?.camera).toBe('Canon EOS');
  });

  it('IMMICH-SVC-112 — returns error when Immich API returns non-OK', async () => {
    mockPrepareGet.mockReturnValue({
      immich_url: 'https://immich.example.com',
      immich_api_key: 'key-123',
    });
    mockGlobalFetch.mockResolvedValueOnce({ ok: false, status: 403 } as any);

    const result = await getAssetInfo(1, 'asset-uuid');
    expect(result.error).toBeTruthy();
    expect(result.status).toBe(403);
  });

  it('IMMICH-SVC-113 — returns 502 when fetch throws', async () => {
    mockPrepareGet.mockReturnValue({
      immich_url: 'https://immich.example.com',
      immich_api_key: 'key-123',
    });
    mockGlobalFetch.mockRejectedValueOnce(new Error('Connection reset'));

    const result = await getAssetInfo(1, 'asset-uuid');
    expect(result.error).toBe('Proxy error');
    expect(result.status).toBe(502);
  });
});

// ── listAlbums — error paths ──────────────────────────────────────────────────

describe('listAlbums', () => {
  it('IMMICH-SVC-120 — returns 400 when no credentials', async () => {
    mockPrepareGet.mockReturnValue(undefined);
    const result = await listAlbums(1);
    expect(result.error).toBeTruthy();
    expect(result.status).toBe(400);
  });

  it('IMMICH-SVC-121 — returns albums on success', async () => {
    mockPrepareGet.mockReturnValue({
      immich_url: 'https://immich.example.com',
      immich_api_key: 'key-123',
    });
    mockGlobalFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([
        { id: 'album-1', albumName: 'Trip Photos', assetCount: 10, startDate: '2024-01-01' },
      ]),
    } as any);

    const result = await listAlbums(1);
    expect(result.albums).toHaveLength(1);
    expect(result.albums![0].albumName).toBe('Trip Photos');
  });

  it('IMMICH-SVC-122 — returns 502 when fetch throws', async () => {
    mockPrepareGet.mockReturnValue({
      immich_url: 'https://immich.example.com',
      immich_api_key: 'key-123',
    });
    mockGlobalFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await listAlbums(1);
    expect(result.status).toBe(502);
  });
});

// ── browseTimeline — error paths ──────────────────────────────────────────────

describe('browseTimeline', () => {
  it('IMMICH-SVC-130 — returns 400 when no credentials', async () => {
    mockPrepareGet.mockReturnValue(undefined);
    const result = await browseTimeline(1);
    expect(result.status).toBe(400);
  });

  it('IMMICH-SVC-131 — returns buckets on success', async () => {
    mockPrepareGet.mockReturnValue({
      immich_url: 'https://immich.example.com',
      immich_api_key: 'key-123',
    });
    mockGlobalFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ timeBucket: '2024-01', count: 5 }]),
    } as any);

    const result = await browseTimeline(1);
    expect(result.buckets).toBeDefined();
  });

  it('IMMICH-SVC-132 — returns 502 on fetch failure', async () => {
    mockPrepareGet.mockReturnValue({
      immich_url: 'https://immich.example.com',
      immich_api_key: 'key-123',
    });
    mockGlobalFetch.mockRejectedValueOnce(new Error('Timeout'));

    const result = await browseTimeline(1);
    expect(result.status).toBe(502);
  });
});

// ── testConnection ────────────────────────────────────────────────────────────

describe('testConnection', () => {
  it('IMMICH-SVC-140 — returns connected:true when server is reachable', async () => {
    // testConnection calls /api/users/me and returns { connected, user: { name, email } }
    mockGlobalFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      url: 'https://immich.example.com/api/users/me',
      json: () => Promise.resolve({ name: 'Alice', email: 'alice@example.com' }),
    } as any);

    const result = await testConnection('https://immich.example.com', 'api-key-123');
    expect(result.connected).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user?.name).toBe('Alice');
  });

  it('IMMICH-SVC-141 — returns connected:false when server returns non-OK', async () => {
    mockGlobalFetch.mockResolvedValueOnce({ ok: false, status: 401 } as any);

    const result = await testConnection('https://immich.example.com', 'wrong-key');
    expect(result.connected).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('IMMICH-SVC-142 — returns connected:false when fetch throws', async () => {
    mockGlobalFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await testConnection('https://immich.example.com', 'key');
    expect(result.connected).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ── syncAlbumAssets ───────────────────────────────────────────────────────────

describe('syncAlbumAssets', () => {
  it('IMMICH-SVC-150 — returns 404 when album link not found', async () => {
    mockPrepareGet.mockReturnValueOnce(undefined); // link not found
    const result = await syncAlbumAssets('1', 'link-1', 42);
    expect(result.error).toContain('Album link not found');
    expect(result.status).toBe(404);
  });

  it('IMMICH-SVC-151 — returns 400 when immich credentials not configured', async () => {
    // First get: link found
    mockPrepareGet.mockReturnValueOnce({ id: 'link-1', trip_id: '1', user_id: 42, immich_album_id: 'album-1' });
    // Second get: no credentials
    mockPrepareGet.mockReturnValueOnce(undefined);
    const result = await syncAlbumAssets('1', 'link-1', 42);
    expect(result.status).toBe(400);
  });
});
