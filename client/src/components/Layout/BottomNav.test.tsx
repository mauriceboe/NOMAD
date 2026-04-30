// FE-COMP-BOTTOMNAV-001 to FE-COMP-BOTTOMNAV-009

vi.mock('../../api/websocket', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  getSocketId: vi.fn(() => null),
  setRefetchCallback: vi.fn(),
  setPreReconnectHook: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import { render, screen, fireEvent } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAddonStore } from '../../store/addonStore';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { buildUser, buildSettings } from '../../../tests/helpers/factories';
import BottomNav from './BottomNav';

const currentUser = buildUser({ id: 1, username: 'testuser', email: 'test@example.com' });

beforeEach(() => {
  resetAllStores();
  mockNavigate.mockClear();
  seedStore(useAuthStore, { user: currentUser, isAuthenticated: true });
});

describe('BottomNav', () => {
  it('FE-COMP-BOTTOMNAV-001: renders without crashing', () => {
    render(<BottomNav />);
    expect(document.body).toBeInTheDocument();
  });

  it('FE-COMP-BOTTOMNAV-002: shows Trips nav link', () => {
    render(<BottomNav />);
    expect(screen.getByText('My Trips')).toBeInTheDocument();
  });

  it('FE-COMP-BOTTOMNAV-003: shows Profile button', () => {
    render(<BottomNav />);
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('FE-COMP-BOTTOMNAV-004: profile sheet opens on click', async () => {
    const user = userEvent.setup();
    render(<BottomNav />);
    await user.click(screen.getByText('Profile'));
    // Profile sheet shows username
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  it('FE-COMP-BOTTOMNAV-005: profile sheet shows username', async () => {
    const user = userEvent.setup();
    render(<BottomNav />);
    await user.click(screen.getByText('Profile'));
    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('FE-COMP-BOTTOMNAV-006: profile sheet shows Settings link', async () => {
    const user = userEvent.setup();
    render(<BottomNav />);
    await user.click(screen.getByText('Profile'));
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('FE-COMP-BOTTOMNAV-007: profile sheet shows Logout button', async () => {
    const user = userEvent.setup();
    render(<BottomNav />);
    await user.click(screen.getByText('Profile'));
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('FE-COMP-BOTTOMNAV-008: admin badge shown for admin users', async () => {
    const adminUser = buildUser({ id: 2, username: 'adminuser', role: 'admin' });
    seedStore(useAuthStore, { user: adminUser, isAuthenticated: true });
    const user = userEvent.setup();
    render(<BottomNav />);
    await user.click(screen.getByText('Profile'));
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('FE-COMP-BOTTOMNAV-009: backdrop click closes profile sheet', async () => {
    const user = userEvent.setup();
    render(<BottomNav />);
    await user.click(screen.getByText('Profile'));
    // Sheet is open — username visible
    expect(screen.getByText('testuser')).toBeInTheDocument();
    // The outermost fixed div is the backdrop wrapper, clicking it triggers onClose
    const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement;
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop);
    // Sheet should be closed — username no longer visible (only the nav Profile text remains)
    expect(screen.queryByText('testuser')).not.toBeInTheDocument();
  });

  it('FE-COMP-BOTTOMNAV-010: Trips label translates when language is fr', () => {
    seedStore(useSettingsStore, { settings: buildSettings({ language: 'fr' }) });
    render(<BottomNav />);
    expect(screen.getByText('Mes voyages')).toBeInTheDocument();
  });

  it('FE-COMP-BOTTOMNAV-011: Profile label translates when language is fr', () => {
    seedStore(useSettingsStore, { settings: buildSettings({ language: 'fr' }) });
    render(<BottomNav />);
    expect(screen.getByText('Profil')).toBeInTheDocument();
  });

  it('FE-COMP-BOTTOMNAV-012: addon labels translate when language is fr', () => {
    seedStore(useSettingsStore, { settings: buildSettings({ language: 'fr' }) });
    seedStore(useAddonStore, {
      addons: [
        { id: 'vacay', name: 'Vacay', type: 'global', icon: 'calendar', enabled: true },
        { id: 'atlas', name: 'Atlas', type: 'global', icon: 'globe', enabled: true },
        { id: 'journey', name: 'Journey', type: 'global', icon: 'compass', enabled: true },
      ],
    });
    render(<BottomNav />);
    expect(screen.getByText('Vacances')).toBeInTheDocument();
    expect(screen.getByText('Atlas')).toBeInTheDocument();
    expect(screen.getByText('Journal de voyage')).toBeInTheDocument();
  });

  it('FE-COMP-BOTTOMNAV-013: unknown addon id is not rendered', () => {
    seedStore(useAddonStore, {
      addons: [{ id: 'foo', name: 'Foo Addon', type: 'global', icon: 'star', enabled: true }],
    });
    render(<BottomNav />);
    expect(screen.queryByText('Foo Addon')).not.toBeInTheDocument();
  });
});
