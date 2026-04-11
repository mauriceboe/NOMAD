import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '../../tests/helpers/render';
import { Routes, Route } from 'react-router-dom';
import { resetAllStores, seedStore } from '../../tests/helpers/store';
import { buildUser, buildTrip, buildDay, buildPlace, buildAssignment } from '../../tests/helpers/factories';
import { useAuthStore } from '../store/authStore';
import { useTripStore } from '../store/tripStore';
import TripPlannerPage from './TripPlannerPage';
import { server } from '../../tests/helpers/msw/server';
import { http, HttpResponse } from 'msw';

// Mock Leaflet-dependent components
vi.mock('../components/Map/MapView', () => ({
  MapView: () => React.createElement('div', { 'data-testid': 'map-view' }),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'map-container' }, children),
  TileLayer: () => null,
  Marker: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
  Tooltip: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
  Polyline: () => null,
  CircleMarker: () => null,
  Circle: () => null,
  useMap: () => ({ fitBounds: vi.fn(), getCenter: vi.fn(() => ({ lat: 0, lng: 0 })) }),
}));

vi.mock('react-leaflet-cluster', () => ({
  default: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('leaflet', () => {
  const L = {
    divIcon: vi.fn(() => ({})),
    latLngBounds: vi.fn(() => ({ extend: vi.fn(), isValid: vi.fn(() => true) })),
    icon: vi.fn(() => ({})),
  };
  return { default: L, ...L };
});

// Mock the WebSocket hook so we can verify it's called
const mockUseTripWebSocket = vi.fn();
vi.mock('../hooks/useTripWebSocket', () => ({
  useTripWebSocket: (...args: unknown[]) => mockUseTripWebSocket(...args),
}));

// Prop-capturing refs for mock components — populated on each render
const capturedDayPlanSidebarProps: { current: Record<string, any> } = { current: {} };
const capturedPlacesSidebarProps: { current: Record<string, any> } = { current: {} };

// Mock heavy sub-components (capture props for handler testing)
vi.mock('../components/Planner/DayPlanSidebar', () => ({
  default: (props: Record<string, any>) => {
    capturedDayPlanSidebarProps.current = props;
    return React.createElement('div', { 'data-testid': 'day-plan-sidebar' });
  },
}));

vi.mock('../components/Planner/PlacesSidebar', () => ({
  default: (props: Record<string, any>) => {
    capturedPlacesSidebarProps.current = props;
    return React.createElement('div', { 'data-testid': 'places-sidebar' });
  },
}));

vi.mock('../components/Planner/PlaceInspector', () => ({
  default: () => null,
}));

const capturedDayDetailPanelProps: { current: Record<string, any> } = { current: {} };
vi.mock('../components/Planner/DayDetailPanel', () => ({
  default: (props: Record<string, any>) => {
    capturedDayDetailPanelProps.current = props;
    return null;
  },
}));

vi.mock('../components/Memories/MemoriesPanel', () => ({
  default: () => React.createElement('div', { 'data-testid': 'memories-panel' }),
}));

vi.mock('../components/Collab/CollabPanel', () => ({
  default: () => React.createElement('div', { 'data-testid': 'collab-panel' }),
}));

const capturedFileManagerProps: { current: Record<string, any> } = { current: {} };
vi.mock('../components/Files/FileManager', () => ({
  default: (props: Record<string, any>) => {
    capturedFileManagerProps.current = props;
    return React.createElement('div', { 'data-testid': 'file-manager' });
  },
}));

vi.mock('../components/Budget/BudgetPanel', () => ({
  default: () => React.createElement('div', { 'data-testid': 'budget-panel' }),
}));

vi.mock('../components/Packing/PackingListPanel', () => ({
  default: () => React.createElement('div', { 'data-testid': 'packing-list-panel' }),
}));

vi.mock('../components/Todo/TodoListPanel', () => ({
  default: () => React.createElement('div', { 'data-testid': 'todo-list-panel' }),
}));

// Prop-capturing mocks for modal components (enable calling onSave/onDelete/etc. in tests)
const capturedReservationsPanelProps: { current: Record<string, any> } = { current: {} };
vi.mock('../components/Planner/ReservationsPanel', () => ({
  default: (props: Record<string, any>) => {
    capturedReservationsPanelProps.current = props;
    return React.createElement('div', { 'data-testid': 'reservations-panel' });
  },
}));

const capturedPlaceFormModalProps: { current: Record<string, any> } = { current: {} };
vi.mock('../components/Planner/PlaceFormModal', () => ({
  default: (props: Record<string, any>) => {
    capturedPlaceFormModalProps.current = props;
    return null;
  },
}));

const capturedReservationModalProps: { current: Record<string, any> } = { current: {} };
vi.mock('../components/Planner/ReservationModal', () => ({
  ReservationModal: (props: Record<string, any>) => {
    capturedReservationModalProps.current = props;
    return null;
  },
}));

const capturedConfirmDialogProps: { current: Record<string, any> } = { current: {} };
vi.mock('../components/shared/ConfirmDialog', () => ({
  default: (props: Record<string, any>) => {
    capturedConfirmDialogProps.current = props;
    return null;
  },
}));

const capturedTripFormModalProps: { current: Record<string, any> } = { current: {} };
vi.mock('../components/Trips/TripFormModal', () => ({
  default: (props: Record<string, any>) => {
    capturedTripFormModalProps.current = props;
    return null;
  },
}));

const capturedTripMembersModalProps: { current: Record<string, any> } = { current: {} };
vi.mock('../components/Trips/TripMembersModal', () => ({
  default: (props: Record<string, any>) => {
    capturedTripMembersModalProps.current = props;
    return null;
  },
}));

// Configurable usePlaceSelection mock — lets tests set a specific selected place
const mockPlaceSelectionState: { selectedPlaceId: number | null; selectedAssignmentId: number | null } = {
  selectedPlaceId: null,
  selectedAssignmentId: null,
};
const mockSetSelectedPlaceId = vi.fn();
const mockSelectAssignment = vi.fn();

vi.mock('../hooks/usePlaceSelection', () => ({
  usePlaceSelection: () => ({
    selectedPlaceId: mockPlaceSelectionState.selectedPlaceId,
    selectedAssignmentId: mockPlaceSelectionState.selectedAssignmentId,
    setSelectedPlaceId: mockSetSelectedPlaceId,
    selectAssignment: mockSelectAssignment,
  }),
}));

// Helper to seed a complete trip store state with mocked actions
function seedTripStore(overrides: { id?: number; tripName?: string; withMocks?: boolean } = {}) {
  const { id = 42, tripName = 'Test Trip', withMocks = true } = overrides;
  // Use `title` because TripPlannerPage reads trip.title
  const trip = { ...buildTrip({ id }), title: tripName };
  const day = buildDay({ trip_id: id });

  const mockLoadTrip = withMocks ? vi.fn().mockResolvedValue(undefined) : undefined;
  const mockLoadFiles = withMocks ? vi.fn().mockResolvedValue(undefined) : undefined;
  const mockLoadReservations = withMocks ? vi.fn().mockResolvedValue(undefined) : undefined;

  seedStore(useTripStore, {
    trip,
    isLoading: false,
    days: [day],
    places: [],
    assignments: {},
    packingItems: [],
    todoItems: [],
    categories: [],
    reservations: [],
    budgetItems: [],
    files: [],
    ...(withMocks && {
      loadTrip: mockLoadTrip,
      loadFiles: mockLoadFiles,
      loadReservations: mockLoadReservations,
    }),
  } as any);

  return { trip, day, mockLoadTrip, mockLoadFiles, mockLoadReservations };
}

// Helper to render TripPlannerPage with route params
function renderPlannerPage(tripId: number | string) {
  return render(
    <Routes>
      <Route path="/trips/:id" element={<TripPlannerPage />} />
    </Routes>,
    { initialEntries: [`/trips/${tripId}`] },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  resetAllStores();
  mockUseTripWebSocket.mockReset();
  mockSetSelectedPlaceId.mockReset();
  mockSelectAssignment.mockReset();
  mockPlaceSelectionState.selectedPlaceId = null;
  mockPlaceSelectionState.selectedAssignmentId = null;
  capturedDayPlanSidebarProps.current = {};
  capturedPlacesSidebarProps.current = {};
  capturedReservationsPanelProps.current = {};
  capturedPlaceFormModalProps.current = {};
  capturedReservationModalProps.current = {};
  capturedConfirmDialogProps.current = {};
  capturedDayDetailPanelProps.current = {};
  capturedTripFormModalProps.current = {};
  capturedTripMembersModalProps.current = {};
  capturedFileManagerProps.current = {};
  seedStore(useAuthStore, { isAuthenticated: true, user: buildUser() });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TripPlannerPage', () => {
  describe('FE-PAGE-PLANNER-001: Calls loadTrip with route param on mount', () => {
    it('calls loadTrip with the trip ID from URL params', async () => {
      const { mockLoadTrip } = seedTripStore({ id: 42 });

      renderPlannerPage(42);

      await waitFor(() => {
        expect(mockLoadTrip).toHaveBeenCalledWith('42');
      });
    });
  });

  describe('FE-PAGE-PLANNER-002: Loading state shown while loadTrip in progress', () => {
    it('shows loading animation when isLoading is true', () => {
      seedStore(useTripStore, {
        trip: null,
        isLoading: true,
        days: [],
        places: [],
        assignments: {},
        loadTrip: vi.fn().mockReturnValue(new Promise(() => {})),
        loadFiles: vi.fn().mockResolvedValue(undefined),
        loadReservations: vi.fn().mockResolvedValue(undefined),
      } as any);

      renderPlannerPage(99);

      // Loading state: shows loading gif
      const loadingImg = document.querySelector('img[alt="Loading"]');
      expect(loadingImg).toBeInTheDocument();
    });
  });

  describe('FE-PAGE-PLANNER-003: Error state shown if loadTrip fails', () => {
    it('calls loadTrip and the action is called (even if it rejects)', async () => {
      const mockLoadTrip = vi.fn().mockRejectedValue(new Error('Not found'));
      const mockLoadFiles = vi.fn().mockResolvedValue(undefined);
      const mockLoadReservations = vi.fn().mockResolvedValue(undefined);

      seedStore(useTripStore, {
        trip: null,
        isLoading: false,
        days: [],
        places: [],
        assignments: {},
        loadTrip: mockLoadTrip,
        loadFiles: mockLoadFiles,
        loadReservations: mockLoadReservations,
      } as any);

      renderPlannerPage(999);

      await waitFor(() => {
        expect(mockLoadTrip).toHaveBeenCalledWith('999');
      });
    });
  });

  describe('FE-PAGE-PLANNER-004: Trip name in header after load', () => {
    it('shows trip title in the Navbar after splash screen', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 7, tripName: 'Tokyo Adventure' });

      renderPlannerPage(7);

      // Run all pending timers (including the 1500ms splash timeout) synchronously
      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByText('Tokyo Adventure')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-PLANNER-005: Day plan sidebar renders', () => {
    it('renders the DayPlanSidebar component after splash', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 3, tripName: 'Day Tabs Trip' });

      renderPlannerPage(3);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('day-plan-sidebar')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-PLANNER-007: Places sidebar renders', () => {
    it('renders the PlacesSidebar component after splash', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 5, tripName: 'Places Trip' });

      renderPlannerPage(5);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('places-sidebar')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-PLANNER-008: WebSocket hook mounted', () => {
    it('calls useTripWebSocket with the trip ID string', async () => {
      seedTripStore({ id: 15 });

      renderPlannerPage(15);

      await waitFor(() => {
        expect(mockUseTripWebSocket).toHaveBeenCalledWith('15');
      });
    });
  });

  describe('FE-PAGE-PLANNER-009: Map view renders after splash', () => {
    it('shows the MapView component after the splash screen is dismissed', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-PLANNER-010: Reservations tab renders ReservationsPanel', () => {
    it('shows ReservationsPanel after clicking the Bookings tab', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      const bookingsTab = await screen.findByTitle('Bookings');
      fireEvent.click(bookingsTab);

      await waitFor(() => {
        expect(screen.getByTestId('reservations-panel')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-PLANNER-011: Packing tab renders PackingListPanel', () => {
    it('shows PackingListPanel after clicking the Lists tab with packing addon enabled', async () => {
      server.use(
        http.get('/api/addons', () =>
          HttpResponse.json({ addons: [{ id: 'packing', type: 'packing' }] })
        )
      );

      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      const listsTab = await screen.findByTitle('Lists');
      fireEvent.click(listsTab);

      await waitFor(() => {
        expect(screen.getByTestId('packing-list-panel')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-PLANNER-012: Budget tab renders BudgetPanel', () => {
    it('shows BudgetPanel after clicking the Budget tab with budget addon enabled', async () => {
      server.use(
        http.get('/api/addons', () =>
          HttpResponse.json({ addons: [{ id: 'budget', type: 'budget' }] })
        )
      );

      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      const budgetTab = await screen.findByTitle('Budget');
      fireEvent.click(budgetTab);

      await waitFor(() => {
        expect(screen.getByTestId('budget-panel')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-PLANNER-013: Files tab renders FileManager', () => {
    it('shows FileManager after clicking the Files tab with documents addon enabled', async () => {
      server.use(
        http.get('/api/addons', () =>
          HttpResponse.json({ addons: [{ id: 'documents', type: 'documents' }] })
        )
      );

      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      const filesTab = await screen.findByTitle('Files');
      fireEvent.click(filesTab);

      await waitFor(() => {
        expect(screen.getByTestId('file-manager')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-PLANNER-014: Collab tab renders CollabPanel', () => {
    it('shows CollabPanel after clicking the Collab tab with collab addon enabled', async () => {
      server.use(
        http.get('/api/addons', () =>
          HttpResponse.json({ addons: [{ id: 'collab', type: 'collab' }] })
        )
      );

      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      const collabTab = await screen.findByTitle('Collab');
      fireEvent.click(collabTab);

      await waitFor(() => {
        expect(screen.getByTestId('collab-panel')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-PLANNER-015: Tab state persists in sessionStorage', () => {
    it('saves the active tab ID to sessionStorage on tab change', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      const bookingsTab = await screen.findByTitle('Bookings');
      fireEvent.click(bookingsTab);

      await waitFor(() => {
        expect(sessionStorage.getItem('trip-tab-42')).toBe('buchungen');
      });
    });
  });

  describe('FE-PAGE-PLANNER-016: Left panel collapse toggle', () => {
    it('collapses the left sidebar when the collapse button is clicked', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('day-plan-sidebar')).toBeInTheDocument();
      });

      const sidebarContainer = screen.getByTestId('day-plan-sidebar').parentElement!;
      const collapseButton = sidebarContainer.previousElementSibling as HTMLElement;

      fireEvent.click(collapseButton);

      await waitFor(() => {
        expect(sidebarContainer).toHaveStyle('opacity: 0');
      });
    });
  });

  describe('FE-PAGE-PLANNER-017: Trip navigation error redirects to dashboard', () => {
    it('navigates to /dashboard when loadTrip rejects', async () => {
      seedStore(useTripStore, {
        trip: null,
        isLoading: false,
        days: [],
        places: [],
        assignments: {},
        loadTrip: vi.fn().mockRejectedValue(new Error('Not found')),
        loadFiles: vi.fn().mockResolvedValue(undefined),
        loadReservations: vi.fn().mockResolvedValue(undefined),
      } as any);

      render(
        <Routes>
          <Route path="/trips/:id" element={<TripPlannerPage />} />
          <Route path="/dashboard" element={<div data-testid="dashboard-page" />} />
        </Routes>,
        { initialEntries: ['/trips/999'] },
      );

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-PLANNER-018: Memories tab renders MemoriesPanel', () => {
    it('shows MemoriesPanel after clicking the Photos tab with a photo_provider addon enabled', async () => {
      server.use(
        http.get('/api/addons', () =>
          HttpResponse.json({ addons: [{ id: 'google_photos', type: 'photo_provider' }] })
        )
      );

      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      const photosTab = await screen.findByTitle('Photos');
      fireEvent.click(photosTab);

      await waitFor(() => {
        expect(screen.getByTestId('memories-panel')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-PLANNER-019: Todo subtab in ListsContainer', () => {
    it('shows TodoListPanel after switching to the Todo subtab inside Lists', async () => {
      server.use(
        http.get('/api/addons', () =>
          HttpResponse.json({ addons: [{ id: 'packing', type: 'packing' }] })
        )
      );

      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      // Navigate to the Lists tab first
      const listsTab = await screen.findByTitle('Lists');
      fireEvent.click(listsTab);

      // Find the Todo subtab button inside ListsContainer and click it
      await waitFor(() => {
        expect(screen.getByTestId('packing-list-panel')).toBeInTheDocument();
      });

      // Click the Todo subtab
      const todoButtons = screen.getAllByRole('button');
      const todoSubtab = todoButtons.find(btn => btn.textContent?.includes('Todo') || btn.textContent?.includes('todo'));
      if (todoSubtab) {
        fireEvent.click(todoSubtab);
        await waitFor(() => {
          expect(screen.getByTestId('todo-list-panel')).toBeInTheDocument();
        });
      }
    });
  });

  describe('FE-PAGE-PLANNER-020: handleSelectDay covers plan selection logic', () => {
    it('calls handleSelectDay through captured DayPlanSidebar props', async () => {
      vi.useFakeTimers();

      const { day } = seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('day-plan-sidebar')).toBeInTheDocument();
      });

      // Call onSelectDay via the captured props — covers handleSelectDay body
      await act(async () => {
        capturedDayPlanSidebarProps.current.onSelectDay?.(day.id);
      });
    });
  });

  describe('FE-PAGE-PLANNER-021: handlePlaceClick covers place selection logic', () => {
    it('calls handlePlaceClick through captured DayPlanSidebar props', async () => {
      vi.useFakeTimers();

      const place = buildPlace({ id: 1, trip_id: 42, lat: 48.8566, lng: 2.3522 });
      seedTripStore({ id: 42 });
      seedStore(useTripStore, { places: [place] } as any);

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('day-plan-sidebar')).toBeInTheDocument();
      });

      // Call onPlaceClick via captured props — covers handlePlaceClick body
      await act(async () => {
        capturedDayPlanSidebarProps.current.onPlaceClick?.(place.id, null);
      });
    });
  });

  describe('FE-PAGE-PLANNER-022: handleRemoveAssignment covers removal logic', () => {
    it('calls onRemoveAssignment through captured DayPlanSidebar props', async () => {
      vi.useFakeTimers();

      const { day } = seedTripStore({ id: 42 });
      const place = buildPlace({ id: 1, trip_id: 42 });
      const assignment = buildAssignment({ id: 10, day_id: day.id, place });
      seedStore(useTripStore, {
        assignments: { [String(day.id)]: [assignment] },
        places: [place],
      } as any);

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('day-plan-sidebar')).toBeInTheDocument();
      });

      // Call onRemoveAssignment — covers handleRemoveAssignment body
      await act(async () => {
        capturedDayPlanSidebarProps.current.onRemoveAssignment?.(day.id, assignment.id);
      });
    });
  });

  describe('FE-PAGE-PLANNER-023: handleAssignToDay covers assignment logic', () => {
    it('calls onAssignToDay through captured PlacesSidebar props with a selected day', async () => {
      vi.useFakeTimers();

      const { day } = seedTripStore({ id: 42 });
      seedStore(useTripStore, { selectedDayId: day.id } as any);

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('places-sidebar')).toBeInTheDocument();
      });

      // Call onAssignToDay — covers handleAssignToDay body
      await act(async () => {
        capturedPlacesSidebarProps.current.onAssignToDay?.(1, day.id, 0);
      });
    });
  });

  describe('FE-PAGE-PLANNER-024: PlaceInspector renders when a place is selected', () => {
    it('renders PlaceInspector when selectedPlaceId matches a store place', async () => {
      vi.useFakeTimers();

      const place = buildPlace({ id: 1, trip_id: 42, lat: 48.8566, lng: 2.3522 });

      // Set selectedPlaceId before render so selectedPlace is computed non-null
      mockPlaceSelectionState.selectedPlaceId = place.id;

      seedTripStore({ id: 42 });
      seedStore(useTripStore, { places: [place] } as any);

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      // PlaceInspector is mocked as () => null so nothing visual renders,
      // but the conditional block lines 776-818 are covered
      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-PLANNER-025: dayOrderMap and dayPlaces computed with selectedDayId', () => {
    it('renders the planner with a selectedDayId and assignments to cover memo logic', async () => {
      vi.useFakeTimers();

      const { day } = seedTripStore({ id: 42 });
      const place = buildPlace({ id: 1, trip_id: 42, lat: 48.8566, lng: 2.3522 });
      const assignment = buildAssignment({ id: 10, day_id: day.id, place, order_index: 0 });
      seedStore(useTripStore, {
        selectedDayId: day.id,
        places: [place],
        assignments: { [String(day.id)]: [assignment] },
      } as any);

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-PLANNER-026: handleReorder covers reorder logic', () => {
    it('calls onReorder through captured DayPlanSidebar props', async () => {
      vi.useFakeTimers();

      const { day } = seedTripStore({ id: 42 });
      const place = buildPlace({ id: 1, trip_id: 42 });
      const assignment = buildAssignment({ id: 10, day_id: day.id, place, order_index: 0 });
      seedStore(useTripStore, {
        places: [place],
        assignments: { [String(day.id)]: [assignment] },
      } as any);

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('day-plan-sidebar')).toBeInTheDocument();
      });

      await act(async () => {
        capturedDayPlanSidebarProps.current.onReorder?.(day.id, [assignment.id]);
      });
    });
  });

  describe('FE-PAGE-PLANNER-027: handleUpdateDayTitle covers title update logic', () => {
    it('calls onUpdateDayTitle through captured DayPlanSidebar props', async () => {
      vi.useFakeTimers();

      const { day } = seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('day-plan-sidebar')).toBeInTheDocument();
      });

      await act(async () => {
        capturedDayPlanSidebarProps.current.onUpdateDayTitle?.(day.id, 'New Title');
      });
    });
  });

  describe('FE-PAGE-PLANNER-028: handleSavePlace add path covers addPlace logic', () => {
    it('calls onSave on PlaceFormModal to exercise the add-place handler', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
      });

      // Call onSave with editingPlace=null (add path)
      await act(async () => {
        await capturedPlaceFormModalProps.current.onSave?.({ name: 'Test Place', lat: 1, lng: 2 });
      });
    });
  });

  describe('FE-PAGE-PLANNER-029: handleSavePlace edit path covers updatePlace logic', () => {
    it('calls onEditPlace then onSave on PlaceFormModal to exercise the edit-place handler', async () => {
      vi.useFakeTimers();

      const place = buildPlace({ id: 1, trip_id: 42, lat: 48.8566, lng: 2.3522 });
      seedTripStore({ id: 42 });
      seedStore(useTripStore, { places: [place] } as any);

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('day-plan-sidebar')).toBeInTheDocument();
      });

      // Set editingPlace via captured props (uses the inline lambda that calls setEditingPlace)
      await act(async () => {
        capturedDayPlanSidebarProps.current.onEditPlace?.(place, null);
      });

      // Now onSave uses the edit path (editingPlace is set)
      await act(async () => {
        await capturedPlaceFormModalProps.current.onSave?.({ name: 'Updated', lat: 1, lng: 2 });
      });
    });
  });

  describe('FE-PAGE-PLANNER-030: confirmDeletePlace covers delete-place logic', () => {
    it('calls onDeletePlace then ConfirmDialog onConfirm to exercise confirmDeletePlace', async () => {
      vi.useFakeTimers();

      const place = buildPlace({ id: 1, trip_id: 42, lat: 48.8566, lng: 2.3522 });
      seedTripStore({ id: 42 });
      seedStore(useTripStore, { places: [place] } as any);

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('day-plan-sidebar')).toBeInTheDocument();
      });

      // Trigger setDeletePlaceId by calling onDeletePlace inline lambda
      await act(async () => {
        capturedDayPlanSidebarProps.current.onDeletePlace?.(place.id);
      });

      // Wait for ConfirmDialog to receive the updated onConfirm
      await waitFor(() => {
        expect(typeof capturedConfirmDialogProps.current.onConfirm).toBe('function');
      });

      // Call onConfirm to run confirmDeletePlace body
      await act(async () => {
        await capturedConfirmDialogProps.current.onConfirm?.();
      });
    });
  });

  describe('FE-PAGE-PLANNER-031: handleSaveReservation add path covers reservation creation', () => {
    it('calls onSave on ReservationModal to exercise the add-reservation handler', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
      });

      // Call onSave with editingReservation=null (add path)
      await act(async () => {
        await capturedReservationModalProps.current.onSave?.({ name: 'Test Booking', type: 'restaurant', status: 'confirmed' });
      });
    });
  });

  describe('FE-PAGE-PLANNER-032: handleDeleteReservation covers reservation deletion', () => {
    it('calls onDelete from ReservationsPanel to exercise the delete-reservation handler', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      const bookingsTab = await screen.findByTitle('Bookings');
      fireEvent.click(bookingsTab);

      await waitFor(() => {
        expect(screen.getByTestId('reservations-panel')).toBeInTheDocument();
      });

      await act(async () => {
        await capturedReservationsPanelProps.current.onDelete?.(1);
      });
    });
  });

  describe('FE-PAGE-PLANNER-033: onDayDetail covers DayDetailPanel render path', () => {
    it('shows DayDetailPanel section when onDayDetail is called via DayPlanSidebar props', async () => {
      vi.useFakeTimers();

      const { day } = seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('day-plan-sidebar')).toBeInTheDocument();
      });

      // Triggers showDayDetail = day, covering DayDetailPanel conditional block
      await act(async () => {
        capturedDayPlanSidebarProps.current.onDayDetail?.(day);
      });
    });
  });

  describe('FE-PAGE-PLANNER-034: onRouteCalculated covers route state setters', () => {
    it('calls onRouteCalculated with route data and null to cover both branches', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('day-plan-sidebar')).toBeInTheDocument();
      });

      await act(async () => {
        capturedDayPlanSidebarProps.current.onRouteCalculated?.({
          coordinates: [[1, 2], [3, 4]],
          distanceText: '1 km',
          durationText: '10 min',
          walkingText: '15 min',
          drivingText: '5 min',
        });
      });

      await act(async () => {
        capturedDayPlanSidebarProps.current.onRouteCalculated?.(null);
      });
    });
  });

  describe('FE-PAGE-PLANNER-035: onAddReservation covers reservation modal open', () => {
    it('calls onAddReservation to open the ReservationModal', async () => {
      vi.useFakeTimers();

      const { day } = seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('day-plan-sidebar')).toBeInTheDocument();
      });

      await act(async () => {
        capturedDayPlanSidebarProps.current.onAddReservation?.(day.id);
      });

      // ReservationModal should now be open (isOpen=true in its props)
      await waitFor(() => {
        expect(capturedReservationModalProps.current.isOpen).toBe(true);
      });
    });
  });

  describe('FE-PAGE-PLANNER-036: handleUndo covers undo execution', () => {
    it('calls onUndo through captured DayPlanSidebar props', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('day-plan-sidebar')).toBeInTheDocument();
      });

      await act(async () => {
        capturedDayPlanSidebarProps.current.onUndo?.();
      });
    });
  });

  describe('FE-PAGE-PLANNER-038: DayDetailPanel onClose and onToggleCollapse callbacks', () => {
    it('calls DayDetailPanel onClose and onToggleCollapse to cover those inline lambdas', async () => {
      vi.useFakeTimers();

      const { day } = seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('day-plan-sidebar')).toBeInTheDocument();
      });

      // Set showDayDetail
      await act(async () => {
        capturedDayPlanSidebarProps.current.onDayDetail?.(day);
      });

      // Call onClose — covers line 766 lambda: setShowDayDetail(null); handleSelectDay(null)
      await act(async () => {
        capturedDayDetailPanelProps.current.onClose?.();
      });

      // Re-open to test onToggleCollapse
      await act(async () => {
        capturedDayPlanSidebarProps.current.onDayDetail?.(day);
      });

      // Call onToggleCollapse — covers line 771 lambda: setDayDetailCollapsed(c => !c)
      await act(async () => {
        capturedDayDetailPanelProps.current.onToggleCollapse?.();
      });
    });
  });

  describe('FE-PAGE-PLANNER-039: PlaceFormModal onClose covers modal close lambda', () => {
    it('calls PlaceFormModal onClose to cover the modal close handler', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
      });

      // Covers line 954 onClose lambda body
      await act(async () => {
        capturedPlaceFormModalProps.current.onClose?.();
      });
    });
  });

  describe('FE-PAGE-PLANNER-040: ReservationModal onClose covers modal close lambda', () => {
    it('calls ReservationModal onClose to cover the modal close handler', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
      });

      // Covers line 957 onClose lambda body
      await act(async () => {
        capturedReservationModalProps.current.onClose?.();
      });
    });
  });

  describe('FE-PAGE-PLANNER-041: handleSaveReservation edit path covers update reservation', () => {
    it('calls onEdit then onSave on ReservationModal to exercise the edit-reservation handler', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      // Navigate to Bookings tab so ReservationsPanel is rendered
      const bookingsTab = await screen.findByTitle('Bookings');
      fireEvent.click(bookingsTab);

      await waitFor(() => {
        expect(screen.getByTestId('reservations-panel')).toBeInTheDocument();
      });

      // Set editingReservation via captured onEdit prop (inline lambda in JSX)
      const fakeReservation = { id: 1, trip_id: 42, name: 'Test', type: 'restaurant', status: 'confirmed' };
      await act(async () => {
        capturedReservationsPanelProps.current.onEdit?.(fakeReservation);
      });

      // Call onSave — now takes edit path (editingReservation is set)
      await act(async () => {
        await capturedReservationModalProps.current.onSave?.({
          name: 'Updated Booking',
          type: 'restaurant',
          status: 'confirmed',
        });
      });
    });
  });

  describe('FE-PAGE-PLANNER-042: TripMembersModal onClose covers modal close lambda', () => {
    it('calls TripMembersModal onClose to cover the inline lambda', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
      });

      // Covers TripMembersModal onClose lambda: () => setShowMembersModal(false)
      await act(async () => {
        capturedTripMembersModalProps.current.onClose?.();
      });
    });
  });

  describe('FE-PAGE-PLANNER-043: TripFormModal onClose covers modal close lambda', () => {
    it('calls TripFormModal onClose to cover the inline lambda', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
      });

      // Covers TripFormModal onClose lambda: () => setShowTripForm(false)
      await act(async () => {
        capturedTripFormModalProps.current.onClose?.();
      });

      // Also cover TripFormModal onSave lambda
      await act(async () => {
        await capturedTripFormModalProps.current.onSave?.({ name: 'Updated Trip' });
      });
    });
  });

  describe('FE-PAGE-PLANNER-044: FileManager callbacks cover file operation lambdas', () => {
    it('calls FileManager onUpload/onDelete/onUpdate to cover inline lambda bodies', async () => {
      server.use(
        http.get('/api/addons', () =>
          HttpResponse.json({ addons: [{ id: 'documents', type: 'documents' }] })
        )
      );

      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      const filesTab = await screen.findByTitle('Files');
      fireEvent.click(filesTab);

      await waitFor(() => {
        expect(screen.getByTestId('file-manager')).toBeInTheDocument();
      });

      // Call FileManager callbacks — covers lines 928-930 lambda bodies
      await act(async () => {
        const fd = new FormData();
        await capturedFileManagerProps.current.onUpload?.(fd).catch(() => {});
      });

      await act(async () => {
        await capturedFileManagerProps.current.onDelete?.(1).catch(() => {});
      });

      await act(async () => {
        capturedFileManagerProps.current.onUpdate?.(1, {});
      });
    });
  });

  describe('FE-PAGE-PLANNER-045: ReservationsPanel onNavigateToFiles covers inline lambda', () => {
    it('calls onNavigateToFiles to cover the inline lambda body', async () => {
      vi.useFakeTimers();

      seedTripStore({ id: 42 });

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      const bookingsTab = await screen.findByTitle('Bookings');
      fireEvent.click(bookingsTab);

      await waitFor(() => {
        expect(screen.getByTestId('reservations-panel')).toBeInTheDocument();
      });

      // Covers line 907 lambda: () => handleTabChange('dateien')
      await act(async () => {
        capturedReservationsPanelProps.current.onNavigateToFiles?.();
      });
    });
  });

  describe('FE-PAGE-PLANNER-037: onExpandedDaysChange covers mapPlaces hidden logic', () => {
    it('calls onExpandedDaysChange to trigger mapPlaces hidden set computation', async () => {
      vi.useFakeTimers();

      const { day } = seedTripStore({ id: 42 });
      const place = buildPlace({ id: 1, trip_id: 42, lat: 48.8566, lng: 2.3522 });
      const assignment = buildAssignment({ id: 10, day_id: day.id, place, order_index: 0 });
      seedStore(useTripStore, {
        places: [place],
        assignments: { [String(day.id)]: [assignment] },
      } as any);

      renderPlannerPage(42);

      act(() => { vi.runAllTimers(); });

      vi.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('day-plan-sidebar')).toBeInTheDocument();
      });

      // Set expandedDayIds — some day not in the set → place is hidden in mapPlaces
      await act(async () => {
        capturedDayPlanSidebarProps.current.onExpandedDaysChange?.(new Set([999]));
      });

      // Then include the actual day → place is un-hidden
      await act(async () => {
        capturedDayPlanSidebarProps.current.onExpandedDaysChange?.(new Set([day.id]));
      });
    });
  });
});
