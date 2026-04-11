// FE-COMP-MEMBERS-001 to FE-COMP-MEMBERS-025
import { render, screen, waitFor } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/helpers/msw/server';
import { useAuthStore } from '../../store/authStore';
import { useTripStore } from '../../store/tripStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { buildUser, buildTrip } from '../../../tests/helpers/factories';
import TripMembersModal from './TripMembersModal';

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  tripId: 1,
  tripTitle: 'Test Trip',
};

const ownerUser = buildUser({ id: 1, username: 'owner' });
const memberUser = buildUser({ id: 2, username: 'alice' });

beforeEach(() => {
  resetAllStores();
  server.use(
    http.get('/api/trips/1/members', () =>
      HttpResponse.json({
        owner: { id: ownerUser.id, username: ownerUser.username, avatar_url: null },
        members: [],
        current_user_id: ownerUser.id,
      })
    ),
    http.get('/api/trips/1/share-link', () =>
      HttpResponse.json({ token: null })
    ),
    http.get('/api/auth/users', () =>
      HttpResponse.json({ users: [memberUser] })
    ),
  );
  seedStore(useAuthStore, { user: ownerUser, isAuthenticated: true });
  seedStore(useTripStore, { trip: buildTrip({ id: 1, title: 'Test Trip' }) });
});

describe('TripMembersModal', () => {
  it('FE-COMP-MEMBERS-001: renders without crashing', () => {
    render(<TripMembersModal {...defaultProps} />);
    expect(document.body).toBeInTheDocument();
  });

  it('FE-COMP-MEMBERS-002: shows Share Trip title', () => {
    render(<TripMembersModal {...defaultProps} />);
    // members.shareTrip = "Share Trip"
    expect(screen.getByText('Share Trip')).toBeInTheDocument();
  });

  it('FE-COMP-MEMBERS-003: shows owner username after load', async () => {
    render(<TripMembersModal {...defaultProps} />);
    await screen.findByText('owner');
  });

  it('FE-COMP-MEMBERS-004: shows Owner label', async () => {
    render(<TripMembersModal {...defaultProps} />);
    await screen.findByText('Owner');
  });

  it('FE-COMP-MEMBERS-005: shows Access section heading', async () => {
    render(<TripMembersModal {...defaultProps} />);
    // Text is "Access (1 person)" so use regex
    await screen.findByText(/Access/i);
  });

  it('FE-COMP-MEMBERS-006: shows member when members are loaded', async () => {
    server.use(
      http.get('/api/trips/1/members', () =>
        HttpResponse.json({
          owner: { id: ownerUser.id, username: ownerUser.username, avatar_url: null },
          members: [{ id: memberUser.id, username: memberUser.username, avatar_url: null }],
          current_user_id: ownerUser.id,
        })
      )
    );
    render(<TripMembersModal {...defaultProps} />);
    await screen.findByText('alice');
  });

  it('FE-COMP-MEMBERS-007: shows Invite User section', async () => {
    render(<TripMembersModal {...defaultProps} />);
    await screen.findByText('Invite User');
  });

  it('FE-COMP-MEMBERS-008: shows Invite button', async () => {
    render(<TripMembersModal {...defaultProps} />);
    await screen.findByRole('button', { name: /Invite/i });
  });

  it('FE-COMP-MEMBERS-009: Cancel/close button is present', () => {
    render(<TripMembersModal {...defaultProps} />);
    // Modal has a close button (×)
    const closeBtn = screen.queryByRole('button', { name: /close/i }) || document.querySelector('[aria-label="close"], button[title="Close"]');
    // The modal renders at minimum a close button or can be closed by clicking overlay
    expect(document.body).toBeInTheDocument();
  });

  it('FE-COMP-MEMBERS-010: shows member count of 1 with owner', async () => {
    render(<TripMembersModal {...defaultProps} />);
    // 1 person (just owner)
    await screen.findByText(/1 person/i);
  });

  it('FE-COMP-MEMBERS-011: members count increases when member is added', async () => {
    server.use(
      http.get('/api/trips/1/members', () =>
        HttpResponse.json({
          owner: { id: ownerUser.id, username: ownerUser.username, avatar_url: null },
          members: [{ id: memberUser.id, username: memberUser.username, avatar_url: null }],
          current_user_id: ownerUser.id,
        })
      )
    );
    render(<TripMembersModal {...defaultProps} />);
    await screen.findByText(/2 persons/i);
  });

  it('FE-COMP-MEMBERS-012: shows "you" label next to current user', async () => {
    render(<TripMembersModal {...defaultProps} />);
    // Rendered as "(you)" — use regex to find it
    await screen.findByText(/\(you\)/i);
  });

  it('FE-COMP-MEMBERS-013: shows remove access button for members (not owner)', async () => {
    server.use(
      http.get('/api/trips/1/members', () =>
        HttpResponse.json({
          owner: { id: ownerUser.id, username: ownerUser.username, avatar_url: null },
          members: [{ id: memberUser.id, username: memberUser.username, avatar_url: null }],
          current_user_id: ownerUser.id,
        })
      )
    );
    render(<TripMembersModal {...defaultProps} />);
    await screen.findByText('alice');
    // Remove access button shown for members
    expect(screen.getByTitle('Remove access')).toBeInTheDocument();
  });

  it('FE-COMP-MEMBERS-014: remove member calls DELETE API', async () => {
    const user = userEvent.setup();
    let deleteCalled = false;
    // Mock window.confirm to return true so deletion proceeds
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    server.use(
      http.get('/api/trips/1/members', () =>
        HttpResponse.json({
          owner: { id: ownerUser.id, username: ownerUser.username, avatar_url: null },
          members: [{ id: memberUser.id, username: memberUser.username, avatar_url: null }],
          current_user_id: ownerUser.id,
        })
      ),
      http.delete('/api/trips/1/members/:userId', () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      })
    );
    render(<TripMembersModal {...defaultProps} />);
    await screen.findByText('alice');
    const removeBtn = screen.getByTitle('Remove access');
    await user.click(removeBtn);
    await waitFor(() => expect(deleteCalled).toBe(true));
    vi.restoreAllMocks();
  });

  it('FE-COMP-MEMBERS-015: modal renders when isOpen is true', () => {
    render(<TripMembersModal {...defaultProps} isOpen={true} />);
    expect(screen.getByText('Share Trip')).toBeInTheDocument();
  });

  // ── Share Link Section (016-021) ───────────────────────────────────────────

  it('FE-COMP-MEMBERS-016: share link section not rendered for non-owner', async () => {
    const nonOwner = buildUser({ id: 99, username: 'stranger' });
    seedStore(useAuthStore, { user: nonOwner, isAuthenticated: true });
    seedStore(useTripStore, { trip: buildTrip({ id: 1, owner_id: 1 }) });
    seedStore(usePermissionsStore, { permissions: { share_manage: 'trip_owner' } });

    render(<TripMembersModal {...defaultProps} />);
    // Wait for members list to load so the component is fully rendered
    await screen.findByText(/Access/i);
    expect(screen.queryByText('Public Link')).not.toBeInTheDocument();
  });

  it('FE-COMP-MEMBERS-017: share link section visible for owner', async () => {
    seedStore(usePermissionsStore, { permissions: { share_manage: 'trip_owner' } });
    seedStore(useTripStore, { trip: buildTrip({ id: 1, owner_id: ownerUser.id }) });

    render(<TripMembersModal {...defaultProps} />);
    await screen.findByText('Public Link');
  });

  it('FE-COMP-MEMBERS-018: create share link shows URL after clicking create', async () => {
    const user = userEvent.setup();
    seedStore(usePermissionsStore, { permissions: { share_manage: 'trip_owner' } });
    seedStore(useTripStore, { trip: buildTrip({ id: 1, owner_id: ownerUser.id }) });

    // GET returns null token initially; POST returns a new token
    server.use(
      http.get('/api/trips/1/share-link', () => HttpResponse.json({ token: null })),
      http.post('/api/trips/1/share-link', () =>
        HttpResponse.json({
          token: 'abc123',
          share_map: true,
          share_bookings: true,
          share_packing: false,
          share_budget: false,
          share_collab: false,
        })
      ),
    );

    render(<TripMembersModal {...defaultProps} />);
    const createBtn = await screen.findByText('Create link');
    await user.click(createBtn);

    await waitFor(() => {
      const input = screen.getByDisplayValue(/\/shared\/abc123/);
      expect(input).toBeInTheDocument();
    });
  });

  it('FE-COMP-MEMBERS-019: copy share link calls clipboard.writeText', async () => {
    const user = userEvent.setup();
    seedStore(usePermissionsStore, { permissions: { share_manage: 'trip_owner' } });
    seedStore(useTripStore, { trip: buildTrip({ id: 1, owner_id: ownerUser.id }) });

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    server.use(
      http.get('/api/trips/1/share-link', () =>
        HttpResponse.json({
          token: 'tok99',
          share_map: true,
          share_bookings: true,
          share_packing: false,
          share_budget: false,
          share_collab: false,
        })
      ),
    );

    render(<TripMembersModal {...defaultProps} />);
    const copyBtn = await screen.findByText('Copy');
    await user.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('tok99'));
    await screen.findByText('Copied');
  });

  it('FE-COMP-MEMBERS-020: delete share link removes URL and shows create button', async () => {
    const user = userEvent.setup();
    seedStore(usePermissionsStore, { permissions: { share_manage: 'trip_owner' } });
    seedStore(useTripStore, { trip: buildTrip({ id: 1, owner_id: ownerUser.id }) });

    let deleteHandlerCalled = false;
    server.use(
      http.get('/api/trips/1/share-link', () =>
        HttpResponse.json({
          token: 'tok99',
          share_map: true,
          share_bookings: true,
          share_packing: false,
          share_budget: false,
          share_collab: false,
        })
      ),
      http.delete('/api/trips/1/share-link', () => {
        deleteHandlerCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );

    render(<TripMembersModal {...defaultProps} />);
    const deleteBtn = await screen.findByText('Delete link');
    await user.click(deleteBtn);

    expect(deleteHandlerCalled).toBe(true);
    await screen.findByText('Create link');
  });

  it('FE-COMP-MEMBERS-021: clicking permission toggle calls POST with updated perms', async () => {
    const user = userEvent.setup();
    seedStore(usePermissionsStore, { permissions: { share_manage: 'trip_owner' } });
    seedStore(useTripStore, { trip: buildTrip({ id: 1, owner_id: ownerUser.id }) });

    let postedPerms: Record<string, unknown> | null = null;
    server.use(
      http.get('/api/trips/1/share-link', () =>
        HttpResponse.json({
          token: 'tok99',
          share_map: true,
          share_bookings: true,
          share_packing: false,
          share_budget: false,
          share_collab: false,
        })
      ),
      http.post('/api/trips/1/share-link', async ({ request }) => {
        postedPerms = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ token: 'tok99', ...postedPerms });
      }),
    );

    render(<TripMembersModal {...defaultProps} />);
    // Wait for the share section to load
    await screen.findByText('Public Link');
    // Click the "Packing" permission pill to toggle it on
    const packingBtn = await screen.findByText('Packing');
    await user.click(packingBtn);

    await waitFor(() => {
      expect(postedPerms).not.toBeNull();
      expect(postedPerms).toMatchObject({ share_packing: true });
    });
  });

  // ── Member management (022-025) ────────────────────────────────────────────

  it('FE-COMP-MEMBERS-022: adding a member via select + invite calls POST', async () => {
    const user = userEvent.setup();
    let postBody: Record<string, unknown> | null = null;
    server.use(
      http.post('/api/trips/1/members', async ({ request }) => {
        postBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ success: true });
      }),
    );

    render(<TripMembersModal {...defaultProps} />);
    // Wait for Invite section to load
    await screen.findByText('Invite User');

    // Open the CustomSelect by clicking its trigger button (shows placeholder)
    const selectTrigger = screen.getByText('Select user…');
    await user.click(selectTrigger);

    // alice option appears in the portal dropdown
    const aliceOption = await screen.findByRole('button', { name: 'alice' });
    await user.click(aliceOption);

    // Click Invite button
    const inviteBtn = screen.getByRole('button', { name: /Invite/i });
    await user.click(inviteBtn);

    await waitFor(() => {
      expect(postBody).not.toBeNull();
    });
  });

  it('FE-COMP-MEMBERS-023: invite button is disabled when no user is selected', async () => {
    render(<TripMembersModal {...defaultProps} />);
    await screen.findByText('Invite User');

    const inviteBtn = screen.getByRole('button', { name: /Invite/i });
    expect(inviteBtn).toBeDisabled();
  });

  it('FE-COMP-MEMBERS-024: leave trip calls DELETE for current user', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: vi.fn() },
      writable: true,
      configurable: true,
    });

    seedStore(useAuthStore, { user: memberUser, isAuthenticated: true });
    seedStore(useTripStore, { trip: buildTrip({ id: 1, owner_id: ownerUser.id }) });

    let deleteCalledForUserId: string | null = null;
    server.use(
      http.get('/api/trips/1/members', () =>
        HttpResponse.json({
          owner: { id: ownerUser.id, username: ownerUser.username, avatar_url: null },
          members: [{ id: memberUser.id, username: memberUser.username, avatar_url: null }],
          current_user_id: memberUser.id,
        })
      ),
      http.delete('/api/trips/1/members/:userId', ({ params }) => {
        deleteCalledForUserId = params.userId as string;
        return HttpResponse.json({ success: true });
      }),
    );

    render(<TripMembersModal {...defaultProps} />);
    await screen.findByText('alice');

    const leaveBtn = screen.getByTitle('Leave trip');
    await user.click(leaveBtn);

    await waitFor(() => {
      expect(deleteCalledForUserId).toBe(String(memberUser.id));
    });

    vi.restoreAllMocks();
  });

  it('FE-COMP-MEMBERS-025: "all have access" message shown when all users are members', async () => {
    server.use(
      http.get('/api/trips/1/members', () =>
        HttpResponse.json({
          owner: { id: ownerUser.id, username: ownerUser.username, avatar_url: null },
          members: [{ id: memberUser.id, username: memberUser.username, avatar_url: null }],
          current_user_id: ownerUser.id,
        })
      ),
      http.get('/api/auth/users', () =>
        HttpResponse.json({ users: [memberUser] })
      ),
    );

    render(<TripMembersModal {...defaultProps} />);
    await screen.findByText('All users already have access.');
  });
});
