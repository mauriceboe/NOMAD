// FE-COMP-ACCOUNT-001 to FE-COMP-ACCOUNT-012
import { render, screen, waitFor } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/helpers/msw/server';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { buildUser, buildSettings } from '../../../tests/helpers/factories';
import AccountTab from './AccountTab';
import { ToastContainer } from '../shared/Toast';

beforeEach(() => {
  resetAllStores();
  server.use(
    http.get('/api/auth/app-config', () =>
      HttpResponse.json({ version: '2.9.10', mfa_enabled: false, allow_registration: true })
    ),
  );
  seedStore(useAuthStore, { user: buildUser({ username: 'testuser', email: 'test@example.com', role: 'user' }), isAuthenticated: true });
  seedStore(useSettingsStore, { settings: buildSettings() });
});

describe('AccountTab', () => {
  it('FE-COMP-ACCOUNT-001: renders without crashing', () => {
    render(<AccountTab />);
    expect(document.body).toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-002: shows Account section title', () => {
    render(<AccountTab />);
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-003: shows username field with current value', () => {
    render(<AccountTab />);
    expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-004: shows email field with current value', () => {
    render(<AccountTab />);
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-005: shows Username label', () => {
    render(<AccountTab />);
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-006: shows Email label', () => {
    render(<AccountTab />);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-007: shows Change Password section', () => {
    render(<AccountTab />);
    expect(screen.getByText('Change Password')).toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-008: shows current password field', () => {
    render(<AccountTab />);
    const inputs = document.querySelectorAll('input[type="password"]');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('FE-COMP-ACCOUNT-009: shows Update password button', () => {
    render(<AccountTab />);
    expect(screen.getByText('Update password')).toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-010: clicking Update password without filling in shows error', async () => {
    const user = userEvent.setup();
    // Render with ToastContainer so toast.error() messages appear in the DOM
    render(<><ToastContainer /><AccountTab /></>);
    await user.click(screen.getByText('Update password'));
    // Validation fires: first checks currentPassword — "Current password is required"
    await screen.findByText(/Current password is required/i);
  });

  it('FE-COMP-ACCOUNT-011: password mismatch shows error', async () => {
    const user = userEvent.setup();
    render(<><ToastContainer /><AccountTab /></>);
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    // Fill current, new, and mismatched confirm
    await user.type(passwordInputs[0], 'currentpass');
    await user.type(passwordInputs[1], 'NewPassword1!');
    await user.type(passwordInputs[2], 'DifferentPass1!');
    await user.click(screen.getByText('Update password'));
    await screen.findByText('Passwords do not match');
  });

  it('FE-COMP-ACCOUNT-012: valid password change calls API', async () => {
    const user = userEvent.setup();
    let changeCalled = false;
    server.use(
      // Endpoint is /api/auth/me/password (not /api/auth/password)
      http.put('/api/auth/me/password', async () => {
        changeCalled = true;
        return HttpResponse.json({ success: true });
      }),
      // loadUser also needs GET /api/auth/me
      http.get('/api/auth/me', () => HttpResponse.json({ user: buildUser() })),
    );
    render(<AccountTab />);
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    await user.type(passwordInputs[0], 'currentpass');
    await user.type(passwordInputs[1], 'NewPassword1!');
    await user.type(passwordInputs[2], 'NewPassword1!');
    await user.click(screen.getByText('Update password'));
    await waitFor(() => expect(changeCalled).toBe(true));
  });
});

// ── Profile (013–017) ────────────────────────────────────────────────────────

describe('AccountTab – Profile', () => {
  it('FE-COMP-ACCOUNT-013: Save Profile calls updateProfile with current field values', async () => {
    const user = userEvent.setup();
    const updateProfileMock = vi.fn().mockResolvedValue(undefined);
    seedStore(useAuthStore, { updateProfile: updateProfileMock });
    render(<AccountTab />);
    await user.click(screen.getByRole('button', { name: /save profile/i }));
    expect(updateProfileMock).toHaveBeenCalledWith({ username: 'testuser', email: 'test@example.com' });
  });

  it('FE-COMP-ACCOUNT-014: editing username and saving calls updateProfile with new value', async () => {
    const user = userEvent.setup();
    const updateProfileMock = vi.fn().mockResolvedValue(undefined);
    seedStore(useAuthStore, { updateProfile: updateProfileMock });
    render(<AccountTab />);
    const usernameInput = screen.getByDisplayValue('testuser');
    await user.clear(usernameInput);
    await user.type(usernameInput, 'newuser');
    await user.click(screen.getByRole('button', { name: /save profile/i }));
    expect(updateProfileMock).toHaveBeenCalledWith({ username: 'newuser', email: 'test@example.com' });
  });

  it('FE-COMP-ACCOUNT-015: successful save shows success toast', async () => {
    const user = userEvent.setup();
    seedStore(useAuthStore, { updateProfile: vi.fn().mockResolvedValue(undefined) });
    render(<><ToastContainer /><AccountTab /></>);
    await user.click(screen.getByRole('button', { name: /save profile/i }));
    await screen.findByText('Profile saved');
  });

  it('FE-COMP-ACCOUNT-016: failed save shows error toast with error message', async () => {
    const user = userEvent.setup();
    seedStore(useAuthStore, { updateProfile: vi.fn().mockRejectedValue(new Error('Server error')) });
    render(<><ToastContainer /><AccountTab /></>);
    await user.click(screen.getByRole('button', { name: /save profile/i }));
    await screen.findByText('Server error');
  });

  it('FE-COMP-ACCOUNT-017: Save button shows spinner while saving', async () => {
    const user = userEvent.setup();
    seedStore(useAuthStore, { updateProfile: vi.fn().mockReturnValue(new Promise(() => {})) });
    render(<AccountTab />);
    await user.click(screen.getByRole('button', { name: /save profile/i }));
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });
});

// ── Password change (018–021) ────────────────────────────────────────────────

describe('AccountTab – Password change', () => {
  it('FE-COMP-ACCOUNT-018: password too short shows error toast', async () => {
    const user = userEvent.setup();
    render(<><ToastContainer /><AccountTab /></>);
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    await user.type(passwordInputs[0], 'currentpass');
    await user.type(passwordInputs[1], 'short');
    await user.type(passwordInputs[2], 'short');
    await user.click(screen.getByText('Update password'));
    await screen.findByText(/at least 8 characters/i);
  });

  it('FE-COMP-ACCOUNT-019: password change clears fields on success', async () => {
    const user = userEvent.setup();
    server.use(
      http.put('/api/auth/me/password', () => HttpResponse.json({ success: true })),
      http.get('/api/auth/me', () => HttpResponse.json({ user: buildUser() })),
    );
    render(<AccountTab />);
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    await user.type(passwordInputs[0], 'currentpass');
    await user.type(passwordInputs[1], 'NewPassword1!');
    await user.type(passwordInputs[2], 'NewPassword1!');
    await user.click(screen.getByText('Update password'));
    await waitFor(() => {
      const inputs = document.querySelectorAll('input[type="password"]');
      inputs.forEach(input => expect((input as HTMLInputElement).value).toBe(''));
    });
  });

  it('FE-COMP-ACCOUNT-020: password change API error shows toast', async () => {
    const user = userEvent.setup();
    server.use(
      http.put('/api/auth/me/password', () =>
        HttpResponse.json({ error: 'Wrong password' }, { status: 400 })
      ),
    );
    render(<><ToastContainer /><AccountTab /></>);
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    await user.type(passwordInputs[0], 'wrongpass');
    await user.type(passwordInputs[1], 'NewPassword1!');
    await user.type(passwordInputs[2], 'NewPassword1!');
    await user.click(screen.getByText('Update password'));
    await screen.findByText('Wrong password');
  });

  it('FE-COMP-ACCOUNT-021: password section hidden in OIDC-only mode', async () => {
    server.use(
      http.get('/api/auth/app-config', () =>
        HttpResponse.json({ oidc_only_mode: true, mfa_enabled: false, allow_registration: true })
      ),
    );
    render(<AccountTab />);
    await waitFor(() => {
      expect(screen.queryByText('Change Password')).not.toBeInTheDocument();
    });
  });
});

// ── MFA (022–036) ────────────────────────────────────────────────────────────

describe('AccountTab – MFA', () => {
  async function setupMfaQrState(ue: ReturnType<typeof userEvent.setup>) {
    server.use(
      http.post('/api/auth/mfa/setup', () =>
        HttpResponse.json({ qr_svg: '<svg id="mock-qr">mock-qr</svg>', secret: 'ABCDEF123' })
      ),
    );
    render(<AccountTab />);
    await ue.click(screen.getByText('Set up authenticator'));
    await waitFor(() => expect(screen.getByText('ABCDEF123')).toBeInTheDocument());
  }

  it('FE-COMP-ACCOUNT-022: MFA section shows Setup button when mfa is disabled', () => {
    render(<AccountTab />);
    expect(screen.getByText('Set up authenticator')).toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-023: clicking Setup MFA button calls mfaSetup API and shows QR', async () => {
    const user = userEvent.setup();
    await setupMfaQrState(user);
    expect(screen.getByText('ABCDEF123')).toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-024: MFA code input filters non-numeric characters', async () => {
    const user = userEvent.setup();
    await setupMfaQrState(user);
    const codeInput = screen.getByPlaceholderText('6-digit code');
    await user.type(codeInput, 'abc123def456');
    expect((codeInput as HTMLInputElement).value).toBe('123456');
  });

  it('FE-COMP-ACCOUNT-025: Enable MFA button is disabled when code has fewer than 6 digits', async () => {
    const user = userEvent.setup();
    await setupMfaQrState(user);
    const codeInput = screen.getByPlaceholderText('6-digit code');
    await user.type(codeInput, '1234');
    expect(screen.getByRole('button', { name: 'Enable 2FA' })).toBeDisabled();
  });

  it('FE-COMP-ACCOUNT-026: Enable MFA button is enabled when code has 6+ digits', async () => {
    const user = userEvent.setup();
    await setupMfaQrState(user);
    const codeInput = screen.getByPlaceholderText('6-digit code');
    await user.type(codeInput, '123456');
    expect(screen.getByRole('button', { name: 'Enable 2FA' })).not.toBeDisabled();
  });

  it('FE-COMP-ACCOUNT-027: enabling MFA shows backup codes', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/auth/mfa/setup', () =>
        HttpResponse.json({ qr_svg: '<svg>mock</svg>', secret: 'ABCDEF123' })
      ),
      http.post('/api/auth/mfa/enable', () =>
        HttpResponse.json({ backup_codes: ['AAAA-1111', 'BBBB-2222'] })
      ),
      http.get('/api/auth/me', () => HttpResponse.json({ user: buildUser({ mfa_enabled: true }) })),
    );
    render(<AccountTab />);
    await user.click(screen.getByText('Set up authenticator'));
    await waitFor(() => screen.getByText('ABCDEF123'));
    await user.type(screen.getByPlaceholderText('6-digit code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Enable 2FA' }));
    // codes are joined by \n in a <pre>, use regex to match partial text
    await screen.findByText(/AAAA-1111/);
    expect(screen.getByText(/BBBB-2222/)).toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-028: backup codes are stored in sessionStorage on enable', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/auth/mfa/setup', () =>
        HttpResponse.json({ qr_svg: '<svg>mock</svg>', secret: 'ABCDEF123' })
      ),
      http.post('/api/auth/mfa/enable', () =>
        HttpResponse.json({ backup_codes: ['AAAA-1111', 'BBBB-2222'] })
      ),
      http.get('/api/auth/me', () => HttpResponse.json({ user: buildUser({ mfa_enabled: true }) })),
    );
    render(<AccountTab />);
    await user.click(screen.getByText('Set up authenticator'));
    await waitFor(() => screen.getByText('ABCDEF123'));
    await user.type(screen.getByPlaceholderText('6-digit code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Enable 2FA' }));
    await screen.findByText(/AAAA-1111/);
    const stored = JSON.parse(sessionStorage.getItem('trek_mfa_backup_codes_pending') || '[]');
    expect(stored).toContain('AAAA-1111');
    expect(stored).toContain('BBBB-2222');
  });

  it('FE-COMP-ACCOUNT-029: dismissing backup codes via OK removes them', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem('trek_mfa_backup_codes_pending', JSON.stringify(['CODE1', 'CODE2']));
    seedStore(useAuthStore, { user: buildUser({ username: 'testuser', email: 'test@example.com', mfa_enabled: true }) });
    render(<AccountTab />);
    // codes are joined by \n in a <pre>; use regex
    await waitFor(() => screen.getByText(/CODE1/));
    await user.click(screen.getByText('OK'));
    expect(screen.queryByText(/CODE1/)).not.toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-030: copy backup codes calls clipboard.writeText', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem('trek_mfa_backup_codes_pending', JSON.stringify(['AAAA-1111', 'BBBB-2222']));
    seedStore(useAuthStore, { user: buildUser({ username: 'testuser', email: 'test@example.com', mfa_enabled: true }) });
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });
    render(<><ToastContainer /><AccountTab /></>);
    await waitFor(() => screen.getByText('Copy codes'));
    await user.click(screen.getByText('Copy codes'));
    expect(writeTextMock).toHaveBeenCalledWith('AAAA-1111\nBBBB-2222');
  });

  it('FE-COMP-ACCOUNT-031: MFA shows enabled status when user.mfa_enabled is true', () => {
    seedStore(useAuthStore, { user: buildUser({ username: 'testuser', email: 'test@example.com', mfa_enabled: true }) });
    render(<AccountTab />);
    expect(screen.getByText('2FA is enabled on your account.')).toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-032: MFA disable form shows password and code inputs when enabled', () => {
    seedStore(useAuthStore, { user: buildUser({ username: 'testuser', email: 'test@example.com', mfa_enabled: true }) });
    render(<AccountTab />);
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    expect(passwordInputs.length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText('6-digit code')).toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-033: Disable MFA button is disabled when fields are empty', () => {
    seedStore(useAuthStore, { user: buildUser({ username: 'testuser', email: 'test@example.com', mfa_enabled: true }) });
    render(<AccountTab />);
    expect(screen.getByRole('button', { name: 'Disable 2FA' })).toBeDisabled();
  });

  it('FE-COMP-ACCOUNT-034: disabling MFA calls the API and shows success toast', async () => {
    const user = userEvent.setup();
    seedStore(useAuthStore, { user: buildUser({ username: 'testuser', email: 'test@example.com', mfa_enabled: true }) });
    server.use(
      http.post('/api/auth/mfa/disable', () => HttpResponse.json({ success: true })),
      http.get('/api/auth/me', () => HttpResponse.json({ user: buildUser() })),
    );
    render(<><ToastContainer /><AccountTab /></>);
    // When mfa_enabled + !oidcOnlyMode, there are 4 password inputs total:
    // 3 in Change Password section + 1 in MFA disable section (last one)
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    const mfaPasswordInput = passwordInputs[passwordInputs.length - 1] as HTMLInputElement;
    await user.type(mfaPasswordInput, 'mypassword');
    const codeInput = screen.getByPlaceholderText('6-digit code');
    await user.type(codeInput, '123456');
    await user.click(screen.getByRole('button', { name: 'Disable 2FA' }));
    await screen.findByText('Two-factor authentication disabled');
  });

  it('FE-COMP-ACCOUNT-035: policy warning shown when MFA is required by policy', () => {
    seedStore(useAuthStore, {
      user: buildUser({ username: 'testuser', email: 'test@example.com', mfa_enabled: false }),
      appRequireMfa: true,
      demoMode: false,
    });
    render(<AccountTab />);
    expect(screen.getByText(/requires two-factor authentication/i)).toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-036: MFA section shows demoBlocked message in demo mode', () => {
    seedStore(useAuthStore, { demoMode: true });
    render(<AccountTab />);
    expect(screen.getByText('Not available in demo mode')).toBeInTheDocument();
  });
});

// ── Avatar (037–040) ─────────────────────────────────────────────────────────

describe('AccountTab – Avatar', () => {
  it('FE-COMP-ACCOUNT-037: shows user initials when no avatar_url', () => {
    seedStore(useAuthStore, { user: buildUser({ username: 'testuser', email: 'test@example.com', avatar_url: null }) });
    render(<AccountTab />);
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-038: shows avatar image when avatar_url is set', () => {
    seedStore(useAuthStore, {
      user: buildUser({ username: 'testuser', email: 'test@example.com', avatar_url: 'https://example.com/avatar.jpg' }),
    });
    render(<AccountTab />);
    // alt="" makes the image decorative (role="presentation"), use querySelector
    const img = document.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toBe('https://example.com/avatar.jpg');
  });

  it('FE-COMP-ACCOUNT-039: avatar remove button absent without avatar, present with avatar', () => {
    seedStore(useAuthStore, { user: buildUser({ username: 'testuser', email: 'test@example.com', avatar_url: null }) });
    const { unmount } = render(<AccountTab />);
    // No trash/remove button when no avatar — the Trash2 icon button is only rendered when avatar_url is set
    const fileInput = document.querySelector('input[type="file"]')!;
    const avatarContainer = fileInput.parentElement!;
    const buttons = avatarContainer.querySelectorAll('button');
    // Only camera button present (1 button)
    expect(buttons).toHaveLength(1);
    unmount();

    seedStore(useAuthStore, {
      user: buildUser({ username: 'testuser', email: 'test@example.com', avatar_url: 'https://example.com/avatar.jpg' }),
    });
    render(<AccountTab />);
    const fileInput2 = document.querySelector('input[type="file"]')!;
    const avatarContainer2 = fileInput2.parentElement!;
    const buttons2 = avatarContainer2.querySelectorAll('button');
    // Camera + remove buttons (2 buttons)
    expect(buttons2).toHaveLength(2);
  });

  it('FE-COMP-ACCOUNT-040: clicking camera button triggers file input click', async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    render(<AccountTab />);
    const fileInput = document.querySelector('input[type="file"]')!;
    const cameraButton = fileInput.nextElementSibling as HTMLElement;
    await user.click(cameraButton);
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});

// ── Account deletion (041–046) ────────────────────────────────────────────────

describe('AccountTab – Account deletion', () => {
  it('FE-COMP-ACCOUNT-041: Delete Account button is visible', () => {
    render(<AccountTab />);
    expect(screen.getByText('Delete account')).toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-042: clicking Delete Account for regular user shows confirm modal', async () => {
    const user = userEvent.setup();
    render(<AccountTab />);
    await user.click(screen.getByText('Delete account'));
    await waitFor(() => expect(screen.getByText('Delete your account?')).toBeInTheDocument());
  });

  it('FE-COMP-ACCOUNT-043: Cancel in confirm modal closes it', async () => {
    const user = userEvent.setup();
    render(<AccountTab />);
    await user.click(screen.getByText('Delete account'));
    await waitFor(() => screen.getByText('Delete your account?'));
    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Delete your account?')).not.toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-044: confirming deletion calls deleteOwnAccount and logout', async () => {
    const user = userEvent.setup();
    const logoutMock = vi.fn();
    seedStore(useAuthStore, {
      user: buildUser({ username: 'testuser', email: 'test@example.com', role: 'user' }),
      logout: logoutMock,
    });
    server.use(
      http.delete('/api/auth/me', () => HttpResponse.json({ success: true })),
    );
    render(<AccountTab />);
    await user.click(screen.getByText('Delete account'));
    await waitFor(() => screen.getByText('Delete your account?'));
    await user.click(screen.getByText('Delete permanently'));
    await waitFor(() => expect(logoutMock).toHaveBeenCalled());
  });

  it('FE-COMP-ACCOUNT-045: blocked modal shown when last admin tries to delete', async () => {
    const user = userEvent.setup();
    seedStore(useAuthStore, {
      user: buildUser({ username: 'testuser', email: 'test@example.com', role: 'admin' }),
    });
    // Default admin handler returns 1 admin → adminUsers.length === 1 → blocked
    render(<AccountTab />);
    await user.click(screen.getByText('Delete account'));
    await waitFor(() => expect(screen.getByText('Deletion not possible')).toBeInTheDocument());
  });

  it('FE-COMP-ACCOUNT-046: blocked modal closes on OK', async () => {
    const user = userEvent.setup();
    seedStore(useAuthStore, {
      user: buildUser({ username: 'testuser', email: 'test@example.com', role: 'admin' }),
    });
    render(<AccountTab />);
    await user.click(screen.getByText('Delete account'));
    await waitFor(() => screen.getByText('Deletion not possible'));
    await user.click(screen.getByText('OK'));
    expect(screen.queryByText('Deletion not possible')).not.toBeInTheDocument();
  });
});

// ── Role / OIDC display (047–048) ─────────────────────────────────────────────

describe('AccountTab – Role / OIDC display', () => {
  it('FE-COMP-ACCOUNT-047: shows admin badge for admin role', () => {
    seedStore(useAuthStore, {
      user: buildUser({ username: 'testuser', email: 'test@example.com', role: 'admin' }),
    });
    render(<AccountTab />);
    expect(screen.getByText(/administrator/i)).toBeInTheDocument();
  });

  it('FE-COMP-ACCOUNT-048: shows SSO badge when oidc_issuer is set', () => {
    seedStore(useAuthStore, {
      user: buildUser({ username: 'testuser', email: 'test@example.com', oidc_issuer: 'https://auth.example.com' } as any),
    });
    render(<AccountTab />);
    expect(screen.getByText('SSO')).toBeInTheDocument();
  });
});
