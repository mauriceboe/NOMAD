import { describe, it, expect } from 'vitest'
import { getHolidays, isWeekend, getWeekday, getWeekdayFull, daysInMonth, formatDate, BUNDESLAENDER } from './holidays'

describe('holidays', () => {
  // FE-COMP-HOLIDAYS-001
  it('getHolidays returns Neujahr for any year', () => {
    expect(getHolidays(2025)['2025-01-01']).toBe('Neujahr')
    expect(getHolidays(2030)['2030-01-01']).toBe('Neujahr')
  })

  // FE-COMP-HOLIDAYS-002
  it('getHolidays returns correct Easter-relative holidays for 2025', () => {
    const h = getHolidays(2025)
    expect(h['2025-04-18']).toBe('Karfreitag')
    expect(h['2025-04-21']).toBe('Ostermontag')
    expect(h['2025-05-29']).toBe('Christi Himmelfahrt')
    expect(h['2025-06-09']).toBe('Pfingstmontag')
  })

  // FE-COMP-HOLIDAYS-003
  it('getHolidays includes state-specific holiday for Bayern (BY)', () => {
    expect(getHolidays(2025, 'BY')['2025-01-06']).toBe('Heilige Drei Könige')
  })

  // FE-COMP-HOLIDAYS-004
  it('getHolidays does not include Heilige Drei Könige for NW', () => {
    expect(getHolidays(2025, 'NW')['2025-01-06']).toBeUndefined()
  })

  // FE-COMP-HOLIDAYS-005
  it('getHolidays includes Fronleichnam for NW', () => {
    expect(getHolidays(2025, 'NW')['2025-06-19']).toBe('Fronleichnam')
  })

  // FE-COMP-HOLIDAYS-006
  it('getHolidays includes Reformationstag for BB but not BW', () => {
    expect(getHolidays(2025, 'BB')['2025-10-31']).toBe('Reformationstag')
    expect(getHolidays(2025, 'BW')['2025-10-31']).toBeUndefined()
  })

  // FE-COMP-HOLIDAYS-007
  it('isWeekend returns true for Saturday with default weekendDays', () => {
    expect(isWeekend('2025-01-04')).toBe(true)
  })

  // FE-COMP-HOLIDAYS-008
  it('isWeekend returns false for Monday', () => {
    expect(isWeekend('2025-01-06')).toBe(false)
  })

  // FE-COMP-HOLIDAYS-009
  it('isWeekend respects custom weekendDays', () => {
    expect(isWeekend('2025-01-06', [1])).toBe(true)
    expect(isWeekend('2025-01-04', [1])).toBe(false)
  })

  // FE-COMP-HOLIDAYS-010
  it('getWeekday returns correct abbreviation', () => {
    expect(getWeekday('2025-01-06')).toBe('Mo')
  })

  // FE-COMP-HOLIDAYS-011
  it('daysInMonth returns correct count', () => {
    expect(daysInMonth(2025, 2)).toBe(28)
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2025, 1)).toBe(31)
  })

  // FE-COMP-HOLIDAYS-012
  it('BUNDESLAENDER contains all 16 states', () => {
    expect(Object.keys(BUNDESLAENDER)).toHaveLength(16)
    expect(BUNDESLAENDER).toHaveProperty('BW')
    expect(BUNDESLAENDER).toHaveProperty('BY')
    expect(BUNDESLAENDER).toHaveProperty('BE')
  })

  // Additional: lowercase bundesland input
  it('getHolidays handles lowercase bundesland', () => {
    expect(getHolidays(2025, 'by')['2025-01-06']).toBe('Heilige Drei Könige')
  })

  // Additional: Buß- und Bettag for Sachsen
  it('getHolidays includes Buß- und Bettag for SN', () => {
    expect(getHolidays(2025, 'SN')['2025-11-19']).toBe('Buß- und Bettag')
  })

  // Additional: fixed national holidays
  it('getHolidays returns all fixed national holidays', () => {
    const h = getHolidays(2025)
    expect(h['2025-05-01']).toBe('Tag der Arbeit')
    expect(h['2025-10-03']).toBe('Tag der Deutschen Einheit')
    expect(h['2025-12-25']).toBe('1. Weihnachtsfeiertag')
    expect(h['2025-12-26']).toBe('2. Weihnachtsfeiertag')
  })

  // Additional: state-specific holidays coverage
  it('getHolidays includes Internationaler Frauentag for BE', () => {
    expect(getHolidays(2025, 'BE')['2025-03-08']).toBe('Internationaler Frauentag')
  })

  it('getHolidays includes Mariä Himmelfahrt for SL', () => {
    expect(getHolidays(2025, 'SL')['2025-08-15']).toBe('Mariä Himmelfahrt')
  })

  it('getHolidays includes Weltkindertag for TH', () => {
    expect(getHolidays(2025, 'TH')['2025-09-20']).toBe('Weltkindertag')
  })

  it('getHolidays includes Allerheiligen for BW', () => {
    expect(getHolidays(2025, 'BW')['2025-11-01']).toBe('Allerheiligen')
  })

  // Additional: getWeekdayFull
  it('getWeekdayFull returns full day name', () => {
    expect(getWeekdayFull('2025-01-06')).toBe('Montag')
    expect(getWeekdayFull('2025-01-05')).toBe('Sonntag')
  })

  // Additional: formatDate returns non-empty string
  it('formatDate returns a non-empty string', () => {
    const result = formatDate('2025-01-06')
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('formatDate accepts a locale parameter', () => {
    const result = formatDate('2025-01-06', 'de-DE')
    expect(result).toBeTruthy()
  })

  // Additional: isWeekend for Sunday
  it('isWeekend returns true for Sunday with default weekendDays', () => {
    expect(isWeekend('2025-01-05')).toBe(true)
  })
})
