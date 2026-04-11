import { describe, it, expect } from 'vitest';
import { formatDate, formatTime, dayTotalCost, currencyDecimals } from '../../../src/utils/formatters';

describe('currencyDecimals', () => {
  it('returns 0 for zero-decimal currencies', () => {
    expect(currencyDecimals('JPY')).toBe(0);
    expect(currencyDecimals('KRW')).toBe(0);
    expect(currencyDecimals('jpy')).toBe(0); // case-insensitive
  });

  it('returns 2 for standard currencies', () => {
    expect(currencyDecimals('EUR')).toBe(2);
    expect(currencyDecimals('USD')).toBe(2);
    expect(currencyDecimals('GBP')).toBe(2);
  });
});

describe('formatDate', () => {
  it('returns null for null/undefined input', () => {
    expect(formatDate(null, 'en-US')).toBeNull();
    expect(formatDate(undefined, 'en-US')).toBeNull();
  });

  it('formats a date string and returns a non-empty string', () => {
    const result = formatDate('2025-06-01', 'en-US');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
    expect(result!.length).toBeGreaterThan(0);
  });

  it('accepts an optional timeZone parameter without throwing', () => {
    const result = formatDate('2025-06-01', 'en-US', 'America/New_York');
    expect(result).not.toBeNull();
  });
});

describe('formatTime', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatTime(null, 'en-US', '24h')).toBe('');
    expect(formatTime(undefined, 'en-US', '24h')).toBe('');
  });

  it('formats 24h time', () => {
    expect(formatTime('14:30', 'en-US', '24h')).toBe('14:30');
    expect(formatTime('09:05', 'en-US', '24h')).toBe('09:05');
  });

  it('appends Uhr suffix for German locale in 24h mode', () => {
    expect(formatTime('14:30', 'de-DE', '24h')).toBe('14:30 Uhr');
  });

  it('formats 12h time', () => {
    expect(formatTime('14:30', 'en-US', '12h')).toBe('2:30 PM');
    expect(formatTime('00:00', 'en-US', '12h')).toBe('12:00 AM');
    expect(formatTime('12:00', 'en-US', '12h')).toBe('12:00 PM');
    expect(formatTime('01:00', 'en-US', '12h')).toBe('1:00 AM');
  });
});

describe('dayTotalCost', () => {
  it('returns null when there are no assignments', () => {
    expect(dayTotalCost(1, {}, 'EUR')).toBeNull();
  });

  it('returns null when no places have prices', () => {
    const assignments = {
      '1': [
        { id: 1, day_id: 1, order_index: 0, notes: null, place: { id: 1, trip_id: 1, name: 'P', lat: null, lng: null, description: null, address: null, category_id: null, icon: null, price: null, image_url: null, google_place_id: null, osm_id: null, route_geometry: null, place_time: null, end_time: null, created_at: '' } },
      ],
    };
    expect(dayTotalCost(1, assignments, 'EUR')).toBeNull();
  });

  it('sums prices across assignments', () => {
    const assignments = {
      '1': [
        { id: 1, day_id: 1, order_index: 0, notes: null, place: { id: 1, trip_id: 1, name: 'A', lat: null, lng: null, description: null, address: null, category_id: null, icon: null, price: '20', image_url: null, google_place_id: null, osm_id: null, route_geometry: null, place_time: null, end_time: null, created_at: '' } },
        { id: 2, day_id: 1, order_index: 1, notes: null, place: { id: 2, trip_id: 1, name: 'B', lat: null, lng: null, description: null, address: null, category_id: null, icon: null, price: '30', image_url: null, google_place_id: null, osm_id: null, route_geometry: null, place_time: null, end_time: null, created_at: '' } },
      ],
    };
    expect(dayTotalCost(1, assignments, 'EUR')).toBe('50 EUR');
  });

  it('ignores non-numeric price strings', () => {
    const assignments = {
      '1': [
        { id: 1, day_id: 1, order_index: 0, notes: null, place: { id: 1, trip_id: 1, name: 'A', lat: null, lng: null, description: null, address: null, category_id: null, icon: null, price: 'free', image_url: null, google_place_id: null, osm_id: null, route_geometry: null, place_time: null, end_time: null, created_at: '' } },
      ],
    };
    expect(dayTotalCost(1, assignments, 'EUR')).toBeNull();
  });

  it('uses the dayId key to look up assignments', () => {
    const assignments = {
      '2': [
        { id: 3, day_id: 2, order_index: 0, notes: null, place: { id: 3, trip_id: 1, name: 'C', lat: null, lng: null, description: null, address: null, category_id: null, icon: null, price: '10', image_url: null, google_place_id: null, osm_id: null, route_geometry: null, place_time: null, end_time: null, created_at: '' } },
      ],
    };
    expect(dayTotalCost(1, assignments, 'USD')).toBeNull();
    expect(dayTotalCost(2, assignments, 'USD')).toBe('10 USD');
  });
});
