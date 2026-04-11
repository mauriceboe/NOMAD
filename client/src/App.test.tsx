import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../tests/helpers/msw/server'
import { useAuthStore } from './store/authStore'
import { useSettingsStore } from './store/settingsStore'
import { resetAllStores } from '../tests/helpers/store'
import { buildUser, buildSettings } from '../tests/helpers/factories'
import App from './App'

// ── Mock page components ───────────────────────────────────────────────────────
vi.mock('./pages/LoginPage', () => ({ default: () => <div>Login</div> }))
vi.mock('./pages/DashboardPage', () => ({ default: () => <div>Dashboard</div> }))
vi.mock('./pages/TripPlannerPage', () => ({ default: () => <div>TripPlanner</div> }))
vi.mock('./pages/FilesPage', () => ({ default: () => <div>Files</div> }))
vi.mock('./pages/AdminPage', () => ({ default: () => <div>Admin</div> }))
vi.mock('./pages/SettingsPage', () => ({ default: () => <div>Settings</div> }))
vi.mock('./pages/VacayPage', () => ({ default: () => <div>Vacay</div> }))
vi.mock('./pages/AtlasPage', () => ({ default: () => <div>Atlas</div> }))
vi.mock('./pages/SharedTripPage', () => ({ default: () => <div>SharedTrip</div> }))
vi.mock('./pages/InAppNotificationsPage.tsx', () => ({ default: () => <div>Notifications</div> }))

// Prevent WebSocket side effects from the notification listener
vi.mock('./hooks/useInAppNotificationListener.ts', () => ({
  useInAppNotificationListener: vi.fn(),
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>
  )
}

/**
 * Seeds authStore with sensible defaults for a test, replacing loadUser with a
 * no-op spy so the MSW /api/auth/me response does not overwrite the seeded state.
 */
function seedAuth(overrides: Record<string, unknown> = {}) {
  useAuthStore.setState({
    isLoading: false,
    isAuthenticated: false,
    user: null,
    appRequireMfa: false,
    loadUser: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  })
}

beforeEach(() => {
  resetAllStores()
  vi.clearAllMocks()
  document.documentElement.classList.remove('dark')
})

// ── RootRedirect ───────────────────────────────────────────────────────────────

describe('RootRedirect', () => {
  it('FE-COMP-APP-001: / redirects to /login when not authenticated', async () => {
    seedAuth({ isAuthenticated: false })
    renderApp('/')
    await waitFor(() => expect(screen.getByText('Login')).toBeInTheDocument())
  })

  it('FE-COMP-APP-002: / redirects to /dashboard when authenticated', async () => {
    seedAuth({ isAuthenticated: true, user: buildUser() })
    renderApp('/')
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument())
  })

  it('FE-COMP-APP-003: / shows loading spinner while auth is loading', () => {
    seedAuth({ isLoading: true, isAuthenticated: false })
    renderApp('/')
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    expect(screen.queryByText('Login')).not.toBeInTheDocument()
  })
})

// ── ProtectedRoute — unauthenticated ──────────────────────────────────────────

describe('ProtectedRoute — unauthenticated', () => {
  it('FE-COMP-APP-004: /dashboard redirects to /login with redirect param when not authenticated', async () => {
    seedAuth({ isAuthenticated: false })
    renderApp('/dashboard')
    await waitFor(() => expect(screen.getByText('Login')).toBeInTheDocument())
  })

  it('FE-COMP-APP-005: /trips/42 redirects to /login when not authenticated', async () => {
    seedAuth({ isAuthenticated: false })
    renderApp('/trips/42')
    await waitFor(() => expect(screen.getByText('Login')).toBeInTheDocument())
  })
})

// ── ProtectedRoute — loading ───────────────────────────────────────────────────

describe('ProtectedRoute — loading state', () => {
  it('FE-COMP-APP-006: protected route shows loading spinner while isLoading is true', () => {
    seedAuth({ isLoading: true, isAuthenticated: false })
    renderApp('/dashboard')
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })
})

// ── ProtectedRoute — MFA enforcement ──────────────────────────────────────────

describe('ProtectedRoute — MFA enforcement', () => {
  it('FE-COMP-APP-007: redirects to /settings?mfa=required when appRequireMfa is true and MFA is disabled', async () => {
    seedAuth({
      isAuthenticated: true,
      appRequireMfa: true,
      user: buildUser({ mfa_enabled: false }),
    })
    renderApp('/dashboard')
    await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument())
  })

  it('FE-COMP-APP-008: does NOT redirect when already on /settings even with MFA required', async () => {
    seedAuth({
      isAuthenticated: true,
      appRequireMfa: true,
      user: buildUser({ mfa_enabled: false }),
    })
    renderApp('/settings')
    await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument())
    expect(screen.queryByText('Login')).not.toBeInTheDocument()
  })

  it('FE-COMP-APP-009: does NOT redirect when user has MFA enabled', async () => {
    seedAuth({
      isAuthenticated: true,
      appRequireMfa: true,
      user: buildUser({ mfa_enabled: true }),
    })
    renderApp('/dashboard')
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument())
  })
})

// ── ProtectedRoute — admin role ────────────────────────────────────────────────

describe('ProtectedRoute — admin role check', () => {
  it('FE-COMP-APP-010: /admin redirects to /dashboard for non-admin user', async () => {
    seedAuth({
      isAuthenticated: true,
      user: buildUser({ role: 'user' }),
    })
    renderApp('/admin')
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument())
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('FE-COMP-APP-011: /admin is accessible for admin user', async () => {
    seedAuth({
      isAuthenticated: true,
      user: buildUser({ role: 'admin' }),
    })
    renderApp('/admin')
    await waitFor(() => expect(screen.getByText('Admin')).toBeInTheDocument())
  })
})

// ── Public routes ──────────────────────────────────────────────────────────────

describe('Public routes', () => {
  it('FE-COMP-APP-012: /login is accessible without authentication', async () => {
    seedAuth({ isAuthenticated: false })
    renderApp('/login')
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('FE-COMP-APP-013: /shared/:token is accessible without authentication', async () => {
    seedAuth({ isAuthenticated: false })
    renderApp('/shared/sometoken')
    expect(screen.getByText('SharedTrip')).toBeInTheDocument()
  })

  it('FE-COMP-APP-014: unknown routes redirect to / which then redirects to /login', async () => {
    seedAuth({ isAuthenticated: false })
    renderApp('/does-not-exist')
    await waitFor(() => expect(screen.getByText('Login')).toBeInTheDocument())
  })
})

// ── App — on-mount effects ─────────────────────────────────────────────────────

describe('App — on-mount effects', () => {
  it('FE-COMP-APP-015: loadUser is called on mount for non-shared paths', async () => {
    const loadUser = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ isLoading: false, isAuthenticated: false, loadUser })
    renderApp('/dashboard')
    expect(loadUser).toHaveBeenCalled()
  })

  it('FE-COMP-APP-016: loadUser is NOT called on /shared/ paths', async () => {
    const loadUser = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ isLoading: false, isAuthenticated: false, loadUser })
    renderApp('/shared/token123')
    expect(loadUser).not.toHaveBeenCalled()
  })

  it('FE-COMP-APP-017: GET /api/auth/app-config is called on mount', async () => {
    let configCalled = false
    server.use(
      http.get('/api/auth/app-config', () => {
        configCalled = true
        return HttpResponse.json({})
      })
    )
    seedAuth()
    renderApp('/')
    await waitFor(() => expect(configCalled).toBe(true))
  })

  it('FE-COMP-APP-018: setDemoMode(true) is called when config returns demo_mode: true', async () => {
    server.use(
      http.get('/api/auth/app-config', () => HttpResponse.json({ demo_mode: true }))
    )
    const setDemoMode = vi.fn()
    useAuthStore.setState({
      isLoading: false,
      isAuthenticated: false,
      loadUser: vi.fn().mockResolvedValue(undefined),
      setDemoMode,
    })
    renderApp('/')
    await waitFor(() => expect(setDemoMode).toHaveBeenCalledWith(true))
  })

  it('FE-COMP-APP-019: loadSettings is called once the user is authenticated', async () => {
    const loadSettings = vi.fn().mockResolvedValue(undefined)
    seedAuth({ isAuthenticated: true, user: buildUser() })
    useSettingsStore.setState({ loadSettings })
    renderApp('/dashboard')
    await waitFor(() => expect(loadSettings).toHaveBeenCalled())
  })
})

// ── Dark mode effects ──────────────────────────────────────────────────────────

describe('Dark mode effects', () => {
  it('FE-COMP-APP-020: adds dark class to documentElement when dark_mode is true', async () => {
    seedAuth({ isAuthenticated: true, user: buildUser() })
    useSettingsStore.setState({ settings: buildSettings({ dark_mode: true }) })
    renderApp('/dashboard')
    await waitFor(() =>
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    )
  })

  it('FE-COMP-APP-021: removes dark class when dark_mode is false', async () => {
    document.documentElement.classList.add('dark')
    seedAuth({ isAuthenticated: true, user: buildUser() })
    useSettingsStore.setState({ settings: buildSettings({ dark_mode: false }) })
    renderApp('/dashboard')
    await waitFor(() =>
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    )
  })

  it('FE-COMP-APP-022: forces light mode on /shared/ path even when dark_mode is true', async () => {
    document.documentElement.classList.add('dark')
    useSettingsStore.setState({ settings: buildSettings({ dark_mode: true }) })
    seedAuth({ isAuthenticated: false, loadUser: vi.fn().mockResolvedValue(undefined) })
    renderApp('/shared/tok')
    await waitFor(() =>
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    )
  })

  it('FE-COMP-APP-023: auto mode applies dark based on matchMedia result', async () => {
    // matchMedia stub returns matches: false by default (from setup.ts)
    seedAuth({ isAuthenticated: true, user: buildUser() })
    useSettingsStore.setState({ settings: buildSettings({ dark_mode: 'auto' as any }) })
    renderApp('/dashboard')
    // With matches: false, dark should NOT be added
    await waitFor(() =>
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    )
  })
})

// ── Version cache-busting ──────────────────────────────────────────────────────

describe('Version cache-busting', () => {
  it('FE-COMP-APP-024: stores version in localStorage when config returns a version', async () => {
    server.use(
      http.get('/api/auth/app-config', () =>
        HttpResponse.json({ version: '2.9.10' })
      )
    )
    seedAuth()
    renderApp('/')
    await waitFor(() =>
      expect(localStorage.getItem('trek_app_version')).toBe('2.9.10')
    )
  })

  it('FE-COMP-APP-025: calls window.location.reload() when version changes', async () => {
    localStorage.setItem('trek_app_version', '2.9.9')
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, reload },
    })

    server.use(
      http.get('/api/auth/app-config', () =>
        HttpResponse.json({ version: '2.9.10' })
      )
    )
    seedAuth()
    renderApp('/')
    await waitFor(() => expect(reload).toHaveBeenCalled())
  })
})
