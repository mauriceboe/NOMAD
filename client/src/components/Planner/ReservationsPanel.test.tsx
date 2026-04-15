// FE-COMP-RES-001 to FE-COMP-RES-040
import { render, screen, waitFor, within } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { useAuthStore } from '../../store/authStore';
import { useTripStore } from '../../store/tripStore';
import { useSettingsStore } from '../../store/settingsStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { buildUser, buildTrip, buildReservation, buildDay, buildPlace } from '../../../tests/helpers/factories';
import ReservationsPanel from './ReservationsPanel';

vi.mock('../../api/authUrl', () => ({ getAuthUrl: vi.fn().mockResolvedValue('http://test/file') }));

const defaultProps = {
  tripId: 1,
  reservations: [],
  days: [],
  assignments: {},
  files: [],
  onAdd: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onNavigateToFiles: vi.fn(),
};

beforeEach(() => {
  resetAllStores();
  seedStore(useAuthStore, { user: buildUser(), isAuthenticated: true });
  seedStore(useTripStore, { trip: buildTrip({ id: 1 }) });
  seedStore(useSettingsStore, { settings: { time_format: '24h', blur_booking_codes: false, temperature_unit: 'celsius', language: 'en', dark_mode: false, default_currency: 'USD', default_lat: 48.8566, default_lng: 2.3522, default_zoom: 10, map_tile_url: '', show_place_description: false, route_calculation: false } });
});

describe('ReservationsPanel', () => {
  it('FE-COMP-RES-001: renders without crashing', () => {
    render(<ReservationsPanel {...defaultProps} />);
    expect(document.body).toBeInTheDocument();
  });

  it('FE-COMP-RES-002: shows Bookings title', () => {
    render(<ReservationsPanel {...defaultProps} />);
    // reservations.title = "Bookings"
    expect(screen.getByText('Bookings')).toBeInTheDocument();
  });

  it('FE-COMP-RES-003: shows empty state when no reservations', () => {
    render(<ReservationsPanel {...defaultProps} reservations={[]} />);
    // "No reservations yet" appears in both header subtitle and empty state body
    const els = screen.getAllByText('No reservations yet');
    expect(els.length).toBeGreaterThan(0);
  });

  it('FE-COMP-RES-004: shows empty hint text', () => {
    render(<ReservationsPanel {...defaultProps} reservations={[]} />);
    expect(screen.getByText(/Add reservations for flights/i)).toBeInTheDocument();
  });

  it('FE-COMP-RES-005: shows Manual Booking add button', () => {
    render(<ReservationsPanel {...defaultProps} />);
    // Button text is reservations.addManual = "Manual Booking"
    expect(screen.getByText('Manual Booking')).toBeInTheDocument();
  });

  it('FE-COMP-RES-006: clicking Manual Booking button calls onAdd', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<ReservationsPanel {...defaultProps} onAdd={onAdd} />);
    await user.click(screen.getByText('Manual Booking'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('FE-COMP-RES-007: renders reservation title', () => {
    // Component renders r.title, not r.name
    const res = buildReservation({ title: 'Hotel Paris', type: 'hotel', status: 'confirmed' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    expect(screen.getByText('Hotel Paris')).toBeInTheDocument();
  });

  it('FE-COMP-RES-008: renders confirmed reservation badge', () => {
    const res = buildReservation({ title: 'Flight NY', type: 'flight', status: 'confirmed' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    // "Confirmed" appears in both section header and card badge
    const els = screen.getAllByText('Confirmed');
    expect(els.length).toBeGreaterThan(0);
  });

  it('FE-COMP-RES-009: renders pending reservation badge', () => {
    const res = buildReservation({ title: 'Hotel Rome', type: 'hotel', status: 'pending' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    // "Pending" appears in both section header and card badge
    const els = screen.getAllByText('Pending');
    expect(els.length).toBeGreaterThan(0);
  });

  it('FE-COMP-RES-010: shows reservations title and cards', () => {
    const r1 = buildReservation({ title: 'My Flight Booking', type: 'flight', status: 'confirmed' });
    const r2 = buildReservation({ title: 'Grand Hotel', type: 'hotel', status: 'pending' });
    render(<ReservationsPanel {...defaultProps} reservations={[r1, r2]} />);
    expect(screen.getByText('My Flight Booking')).toBeInTheDocument();
    expect(screen.getByText('Grand Hotel')).toBeInTheDocument();
  });

  it('FE-COMP-RES-011: hotel reservation renders', () => {
    const res = buildReservation({ title: 'Grand Hotel', type: 'hotel', status: 'confirmed' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    expect(screen.getByText('Grand Hotel')).toBeInTheDocument();
  });

  it('FE-COMP-RES-012: flight reservation renders', () => {
    const res = buildReservation({ title: 'Air France 123', type: 'flight', status: 'confirmed' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    expect(screen.getByText('Air France 123')).toBeInTheDocument();
  });

  it('FE-COMP-RES-013: multiple reservations all render', () => {
    const r1 = buildReservation({ title: 'Hotel A', type: 'hotel', status: 'confirmed' });
    const r2 = buildReservation({ title: 'Flight B', type: 'flight', status: 'confirmed' });
    const r3 = buildReservation({ title: 'Restaurant C', type: 'restaurant', status: 'pending' });
    render(<ReservationsPanel {...defaultProps} reservations={[r1, r2, r3]} />);
    expect(screen.getByText('Hotel A')).toBeInTheDocument();
    expect(screen.getByText('Flight B')).toBeInTheDocument();
    expect(screen.getByText('Restaurant C')).toBeInTheDocument();
  });

  it('FE-COMP-RES-014: edit button calls onEdit with reservation', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const res = buildReservation({ id: 77, title: 'Editable Res', type: 'hotel', status: 'confirmed' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} onEdit={onEdit} />);
    const editBtn = screen.getByTitle('Edit');
    await user.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 77 }));
  });

  it('FE-COMP-RES-015: delete button opens confirm dialog, then calls onDelete', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const res = buildReservation({ id: 88, title: 'Delete Me', type: 'hotel', status: 'confirmed' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} onDelete={onDelete} />);
    await user.click(screen.getByTitle('Delete'));
    // Confirm dialog appears — click the Confirm button
    const confirmBtn = await screen.findByText('Confirm');
    await user.click(confirmBtn);
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(88));
  });

  // ── Section collapsing ──────────────────────────────────────────────────────

  it('FE-PLANNER-RESP-016: clicking Pending section header collapses it', async () => {
    const user = userEvent.setup();
    const res = buildReservation({ title: 'Pending Hotel', type: 'hotel', status: 'pending' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    // Initially the card is visible
    expect(screen.getByText('Pending Hotel')).toBeInTheDocument();
    // Click the "Pending" section header button (the one with count badge)
    const pendingButtons = screen.getAllByText('Pending');
    // The section header button contains "Pending" text
    const sectionHeaderBtn = pendingButtons.find(el => el.closest('button'));
    await user.click(sectionHeaderBtn!.closest('button')!);
    // Card should no longer be visible
    expect(screen.queryByText('Pending Hotel')).not.toBeInTheDocument();
  });

  it('FE-PLANNER-RESP-017: clicking Pending section header again expands it', async () => {
    const user = userEvent.setup();
    const res = buildReservation({ title: 'Pending Train', type: 'train', status: 'pending' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    const pendingButtons = screen.getAllByText('Pending');
    const sectionHeaderBtn = pendingButtons.find(el => el.closest('button'));
    // Collapse
    await user.click(sectionHeaderBtn!.closest('button')!);
    expect(screen.queryByText('Pending Train')).not.toBeInTheDocument();
    // Re-query after collapse
    const pendingButtons2 = screen.getAllByText('Pending');
    const sectionHeaderBtn2 = pendingButtons2.find(el => el.closest('button'));
    // Expand
    await user.click(sectionHeaderBtn2!.closest('button')!);
    expect(screen.getByText('Pending Train')).toBeInTheDocument();
  });

  it('FE-PLANNER-RESP-018: confirmed and pending sections render separately', () => {
    const confirmed = buildReservation({ title: 'Confirmed Flight', type: 'flight', status: 'confirmed' });
    const pending = buildReservation({ title: 'Pending Restaurant', type: 'restaurant', status: 'pending' });
    render(<ReservationsPanel {...defaultProps} reservations={[confirmed, pending]} />);
    // Both section labels should appear (as buttons or spans in card headers, plus section titles)
    const confirmedEls = screen.getAllByText('Confirmed');
    const pendingEls = screen.getAllByText('Pending');
    expect(confirmedEls.length).toBeGreaterThan(0);
    expect(pendingEls.length).toBeGreaterThan(0);
  });

  // ── ReservationCard details ─────────────────────────────────────────────────

  it('FE-PLANNER-RESP-019: reservation with date shows formatted date', () => {
    const res = buildReservation({ reservation_time: '2025-06-15', status: 'confirmed' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    // Should show some form of Jun 15 formatted date
    expect(screen.getByText(/Jun/i)).toBeInTheDocument();
  });

  it('FE-PLANNER-RESP-020: reservation with ISO datetime shows time', () => {
    const res = buildReservation({ reservation_time: '2025-06-15T14:30:00Z', status: 'confirmed' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    // Time column should appear (exact format depends on locale/env but contains hour:minute)
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  it('FE-PLANNER-RESP-021: confirmation number is visible by default (no blur)', () => {
    const res = buildReservation({ confirmation_number: 'ABC123', status: 'confirmed' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });

  it('FE-PLANNER-RESP-022: confirmation number is blurred when blur_booking_codes=true', () => {
    seedStore(useSettingsStore, { settings: { time_format: '24h', blur_booking_codes: true, temperature_unit: 'celsius', language: 'en', dark_mode: false, default_currency: 'USD', default_lat: 48.8566, default_lng: 2.3522, default_zoom: 10, map_tile_url: '', show_place_description: false, route_calculation: false } });
    const res = buildReservation({ confirmation_number: 'ABC123', status: 'confirmed' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    const codeEl = screen.getByText('ABC123');
    expect(codeEl.style.filter).toContain('blur');
  });

  it('FE-PLANNER-RESP-023: confirmation code revealed on hover when blurred', async () => {
    const user = userEvent.setup();
    seedStore(useSettingsStore, { settings: { time_format: '24h', blur_booking_codes: true, temperature_unit: 'celsius', language: 'en', dark_mode: false, default_currency: 'USD', default_lat: 48.8566, default_lng: 2.3522, default_zoom: 10, map_tile_url: '', show_place_description: false, route_calculation: false } });
    const res = buildReservation({ confirmation_number: 'ABC123', status: 'confirmed' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    const codeEl = screen.getByText('ABC123');
    expect(codeEl.style.filter).toContain('blur');
    await user.hover(codeEl);
    expect(codeEl.style.filter).toBe('none');
  });

  it('FE-PLANNER-RESP-024: reservation notes are shown', () => {
    const res = buildReservation({ notes: 'Window seat requested', status: 'pending' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    expect(screen.getByText('Window seat requested')).toBeInTheDocument();
  });

  it('FE-PLANNER-RESP-025: reservation location is shown', () => {
    const res = buildReservation({ location: 'Charles de Gaulle Airport', status: 'confirmed' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    expect(screen.getByText('Charles de Gaulle Airport')).toBeInTheDocument();
  });

  it('FE-PLANNER-RESP-026: flight metadata (airline, flight number) renders', () => {
    const res = buildReservation({
      type: 'flight',
      status: 'confirmed',
      metadata: JSON.stringify({ airline: 'Air France', flight_number: 'AF001', departure_airport: 'CDG', arrival_airport: 'JFK' }),
    });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    expect(screen.getByText('Air France')).toBeInTheDocument();
    expect(screen.getByText('AF001')).toBeInTheDocument();
  });

  it('FE-PLANNER-RESP-027: train metadata (train number, platform, seat) renders', () => {
    const res = buildReservation({
      type: 'train',
      status: 'confirmed',
      metadata: JSON.stringify({ train_number: 'TGV9876', platform: '3', seat: '42A' }),
    });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    expect(screen.getByText('TGV9876')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('42A')).toBeInTheDocument();
  });

  it('FE-PLANNER-RESP-028: hotel check-in/check-out metadata renders', () => {
    const res = buildReservation({
      type: 'hotel',
      status: 'confirmed',
      metadata: JSON.stringify({ check_in_time: '14:00', check_out_time: '11:00' }),
    });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    expect(screen.getByText('14:00')).toBeInTheDocument();
    expect(screen.getByText('11:00')).toBeInTheDocument();
  });

  it('FE-PLANNER-RESP-029: linked assignment shows day title and place name', () => {
    const place = buildPlace({ name: 'Eiffel Tower', place_time: '10:00' });
    const assignmentId = 55;
    const day = { ...buildDay({ id: 1, title: 'Day 1', date: '2025-06-01' }), day_number: 1 } as any;
    const assignments = { '1': [{ id: assignmentId, order_index: 0, day_id: 1, place_id: place.id, notes: null, place }] };
    const res = buildReservation({ assignment_id: assignmentId, status: 'confirmed' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} days={[day]} assignments={assignments} />);
    expect(screen.getByText(/Day 1/)).toBeInTheDocument();
    expect(screen.getByText(/Eiffel Tower/)).toBeInTheDocument();
  });

  // ── Status toggle (canEdit=true) ────────────────────────────────────────────

  it('FE-PLANNER-RESP-030: status label is always a span (not clickable)', () => {
    const res = buildReservation({ title: 'My Booking', status: 'pending' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    const pendingEls = screen.getAllByText('Pending');
    const statusSpan = pendingEls.find(el => el.tagName === 'SPAN');
    expect(statusSpan).toBeDefined();
    const statusBtn = pendingEls.find(el => el.tagName === 'BUTTON');
    expect(statusBtn).toBeUndefined();
  });

  // ── Status (canEdit=false) ──────────────────────────────────────────────────

  it('FE-PLANNER-RESP-032: status label is a span (not button) when canEdit=false', () => {
    seedStore(usePermissionsStore, { permissions: { reservation_edit: 'admin' } });
    const res = buildReservation({ title: 'Read Only', status: 'pending' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    const pendingEls = screen.getAllByText('Pending');
    const statusSpan = pendingEls.find(el => el.tagName === 'SPAN');
    expect(statusSpan).toBeDefined();
    const statusBtn = pendingEls.find(el => el.tagName === 'BUTTON');
    expect(statusBtn).toBeUndefined();
  });

  it('FE-PLANNER-RESP-033: edit and delete buttons hidden when canEdit=false', () => {
    seedStore(usePermissionsStore, { permissions: { reservation_edit: 'admin' } });
    const res = buildReservation({ title: 'Read Only', status: 'confirmed' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });

  // ── Delete confirmation ─────────────────────────────────────────────────────

  it('FE-PLANNER-RESP-034: delete confirm dialog shows reservation title', async () => {
    const user = userEvent.setup();
    const res = buildReservation({ id: 99, title: 'Paris Hotel', status: 'confirmed' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    await user.click(screen.getByTitle('Delete'));
    // The dialog body contains the title in the delete message
    const dialogBody = await screen.findByText(/will be permanently deleted/i);
    expect(dialogBody.textContent).toContain('Paris Hotel');
  });

  it('FE-PLANNER-RESP-035: clicking Cancel in delete dialog closes it without calling onDelete', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const res = buildReservation({ id: 100, title: 'Cancel Test', status: 'confirmed' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} onDelete={onDelete} />);
    await user.click(screen.getByTitle('Delete'));
    const cancelBtn = await screen.findByText('Cancel');
    await user.click(cancelBtn);
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('FE-PLANNER-RESP-036: clicking backdrop closes delete confirm dialog', async () => {
    const user = userEvent.setup();
    const res = buildReservation({ id: 101, title: 'Backdrop Test', status: 'confirmed' });
    render(<ReservationsPanel {...defaultProps} reservations={[res]} />);
    await user.click(screen.getByTitle('Delete'));
    // Dialog is visible
    await screen.findByText('Cancel');
    // Click the fixed backdrop (the outermost div of the portal)
    const backdrop = document.querySelector('[style*="position: fixed"]') as HTMLElement;
    await user.click(backdrop!);
    await waitFor(() => expect(screen.queryByText('Cancel')).not.toBeInTheDocument());
  });

  // ── Files ───────────────────────────────────────────────────────────────────

  it('FE-PLANNER-RESP-037: attached files section appears for reservation with files', () => {
    const res = buildReservation({ id: 77, status: 'confirmed' });
    const files = [{ id: 1, trip_id: 1, reservation_id: 77, original_name: 'boarding_pass.pdf', url: '/uploads/bp.pdf', filename: 'bp.pdf', mime_type: 'application/pdf', created_at: '2025-01-01T00:00:00.000Z' }];
    render(<ReservationsPanel {...defaultProps} reservations={[res]} files={files} />);
    expect(screen.getByText('boarding_pass.pdf')).toBeInTheDocument();
  });

  it('FE-PLANNER-RESP-038: linked file (via linked_reservation_ids) also appears', () => {
    const res = buildReservation({ id: 77, status: 'confirmed' });
    const files = [{ id: 2, trip_id: 1, reservation_id: null, linked_reservation_ids: [77], original_name: 'voucher.pdf', url: '/uploads/v.pdf', filename: 'v.pdf', mime_type: 'application/pdf', created_at: '2025-01-01T00:00:00.000Z' }];
    render(<ReservationsPanel {...defaultProps} reservations={[res]} files={files as any} />);
    expect(screen.getByText('voucher.pdf')).toBeInTheDocument();
  });

  // ── Add button ──────────────────────────────────────────────────────────────

  it('FE-PLANNER-RESP-039: "Add" button hidden when canEdit=false', () => {
    seedStore(usePermissionsStore, { permissions: { reservation_edit: 'admin' } });
    render(<ReservationsPanel {...defaultProps} />);
    expect(screen.queryByText('Manual Booking')).not.toBeInTheDocument();
  });

  it('FE-PLANNER-RESP-040: multiple reservations in pending section all render', () => {
    const r1 = buildReservation({ title: 'Pending 1', status: 'pending' });
    const r2 = buildReservation({ title: 'Pending 2', status: 'pending' });
    const r3 = buildReservation({ title: 'Pending 3', status: 'pending' });
    render(<ReservationsPanel {...defaultProps} reservations={[r1, r2, r3]} />);
    expect(screen.getByText('Pending 1')).toBeInTheDocument();
    expect(screen.getByText('Pending 2')).toBeInTheDocument();
    expect(screen.getByText('Pending 3')).toBeInTheDocument();
  });
});
