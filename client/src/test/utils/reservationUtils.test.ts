import { describe, it, expect } from 'vitest'
import {
  isTimeOnly, splitReservationTime, formatReservationTimeDisplay,
  buildMetadataForType, parseStoredMetadata, serializeMetadata, buildSavePayload,
} from '../../utils/reservationUtils'

// ── isTimeOnly ───────────────────────────────────────────────────────────────
describe('isTimeOnly', () => {
  it('returns true for HH:MM', () => {
    expect(isTimeOnly('20:20')).toBe(true)
    expect(isTimeOnly('00:00')).toBe(true)
    expect(isTimeOnly('09:05')).toBe(true)
    expect(isTimeOnly('23:59')).toBe(true)
  })
  it('returns true for HH:MM:SS', () => {
    expect(isTimeOnly('20:20:00')).toBe(true)
    expect(isTimeOnly('09:05:30')).toBe(true)
  })
  it('returns false for date-only strings', () => {
    expect(isTimeOnly('2024-06-15')).toBe(false)
    expect(isTimeOnly('2024-01-01')).toBe(false)
  })
  it('returns false for datetime strings', () => {
    expect(isTimeOnly('2024-06-15T20:20')).toBe(false)
    expect(isTimeOnly('2024-06-15T20:20:00')).toBe(false)
  })
  it('returns false for empty or invalid strings', () => {
    expect(isTimeOnly('')).toBe(false)
    expect(isTimeOnly('invalid')).toBe(false)
    expect(isTimeOnly('9:5')).toBe(false) // single-digit hours not matched
  })
})

// ── splitReservationTime ─────────────────────────────────────────────────────
describe('splitReservationTime', () => {
  it('returns empty for empty string', () => {
    expect(splitReservationTime('')).toEqual({ date: '', time: '' })
  })
  it('handles time-only HH:MM', () => {
    expect(splitReservationTime('20:20')).toEqual({ date: '', time: '20:20' })
    expect(splitReservationTime('09:05')).toEqual({ date: '', time: '09:05' })
  })
  it('handles time-only HH:MM:SS — truncates to HH:MM', () => {
    expect(splitReservationTime('20:20:00')).toEqual({ date: '', time: '20:20' })
  })
  it('handles date-only YYYY-MM-DD', () => {
    expect(splitReservationTime('2024-06-15')).toEqual({ date: '2024-06-15', time: '' })
  })
  it('handles full datetime', () => {
    expect(splitReservationTime('2024-06-15T20:20')).toEqual({ date: '2024-06-15', time: '20:20' })
  })
  it('handles datetime with seconds — truncates time', () => {
    expect(splitReservationTime('2024-06-15T20:20:00')).toEqual({ date: '2024-06-15', time: '20:20' })
  })
})

// ── formatReservationTimeDisplay ─────────────────────────────────────────────
describe('formatReservationTimeDisplay', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(formatReservationTimeDisplay(null, 'en-US', '24h')).toBe('')
    expect(formatReservationTimeDisplay(undefined, 'en-US', '24h')).toBe('')
    expect(formatReservationTimeDisplay('', 'en-US', '24h')).toBe('')
  })
  it('returns raw time for time-only strings', () => {
    expect(formatReservationTimeDisplay('20:20', 'en-US', '24h')).toBe('20:20')
    expect(formatReservationTimeDisplay('09:05', 'de-DE', '24h')).toBe('09:05')
    expect(formatReservationTimeDisplay('23:59:00', 'en-US', '24h')).toBe('23:59')
  })
  it('formats datetime string', () => {
    const result = formatReservationTimeDisplay('2024-06-15T14:30', 'en-US', '24h')
    expect(result).toContain('14')
    expect(result).not.toBe('')
  })
  it('formats date-only string with UTC timezone', () => {
    const result = formatReservationTimeDisplay('2024-06-15', 'en-US', '24h')
    expect(result).toContain('15')
    expect(result).not.toBe('')
  })
  it('returns original string for truly invalid input', () => {
    expect(formatReservationTimeDisplay('not-a-date', 'en-US', '24h')).toBe('not-a-date')
  })
})

// ── buildMetadataForType ─────────────────────────────────────────────────────
const emptyMeta = {
  meta_airline: '', meta_flight_number: '', meta_departure_airport: '', meta_arrival_airport: '',
  meta_check_in_time: '', meta_check_out_time: '',
  meta_train_number: '', meta_platform: '', meta_seat: '',
}

describe('buildMetadataForType', () => {
  it('returns empty object for flight type with no fields filled', () => {
    expect(buildMetadataForType('flight', emptyMeta)).toEqual({})
  })
  it('builds full flight metadata', () => {
    const form = { ...emptyMeta, meta_airline: 'EVA Air', meta_flight_number: 'BR195', meta_departure_airport: 'NRT', meta_arrival_airport: 'TPE' }
    expect(buildMetadataForType('flight', form)).toEqual({ airline: 'EVA Air', flight_number: 'BR195', departure_airport: 'NRT', arrival_airport: 'TPE' })
  })
  it('builds partial flight metadata (omits empty fields)', () => {
    const form = { ...emptyMeta, meta_flight_number: 'JL001' }
    expect(buildMetadataForType('flight', form)).toEqual({ flight_number: 'JL001' })
    expect(buildMetadataForType('flight', form)).not.toHaveProperty('airline')
  })
  it('builds hotel metadata', () => {
    const form = { ...emptyMeta, meta_check_in_time: '15:00', meta_check_out_time: '11:00' }
    expect(buildMetadataForType('hotel', form)).toEqual({ check_in_time: '15:00', check_out_time: '11:00' })
  })
  it('builds partial hotel metadata', () => {
    const form = { ...emptyMeta, meta_check_in_time: '14:00' }
    expect(buildMetadataForType('hotel', form)).toEqual({ check_in_time: '14:00' })
    expect(buildMetadataForType('hotel', form)).not.toHaveProperty('check_out_time')
  })
  it('builds train metadata', () => {
    const form = { ...emptyMeta, meta_train_number: 'N700S', meta_platform: '14', meta_seat: '5A' }
    expect(buildMetadataForType('train', form)).toEqual({ train_number: 'N700S', platform: '14', seat: '5A' })
  })
  it('returns empty object for non-meta types (restaurant, car, cruise, event, tour, activity, other)', () => {
    for (const type of ['restaurant', 'car', 'cruise', 'event', 'tour', 'activity', 'other']) {
      const form = { ...emptyMeta, meta_airline: 'EVA', meta_train_number: 'X1' }
      expect(buildMetadataForType(type, form)).toEqual({})
    }
  })
  it('ignores hotel/train fields for flight type', () => {
    const form = { ...emptyMeta, meta_flight_number: 'BR195', meta_train_number: 'N700S', meta_check_in_time: '15:00' }
    const result = buildMetadataForType('flight', form)
    expect(result).not.toHaveProperty('train_number')
    expect(result).not.toHaveProperty('check_in_time')
  })
})

// ── parseStoredMetadata ──────────────────────────────────────────────────────
describe('parseStoredMetadata', () => {
  it('returns empty object for null/undefined/empty', () => {
    expect(parseStoredMetadata(null)).toEqual({})
    expect(parseStoredMetadata(undefined)).toEqual({})
    expect(parseStoredMetadata('')).toEqual({})
  })
  it('parses valid JSON string', () => {
    expect(parseStoredMetadata('{"flight_number":"BR195"}')).toEqual({ flight_number: 'BR195' })
    expect(parseStoredMetadata('{"airline":"EVA Air","departure_airport":"NRT"}')).toEqual({ airline: 'EVA Air', departure_airport: 'NRT' })
  })
  it('returns empty object for invalid JSON string', () => {
    expect(parseStoredMetadata('not-json')).toEqual({})
    expect(parseStoredMetadata('{broken')).toEqual({})
  })
  it('returns object as-is when already an object', () => {
    const obj = { airline: 'EVA', flight_number: 'BR195' }
    expect(parseStoredMetadata(obj)).toEqual(obj)
  })
  it('returns empty for non-string non-object', () => {
    expect(parseStoredMetadata(42)).toEqual({})
    expect(parseStoredMetadata(true)).toEqual({})
  })
})

// ── serializeMetadata ────────────────────────────────────────────────────────
describe('serializeMetadata', () => {
  it('returns null for empty object', () => {
    expect(serializeMetadata({})).toBeNull()
  })
  it('returns JSON string for non-empty object', () => {
    const result = serializeMetadata({ flight_number: 'BR195' })
    expect(result).toBe('{"flight_number":"BR195"}')
  })
  it('round-trips with parseStoredMetadata', () => {
    const original = { airline: 'EVA Air', flight_number: 'BR195', departure_airport: 'NRT' }
    const serialized = serializeMetadata(original)
    expect(serialized).not.toBeNull()
    expect(parseStoredMetadata(serialized!)).toEqual(original)
  })
})

// ── buildSavePayload ─────────────────────────────────────────────────────────
const baseForm = {
  title: 'Test Reservation', type: 'other', status: 'pending',
  reservation_time: '', reservation_end_time: '', location: '', confirmation_number: '',
  notes: '', assignment_id: '', accommodation_id: '',
  ...emptyMeta,
  hotel_place_id: '', hotel_start_day: '', hotel_end_day: '',
}

describe('buildSavePayload', () => {
  it('coerces empty strings to null for optional fields', () => {
    const payload = buildSavePayload(baseForm)
    expect(payload.reservation_time).toBeNull()
    expect(payload.reservation_end_time).toBeNull()
    expect(payload.location).toBeNull()
    expect(payload.confirmation_number).toBeNull()
    expect(payload.notes).toBeNull()
    expect(payload.assignment_id).toBeNull()
    expect(payload.metadata).toBeNull()
  })
  it('preserves non-empty values', () => {
    const form = { ...baseForm, title: 'Flight', reservation_time: '2024-06-15T20:20', location: 'NRT' }
    const payload = buildSavePayload(form)
    expect(payload.title).toBe('Flight')
    expect(payload.reservation_time).toBe('2024-06-15T20:20')
    expect(payload.location).toBe('NRT')
  })
  it('builds flight metadata as JSON string', () => {
    const form = { ...baseForm, type: 'flight', meta_airline: 'EVA Air', meta_flight_number: 'BR195', meta_departure_airport: 'NRT', meta_arrival_airport: 'TPE' }
    const payload = buildSavePayload(form)
    expect(typeof payload.metadata).toBe('string')
    const meta = JSON.parse(payload.metadata as string)
    expect(meta).toEqual({ airline: 'EVA Air', flight_number: 'BR195', departure_airport: 'NRT', arrival_airport: 'TPE' })
  })
  it('does NOT include create_accommodation for flight type', () => {
    const form = { ...baseForm, type: 'flight', meta_flight_number: 'BR195' }
    expect(buildSavePayload(form)).not.toHaveProperty('create_accommodation')
  })
  it('sets accommodation_id to null for non-hotel types', () => {
    for (const type of ['flight', 'train', 'restaurant', 'car', 'cruise', 'event', 'tour', 'activity', 'other']) {
      const payload = buildSavePayload({ ...baseForm, type, accommodation_id: '5' })
      expect(payload.accommodation_id).toBeNull()
    }
  })
  it('preserves accommodation_id for hotel type', () => {
    const form = { ...baseForm, type: 'hotel', accommodation_id: '5' }
    expect(buildSavePayload(form).accommodation_id).toBe('5')
  })
  it('includes create_accommodation for hotel with all hotel fields', () => {
    const form = {
      ...baseForm, type: 'hotel',
      hotel_place_id: '10', hotel_start_day: '3', hotel_end_day: '5',
      meta_check_in_time: '15:00', meta_check_out_time: '11:00',
      confirmation_number: 'CONF123',
    }
    const payload = buildSavePayload(form)
    expect(payload.create_accommodation).toEqual({
      place_id: '10', start_day_id: '3', end_day_id: '5',
      check_in: '15:00', check_out: '11:00', confirmation: 'CONF123',
    })
  })
  it('does NOT include create_accommodation for hotel missing hotel_place_id', () => {
    const form = { ...baseForm, type: 'hotel', hotel_start_day: '3', hotel_end_day: '5' }
    expect(buildSavePayload(form)).not.toHaveProperty('create_accommodation')
  })
  it('does NOT include create_accommodation for hotel missing start/end day', () => {
    const form = { ...baseForm, type: 'hotel', hotel_place_id: '10' }
    expect(buildSavePayload(form)).not.toHaveProperty('create_accommodation')
  })
  it('builds train metadata', () => {
    const form = { ...baseForm, type: 'train', meta_train_number: 'N700S', meta_platform: '14', meta_seat: '5A' }
    const meta = JSON.parse(buildSavePayload(form).metadata as string)
    expect(meta).toEqual({ train_number: 'N700S', platform: '14', seat: '5A' })
  })
  it('builds hotel metadata', () => {
    const form = { ...baseForm, type: 'hotel', meta_check_in_time: '15:00', meta_check_out_time: '11:00' }
    const meta = JSON.parse(buildSavePayload(form).metadata as string)
    expect(meta).toEqual({ check_in_time: '15:00', check_out_time: '11:00' })
  })
  it('time-only reservation_time is preserved as-is (not coerced to null)', () => {
    const form = { ...baseForm, reservation_time: '20:20' }
    expect(buildSavePayload(form).reservation_time).toBe('20:20')
  })
  it('sets status field correctly', () => {
    expect(buildSavePayload({ ...baseForm, status: 'confirmed' }).status).toBe('confirmed')
    expect(buildSavePayload({ ...baseForm, status: 'pending' }).status).toBe('pending')
  })
})
