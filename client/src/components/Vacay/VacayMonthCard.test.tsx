import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../../../tests/helpers/render'
import { resetAllStores } from '../../../tests/helpers/store'
import VacayMonthCard from './VacayMonthCard'

const baseProps = {
  year: 2025,
  month: 0, // January 2025
  holidays: {},
  companyHolidaySet: new Set<string>(),
  companyHolidaysEnabled: true,
  entryMap: {},
  onCellClick: vi.fn(),
  companyMode: false,
  blockWeekends: true,
  weekendDays: [0, 6],
}

afterEach(() => {
  resetAllStores()
  vi.clearAllMocks()
})

describe('VacayMonthCard', () => {
  it('FE-COMP-VACAYMONTHCARD-001: Renders the month name', () => {
    render(<VacayMonthCard {...baseProps} />)
    // January in en-US locale via Intl.DateTimeFormat
    expect(screen.getByText(/january/i)).toBeInTheDocument()
  })

  it('FE-COMP-VACAYMONTHCARD-002: Renders correct number of day cells for January 2025', () => {
    render(<VacayMonthCard {...baseProps} />)
    // January 2025 has 31 days
    for (let d = 1; d <= 31; d++) {
      expect(screen.getByText(String(d))).toBeInTheDocument()
    }
  })

  it('FE-COMP-VACAYMONTHCARD-003: Calls onCellClick with the correct ISO date string', async () => {
    const user = userEvent.setup()
    render(<VacayMonthCard {...baseProps} />)
    // January 15, 2025 is a Wednesday (not blocked)
    await user.click(screen.getByText('15'))
    expect(baseProps.onCellClick).toHaveBeenCalledWith('2025-01-15')
  })

  it('FE-COMP-VACAYMONTHCARD-004: Holiday cell has tooltip with localName', () => {
    const props = {
      ...baseProps,
      holidays: { '2025-01-01': { localName: 'Neujahr', label: null, color: '#ef4444' } },
    }
    render(<VacayMonthCard {...props} />)
    // Jan 1 is a Wednesday — there may be multiple "1" text nodes, find the one with a title
    const cell = screen.getByTitle('Neujahr')
    expect(cell).toBeInTheDocument()
  })

  it('FE-COMP-VACAYMONTHCARD-005: Holiday cell with label shows combined tooltip', () => {
    const props = {
      ...baseProps,
      holidays: { '2025-01-01': { localName: 'New Year', label: 'DE', color: '#ef4444' } },
    }
    render(<VacayMonthCard {...props} />)
    const cell = screen.getByTitle('DE: New Year')
    expect(cell).toBeInTheDocument()
  })

  it('FE-COMP-VACAYMONTHCARD-006: Weekend cell has default cursor (blocked)', () => {
    render(<VacayMonthCard {...baseProps} />)
    // January 5, 2025 is a Sunday (getDay() === 0), which is in weekendDays [0, 6]
    // isBlocked = weekend && blockWeekends = true
    const daySpan = screen.getByText('5')
    const cell = daySpan.closest('div') as HTMLElement
    expect(cell.style.cursor).toBe('default')
  })

  it('FE-COMP-VACAYMONTHCARD-007: Company holiday overlay renders', () => {
    const props = {
      ...baseProps,
      companyHolidaySet: new Set(['2025-01-10']),
      companyHolidaysEnabled: true,
    }
    render(<VacayMonthCard {...props} />)
    // January 10, 2025 is a Friday (not a weekend)
    const daySpan = screen.getByText('10')
    const cell = daySpan.closest('div') as HTMLElement
    // Company overlay is a direct child div with amber background
    const overlayDivs = Array.from(cell.querySelectorAll(':scope > div')) as HTMLElement[]
    const companyOverlay = overlayDivs.find(el => el.style.background.includes('245'))
    expect(companyOverlay).toBeTruthy()
  })

  it('FE-COMP-VACAYMONTHCARD-008: Single vacation entry renders colored overlay', () => {
    const props = {
      ...baseProps,
      entryMap: { '2025-01-15': [{ person_color: '#6366f1' }] },
    }
    render(<VacayMonthCard {...props} />)
    const daySpan = screen.getByText('15')
    const cell = daySpan.closest('div') as HTMLElement
    // The overlay div should have opacity: 0.4 and a backgroundColor set
    const overlayDivs = Array.from(cell.querySelectorAll(':scope > div')) as HTMLElement[]
    const colorOverlay = overlayDivs.find(
      el => el.style.opacity === '0.4' && el.style.backgroundColor !== '',
    )
    expect(colorOverlay).toBeTruthy()
  })

  it('FE-COMP-VACAYMONTHCARD-009: Day number font-weight is bold when entries exist', () => {
    const props = {
      ...baseProps,
      entryMap: { '2025-01-20': [{ person_color: '#6366f1' }] },
    }
    render(<VacayMonthCard {...props} />)
    const daySpan = screen.getByText('20')
    expect(daySpan.style.fontWeight).toBe('700')
  })

  it('FE-COMP-VACAYMONTHCARD-010: Renders 7 weekday header labels', () => {
    render(<VacayMonthCard {...baseProps} />)
    // Weekday labels from translations: Mon, Tue, Wed, Thu, Fri, Sat, Sun
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    for (const wd of weekdays) {
      expect(screen.getByText(wd)).toBeInTheDocument()
    }
  })

  it('FE-COMP-VACAYMONTHCARD-011: Two vacation entries render gradient overlay', () => {
    const props = {
      ...baseProps,
      entryMap: {
        '2025-01-15': [{ person_color: '#6366f1' }, { person_color: '#f43f5e' }],
      },
    }
    render(<VacayMonthCard {...props} />)
    const daySpan = screen.getByText('15')
    const cell = daySpan.closest('div') as HTMLElement
    const overlayDivs = Array.from(cell.querySelectorAll(':scope > div')) as HTMLElement[]
    const gradientOverlay = overlayDivs.find(
      el => el.style.opacity === '0.4' && el.style.background.includes('linear-gradient'),
    )
    expect(gradientOverlay).toBeTruthy()
  })

  it('FE-COMP-VACAYMONTHCARD-012: Four vacation entries render quadrant overlay', () => {
    const props = {
      ...baseProps,
      entryMap: {
        '2025-01-15': [
          { person_color: '#6366f1' },
          { person_color: '#f43f5e' },
          { person_color: '#22c55e' },
          { person_color: '#f59e0b' },
        ],
      },
    }
    render(<VacayMonthCard {...props} />)
    const daySpan = screen.getByText('15')
    const cell = daySpan.closest('div') as HTMLElement
    // Quadrant overlay wrapper div (4 entries) has 4 sub-divs
    const wrapperDiv = cell.querySelector(':scope > div') as HTMLElement
    expect(wrapperDiv).toBeTruthy()
    const quadrants = wrapperDiv.querySelectorAll(':scope > div')
    expect(quadrants).toHaveLength(4)
  })
})
