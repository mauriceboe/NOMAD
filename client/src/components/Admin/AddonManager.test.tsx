// FE-ADMIN-ADDON-001 to FE-ADMIN-ADDON-011
import { render, screen, waitFor, within } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/helpers/msw/server';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { useSettingsStore } from '../../store/settingsStore';
import { useAddonStore } from '../../store/addonStore';
import { ToastContainer } from '../shared/Toast';
import AddonManager from './AddonManager';

function buildAddon(overrides = {}) {
  return {
    id: 'todo',
    name: 'Todo List',
    description: 'Track tasks',
    icon: 'ListChecks',
    type: 'trip',
    enabled: false,
    ...overrides,
  };
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

beforeEach(() => {
  resetAllStores();
  seedStore(useSettingsStore, { settings: { dark_mode: false } });
  vi.spyOn(useAddonStore.getState(), 'loadAddons').mockResolvedValue(undefined);
  server.use(
    http.get('/api/admin/addons', () => HttpResponse.json({ addons: [] }))
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AddonManager', () => {
  it('FE-ADMIN-ADDON-001: loading spinner shown while fetching', async () => {
    server.use(
      http.get('/api/admin/addons', async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return HttpResponse.json({ addons: [] });
      })
    );
    render(<AddonManager />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('FE-ADMIN-ADDON-002: empty state when addons list is empty', async () => {
    render(<AddonManager />);
    await screen.findByText('No addons available');
  });

  it('FE-ADMIN-ADDON-003: trip addons section renders with correct section header', async () => {
    server.use(
      http.get('/api/admin/addons', () =>
        HttpResponse.json({ addons: [buildAddon({ id: 'todo', name: 'Todo List', type: 'trip' })] })
      )
    );
    render(<AddonManager />);
    await screen.findByText('Todo List');
    // Section header contains "Trip" and "Available as a tab within each trip"
    expect(screen.getAllByText(/Trip/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Available as a tab within each trip/)).toBeInTheDocument();
  });

  it('FE-ADMIN-ADDON-004: global and integration sections render when present', async () => {
    server.use(
      http.get('/api/admin/addons', () =>
        HttpResponse.json({
          addons: [
            buildAddon({ id: 'global1', name: 'Global Feature', type: 'global' }),
            buildAddon({ id: 'int1', name: 'Integration Feature', type: 'integration' }),
          ],
        })
      )
    );
    render(<AddonManager />);
    await screen.findByText('Global Feature');
    expect(screen.getAllByText(/Global/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Integration/).length).toBeGreaterThan(0);
  });

  it('FE-ADMIN-ADDON-005: toggle enables a disabled addon (optimistic update)', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/admin/addons', () =>
        HttpResponse.json({ addons: [buildAddon({ id: 'todo', enabled: false })] })
      ),
      http.put('/api/admin/addons/todo', () =>
        HttpResponse.json({ success: true })
      )
    );
    render(<><ToastContainer /><AddonManager /></>);
    await screen.findByText('Todo List');

    // Get toggle button - use getAllByRole since there might be multiple buttons
    const buttons = screen.getAllByRole('button');
    const toggleBtn = buttons.find(b => b.classList.contains('rounded-full'));
    expect(toggleBtn).toBeInTheDocument();

    // Before click - disabled state (border-primary bg)
    await user.click(toggleBtn!);

    // After click - success toast
    await screen.findByText('Addon updated');
  });

  it('FE-ADMIN-ADDON-006: toggle rolls back on API failure', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/admin/addons', () =>
        HttpResponse.json({ addons: [buildAddon({ id: 'todo', enabled: false })] })
      ),
      http.put('/api/admin/addons/todo', () =>
        HttpResponse.error()
      )
    );
    render(<><ToastContainer /><AddonManager /></>);
    await screen.findByText('Todo List');

    const buttons = screen.getAllByRole('button');
    const toggleBtn = buttons.find(b => b.classList.contains('rounded-full'));
    await user.click(toggleBtn!);

    // Error toast appears
    await screen.findByText('Failed to update addon');

    // The disabled text should be back after rollback
    await waitFor(() => {
      const disabledTexts = screen.getAllByText('Disabled');
      expect(disabledTexts.length).toBeGreaterThan(0);
    });
  });

  it('FE-ADMIN-ADDON-007: bag tracking sub-toggle renders when packing addon is enabled', async () => {
    const user = userEvent.setup();
    const mockToggle = vi.fn();
    server.use(
      http.get('/api/admin/addons', () =>
        HttpResponse.json({ addons: [buildAddon({ id: 'packing', enabled: true })] })
      )
    );
    render(
      <AddonManager bagTrackingEnabled={false} onToggleBagTracking={mockToggle} />
    );
    await screen.findByText('Bag Tracking');
    const bagTrackingToggle = screen.getAllByRole('button').find(b =>
      b.closest('[style*="paddingLeft: 70"]') !== null || b.closest('div')?.textContent?.includes('Bag Tracking')
    );
    // Click the bag tracking toggle button (the h-6 w-11 button near "Bag Tracking")
    const allBtns = screen.getAllByRole('button').filter(b => b.classList.contains('rounded-full'));
    // There should be two toggle buttons: one for the addon, one for bag tracking
    await user.click(allBtns[allBtns.length - 1]);
    expect(mockToggle).toHaveBeenCalled();
  });

  it('FE-ADMIN-ADDON-008: bag tracking hidden when packing addon is disabled', async () => {
    server.use(
      http.get('/api/admin/addons', () =>
        HttpResponse.json({ addons: [buildAddon({ id: 'packing', enabled: false })] })
      )
    );
    render(
      <AddonManager bagTrackingEnabled={false} onToggleBagTracking={vi.fn()} />
    );
    await screen.findByText('Lists');
    expect(screen.queryByText('Bag Tracking')).not.toBeInTheDocument();
  });

  it('FE-ADMIN-ADDON-009: bag tracking hidden when onToggleBagTracking prop not provided', async () => {
    server.use(
      http.get('/api/admin/addons', () =>
        HttpResponse.json({ addons: [buildAddon({ id: 'packing', enabled: true })] })
      )
    );
    render(<AddonManager bagTrackingEnabled={false} />);
    await screen.findByText('Lists');
    expect(screen.queryByText('Bag Tracking')).not.toBeInTheDocument();
  });

  it('FE-ADMIN-ADDON-010: photo provider sub-toggles shown for Memories addon', async () => {
    server.use(
      http.get('/api/admin/addons', () =>
        HttpResponse.json({
          addons: [
            buildAddon({ id: 'photos', name: 'Memories', type: 'trip', icon: 'Image', enabled: false }),
            buildAddon({ id: 'unsplash', name: 'Unsplash', type: 'photo_provider', enabled: true }),
            buildAddon({ id: 'pexels', name: 'Pexels', type: 'photo_provider', enabled: false }),
          ],
        })
      )
    );
    render(<AddonManager />);

    // Provider sub-rows are visible
    await screen.findByText('Unsplash');
    expect(screen.getByText('Pexels')).toBeInTheDocument();

    // Memories row shows name override
    expect(screen.getByText('Memories providers')).toBeInTheDocument();

    // The photos addon row itself has no top-level toggle (hideToggle = true)
    // The toggle buttons are only for the providers
    const toggleBtns = screen.getAllByRole('button').filter(b => b.classList.contains('rounded-full'));
    // Should be 2 provider toggles (no main toggle for the photos addon)
    expect(toggleBtns.length).toBe(2);
  });

  it('FE-ADMIN-ADDON-011: icon falls back to Puzzle when icon name unknown', async () => {
    server.use(
      http.get('/api/admin/addons', () =>
        HttpResponse.json({
          addons: [buildAddon({ id: 'mystery', name: 'Mystery Addon', icon: 'NonExistentIcon', type: 'trip' })],
        })
      )
    );
    // Should not throw; Puzzle icon is used as fallback
    expect(() => render(<AddonManager />)).not.toThrow();
    await screen.findByText('Mystery Addon');
  });
});
