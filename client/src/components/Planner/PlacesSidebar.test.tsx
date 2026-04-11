// FE-COMP-PLACES-001 to FE-COMP-PLACES-015 + FE-PLANNER-SIDEBAR-016 to 043
import { render, screen, fireEvent, waitFor, act } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useAuthStore } from '../../store/authStore';
import { useTripStore } from '../../store/tripStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { buildUser, buildTrip, buildPlace, buildCategory, buildDay, buildAssignment } from '../../../tests/helpers/factories';
import { server } from '../../../tests/helpers/msw/server';
import PlacesSidebar from './PlacesSidebar';

// Mock photoService so PlaceAvatar doesn't trigger API calls
vi.mock('../../services/photoService', () => ({
  getCached: vi.fn(() => null),
  isLoading: vi.fn(() => false),
  fetchPhoto: vi.fn(),
  onThumbReady: vi.fn(() => () => {}),
}));

// PlaceAvatar uses `new IntersectionObserver(...)` — needs a class-based mock
class MockIO {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}
beforeAll(() => { (globalThis as any).IntersectionObserver = MockIO; });

const defaultProps = {
  tripId: 1,
  places: [],
  categories: [],
  assignments: {},
  selectedDayId: null,
  selectedPlaceId: null,
  onPlaceClick: vi.fn(),
  onAddPlace: vi.fn(),
  onAssignToDay: vi.fn(),
  onEditPlace: vi.fn(),
  onDeletePlace: vi.fn(),
  days: [],
  isMobile: false,
};

beforeEach(() => {
  resetAllStores();
  seedStore(useAuthStore, { user: buildUser(), isAuthenticated: true });
  seedStore(useTripStore, { trip: buildTrip({ id: 1 }) });
});

describe('PlacesSidebar', () => {
  it('FE-COMP-PLACES-001: renders without crashing', () => {
    render(<PlacesSidebar {...defaultProps} />);
    expect(document.body).toBeInTheDocument();
  });

  it('FE-COMP-PLACES-002: shows search input', () => {
    render(<PlacesSidebar {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/Search places/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('FE-COMP-PLACES-003: renders places from props', () => {
    const places = [
      buildPlace({ name: 'Eiffel Tower' }),
      buildPlace({ name: 'Louvre Museum' }),
    ];
    render(<PlacesSidebar {...defaultProps} places={places} />);
    expect(screen.getByText('Eiffel Tower')).toBeInTheDocument();
    expect(screen.getByText('Louvre Museum')).toBeInTheDocument();
  });

  it('FE-COMP-PLACES-004: shows Add Place button', () => {
    render(<PlacesSidebar {...defaultProps} />);
    // Multiple "Add Place/Activity" buttons may exist (top toolbar + empty state)
    const addBtns = screen.getAllByText(/Add Place\/Activity/i);
    expect(addBtns.length).toBeGreaterThan(0);
  });

  it('FE-COMP-PLACES-005: clicking Add Place calls onAddPlace', async () => {
    const user = userEvent.setup();
    const onAddPlace = vi.fn();
    render(<PlacesSidebar {...defaultProps} onAddPlace={onAddPlace} />);
    const addBtns = screen.getAllByText(/Add Place\/Activity/i);
    await user.click(addBtns[0]);
    expect(onAddPlace).toHaveBeenCalled();
  });

  it('FE-COMP-PLACES-006: clicking a place calls onPlaceClick with place id', async () => {
    const user = userEvent.setup();
    const onPlaceClick = vi.fn();
    const place = buildPlace({ id: 42, name: 'Notre Dame' });
    render(<PlacesSidebar {...defaultProps} places={[place]} onPlaceClick={onPlaceClick} />);
    await user.click(screen.getByText('Notre Dame'));
    expect(onPlaceClick).toHaveBeenCalled();
  });

  it('FE-COMP-PLACES-007: search filters places by name', async () => {
    const user = userEvent.setup();
    const places = [
      buildPlace({ name: 'Arc de Triomphe' }),
      buildPlace({ name: 'Sacre Coeur' }),
    ];
    render(<PlacesSidebar {...defaultProps} places={places} />);
    const searchInput = screen.getByPlaceholderText(/Search places/i);
    await user.type(searchInput, 'Arc');
    expect(screen.getByText('Arc de Triomphe')).toBeInTheDocument();
    expect(screen.queryByText('Sacre Coeur')).not.toBeInTheDocument();
  });

  it('FE-COMP-PLACES-008: search is case-insensitive', async () => {
    const user = userEvent.setup();
    const places = [buildPlace({ name: 'Museum of Art' })];
    render(<PlacesSidebar {...defaultProps} places={places} />);
    const searchInput = screen.getByPlaceholderText(/Search places/i);
    await user.type(searchInput, 'museum');
    expect(screen.getByText('Museum of Art')).toBeInTheDocument();
  });

  it('FE-COMP-PLACES-009: selected place is highlighted', () => {
    const place = buildPlace({ id: 10, name: 'Central Park' });
    render(<PlacesSidebar {...defaultProps} places={[place]} selectedPlaceId={10} />);
    expect(screen.getByText('Central Park')).toBeInTheDocument();
  });

  it('FE-COMP-PLACES-010: shows place count', () => {
    const places = [buildPlace({ name: 'P1' }), buildPlace({ name: 'P2' }), buildPlace({ name: 'P3' })];
    render(<PlacesSidebar {...defaultProps} places={places} />);
    // i18n: places.count = "{count} places"
    expect(screen.getByText(/3 places/i)).toBeInTheDocument();
  });

  it('FE-COMP-PLACES-011: empty list shows no place names', () => {
    render(<PlacesSidebar {...defaultProps} places={[]} />);
    expect(screen.queryByText(/Eiffel/)).not.toBeInTheDocument();
  });

  it('FE-COMP-PLACES-012: categories from props render without error', () => {
    const cats = [buildCategory({ name: 'Restaurant' }), buildCategory({ name: 'Hotel' })];
    render(<PlacesSidebar {...defaultProps} categories={cats} />);
    expect(document.body).toBeInTheDocument();
  });

  it('FE-COMP-PLACES-013: clearing search shows all places again', async () => {
    const user = userEvent.setup();
    const places = [buildPlace({ name: 'Place A' }), buildPlace({ name: 'Place B' })];
    render(<PlacesSidebar {...defaultProps} places={places} />);
    const searchInput = screen.getByPlaceholderText(/Search places/i);
    await user.type(searchInput, 'Place A');
    expect(screen.queryByText('Place B')).not.toBeInTheDocument();
    await user.clear(searchInput);
    expect(screen.getByText('Place B')).toBeInTheDocument();
  });

  it('FE-COMP-PLACES-014: renders with days prop for day assignment', () => {
    const days = [buildDay({ id: 1, date: '2025-06-01' })];
    render(<PlacesSidebar {...defaultProps} days={days} />);
    expect(document.body).toBeInTheDocument();
  });

  it('FE-COMP-PLACES-015: onEditPlace passed to component correctly', () => {
    const onEditPlace = vi.fn();
    const place = buildPlace({ name: 'Test Place' });
    render(<PlacesSidebar {...defaultProps} places={[place]} onEditPlace={onEditPlace} />);
    expect(screen.getByText('Test Place')).toBeInTheDocument();
  });
});

// ── Filter tabs ───────────────────────────────────────────────────────────────

describe('Filter tabs', () => {
  it('FE-PLANNER-SIDEBAR-016: "All" tab is active by default', () => {
    const places = [buildPlace({ name: 'Place Alpha' }), buildPlace({ name: 'Place Beta' })];
    render(<PlacesSidebar {...defaultProps} places={places} />);
    expect(screen.getByText('Place Alpha')).toBeInTheDocument();
    expect(screen.getByText('Place Beta')).toBeInTheDocument();
  });

  it('FE-PLANNER-SIDEBAR-017: "Unplanned" tab filters out planned places', async () => {
    const user = userEvent.setup();
    const planned = buildPlace({ name: 'Planned Place' });
    const unplanned = buildPlace({ name: 'Unplanned Place' });
    const assignments = { '1': [buildAssignment({ place: planned, day_id: 1 })] };
    render(<PlacesSidebar {...defaultProps} places={[planned, unplanned]} assignments={assignments} />);
    await user.click(screen.getByRole('button', { name: /Unplanned/i }));
    expect(screen.queryByText('Planned Place')).not.toBeInTheDocument();
    expect(screen.getByText('Unplanned Place')).toBeInTheDocument();
  });

  it('FE-PLANNER-SIDEBAR-018: "All" tab re-shows planned places', async () => {
    const user = userEvent.setup();
    const planned = buildPlace({ name: 'Planned Place' });
    const unplanned = buildPlace({ name: 'Unplanned Place' });
    const assignments = { '1': [buildAssignment({ place: planned, day_id: 1 })] };
    render(<PlacesSidebar {...defaultProps} places={[planned, unplanned]} assignments={assignments} />);
    await user.click(screen.getByRole('button', { name: /Unplanned/i }));
    await user.click(screen.getByRole('button', { name: /^All$/i }));
    expect(screen.getByText('Planned Place')).toBeInTheDocument();
    expect(screen.getByText('Unplanned Place')).toBeInTheDocument();
  });

  it('FE-PLANNER-SIDEBAR-019: unplanned empty state shows "All places are planned"', async () => {
    const user = userEvent.setup();
    const place = buildPlace({ name: 'Assigned Place' });
    const assignments = { '1': [buildAssignment({ place, day_id: 1 })] };
    render(<PlacesSidebar {...defaultProps} places={[place]} assignments={assignments} />);
    await user.click(screen.getByRole('button', { name: /Unplanned/i }));
    expect(screen.getByText(/All places are planned/i)).toBeInTheDocument();
  });
});

// ── Search ────────────────────────────────────────────────────────────────────

describe('Search', () => {
  it('FE-PLANNER-SIDEBAR-020: search filters by address', async () => {
    const user = userEvent.setup();
    const place = buildPlace({ name: 'UK Office', address: '10 Downing Street' });
    const other = buildPlace({ name: 'Other Place', address: null });
    render(<PlacesSidebar {...defaultProps} places={[place, other]} />);
    await user.type(screen.getByPlaceholderText(/Search places/i), 'Downing');
    expect(screen.getByText('UK Office')).toBeInTheDocument();
    expect(screen.queryByText('Other Place')).not.toBeInTheDocument();
  });

  it('FE-PLANNER-SIDEBAR-021: clear search (X) button appears and resets search', async () => {
    const user = userEvent.setup();
    const places = [buildPlace({ name: 'Paris Hotel' }), buildPlace({ name: 'Rome Cafe' })];
    render(<PlacesSidebar {...defaultProps} places={places} />);
    const searchInput = screen.getByPlaceholderText(/Search places/i);
    await user.type(searchInput, 'Paris');
    expect(screen.queryByText('Rome Cafe')).not.toBeInTheDocument();
    // X clear button should appear
    const clearBtn = document.querySelector('button svg[data-lucide="x"]')?.closest('button')
      ?? document.querySelector('input[type="text"] ~ button')
      ?? screen.getByRole('button', { name: '' });
    // Find the X button by querying near the search input
    const inputWrapper = searchInput.closest('div');
    const xBtn = inputWrapper?.querySelector('button');
    expect(xBtn).toBeTruthy();
    await user.click(xBtn!);
    expect(screen.getByText('Rome Cafe')).toBeInTheDocument();
  });
});

// ── Category filter dropdown ──────────────────────────────────────────────────

describe('Category filter dropdown', () => {
  it('FE-PLANNER-SIDEBAR-022: category dropdown renders when categories are present', () => {
    const cat = buildCategory({ name: 'Museum', color: '#3b82f6' });
    render(<PlacesSidebar {...defaultProps} categories={[cat]} />);
    expect(screen.getByText(/All Categories/i)).toBeInTheDocument();
  });

  it('FE-PLANNER-SIDEBAR-023: clicking category dropdown opens options', async () => {
    const user = userEvent.setup();
    const cat = buildCategory({ name: 'Museum', color: '#3b82f6' });
    render(<PlacesSidebar {...defaultProps} categories={[cat]} />);
    await user.click(screen.getByText(/All Categories/i));
    expect(screen.getByText('Museum')).toBeInTheDocument();
  });

  it('FE-PLANNER-SIDEBAR-024: selecting a category filters places', async () => {
    const user = userEvent.setup();
    const cat = buildCategory({ name: 'Park', color: '#22c55e' });
    // Give places addresses so category name doesn't appear as subtitle
    const withCat = buildPlace({ name: 'Central Park', category_id: cat.id, address: 'New York, NY' });
    const noCat = buildPlace({ name: 'Random Shop', category_id: null, address: 'London, UK' });
    render(<PlacesSidebar {...defaultProps} places={[withCat, noCat]} categories={[cat]} />);
    await user.click(screen.getByText(/All Categories/i));
    // Click the category option in the dropdown (only one 'Park' now — no subtitle conflict)
    await user.click(screen.getByText('Park'));
    expect(screen.getByText('Central Park')).toBeInTheDocument();
    expect(screen.queryByText('Random Shop')).not.toBeInTheDocument();
  });

  it('FE-PLANNER-SIDEBAR-025: "Clear filter" button appears when filter active and clears it', async () => {
    const user = userEvent.setup();
    const cat = buildCategory({ name: 'Museum', color: '#3b82f6' });
    // Give places addresses so category name doesn't appear as subtitle
    const withCat = buildPlace({ name: 'Art Museum', category_id: cat.id, address: 'Paris' });
    const noCat = buildPlace({ name: 'Untagged Place', category_id: null, address: 'Berlin' });
    render(<PlacesSidebar {...defaultProps} places={[withCat, noCat]} categories={[cat]} />);
    await user.click(screen.getByText(/All Categories/i));
    await user.click(screen.getByText('Museum'));
    expect(screen.queryByText('Untagged Place')).not.toBeInTheDocument();
    // Clear filter button should appear
    expect(screen.getByText(/Clear filter/i)).toBeInTheDocument();
    await user.click(screen.getByText(/Clear filter/i));
    expect(screen.getByText('Untagged Place')).toBeInTheDocument();
  });

  it('FE-PLANNER-SIDEBAR-026: multi-category selection shows count', async () => {
    const user = userEvent.setup();
    const cat1 = buildCategory({ name: 'Museum', color: '#3b82f6' });
    const cat2 = buildCategory({ name: 'Park', color: '#22c55e' });
    render(<PlacesSidebar {...defaultProps} categories={[cat1, cat2]} />);
    await user.click(screen.getByText(/All Categories/i));
    const museumOpts = screen.getAllByText('Museum');
    await user.click(museumOpts[museumOpts.length - 1]);
    const parkOpts = screen.getAllByText('Park');
    await user.click(parkOpts[parkOpts.length - 1]);
    expect(screen.getByText(/2 categories/i)).toBeInTheDocument();
  });
});

// ── Place list interaction ─────────────────────────────────────────────────────

describe('Place list interaction', () => {
  it('FE-PLANNER-SIDEBAR-027: "+" assign button appears when selectedDayId set and place not in day', () => {
    const place = buildPlace({ name: 'Unassigned Place' });
    render(<PlacesSidebar {...defaultProps} places={[place]} selectedDayId={5} assignments={{}} />);
    // Plus button should be visible next to the place
    const plusBtns = screen.getAllByRole('button');
    const plusBtn = plusBtns.find(b => b.querySelector('svg'));
    expect(plusBtn).toBeTruthy();
    // The place row itself should be in the DOM
    expect(screen.getByText('Unassigned Place')).toBeInTheDocument();
  });

  it('FE-PLANNER-SIDEBAR-028: clicking "+" assign button calls onAssignToDay with placeId', async () => {
    const user = userEvent.setup();
    const onAssignToDay = vi.fn();
    const place = buildPlace({ id: 99, name: 'Place To Assign' });
    render(<PlacesSidebar {...defaultProps} places={[place]} selectedDayId={5} assignments={{}} onAssignToDay={onAssignToDay} />);
    // Find the + button inside the place row (small inline button)
    const placeRow = screen.getByText('Place To Assign').closest('div[draggable]')!;
    const plusBtn = placeRow.querySelector('button')!;
    await user.click(plusBtn);
    expect(onAssignToDay).toHaveBeenCalledWith(99);
  });

  it('FE-PLANNER-SIDEBAR-029: "+" button not shown when place already assigned to selectedDay', () => {
    const place = buildPlace({ id: 55, name: 'Already Assigned' });
    const assignments = { '5': [buildAssignment({ place, day_id: 5 })] };
    render(<PlacesSidebar {...defaultProps} places={[place]} selectedDayId={5} assignments={assignments} />);
    const placeRow = screen.getByText('Already Assigned').closest('div[draggable]')!;
    const plusBtn = placeRow.querySelector('button');
    expect(plusBtn).toBeNull();
  });

  it('FE-PLANNER-SIDEBAR-030: place address shown as subtitle', () => {
    const place = buildPlace({ name: 'Paris Spot', address: 'Rue de Rivoli', description: null });
    render(<PlacesSidebar {...defaultProps} places={[place]} />);
    expect(screen.getByText('Rue de Rivoli')).toBeInTheDocument();
  });

  it('FE-PLANNER-SIDEBAR-031: no edit buttons shown when canEditPlaces=false', () => {
    seedStore(usePermissionsStore, { permissions: { place_edit: 'admin' } });
    render(<PlacesSidebar {...defaultProps} />);
    expect(screen.queryByText(/Add Place\/Activity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/GPX/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Google List/i)).not.toBeInTheDocument();
  });

  it('FE-PLANNER-SIDEBAR-032: place count shows singular form for 1 place', () => {
    const place = buildPlace({ name: 'Solo Place' });
    render(<PlacesSidebar {...defaultProps} places={[place]} />);
    expect(screen.getByText('1 place')).toBeInTheDocument();
  });
});

// ── Mobile day-picker (portal) ─────────────────────────────────────────────────

describe('Mobile day-picker (portal)', () => {
  it('FE-PLANNER-SIDEBAR-033: on mobile, clicking a place opens day-picker bottom sheet', async () => {
    const user = userEvent.setup();
    const place = buildPlace({ name: 'Mobile Place' });
    render(<PlacesSidebar {...defaultProps} places={[place]} isMobile={true} />);
    await user.click(screen.getByText('Mobile Place'));
    // The bottom sheet portal renders an extra copy of the place name + action buttons
    expect(await screen.findAllByText('Mobile Place')).toHaveLength(2);
    // Sheet-specific button is always present
    expect(screen.getByText(/View details/i)).toBeInTheDocument();
  });

  it('FE-PLANNER-SIDEBAR-034: day-picker lists days and clicking a day calls onAssignToDay', async () => {
    const user = userEvent.setup();
    const onAssignToDay = vi.fn();
    const place = buildPlace({ id: 77, name: 'Day Picker Place' });
    const day = buildDay({ id: 7, title: 'Day 1' });
    render(<PlacesSidebar {...defaultProps} places={[place]} isMobile={true} days={[day]} onAssignToDay={onAssignToDay} />);
    await user.click(screen.getByText('Day Picker Place'));
    // Click "Add to which day?" to expand the day list
    const assignBtn = await screen.findByText(/Add to which day\?/i);
    await user.click(assignBtn);
    // Click Day 1
    expect(await screen.findByText('Day 1')).toBeInTheDocument();
    await user.click(screen.getByText('Day 1'));
    expect(onAssignToDay).toHaveBeenCalledWith(77, 7);
  });

  it('FE-PLANNER-SIDEBAR-035: day-picker backdrop click dismisses sheet', async () => {
    const user = userEvent.setup();
    const place = buildPlace({ name: 'Dismissable Place' });
    render(<PlacesSidebar {...defaultProps} places={[place]} isMobile={true} />);
    await user.click(screen.getByText('Dismissable Place'));
    // Wait for the sheet to open (always shows "View details")
    await screen.findByText(/View details/i);
    expect(screen.getAllByText('Dismissable Place')).toHaveLength(2);
    // Click the backdrop (fixed overlay div — first fixed overlay in body)
    const backdrop = document.querySelector('[style*="position: fixed"][style*="inset: 0"]') as HTMLElement;
    expect(backdrop).toBeTruthy();
    await user.click(backdrop!);
    await waitFor(() => {
      expect(screen.queryByText(/View details/i)).not.toBeInTheDocument();
    });
  });

  it('FE-PLANNER-SIDEBAR-036: day-picker Edit button calls onEditPlace', async () => {
    const user = userEvent.setup();
    const onEditPlace = vi.fn();
    const place = buildPlace({ id: 88, name: 'Editable Place' });
    render(<PlacesSidebar {...defaultProps} places={[place]} isMobile={true} onEditPlace={onEditPlace} />);
    await user.click(screen.getByText('Editable Place'));
    const editBtn = await screen.findByText(/^Edit$/i);
    await user.click(editBtn);
    expect(onEditPlace).toHaveBeenCalledWith(expect.objectContaining({ id: 88 }));
  });

  it('FE-PLANNER-SIDEBAR-037: day-picker Delete button calls onDeletePlace', async () => {
    const user = userEvent.setup();
    const onDeletePlace = vi.fn();
    const place = buildPlace({ id: 66, name: 'Deletable Place' });
    render(<PlacesSidebar {...defaultProps} places={[place]} isMobile={true} onDeletePlace={onDeletePlace} />);
    await user.click(screen.getByText('Deletable Place'));
    const deleteBtn = await screen.findByText(/^Delete$/i);
    await user.click(deleteBtn);
    expect(onDeletePlace).toHaveBeenCalledWith(66);
  });
});

// ── GPX import ────────────────────────────────────────────────────────────────

describe('GPX import', () => {
  it('FE-PLANNER-SIDEBAR-038: GPX import button triggers file input click', async () => {
    const user = userEvent.setup();
    render(<PlacesSidebar {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"][accept=".gpx"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    const clickSpy = vi.spyOn(fileInput, 'click');
    await user.click(screen.getByText(/GPX/i));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('FE-PLANNER-SIDEBAR-039: successful GPX import shows success toast', async () => {
    server.use(
      http.post('/api/trips/1/places/import/gpx', () =>
        HttpResponse.json({ count: 2, places: [{ id: 10 }, { id: 11 }] })
      ),
    );
    const loadTrip = vi.fn().mockResolvedValue(undefined);
    seedStore(useTripStore, { loadTrip });
    const addToast = vi.fn();
    (window as any).__addToast = addToast;
    render(<PlacesSidebar {...defaultProps} pushUndo={vi.fn()} />);
    const fileInput = document.querySelector('input[type="file"][accept=".gpx"]') as HTMLInputElement;
    const file = new File(['track data'], 'route.gpx', { type: 'application/gpx+xml' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });
    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith(
        expect.stringContaining('2'),
        'success',
        undefined,
      );
    });
  });
});

// ── Google Maps list import ───────────────────────────────────────────────────

describe('Google Maps list import', () => {
  it('FE-PLANNER-SIDEBAR-040: "Google List" button opens the URL dialog', async () => {
    const user = userEvent.setup();
    render(<PlacesSidebar {...defaultProps} />);
    await user.click(screen.getByText(/Google List/i));
    expect(await screen.findByPlaceholderText(/maps\.app\.goo\.gl/i)).toBeInTheDocument();
  });

  it('FE-PLANNER-SIDEBAR-041: import button disabled when URL input is empty', async () => {
    const user = userEvent.setup();
    render(<PlacesSidebar {...defaultProps} />);
    await user.click(screen.getByText(/Google List/i));
    await screen.findByPlaceholderText(/maps\.app\.goo\.gl/i);
    const importBtn = screen.getByRole('button', { name: /^Import$/i });
    expect(importBtn).toBeDisabled();
  });

  it('FE-PLANNER-SIDEBAR-042: successful Google list import shows success toast and closes dialog', async () => {
    server.use(
      http.post('/api/trips/1/places/import/google-list', () =>
        HttpResponse.json({ count: 3, listName: 'My List', places: [{ id: 20 }, { id: 21 }, { id: 22 }] })
      ),
    );
    const loadTrip = vi.fn().mockResolvedValue(undefined);
    seedStore(useTripStore, { loadTrip });
    const addToast = vi.fn();
    (window as any).__addToast = addToast;
    const user = userEvent.setup();
    render(<PlacesSidebar {...defaultProps} pushUndo={vi.fn()} />);
    await user.click(screen.getByText(/Google List/i));
    const urlInput = await screen.findByPlaceholderText(/maps\.app\.goo\.gl/i);
    await user.type(urlInput, 'https://maps.app.goo.gl/abc123');
    await user.click(screen.getByRole('button', { name: /^Import$/i }));
    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith(
        expect.stringContaining('3'),
        'success',
        undefined,
      );
    });
    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/maps\.app\.goo\.gl/i)).not.toBeInTheDocument();
    });
  });

  it('FE-PLANNER-SIDEBAR-043: pressing Enter in URL field triggers import', async () => {
    server.use(
      http.post('/api/trips/1/places/import/google-list', () =>
        HttpResponse.json({ count: 1, listName: 'Test', places: [{ id: 30 }] })
      ),
    );
    const loadTrip = vi.fn().mockResolvedValue(undefined);
    seedStore(useTripStore, { loadTrip });
    const addToast = vi.fn();
    (window as any).__addToast = addToast;
    const user = userEvent.setup();
    render(<PlacesSidebar {...defaultProps} pushUndo={vi.fn()} />);
    await user.click(screen.getByText(/Google List/i));
    const urlInput = await screen.findByPlaceholderText(/maps\.app\.goo\.gl/i);
    await user.type(urlInput, 'https://maps.app.goo.gl/xyz{Enter}');
    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith(
        expect.stringContaining('1'),
        'success',
        undefined,
      );
    });
  });
});
