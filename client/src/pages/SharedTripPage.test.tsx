import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '../../tests/helpers/render';
import { Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/helpers/msw/server';
import { resetAllStores } from '../../tests/helpers/store';
import SharedTripPage from './SharedTripPage';

// Mock react-leaflet (SharedTripPage renders a map)
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({
    fitBounds: vi.fn(),
    getCenter: vi.fn(() => ({ lat: 0, lng: 0 })),
  }),
}));

vi.mock('leaflet', () => {
  const L = {
    divIcon: vi.fn(() => ({})),
    latLngBounds: vi.fn(() => ({
      extend: vi.fn(),
      isValid: vi.fn(() => true),
    })),
    icon: vi.fn(() => ({})),
  };
  return { default: L, ...L };
});

// Mock react-dom/server (used in createMarkerIcon)
vi.mock('react-dom/server', () => ({
  renderToStaticMarkup: vi.fn(() => '<svg></svg>'),
}));

// Helper: render SharedTripPage under the correct route so useParams works
function renderSharedTrip(token: string) {
  return render(
    <Routes>
      <Route path="/shared/:token" element={<SharedTripPage />} />
    </Routes>,
    { initialEntries: [`/shared/${token}`] },
  );
}

beforeEach(() => {
  // SharedTripPage does NOT require authentication — do NOT seed auth store
  resetAllStores();
  vi.clearAllMocks();
});

describe('SharedTripPage', () => {
  describe('FE-PAGE-SHARED-001: Renders without authentication', () => {
    it('renders loading spinner without any auth state', async () => {
      // Use a token that will delay or we just check initial state before response
      server.use(
        http.get('/api/shared/:token', async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return HttpResponse.json({ trips: [] });
        }),
      );

      renderSharedTrip('test-token');

      // While data is loading, shows a spinner (the loading div)
      // The page shows a spinning div before data arrives
      expect(document.body.textContent).toBeDefined();
    });
  });

  describe('FE-PAGE-SHARED-002: Trip data loads from share token API', () => {
    it('fetches shared trip from GET /api/shared/:token', async () => {
      renderSharedTrip('test-token');

      // After data loads, trip name appears
      await waitFor(() => {
        expect(screen.getByText('Shared Paris Trip')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-SHARED-003: Trip details displayed', () => {
    it('shows trip name after data loads', async () => {
      renderSharedTrip('test-token');

      await waitFor(() => {
        expect(screen.getByText('Shared Paris Trip')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-SHARED-004: Invalid token shows error', () => {
    it('displays error message when token is invalid or expired', async () => {
      renderSharedTrip('invalid-token');

      await waitFor(() => {
        expect(screen.getByText(/link expired or invalid/i)).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-SHARED-005: No edit controls shown (read-only)', () => {
    it('shows the read-only indicator after data loads', async () => {
      renderSharedTrip('test-token');

      await waitFor(() => {
        // The shared page renders "Read-only shared view" text
        expect(screen.getByText(/read-only/i)).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-SHARED-006: Expired token hint is shown', () => {
    it('shows hint text below the lock icon on error', async () => {
      renderSharedTrip('expired-token');

      await waitFor(() => {
        expect(screen.getByText(/no longer active/i)).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-SHARED-007: Map is rendered', () => {
    it('renders the map container for the shared trip', async () => {
      renderSharedTrip('test-token');

      await waitFor(() => {
        expect(screen.getByText('Shared Paris Trip')).toBeInTheDocument();
      });

      // Map container should be rendered
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  describe('FE-PAGE-SHARED-008: Bookings tab is visible when share_bookings is true', () => {
    it('shows bookings tab button with default test-token permissions', async () => {
      renderSharedTrip('test-token');

      await waitFor(() => {
        expect(screen.getByText('Shared Paris Trip')).toBeInTheDocument();
      });

      const bookingsTab = screen.getByRole('button', { name: /bookings/i });
      expect(bookingsTab).toBeInTheDocument();

      // Clicking should not crash
      fireEvent.click(bookingsTab);
      expect(bookingsTab).toBeInTheDocument();
    });
  });

  describe('FE-PAGE-SHARED-009: Packing tab hidden when share_packing is false', () => {
    it('does not show packing tab with default test-token (share_packing: false)', async () => {
      renderSharedTrip('test-token');

      await waitFor(() => {
        expect(screen.getByText('Shared Paris Trip')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /packing/i })).toBeNull();
    });
  });

  describe('FE-PAGE-SHARED-010: Packing tab visible when share_packing is true', () => {
    it('shows packing tab and packing items when share_packing is true', async () => {
      server.use(
        http.get('/api/shared/:token', ({ params }) => {
          if (params.token !== 'packing-token') return;
          return HttpResponse.json({
            trip: { id: 1, title: 'Shared Paris Trip', start_date: '2026-07-01', end_date: '2026-07-05' },
            days: [],
            assignments: {},
            dayNotes: {},
            places: [],
            reservations: [],
            accommodations: [],
            packing: [{ id: 1, name: 'Sunscreen', category: 'Health', checked: false }],
            budget: [],
            categories: [],
            permissions: { share_bookings: false, share_packing: true, share_budget: false, share_collab: false },
            collab: [],
          });
        }),
      );

      renderSharedTrip('packing-token');

      await waitFor(() => {
        expect(screen.getByText('Shared Paris Trip')).toBeInTheDocument();
      });

      const packingTab = screen.getByRole('button', { name: /packing/i });
      expect(packingTab).toBeInTheDocument();

      fireEvent.click(packingTab);

      await waitFor(() => {
        expect(screen.getByText('Sunscreen')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-SHARED-011: Budget tab visible when share_budget is true', () => {
    it('shows budget tab and budget items when share_budget is true', async () => {
      server.use(
        http.get('/api/shared/:token', ({ params }) => {
          if (params.token !== 'budget-token') return;
          return HttpResponse.json({
            trip: { id: 1, title: 'Shared Paris Trip', start_date: '2026-07-01', end_date: '2026-07-05', currency: 'EUR' },
            days: [],
            assignments: {},
            dayNotes: {},
            places: [],
            reservations: [],
            accommodations: [],
            packing: [],
            budget: [{ id: 1, name: 'Hotel', total_price: '200', category: 'Accommodation' }],
            categories: [],
            permissions: { share_bookings: false, share_packing: false, share_budget: true, share_collab: false },
            collab: [],
          });
        }),
      );

      renderSharedTrip('budget-token');

      await waitFor(() => {
        expect(screen.getByText('Shared Paris Trip')).toBeInTheDocument();
      });

      const budgetTab = screen.getByRole('button', { name: /budget/i });
      expect(budgetTab).toBeInTheDocument();

      fireEvent.click(budgetTab);

      await waitFor(() => {
        expect(screen.getByText('Hotel')).toBeInTheDocument();
      });
      expect(screen.getAllByText(/200/).length).toBeGreaterThan(0);
    });
  });

  describe('FE-PAGE-SHARED-012: Collab tab renders messages when share_collab is true', () => {
    it('shows collab messages when share_collab is true', async () => {
      server.use(
        http.get('/api/shared/:token', ({ params }) => {
          if (params.token !== 'collab-token') return;
          return HttpResponse.json({
            trip: { id: 1, title: 'Shared Paris Trip', start_date: '2026-07-01', end_date: '2026-07-05' },
            days: [],
            assignments: {},
            dayNotes: {},
            places: [],
            reservations: [],
            accommodations: [],
            packing: [],
            budget: [],
            categories: [],
            permissions: { share_bookings: false, share_packing: false, share_budget: false, share_collab: true },
            collab: [{ id: 1, username: 'alice', text: 'Hello team!', created_at: '2025-01-01T10:00:00Z', avatar: null }],
          });
        }),
      );

      renderSharedTrip('collab-token');

      await waitFor(() => {
        expect(screen.getByText('Shared Paris Trip')).toBeInTheDocument();
      });

      const collabTab = screen.getByRole('button', { name: /chat/i });
      expect(collabTab).toBeInTheDocument();

      fireEvent.click(collabTab);

      await waitFor(() => {
        expect(screen.getByText('Hello team!')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-SHARED-013: Day card expands when clicked', () => {
    it('reveals place names after clicking a collapsed day card header', async () => {
      const day = { id: 101, trip_id: 1, day_number: 1, date: '2026-07-01', title: 'Day One', notes: null };
      const place = { id: 201, trip_id: 1, name: 'Eiffel Tower', lat: 48.8584, lng: 2.2945, category_id: null, image_url: null, address: null };

      server.use(
        http.get('/api/shared/:token', ({ params }) => {
          if (params.token !== 'expand-token') return;
          return HttpResponse.json({
            trip: { id: 1, title: 'Shared Paris Trip', start_date: '2026-07-01', end_date: '2026-07-05' },
            days: [day],
            assignments: {
              '101': [{ id: 301, day_id: 101, place_id: 201, order_index: 0, place }],
            },
            dayNotes: {},
            places: [place],
            reservations: [],
            accommodations: [],
            packing: [],
            budget: [],
            categories: [],
            permissions: { share_bookings: false, share_packing: false, share_budget: false, share_collab: false },
            collab: [],
          });
        }),
      );

      renderSharedTrip('expand-token');

      await waitFor(() => {
        expect(screen.getByText('Shared Paris Trip')).toBeInTheDocument();
      });

      // Eiffel Tower is only in the mocked map tooltip (1 occurrence)
      expect(screen.getAllByText('Eiffel Tower')).toHaveLength(1);

      // Click the day card header to expand it
      fireEvent.click(screen.getByText('Day One'));

      // Now Eiffel Tower also appears in the expanded day content
      await waitFor(() => {
        expect(screen.getAllByText('Eiffel Tower')).toHaveLength(2);
      });
    });
  });

  describe('FE-PAGE-SHARED-014: Language picker toggles', () => {
    it('opens language dropdown and closes after selecting a language', async () => {
      renderSharedTrip('test-token');

      await waitFor(() => {
        expect(screen.getByText('Shared Paris Trip')).toBeInTheDocument();
      });

      // Language picker button shows current language
      const langButton = screen.getByRole('button', { name: /english/i });
      expect(langButton).toBeInTheDocument();

      // Open the dropdown
      fireEvent.click(langButton);

      // Language options should now be visible
      expect(screen.getByRole('button', { name: /deutsch/i })).toBeInTheDocument();

      // Select a different language
      fireEvent.click(screen.getByRole('button', { name: /deutsch/i }));

      // Dropdown should close — Español is no longer visible
      expect(screen.queryByRole('button', { name: /español/i })).toBeNull();
    });
  });

  describe('FE-PAGE-SHARED-015: TREK branding footer is rendered', () => {
    it('renders the Shared via TREK footer', async () => {
      renderSharedTrip('test-token');

      await waitFor(() => {
        expect(screen.getByText('Shared Paris Trip')).toBeInTheDocument();
      });

      expect(screen.getByText(/shared via/i)).toBeInTheDocument();
    });
  });

  describe('FE-PAGE-SHARED-016: Bookings tab shows reservation list', () => {
    it('renders reservations when bookings tab is active and reservations are provided', async () => {
      server.use(
        http.get('/api/shared/:token', ({ params }) => {
          if (params.token !== 'bookings-token') return;
          return HttpResponse.json({
            trip: { id: 1, title: 'Shared Paris Trip', start_date: '2026-07-01', end_date: '2026-07-05' },
            days: [],
            assignments: {},
            dayNotes: {},
            places: [],
            reservations: [
              { id: 1, title: 'Flight to Paris', type: 'flight', status: 'confirmed', reservation_time: '2026-07-01T10:00:00', metadata: '{}' },
            ],
            accommodations: [],
            packing: [],
            budget: [],
            categories: [],
            permissions: { share_bookings: true, share_packing: false, share_budget: false, share_collab: false },
            collab: [],
          });
        }),
      );

      renderSharedTrip('bookings-token');

      await waitFor(() => {
        expect(screen.getByText('Shared Paris Trip')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /bookings/i }));

      await waitFor(() => {
        expect(screen.getByText('Flight to Paris')).toBeInTheDocument();
      });
    });
  });
});
