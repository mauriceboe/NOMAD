import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/helpers/msw/server';
import { resetAllStores } from '../../tests/helpers/store';
import RegisterPage from './RegisterPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const USERNAME_PLACEHOLDER = 'johndoe';
const EMAIL_PLACEHOLDER = 'your@email.com';
const PASSWORD_PLACEHOLDER = 'Min. 6 characters';
const CONFIRM_PASSWORD_PLACEHOLDER = 'Repeat password';

beforeEach(() => {
  resetAllStores();
  vi.clearAllMocks();
});

describe('RegisterPage', () => {
  describe('FE-PAGE-REG-001: Renders registration form with all fields', () => {
    it('shows username, email, password, confirm-password inputs and submit button', () => {
      render(<RegisterPage />);
      expect(screen.getByPlaceholderText(USERNAME_PLACEHOLDER)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(EMAIL_PLACEHOLDER)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(CONFIRM_PASSWORD_PLACEHOLDER)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
    });
  });

  describe('FE-PAGE-REG-002: Password mismatch shows error', () => {
    it('displays mismatch error without calling API', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      await user.type(screen.getByPlaceholderText(USERNAME_PLACEHOLDER), 'testuser');
      await user.type(screen.getByPlaceholderText(EMAIL_PLACEHOLDER), 'test@example.com');
      await user.type(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), 'password1');
      await user.type(screen.getByPlaceholderText(CONFIRM_PASSWORD_PLACEHOLDER), 'password2');
      await user.click(screen.getByRole('button', { name: /^register$/i }));

      await waitFor(() => {
        expect(screen.getByText(/do not match/i)).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-REG-003: Password too short shows error', () => {
    it('displays length error when passwords are the same but too short', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      await user.type(screen.getByPlaceholderText(USERNAME_PLACEHOLDER), 'testuser');
      await user.type(screen.getByPlaceholderText(EMAIL_PLACEHOLDER), 'test@example.com');
      await user.type(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), 'abc');
      await user.type(screen.getByPlaceholderText(CONFIRM_PASSWORD_PLACEHOLDER), 'abc');
      await user.click(screen.getByRole('button', { name: /^register$/i }));

      await waitFor(() => {
        expect(screen.getByText(/at least 8/i)).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-REG-004: Successful registration navigates to /dashboard', () => {
    it('calls navigate("/dashboard") after successful registration', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      await user.type(screen.getByPlaceholderText(USERNAME_PLACEHOLDER), 'testuser');
      await user.type(screen.getByPlaceholderText(EMAIL_PLACEHOLDER), 'test@example.com');
      await user.type(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), 'password123');
      await user.type(screen.getByPlaceholderText(CONFIRM_PASSWORD_PLACEHOLDER), 'password123');
      await user.click(screen.getByRole('button', { name: /^register$/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });
  });

  describe('FE-PAGE-REG-005: Loading state during submission', () => {
    it('disables submit button and shows loading text while registering', async () => {
      server.use(
        http.post('/api/auth/register', async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({ user: { id: 1, username: 'newuser' } });
        }),
      );

      const user = userEvent.setup();
      render(<RegisterPage />);

      await user.type(screen.getByPlaceholderText(USERNAME_PLACEHOLDER), 'testuser');
      await user.type(screen.getByPlaceholderText(EMAIL_PLACEHOLDER), 'test@example.com');
      await user.type(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), 'password123');
      await user.type(screen.getByPlaceholderText(CONFIRM_PASSWORD_PLACEHOLDER), 'password123');
      await user.click(screen.getByRole('button', { name: /^register$/i }));

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /registering/i });
        expect(btn).toBeDisabled();
      });
    });
  });

  describe('FE-PAGE-REG-006: API error displayed', () => {
    it('shows error message returned by the API', async () => {
      server.use(
        http.post('/api/auth/register', () => {
          return HttpResponse.json({ error: 'Username already taken' }, { status: 409 });
        }),
      );

      const user = userEvent.setup();
      render(<RegisterPage />);

      await user.type(screen.getByPlaceholderText(USERNAME_PLACEHOLDER), 'testuser');
      await user.type(screen.getByPlaceholderText(EMAIL_PLACEHOLDER), 'test@example.com');
      await user.type(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), 'password123');
      await user.type(screen.getByPlaceholderText(CONFIRM_PASSWORD_PLACEHOLDER), 'password123');
      await user.click(screen.getByRole('button', { name: /^register$/i }));

      await waitFor(() => {
        expect(screen.getByText('Username already taken')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-REG-007: Show/hide password toggle', () => {
    it('toggles password input type between password and text', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const passwordInput = screen.getByPlaceholderText(PASSWORD_PLACEHOLDER);
      const confirmInput = screen.getByPlaceholderText(CONFIRM_PASSWORD_PLACEHOLDER);

      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(confirmInput).toHaveAttribute('type', 'password');

      // The toggle button is the only button of type "button" (not submit) before form submission
      const toggleButton = screen.getByRole('button', { name: '' });
      await user.click(toggleButton);

      expect(passwordInput).toHaveAttribute('type', 'text');
      expect(confirmInput).toHaveAttribute('type', 'text');

      await user.click(toggleButton);

      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(confirmInput).toHaveAttribute('type', 'password');
    });
  });

  describe('FE-PAGE-REG-008: Link to login page is present', () => {
    it('renders a Sign In link pointing to /login', () => {
      render(<RegisterPage />);
      const link = screen.getByRole('link', { name: /sign in/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/login');
    });
  });

  describe('FE-PAGE-REG-009: Feature list rendered', () => {
    it('renders feature list items in the DOM', () => {
      render(<RegisterPage />);
      // Features are always in the DOM (hidden via CSS on mobile)
      expect(screen.getByText(/Unlimited trip plans/i)).toBeInTheDocument();
      expect(screen.getByText(/Interactive map view/i)).toBeInTheDocument();
      expect(screen.getByText(/Track reservations/i)).toBeInTheDocument();
    });
  });

  describe('FE-PAGE-REG-010: Required attribute on username input', () => {
    it('username input has required attribute', () => {
      render(<RegisterPage />);
      expect(screen.getByPlaceholderText(USERNAME_PLACEHOLDER)).toBeRequired();
    });
  });
});
