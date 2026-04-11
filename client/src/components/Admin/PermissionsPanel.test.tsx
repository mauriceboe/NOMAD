// FE-ADMIN-PERM-001 to FE-ADMIN-PERM-010
import { render, screen, waitFor } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/helpers/msw/server';
import { resetAllStores } from '../../../tests/helpers/store';
import { ToastContainer } from '../shared/Toast';
import PermissionsPanel from './PermissionsPanel';

// ── Fixture ───────────────────────────────────────────────────────────────────

const ALLOWED = ['admin', 'trip_owner', 'trip_member', 'everybody'] as const;

function buildPermission(key: string, level = 'trip_member', defaultLevel = 'trip_member') {
  return { key, level, defaultLevel, allowedLevels: [...ALLOWED] };
}

const SAMPLE_PERMISSIONS = [
  buildPermission('trip_create'),
  buildPermission('trip_edit'),
  buildPermission('trip_delete'),
  buildPermission('trip_archive'),
  buildPermission('trip_cover_upload'),
  buildPermission('member_manage'),
  buildPermission('file_upload'),
  buildPermission('file_edit'),
  buildPermission('file_delete'),
  buildPermission('place_edit'),
  buildPermission('day_edit'),
  buildPermission('reservation_edit'),
  buildPermission('budget_edit'),
  buildPermission('packing_edit'),
  buildPermission('collab_edit'),
  buildPermission('share_manage'),
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPanel() {
  return render(
    <>
      <ToastContainer />
      <PermissionsPanel />
    </>,
  );
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetAllStores();
  // Override the default handler (returns object) with correct array shape
  server.use(
    http.get('/api/admin/permissions', () =>
      HttpResponse.json({ permissions: SAMPLE_PERMISSIONS }),
    ),
  );
});

afterEach(() => {
  server.resetHandlers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PermissionsPanel', () => {
  it('FE-ADMIN-PERM-001: loading spinner renders before data arrives', () => {
    server.use(
      http.get('/api/admin/permissions', async () => {
        await new Promise(() => {}); // never resolves
        return HttpResponse.json({ permissions: [] });
      }),
    );
    renderPanel();
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    // The form content (category headings) should not be present
    expect(screen.queryByText('Trip Management')).not.toBeInTheDocument();
  });

  it('FE-ADMIN-PERM-002: permission categories and actions render after load', async () => {
    renderPanel();
    // Wait until loading is done — a category heading appears
    await screen.findByText('Trip Management');
    expect(screen.getByText('Member Management')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('Content & Schedule')).toBeInTheDocument();
    expect(screen.getByText('Budget, Packing & Collaboration')).toBeInTheDocument();
    expect(screen.getByText('Create trips')).toBeInTheDocument();
    expect(screen.getByText('Add / remove members')).toBeInTheDocument();
  });

  it('FE-ADMIN-PERM-003: "customized" badge visible when value differs from default', async () => {
    const perms = [
      buildPermission('trip_create', 'admin', 'trip_member'), // level ≠ default → badge
      buildPermission('trip_edit', 'trip_member', 'trip_member'), // level === default → no badge
    ];
    server.use(
      http.get('/api/admin/permissions', () =>
        HttpResponse.json({ permissions: perms }),
      ),
    );
    renderPanel();
    await screen.findByText('Trip Management');
    // Badge should appear once (for trip_create)
    expect(screen.getByText('customized')).toBeInTheDocument();
    expect(screen.getAllByText('customized')).toHaveLength(1);
  });

  it('FE-ADMIN-PERM-004: Save button is disabled until a value changes', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Trip Management');

    const saveButton = screen.getByRole('button', { name: /^Save$/i });
    expect(saveButton).toBeDisabled();

    // Open the first CustomSelect trigger (shows current level "Trip members")
    const triggers = screen.getAllByRole('button', { name: /Trip members/i });
    await user.click(triggers[0]);

    // Pick an option different from the current one (current is trip_member → pick admin)
    const adminOption = await screen.findByText('Admin only');
    await user.click(adminOption);

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
  });

  it('FE-ADMIN-PERM-005: changing a value marks form dirty and enables Save', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Trip Management');

    const saveButton = screen.getByRole('button', { name: /^Save$/i });
    expect(saveButton).toBeDisabled();

    // Open first CustomSelect dropdown and select a different option
    const triggers = screen.getAllByRole('button', { name: /Trip members/i });
    await user.click(triggers[0]);
    const adminOption = await screen.findByText('Admin only');
    await user.click(adminOption);

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
  });

  it('FE-ADMIN-PERM-006: Reset button restores values to defaultLevel and enables Save', async () => {
    const perms = [
      buildPermission('trip_create', 'admin', 'trip_member'), // customized
      ...SAMPLE_PERMISSIONS.filter(p => p.key !== 'trip_create'),
    ];
    server.use(
      http.get('/api/admin/permissions', () =>
        HttpResponse.json({ permissions: perms }),
      ),
    );
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Trip Management');

    // Customized badge should be visible
    expect(screen.getByText('customized')).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: /^Save$/i });
    const resetButton = screen.getByRole('button', { name: /Reset to defaults/i });

    await user.click(resetButton);

    // Badge should disappear (value back to defaultLevel)
    await waitFor(() => {
      expect(screen.queryByText('customized')).not.toBeInTheDocument();
    });

    // Save should be enabled (handleReset sets dirty=true)
    expect(saveButton).not.toBeDisabled();
  });

  it('FE-ADMIN-PERM-007: successful save calls PUT and shows success toast', async () => {
    server.use(
      http.put('/api/admin/permissions', () =>
        HttpResponse.json({ permissions: SAMPLE_PERMISSIONS }),
      ),
    );
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Trip Management');

    // Dirty the form
    const triggers = screen.getAllByRole('button', { name: /Trip members/i });
    await user.click(triggers[0]);
    const adminOption = await screen.findByText('Admin only');
    await user.click(adminOption);

    const saveButton = screen.getByRole('button', { name: /^Save$/i });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    await user.click(saveButton);

    await screen.findByText('Permission settings saved');
    // After successful save, dirty is cleared → Save disabled again
    await waitFor(() => expect(saveButton).toBeDisabled());
  });

  it('FE-ADMIN-PERM-008: failed save shows error toast and keeps Save enabled', async () => {
    server.use(
      http.put('/api/admin/permissions', () =>
        HttpResponse.json({ error: 'server error' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Trip Management');

    // Dirty the form
    const triggers = screen.getAllByRole('button', { name: /Trip members/i });
    await user.click(triggers[0]);
    const adminOption = await screen.findByText('Admin only');
    await user.click(adminOption);

    const saveButton = screen.getByRole('button', { name: /^Save$/i });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    await user.click(saveButton);

    await screen.findByText('Error');
    // Dirty unchanged → Save stays enabled
    expect(saveButton).not.toBeDisabled();
  });

  it('FE-ADMIN-PERM-009: Save button is disabled while save is in-flight', async () => {
    let resolvePut!: () => void;
    server.use(
      http.put('/api/admin/permissions', () =>
        new Promise<Response>(resolve => {
          resolvePut = () =>
            resolve(HttpResponse.json({ permissions: SAMPLE_PERMISSIONS }) as unknown as Response);
        }),
      ),
    );
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Trip Management');

    // Dirty the form
    const triggers = screen.getAllByRole('button', { name: /Trip members/i });
    await user.click(triggers[0]);
    const adminOption = await screen.findByText('Admin only');
    await user.click(adminOption);

    const saveButton = screen.getByRole('button', { name: /^Save$/i });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    await user.click(saveButton);

    // In-flight: button should be disabled and show Loader2 spinner
    await waitFor(() => expect(saveButton).toBeDisabled());
    const loader = saveButton.querySelector('.animate-spin');
    expect(loader).toBeInTheDocument();

    // Resolve the request
    resolvePut();
    await screen.findByText('Permission settings saved');
  });

  it('FE-ADMIN-PERM-010: load failure shows error toast', async () => {
    server.use(
      http.get('/api/admin/permissions', () =>
        HttpResponse.json({ error: 'server error' }, { status: 500 }),
      ),
    );
    renderPanel();
    await screen.findByText('Error');
  });
});
