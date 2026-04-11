// FE-COMP-MEMORIESPANEL-001 to FE-COMP-MEMORIESPANEL-027
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../../tests/helpers/render';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { server } from '../../../tests/helpers/msw/server';
import { http, HttpResponse } from 'msw';
import { useAuthStore } from '../../store/authStore';
import { buildUser } from '../../../tests/helpers/factories';
import MemoriesPanel from './MemoriesPanel';

// Mock fetchImageAsBlob to avoid real HTTP calls for thumbnail/image rendering
vi.mock('../../api/authUrl', () => ({
  fetchImageAsBlob: vi.fn().mockResolvedValue('blob:mock-url'),
  clearImageQueue: vi.fn(),
}));

const defaultProps = {
  tripId: 1,
  startDate: '2025-03-01',
  endDate: '2025-03-10',
};

// Reusable provider object to configure a connected Immich instance
const immichAddon = {
  id: 'immich',
  name: 'Immich',
  type: 'photo_provider',
  enabled: true,
  config: { status_get: '/integrations/memories/immich/status' },
};

// Handlers that simulate a connected provider with no photos/links
const connectedHandlers = [
  http.get('/api/addons', () =>
    HttpResponse.json({ addons: [immichAddon] })
  ),
  http.get('/api/integrations/memories/immich/status', () =>
    HttpResponse.json({ connected: true })
  ),
  http.get('/api/integrations/memories/unified/trips/:tripId/photos', () =>
    HttpResponse.json({ photos: [] })
  ),
  http.get('/api/integrations/memories/unified/trips/:tripId/album-links', () =>
    HttpResponse.json({ links: [] })
  ),
];

beforeEach(() => {
  resetAllStores();
  // Seed a default logged-in user
  seedStore(useAuthStore, { user: buildUser({ id: 1, username: 'me' }) });
});

describe('MemoriesPanel', () => {
  it('FE-COMP-MEMORIESPANEL-001: Shows loading state on initial render', () => {
    // Use a delayed response so loading stays true long enough to assert
    server.use(
      http.get('/api/addons', async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return HttpResponse.json({ addons: [] });
      }),
      http.get('/api/integrations/memories/unified/trips/:tripId/photos', () =>
        HttpResponse.json({ photos: [] })
      ),
      http.get('/api/integrations/memories/unified/trips/:tripId/album-links', () =>
        HttpResponse.json({ links: [] })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);

    // Spinner is rendered synchronously — loading state starts as true
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('FE-COMP-MEMORIESPANEL-002: Shows not-connected state when no photo providers are enabled', async () => {
    server.use(
      http.get('/api/addons', () => HttpResponse.json({ addons: [] })),
      http.get('/api/integrations/memories/unified/trips/:tripId/photos', () =>
        HttpResponse.json({ photos: [] })
      ),
      http.get('/api/integrations/memories/unified/trips/:tripId/album-links', () =>
        HttpResponse.json({ links: [] })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);

    // "Photo provider not connected" — no providers, falls back to generic label
    await screen.findByText('Photo provider not connected');
  });

  it('FE-COMP-MEMORIESPANEL-003: Displays trip photos from other users', async () => {
    server.use(
      ...connectedHandlers.filter(h => !h.info.path.includes('photos')),
      http.get('/api/integrations/memories/unified/trips/:tripId/photos', () =>
        HttpResponse.json({
          photos: [
            {
              asset_id: 'abc',
              provider: 'immich',
              user_id: 2,
              username: 'Alice',
              shared: 1,
              added_at: '2025-03-05T10:00:00Z',
            },
          ],
        })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);

    // Alice's username is rendered as an avatar tooltip in the gallery
    await screen.findByText('Alice');
  });

  it('FE-COMP-MEMORIESPANEL-004: Shows empty gallery state when connected but no photos', async () => {
    server.use(...connectedHandlers);

    render(<MemoriesPanel {...defaultProps} />);

    // Provider is connected so the gallery renders — but no photos → empty state
    await screen.findByText('No photos found');
  });

  it('FE-COMP-MEMORIESPANEL-005: Album links are displayed in the gallery header', async () => {
    server.use(
      ...connectedHandlers.filter(h => !h.info.path.includes('album-links')),
      http.get('/api/integrations/memories/unified/trips/:tripId/album-links', () =>
        HttpResponse.json({
          links: [
            {
              id: 1,
              provider: 'immich',
              album_id: 'a1',
              album_name: 'Holidays',
              user_id: 1,
              username: 'me',
              sync_enabled: 1,
              last_synced_at: null,
            },
          ],
        })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);

    await screen.findByText('Holidays');
  });

  it('FE-COMP-MEMORIESPANEL-006: Sync button calls the sync endpoint', async () => {
    let syncCalled = false;

    server.use(
      ...connectedHandlers.filter(h => !h.info.path.includes('album-links')),
      http.get('/api/integrations/memories/unified/trips/:tripId/album-links', () =>
        HttpResponse.json({
          links: [
            {
              id: 1,
              provider: 'immich',
              album_id: 'a1',
              album_name: 'Holidays',
              user_id: 1,
              username: 'me',
              sync_enabled: 1,
              last_synced_at: null,
            },
          ],
        })
      ),
      http.post('/api/integrations/memories/:provider/trips/:tripId/album-links/:linkId/sync', () => {
        syncCalled = true;
        return HttpResponse.json({ ok: true });
      }),
    );

    render(<MemoriesPanel {...defaultProps} />);

    await screen.findByText('Holidays');

    const syncBtn = screen.getByTitle('Sync album');
    await userEvent.click(syncBtn);

    await waitFor(() => expect(syncCalled).toBe(true));
  });

  it('FE-COMP-MEMORIESPANEL-007: Unlink button calls the delete endpoint', async () => {
    let deleteCalled = false;

    server.use(
      ...connectedHandlers.filter(h => !h.info.path.includes('album-links')),
      http.get('/api/integrations/memories/unified/trips/:tripId/album-links', () =>
        HttpResponse.json({
          links: [
            {
              id: 1,
              provider: 'immich',
              album_id: 'a1',
              album_name: 'Holidays',
              user_id: 1,
              username: 'me',
              sync_enabled: 1,
              last_synced_at: null,
            },
          ],
        })
      ),
      http.delete('/api/integrations/memories/unified/trips/:tripId/album-links/:linkId', () => {
        deleteCalled = true;
        return HttpResponse.json({ ok: true });
      }),
    );

    render(<MemoriesPanel {...defaultProps} />);

    await screen.findByText('Holidays');

    // The unlink button is only shown when link.user_id === currentUser.id
    const unlinkBtn = screen.getByTitle('Unlink album');
    await userEvent.click(unlinkBtn);

    await waitFor(() => expect(deleteCalled).toBe(true));
  });

  it('FE-COMP-MEMORIESPANEL-008: Sort toggle switches between oldest-first and newest-first', async () => {
    server.use(
      ...connectedHandlers.filter(h => !h.info.path.includes('photos')),
      http.get('/api/integrations/memories/unified/trips/:tripId/photos', () =>
        HttpResponse.json({
          photos: [
            { asset_id: 'photo1', provider: 'immich', user_id: 1, username: 'me', shared: 1, added_at: '2025-03-01T10:00:00Z' },
            { asset_id: 'photo2', provider: 'immich', user_id: 1, username: 'me', shared: 1, added_at: '2025-03-10T10:00:00Z' },
          ],
        })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);

    // Default sort is ascending ("Oldest first")
    const sortBtn = await screen.findByText('Oldest first');

    await userEvent.click(sortBtn);

    // After toggle, button label switches to "Newest first"
    expect(screen.getByText('Newest first')).toBeInTheDocument();
  });

  it('FE-COMP-MEMORIESPANEL-009: Photo picker opens when "Add photos" is clicked', async () => {
    server.use(
      ...connectedHandlers,
      http.post('/api/integrations/memories/immich/search', () =>
        HttpResponse.json({ assets: [] })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);

    // Wait for the empty gallery to load
    await screen.findByText('No photos found');

    // Both the header button and gallery CTA say "Add photos" — click the first
    const addBtns = screen.getAllByText('Add photos');
    await userEvent.click(addBtns[0]);

    // Picker header is now visible
    await screen.findByText('Select photos from Immich');
  });

  it('FE-COMP-MEMORIESPANEL-010: Picker cancel button closes the picker', async () => {
    server.use(
      ...connectedHandlers,
      http.post('/api/integrations/memories/immich/search', () =>
        HttpResponse.json({ assets: [] })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);

    await screen.findByText('No photos found');

    const addBtns = screen.getAllByText('Add photos');
    await userEvent.click(addBtns[0]);
    await screen.findByText('Select photos from Immich');

    // Click Cancel in the picker header
    await userEvent.click(screen.getByText('Cancel'));

    // Gallery is restored
    await screen.findByText('No photos found');
  });

  it('FE-COMP-MEMORIESPANEL-011: Album picker opens when "Link Album" is clicked', async () => {
    server.use(
      ...connectedHandlers,
      http.get('/api/integrations/memories/immich/albums', () =>
        HttpResponse.json({ albums: [] })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);

    await screen.findByText('No photos found');

    await userEvent.click(screen.getByText('Link Album'));

    // Album picker header appears
    await screen.findByText('Select Immich Album');
  });

  it('FE-COMP-MEMORIESPANEL-012: Own photos render with share-toggle and private indicator', async () => {
    server.use(
      ...connectedHandlers.filter(h => !h.info.path.includes('photos')),
      http.get('/api/integrations/memories/unified/trips/:tripId/photos', () =>
        HttpResponse.json({
          photos: [
            {
              asset_id: 'photo1',
              provider: 'immich',
              user_id: 1,
              username: 'me',
              shared: 0,
              added_at: '2025-03-05T10:00:00Z',
            },
          ],
        })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);

    // Share-toggle button appears with correct title (not shared → "Share photos")
    await screen.findByTitle('Share photos');

    // "Private" label is shown on unshared own photos
    expect(screen.getByText('Private')).toBeInTheDocument();
  });

  it('FE-COMP-MEMORIESPANEL-013: toggleSharing calls the PUT sharing endpoint', async () => {
    let putCalled = false;

    server.use(
      ...connectedHandlers.filter(h => !h.info.path.includes('photos')),
      http.get('/api/integrations/memories/unified/trips/:tripId/photos', () =>
        HttpResponse.json({
          photos: [
            {
              asset_id: 'photo1',
              provider: 'immich',
              user_id: 1,
              username: 'me',
              shared: 0,
              added_at: '2025-03-05T10:00:00Z',
            },
          ],
        })
      ),
      http.put('/api/integrations/memories/unified/trips/:tripId/photos/sharing', () => {
        putCalled = true;
        return HttpResponse.json({ ok: true });
      }),
    );

    render(<MemoriesPanel {...defaultProps} />);

    const shareBtn = await screen.findByTitle('Share photos');
    await userEvent.click(shareBtn);

    await waitFor(() => expect(putCalled).toBe(true));
  });

  it('FE-COMP-MEMORIESPANEL-014: removePhoto calls the DELETE photos endpoint', async () => {
    let deleteCalled = false;

    server.use(
      ...connectedHandlers.filter(h => !h.info.path.includes('photos')),
      http.get('/api/integrations/memories/unified/trips/:tripId/photos', () =>
        HttpResponse.json({
          photos: [
            {
              asset_id: 'photo1',
              provider: 'immich',
              user_id: 1,
              username: 'me',
              shared: 1,
              added_at: '2025-03-05T10:00:00Z',
            },
          ],
        })
      ),
      http.delete('/api/integrations/memories/unified/trips/:tripId/photos', () => {
        deleteCalled = true;
        return HttpResponse.json({ ok: true });
      }),
    );

    render(<MemoriesPanel {...defaultProps} />);

    // Wait for the share/stop-sharing button to confirm the gallery has rendered
    await screen.findByTitle('Stop sharing');

    // The remove button is the second action button in the hover overlay — no title, just an X icon
    // Get all buttons and click the one after the share toggle
    const allBtns = screen.getAllByRole('button');
    const shareIdx = allBtns.findIndex(b => b.getAttribute('title') === 'Stop sharing');
    // The remove button immediately follows the share button in the DOM
    await userEvent.click(allBtns[shareIdx + 1]);

    await waitFor(() => expect(deleteCalled).toBe(true));
  });

  it('FE-COMP-MEMORIESPANEL-015: Picker displays assets grouped by month', async () => {
    server.use(
      ...connectedHandlers,
      http.post('/api/integrations/memories/immich/search', () =>
        HttpResponse.json({
          assets: [
            { id: 'asset1', takenAt: '2025-03-05T10:00:00Z', city: 'Paris', country: 'France' },
          ],
        })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);
    await screen.findByText('No photos found');

    const [firstAddBtn] = screen.getAllByText('Add photos');
    await userEvent.click(firstAddBtn);

    await screen.findByText('Select photos from Immich');

    // Month group header appears after photos load
    await screen.findByText(/March.*2025|2025.*March/);
  });

  it('FE-COMP-MEMORIESPANEL-016: Album picker lists available albums with asset count', async () => {
    server.use(
      ...connectedHandlers,
      http.get('/api/integrations/memories/immich/albums', () =>
        HttpResponse.json({
          albums: [
            { id: 'album1', albumName: 'Summer 2025', assetCount: 42 },
          ],
        })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);
    await screen.findByText('No photos found');

    await userEvent.click(screen.getByText('Link Album'));

    await screen.findByText('Summer 2025');
    // Asset count is rendered next to the album name
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it('FE-COMP-MEMORIESPANEL-017: ProviderTabs appear in picker when multiple providers are connected', async () => {
    const immich2Addon = {
      id: 'immich2',
      name: 'Immich2',
      type: 'photo_provider',
      enabled: true,
      config: { status_get: '/integrations/memories/immich2/status' },
    };

    server.use(
      http.get('/api/addons', () =>
        HttpResponse.json({ addons: [immichAddon, immich2Addon] })
      ),
      http.get('/api/integrations/memories/immich/status', () => HttpResponse.json({ connected: true })),
      http.get('/api/integrations/memories/immich2/status', () => HttpResponse.json({ connected: true })),
      http.get('/api/integrations/memories/unified/trips/:tripId/photos', () => HttpResponse.json({ photos: [] })),
      http.get('/api/integrations/memories/unified/trips/:tripId/album-links', () => HttpResponse.json({ links: [] })),
      http.post('/api/integrations/memories/immich/search', () => HttpResponse.json({ assets: [] })),
      http.post('/api/integrations/memories/immich2/search', () => HttpResponse.json({ assets: [] })),
    );

    render(<MemoriesPanel {...defaultProps} />);
    await screen.findByText('No photos found');

    const [firstAddBtn] = screen.getAllByText('Add photos');
    await userEvent.click(firstAddBtn);

    // With multiple providers the picker header uses the "multiple" translation
    await screen.findByText('Select Photos');

    // Both provider name tabs are rendered inside the picker
    expect(screen.getByRole('button', { name: 'Immich' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Immich2' })).toBeInTheDocument();
  });

  it('FE-COMP-MEMORIESPANEL-018: Location filter dropdown appears when photos have multiple cities', async () => {
    server.use(
      ...connectedHandlers.filter(h => !h.info.path.includes('photos')),
      http.get('/api/integrations/memories/unified/trips/:tripId/photos', () =>
        HttpResponse.json({
          photos: [
            { asset_id: 'p1', provider: 'immich', user_id: 1, username: 'me', shared: 1, added_at: '2025-03-01T00:00:00Z', city: 'Paris' },
            { asset_id: 'p2', provider: 'immich', user_id: 1, username: 'me', shared: 1, added_at: '2025-03-05T00:00:00Z', city: 'Lyon' },
          ],
        })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);

    // Location dropdown shows "All locations" option when there are 2+ distinct cities
    await screen.findByText('All locations');
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('FE-COMP-MEMORIESPANEL-019: Full picker flow: select photo → confirm dialog → execute add', async () => {
    let addPhotosCalled = false;

    server.use(
      ...connectedHandlers,
      http.post('/api/integrations/memories/immich/search', () =>
        HttpResponse.json({
          assets: [
            { id: 'asset1', takenAt: '2025-03-05T10:00:00Z', city: null, country: null },
          ],
        })
      ),
      http.post('/api/integrations/memories/unified/trips/:tripId/photos', () => {
        addPhotosCalled = true;
        return HttpResponse.json({ ok: true });
      }),
    );

    render(<MemoriesPanel {...defaultProps} />);
    await screen.findByText('No photos found');

    const [firstAddBtn] = screen.getAllByText('Add photos');
    await userEvent.click(firstAddBtn);

    await screen.findByText('Select photos from Immich');

    // Wait for the picker asset thumbnail to render (ProviderImg sets src after blob resolves)
    // img has alt="" so findByRole('img') won't work — use findByAltText instead
    const thumbnail = await screen.findByAltText('');

    // Click the thumbnail — bubbles up to the parent div's onClick to select it
    await userEvent.click(thumbnail);

    // "1 selected" count appears and "Add 1 photos" button is active
    await screen.findByText(/1\s+selected/);
    await userEvent.click(screen.getByText('Add 1 photos'));

    // Confirm share dialog appears
    await screen.findByText('Share with trip members?');

    // Click the confirm "Share photos" button to execute
    await userEvent.click(screen.getByText('Share photos'));

    await waitFor(() => expect(addPhotosCalled).toBe(true));
  });

  it('FE-COMP-MEMORIESPANEL-020: "All photos" filter tab makes an unfiltered search', async () => {
    let searchCount = 0;

    server.use(
      ...connectedHandlers,
      http.post('/api/integrations/memories/immich/search', () => {
        searchCount++;
        return HttpResponse.json({ assets: [] });
      }),
    );

    render(<MemoriesPanel {...defaultProps} />);
    await screen.findByText('No photos found');

    const [firstAddBtn] = screen.getAllByText('Add photos');
    await userEvent.click(firstAddBtn);

    await screen.findByText('Select photos from Immich');

    // Click "All photos" — triggers a second loadPickerPhotos(false) call
    await userEvent.click(screen.getByText('All photos'));

    await waitFor(() => expect(searchCount).toBeGreaterThan(1));
  });

  it('FE-COMP-MEMORIESPANEL-021: Picker with no trip dates shows only "All photos" tab', async () => {
    server.use(
      ...connectedHandlers,
      http.post('/api/integrations/memories/immich/search', () =>
        HttpResponse.json({ assets: [] })
      ),
    );

    render(<MemoriesPanel tripId={1} startDate={null} endDate={null} />);

    await screen.findByText('No photos found');

    const [firstAddBtn] = screen.getAllByText('Add photos');
    await userEvent.click(firstAddBtn);

    await screen.findByText('Select photos from Immich');

    // "Trip dates" tab is absent when dates are not set
    expect(screen.queryByText(/Trip dates/)).not.toBeInTheDocument();
    expect(screen.getByText('All photos')).toBeInTheDocument();
  });

  it('FE-COMP-MEMORIESPANEL-022: Provider with no status_get URL shows not-connected', async () => {
    server.use(
      http.get('/api/addons', () =>
        HttpResponse.json({
          addons: [
            { id: 'myapp', name: 'MyApp', type: 'photo_provider', enabled: true, config: {} },
          ],
        })
      ),
      http.get('/api/integrations/memories/unified/trips/:tripId/photos', () =>
        HttpResponse.json({ photos: [] })
      ),
      http.get('/api/integrations/memories/unified/trips/:tripId/album-links', () =>
        HttpResponse.json({ links: [] })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);

    // Provider name shown in the not-connected message when exactly 1 enabled provider
    await screen.findByText('MyApp not connected');
  });

  it('FE-COMP-MEMORIESPANEL-023: Picker marks already-added photos with "Added" overlay', async () => {
    server.use(
      ...connectedHandlers.filter(h => !h.info.path.includes('photos')),
      http.get('/api/integrations/memories/unified/trips/:tripId/photos', () =>
        HttpResponse.json({
          photos: [
            {
              asset_id: 'asset1',
              provider: 'immich',
              user_id: 1,
              username: 'me',
              shared: 1,
              added_at: '2025-03-05T10:00:00Z',
            },
          ],
        })
      ),
      http.post('/api/integrations/memories/immich/search', () =>
        HttpResponse.json({
          assets: [
            { id: 'asset1', takenAt: '2025-03-05T10:00:00Z', city: null, country: null },
          ],
        })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);

    // Gallery shows own photo — "Stop sharing" title confirms it's loaded
    await screen.findByTitle('Stop sharing');

    // Open picker from the header button (only 1 "Add photos" button since photos > 0)
    await userEvent.click(screen.getByText('Add photos'));
    await screen.findByText('Select photos from Immich');

    // The asset already in the gallery shows the "Added" overlay in the picker
    await screen.findByText('Added');
  });

  it('FE-COMP-MEMORIESPANEL-024: Location filter select filters the visible photos', async () => {
    server.use(
      ...connectedHandlers.filter(h => !h.info.path.includes('photos')),
      http.get('/api/integrations/memories/unified/trips/:tripId/photos', () =>
        HttpResponse.json({
          photos: [
            { asset_id: 'p1', provider: 'immich', user_id: 1, username: 'me', shared: 1, added_at: '2025-03-01T00:00:00Z', city: 'Paris' },
            { asset_id: 'p2', provider: 'immich', user_id: 1, username: 'me', shared: 1, added_at: '2025-03-05T00:00:00Z', city: 'Lyon' },
          ],
        })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);

    const select = await screen.findByRole('combobox');

    // Change filter to a specific city
    await userEvent.selectOptions(select, 'Paris');

    expect(select).toHaveValue('Paris');
  });

  it("FE-COMP-MEMORIESPANEL-025: Album link from another user shows username but no unlink button", async () => {
    server.use(
      ...connectedHandlers.filter(h => !h.info.path.includes('album-links')),
      http.get('/api/integrations/memories/unified/trips/:tripId/album-links', () =>
        HttpResponse.json({
          links: [
            {
              id: 1,
              provider: 'immich',
              album_id: 'a1',
              album_name: 'Holidays',
              user_id: 2,
              username: 'Alice',
              sync_enabled: 1,
              last_synced_at: null,
            },
          ],
        })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);

    await screen.findByText('Holidays');

    // Other user's username is shown in parentheses
    expect(screen.getByText('(Alice)')).toBeInTheDocument();

    // Unlink button is NOT shown for another user's album link
    expect(screen.queryByTitle('Unlink album')).not.toBeInTheDocument();
  });

  it('FE-COMP-MEMORIESPANEL-026: Linking an album calls the album-links POST endpoint', async () => {
    let linkCalled = false;
    // Track whether POST has been made so the GET can return different data
    let albumLinked = false;

    server.use(
      ...connectedHandlers.filter(h => !h.info.path.includes('album-links')),
      http.get('/api/integrations/memories/immich/albums', () =>
        HttpResponse.json({
          albums: [{ id: 'album1', albumName: 'Summer 2025', assetCount: 10 }],
        })
      ),
      http.post('/api/integrations/memories/unified/trips/:tripId/album-links', () => {
        linkCalled = true;
        albumLinked = true;
        return HttpResponse.json({ ok: true });
      }),
      // Return empty before POST, linked album after POST
      http.get('/api/integrations/memories/unified/trips/:tripId/album-links', () => {
        if (!albumLinked) return HttpResponse.json({ links: [] });
        return HttpResponse.json({
          links: [{ id: 1, provider: 'immich', album_id: 'album1', album_name: 'Summer 2025', user_id: 1, username: 'me', sync_enabled: 1, last_synced_at: null }],
        });
      }),
      http.post('/api/integrations/memories/:provider/trips/:tripId/album-links/:linkId/sync', () =>
        HttpResponse.json({ ok: true })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);
    await screen.findByText('No photos found');

    await userEvent.click(screen.getByText('Link Album'));
    await screen.findByText('Summer 2025');

    // Click the album button to link it (album is not yet linked → button is enabled)
    await userEvent.click(screen.getByText('Summer 2025'));

    await waitFor(() => expect(linkCalled).toBe(true));
  });

  it('FE-COMP-MEMORIESPANEL-027: Album picker cancel button returns to the gallery', async () => {
    server.use(
      ...connectedHandlers,
      http.get('/api/integrations/memories/immich/albums', () =>
        HttpResponse.json({ albums: [] })
      ),
    );

    render(<MemoriesPanel {...defaultProps} />);
    await screen.findByText('No photos found');

    await userEvent.click(screen.getByText('Link Album'));
    await screen.findByText('Select Immich Album');

    // Click Cancel to dismiss without linking
    await userEvent.click(screen.getByText('Cancel'));

    // Gallery is restored
    await screen.findByText('No photos found');
  });
});
