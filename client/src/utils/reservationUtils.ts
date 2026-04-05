// client/src/utils/reservationUtils.ts

/** Returns true for HH:MM or HH:MM:SS time-only strings */
export function isTimeOnly(s: string): boolean {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(s)
}

/**
 * Splits a reservation_time value into separate date and time parts.
 * Handles: datetime ("2024-06-15T20:20"), date-only ("2024-06-15"), time-only ("20:20"), empty.
 */
export function splitReservationTime(rt: string): { date: string; time: string } {
  if (!rt) return { date: '', time: '' }
  if (isTimeOnly(rt)) return { date: '', time: rt.slice(0, 5) }
  if (rt.includes('T')) {
    const [date, time] = rt.split('T')
    return { date: date || '', time: (time || '').slice(0, 5) }
  }
  return { date: rt, time: '' }
}

/**
 * Formats a reservation_time value for display.
 * Returns '' for falsy input, time as-is for time-only strings,
 * locale date+time for datetime strings, locale date for date-only strings.
 */
export function formatReservationTimeDisplay(
  rt: string | null | undefined,
  locale: string,
  timeFormat: '12h' | '24h',
): string {
  if (!rt) return ''
  if (isTimeOnly(rt)) return rt.slice(0, 5)
  if (rt.includes('T')) {
    const d = new Date(rt)
    if (isNaN(d.getTime())) return rt
    return d.toLocaleString(locale, {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h',
    })
  }
  // date-only
  const d = new Date(rt + 'T00:00:00Z')
  if (isNaN(d.getTime())) return rt
  return d.toLocaleDateString(locale, {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

export interface MetaForm {
  meta_airline: string
  meta_flight_number: string
  meta_departure_airport: string
  meta_arrival_airport: string
  meta_check_in_time: string
  meta_check_out_time: string
  meta_train_number: string
  meta_platform: string
  meta_seat: string
}

/** Builds metadata Record based on reservation type. Empty fields are omitted. */
export function buildMetadataForType(type: string, form: MetaForm): Record<string, string> {
  const m: Record<string, string> = {}
  if (type === 'flight') {
    if (form.meta_airline) m.airline = form.meta_airline
    if (form.meta_flight_number) m.flight_number = form.meta_flight_number
    if (form.meta_departure_airport) m.departure_airport = form.meta_departure_airport
    if (form.meta_arrival_airport) m.arrival_airport = form.meta_arrival_airport
  } else if (type === 'hotel') {
    if (form.meta_check_in_time) m.check_in_time = form.meta_check_in_time
    if (form.meta_check_out_time) m.check_out_time = form.meta_check_out_time
  } else if (type === 'train') {
    if (form.meta_train_number) m.train_number = form.meta_train_number
    if (form.meta_platform) m.platform = form.meta_platform
    if (form.meta_seat) m.seat = form.meta_seat
  }
  return m
}

/** Parses a stored metadata value (JSON string, plain object, or falsy) into a Record. */
export function parseStoredMetadata(metadata: unknown): Record<string, string> {
  if (!metadata) return {}
  if (typeof metadata === 'string') {
    try { return JSON.parse(metadata) } catch { return {} }
  }
  if (typeof metadata === 'object') return metadata as Record<string, string>
  return {}
}

/** Serializes a metadata Record to a JSON string, or null if empty. */
export function serializeMetadata(m: Record<string, string>): string | null {
  return Object.keys(m).length > 0 ? JSON.stringify(m) : null
}

export interface ReservationFormState extends MetaForm {
  title: string
  type: string
  status: string
  reservation_time: string
  reservation_end_time: string
  location: string
  confirmation_number: string
  notes: string
  assignment_id: string | number
  accommodation_id: string | number
  hotel_place_id: string | number
  hotel_start_day: string | number
  hotel_end_day: string | number
}

/**
 * Builds the save payload for create/update reservation API calls.
 * Coerces empty strings to null for optional fields.
 * Serializes metadata to JSON.
 * Includes create_accommodation only for hotel type with all required fields.
 */
export function buildSavePayload(form: ReservationFormState): Record<string, unknown> {
  const metadata = buildMetadataForType(form.type, form)
  const payload: Record<string, unknown> = {
    title: form.title,
    type: form.type,
    status: form.status,
    reservation_time: form.reservation_time || null,
    reservation_end_time: form.reservation_end_time || null,
    location: form.location || null,
    confirmation_number: form.confirmation_number || null,
    notes: form.notes || null,
    assignment_id: form.assignment_id || null,
    accommodation_id: form.type === 'hotel' ? (form.accommodation_id || null) : null,
    metadata: serializeMetadata(metadata),
  }
  if (form.type === 'hotel' && form.hotel_place_id && form.hotel_start_day && form.hotel_end_day) {
    payload.create_accommodation = {
      place_id: form.hotel_place_id,
      start_day_id: form.hotel_start_day,
      end_day_id: form.hotel_end_day,
      check_in: form.meta_check_in_time || null,
      check_out: form.meta_check_out_time || null,
      confirmation: form.confirmation_number || null,
    }
  }
  return payload
}
