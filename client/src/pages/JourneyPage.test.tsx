// FE-PAGE-JOURNEY-001 to FE-PAGE-JOURNEY-010
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/helpers/msw/server';
import { resetAllStores, seedStore } from '../../tests/helpers/store';
import { buildUser } from '../../tests/helpers/factories';
import { useAuthStore } from '../store/authStore';
import { useAddonStore } from '../store/addonStore';
import { usePermissionsStore } from '../store/permissionsStore';
import JourneyPage from './JourneyPage';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../components/Layout/Navbar', () => ({
  default: () => <nav data-testid="navbar" />,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

let _seq = 500;
function nextId(): number {
  return ++_seq;
}

function buildJourneyListItem(overrides: Record<string, unknown> = {}) {
  const id = (overrides.id as number) ?? nextId();
  return {
    id,
    user_id: 1,
    title: `Journey ${id}`,
    subtitle: null,
    cover_gradient: null,
    cover_image: null,
    status: 'draft' as const,
    entry_count: 0,
    photo_count: 0,
    city_count: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

function seedDefaults() {
  seedStore(useAuthStore, { isAuthenticated: true, user: buildUser() });
  seedStore(useAddonStore, {
    addons: [{ id: 'journey', type: 'global', enabled: true }],
  } as any);
  seedStore(usePermissionsStore, { level: 'owner' } as any);
}

function setupDefaultHandlers(journeys: ReturnType<typeof buildJourneyListItem>[] = []) {
  server.use(
    http.get('/api/journeys', () =>
      HttpResponse.json({ journeys })
    ),
    http.get('/api/journeys/suggestions', () =>
      HttpResponse.json({ trips: [] })
    ),
    http.get('/api/journeys/available-trips', () =>
      HttpResponse.json({ trips: [] })
    ),
  );
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockNavigate.mockReset();
  resetAllStores();
  seedDefaults();
  setupDefaultHandlers();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('JourneyPage', () => {
  // FE-PAGE-JOURNEY-001
  it('FE-PAGE-JOURNEY-001: renders without crashing', async () => {
    render(<JourneyPage />);
    await waitFor(() => {
      expect(screen.getByTestId('navbar')).toBeInTheDocument();
    });
  });

  // FE-PAGE-JOURNEY-002
  it('FE-PAGE-JOURNEY-002: shows loading state', async () => {
    server.use(
      http.get('/api/journeys', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return HttpResponse.json({ journeys: [] });
      }),
    );
    render(<JourneyPage />);
    // The spinner has animate-spin class while loading with no journeys
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  // FE-PAGE-JOURNEY-003
  it('FE-PAGE-JOURNEY-003: shows empty state when no journeys', async () => {
    setupDefaultHandlers([]);
    render(<JourneyPage />);
    await waitFor(() => {
      // Grid renders with only the create card (the dashed-border button)
      // The "0 journeys" counter is shown
      expect(screen.getByText(/0/)).toBeInTheDocument();
    });
  });

  // FE-PAGE-JOURNEY-004
  it('FE-PAGE-JOURNEY-004: shows journey cards when journeys exist', async () => {
    const j1 = buildJourneyListItem({ id: 1, title: 'Summer in Italy' });
    const j2 = buildJourneyListItem({ id: 2, title: 'Winter in Japan' });
    setupDefaultHandlers([j1, j2]);

    render(<JourneyPage />);
    await waitFor(() => {
      expect(screen.getByText('Summer in Italy')).toBeInTheDocument();
      expect(screen.getByText('Winter in Japan')).toBeInTheDocument();
    });
  });

  // FE-PAGE-JOURNEY-005
  it('FE-PAGE-JOURNEY-005: create journey button exists', async () => {
    render(<JourneyPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Create Journey|Create a new Journey/i).length).toBeGreaterThan(0);
    });
  });

  // FE-PAGE-JOURNEY-006
  it('FE-PAGE-JOURNEY-006: create journey dialog opens on click', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/journeys/available-trips', () =>
        HttpResponse.json({ trips: [] })
      ),
    );

    render(<JourneyPage />);

    await waitFor(() => {
      // Wait for page to finish loading
      expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
    });

    // Find and click a create button (mobile or desktop)
    const createButtons = screen.getAllByText(/Create Journey|Create a new Journey/i);
    await user.click(createButtons[0]);

    // Modal should now show the journey name input
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Southeast Asia 2026/i)).toBeInTheDocument();
    });
  });

  // FE-PAGE-JOURNEY-007
  it('FE-PAGE-JOURNEY-007: shows suggestion card for recently ended trips', async () => {
    const suggestion = {
      id: 99,
      title: 'Paris Adventure',
      start_date: '2026-03-01',
      end_date: '2026-04-01',
      place_count: 5,
    };
    server.use(
      http.get('/api/journeys', () =>
        HttpResponse.json({ journeys: [] })
      ),
      http.get('/api/journeys/suggestions', () =>
        HttpResponse.json({ trips: [suggestion] })
      ),
    );

    render(<JourneyPage />);
    await waitFor(() => {
      // The suggestion banner shows the trip title embedded via dangerouslySetInnerHTML
      // The translation key is journey.frontpage.suggestionText with {title}
      // Look for the suggestion label
      expect(screen.getByText(/Trip just ended/i)).toBeInTheDocument();
    });
  });

  // FE-PAGE-JOURNEY-008
  it('FE-PAGE-JOURNEY-008: shows active journey hero when active journey exists', async () => {
    const active = buildJourneyListItem({ id: 10, title: 'Active Trip', status: 'active' });
    const other = buildJourneyListItem({ id: 11, title: 'Completed Trip', status: 'completed' });
    setupDefaultHandlers([active, other]);

    render(<JourneyPage />);
    await waitFor(() => {
      expect(screen.getByText('Active Trip')).toBeInTheDocument();
    });
    // Active journey section label
    expect(screen.getByText(/Active Journey/i)).toBeInTheDocument();
  });

  // FE-PAGE-JOURNEY-009
  it('FE-PAGE-JOURNEY-009: dismiss suggestion removes the banner', async () => {
    const user = userEvent.setup();
    const suggestion = {
      id: 77,
      title: 'Tokyo Trip',
      start_date: '2026-03-01',
      end_date: '2026-04-01',
      place_count: 3,
    };
    server.use(
      http.get('/api/journeys', () =>
        HttpResponse.json({ journeys: [] })
      ),
      http.get('/api/journeys/suggestions', () =>
        HttpResponse.json({ trips: [suggestion] })
      ),
    );

    render(<JourneyPage />);
    await waitFor(() => {
      expect(screen.getByText(/Trip just ended/i)).toBeInTheDocument();
    });

    // Click dismiss
    await user.click(screen.getByText(/Dismiss/i));

    await waitFor(() => {
      expect(screen.queryByText(/Trip just ended/i)).not.toBeInTheDocument();
    });
  });

  // FE-PAGE-JOURNEY-010
  it('FE-PAGE-JOURNEY-010: shows journey count in header', async () => {
    const j1 = buildJourneyListItem({ id: 1, title: 'Trip A' });
    const j2 = buildJourneyListItem({ id: 2, title: 'Trip B' });
    const j3 = buildJourneyListItem({ id: 3, title: 'Trip C' });
    setupDefaultHandlers([j1, j2, j3]);

    render(<JourneyPage />);
    await waitFor(() => {
      expect(screen.getByText('Trip A')).toBeInTheDocument();
    });
    // The count "3 journeys" text is displayed
    expect(screen.getByText(/3 journeys/i)).toBeInTheDocument();
  });

  // FE-PAGE-JOURNEY-011
  it('FE-PAGE-JOURNEY-011: clicking a journey card navigates to detail page', async () => {
    const user = userEvent.setup();
    const j1 = buildJourneyListItem({ id: 42, title: 'Morocco Road Trip' });
    setupDefaultHandlers([j1]);

    render(<JourneyPage />);
    await waitFor(() => {
      expect(screen.getByText('Morocco Road Trip')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Morocco Road Trip'));
    expect(mockNavigate).toHaveBeenCalledWith('/journey/42');
  });

  // FE-PAGE-JOURNEY-012
  it('FE-PAGE-JOURNEY-012: create journey form submission navigates to new journey', async () => {
    const user = userEvent.setup();
    const createdJourney = { id: 99, user_id: 1, title: 'My New Journey', subtitle: null, cover_gradient: null, cover_image: null, status: 'draft', created_at: Date.now(), updated_at: Date.now() };

    server.use(
      http.get('/api/journeys', () => HttpResponse.json({ journeys: [] })),
      http.get('/api/journeys/suggestions', () => HttpResponse.json({ trips: [] })),
      http.get('/api/journeys/available-trips', () =>
        HttpResponse.json({ trips: [
          { id: 5, title: 'Thailand 2026', start_date: '2026-05-01', end_date: '2026-05-14', place_count: 8 },
        ] })
      ),
      http.post('/api/journeys', () => HttpResponse.json(createdJourney)),
    );

    render(<JourneyPage />);
    await waitFor(() => {
      expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
    });

    // Open the create modal
    const createButtons = screen.getAllByText(/Create Journey/i);
    await user.click(createButtons[0]);

    // Fill name
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Southeast Asia 2026/i)).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/Southeast Asia 2026/i), 'My New Journey');

    // Select a trip
    await waitFor(() => {
      expect(screen.getByText('Thailand 2026')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Thailand 2026'));

    // The modal footer has a Create/Create Journey button — find it by its disabled-capable parent
    // The footer buttons live inside the border-t div at the bottom of the modal
    const footerDiv = document.querySelector('.border-t.border-zinc-200');
    const footerButtons = footerDiv?.querySelectorAll('button');
    // The last button in the footer is the submit button
    const submitBtn = footerButtons ? footerButtons[footerButtons.length - 1] : null;
    expect(submitBtn).toBeTruthy();
    await user.click(submitBtn!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/journey/99');
    });
  });

  // FE-PAGE-JOURNEY-013
  it('FE-PAGE-JOURNEY-013: journey card shows entry/photo/city counts', async () => {
    const j1 = buildJourneyListItem({
      id: 20,
      title: 'Stats Journey',
      entry_count: 12,
      photo_count: 47,
      city_count: 5,
    });
    setupDefaultHandlers([j1]);

    render(<JourneyPage />);
    await waitFor(() => {
      expect(screen.getByText('Stats Journey')).toBeInTheDocument();
    });

    // The card renders entry_count, photo_count, city_count values
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  // FE-PAGE-JOURNEY-014
  it('FE-PAGE-JOURNEY-014: journey card shows draft status badge', async () => {
    const j1 = buildJourneyListItem({ id: 30, title: 'Draft Journey', status: 'draft' });
    setupDefaultHandlers([j1]);

    render(<JourneyPage />);
    await waitFor(() => {
      expect(screen.getByText('Draft Journey')).toBeInTheDocument();
    });

    // Draft badge rendered
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  // FE-PAGE-JOURNEY-015
  it('FE-PAGE-JOURNEY-015: timeAgo renders "just now" for recent updates', async () => {
    const active = buildJourneyListItem({
      id: 40,
      title: 'Recent Active',
      status: 'active',
      updated_at: Date.now() - 60000, // 1 minute ago
    });
    setupDefaultHandlers([active]);

    render(<JourneyPage />);
    await waitFor(() => {
      expect(screen.getByText('Recent Active')).toBeInTheDocument();
    });

    // timeAgo should show "just now" for < 1 hour
    expect(screen.getByText(/Updated just now/i)).toBeInTheDocument();
  });

  // FE-PAGE-JOURNEY-016
  it('FE-PAGE-JOURNEY-016: timeAgo renders hours ago', async () => {
    const active = buildJourneyListItem({
      id: 41,
      title: 'Hours Active',
      status: 'active',
      updated_at: Date.now() - 3 * 3600000, // 3 hours ago
    });
    setupDefaultHandlers([active]);

    render(<JourneyPage />);
    await waitFor(() => {
      expect(screen.getByText('Hours Active')).toBeInTheDocument();
    });

    // timeAgo shows "{count}h ago"
    expect(screen.getByText(/Updated 3h ago/i)).toBeInTheDocument();
  });

  // FE-PAGE-JOURNEY-017
  it('FE-PAGE-JOURNEY-017: timeAgo renders days ago', async () => {
    const active = buildJourneyListItem({
      id: 42,
      title: 'Days Active',
      status: 'active',
      updated_at: Date.now() - 5 * 24 * 3600000, // 5 days ago
    });
    setupDefaultHandlers([active]);

    render(<JourneyPage />);
    await waitFor(() => {
      expect(screen.getByText('Days Active')).toBeInTheDocument();
    });

    // timeAgo shows "{count}d ago"
    expect(screen.getByText(/Updated 5d ago/i)).toBeInTheDocument();
  });

  // FE-PAGE-JOURNEY-018
  it('FE-PAGE-JOURNEY-018: active journey hero shows "Continue writing" button', async () => {
    const active = buildJourneyListItem({ id: 50, title: 'Writing Journey', status: 'active' });
    setupDefaultHandlers([active]);

    render(<JourneyPage />);
    await waitFor(() => {
      expect(screen.getByText('Writing Journey')).toBeInTheDocument();
    });

    expect(screen.getByText('Continue writing')).toBeInTheDocument();
  });

  // FE-PAGE-JOURNEY-019
  it('FE-PAGE-JOURNEY-019: active journey hero shows Live and Synced badges', async () => {
    const active = buildJourneyListItem({ id: 51, title: 'Live Journey', status: 'active' });
    setupDefaultHandlers([active]);

    render(<JourneyPage />);
    await waitFor(() => {
      expect(screen.getByText('Live Journey')).toBeInTheDocument();
    });

    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Synced')).toBeInTheDocument();
  });

  // FE-PAGE-JOURNEY-020
  it('FE-PAGE-JOURNEY-020: clicking active journey hero navigates to its detail page', async () => {
    const user = userEvent.setup();
    const active = buildJourneyListItem({ id: 60, title: 'Clickable Hero', status: 'active' });
    setupDefaultHandlers([active]);

    render(<JourneyPage />);
    await waitFor(() => {
      expect(screen.getByText('Clickable Hero')).toBeInTheDocument();
    });

    // Click the hero card title
    await user.click(screen.getByText('Clickable Hero'));
    expect(mockNavigate).toHaveBeenCalledWith('/journey/60');
  });
});
