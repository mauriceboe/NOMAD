import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../../../tests/helpers/render'
import { resetAllStores, seedStore } from '../../../tests/helpers/store'
import { server } from '../../../tests/helpers/msw/server'
import { http, HttpResponse } from 'msw'
import { useVacayStore } from '../../store/vacayStore'
import VacaySettings from './VacaySettings'

const basePlan = {
  id: 1,
  block_weekends: true,
  weekend_days: '0,6',
  carry_over_enabled: false,
  company_holidays_enabled: false,
  holidays_enabled: false,
  holiday_calendars: [],
}

beforeEach(() => {
  resetAllStores()
  server.use(
    http.get('/api/addons/vacay/holidays/countries', () =>
      HttpResponse.json([{ countryCode: 'DE', name: 'Germany' }, { countryCode: 'FR', name: 'France' }])
    ),
    http.get('/api/addons/vacay/holidays/:year/:country', () =>
      HttpResponse.json([])
    ),
  )
})

describe('VacaySettings', () => {
  it('FE-COMP-VACAYSETTINGS-001: returns null when plan is null', () => {
    seedStore(useVacayStore, { plan: null, isFused: false, users: [] })
    const { container } = render(<VacaySettings onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('FE-COMP-VACAYSETTINGS-002: block weekends toggle calls updatePlan', async () => {
    const user = userEvent.setup()
    const updatePlan = vi.fn().mockResolvedValue(undefined)
    seedStore(useVacayStore, {
      plan: { ...basePlan, block_weekends: true },
      isFused: false,
      users: [],
      updatePlan,
    })
    render(<VacaySettings onClose={vi.fn()} />)

    // The SettingToggle for block_weekends is the first toggle button
    const toggles = screen.getAllByRole('button', { hidden: true })
    // Find the toggle button (inline-flex h-6 w-11 button) - there are day buttons + toggle
    // The block_weekends toggle is rendered as a button with rounded-full class
    // Let's find it by its position - it's the first toggle-style button
    const allButtons = screen.getAllByRole('button')
    // Day buttons (Mon-Sun) are visible when block_weekends is true, toggle buttons are the ones
    // that are NOT day abbreviations. The block_weekends toggle should be before the day buttons.
    // Easiest: find the first button that has inline-flex styling (the toggle)
    const toggleButton = allButtons.find(b =>
      b.className.includes('inline-flex') && b.className.includes('rounded-full')
    )
    expect(toggleButton).toBeDefined()
    await user.click(toggleButton!)

    expect(updatePlan).toHaveBeenCalledWith({ block_weekends: false })
  })

  it('FE-COMP-VACAYSETTINGS-003: weekend day buttons visible when blockWeekends is true', () => {
    seedStore(useVacayStore, {
      plan: { ...basePlan, block_weekends: true },
      isFused: false,
      users: [],
    })
    render(<VacaySettings onClose={vi.fn()} />)

    // Day buttons should be visible (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
    // Scope to the weekend-days container to avoid picking up week-start buttons
    const label = screen.getByText('Weekend days')
    const container = label.parentElement!
    const dayButtons = container.querySelectorAll('button')
    // There should be 7 day buttons
    expect(dayButtons.length).toBe(7)
  })

  it('FE-COMP-VACAYSETTINGS-004: weekend day buttons hidden when blockWeekends is false', () => {
    seedStore(useVacayStore, {
      plan: { ...basePlan, block_weekends: false },
      isFused: false,
      users: [],
    })
    render(<VacaySettings onClose={vi.fn()} />)

    // When block_weekends is false, the weekend-days section is not rendered at all
    expect(screen.queryByText('Weekend days')).not.toBeInTheDocument()
  })

  it('FE-COMP-VACAYSETTINGS-005: clicking an active weekend day removes it', async () => {
    const user = userEvent.setup()
    const updatePlan = vi.fn().mockResolvedValue(undefined)
    seedStore(useVacayStore, {
      plan: { ...basePlan, block_weekends: true, weekend_days: '0,6' },
      isFused: false,
      users: [],
      updatePlan,
    })
    render(<VacaySettings onClose={vi.fn()} />)

    // Day buttons have inline style with padding: '4px 10px' and borderRadius: 8
    const dayButtons = screen.getAllByRole('button').filter(b =>
      b.style.padding === '4px 10px'
    )
    // Order: Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Sat(6), Sun(0)
    // Sun is the last one (index 6), day=0, currently in '0,6'
    const sunButton = dayButtons[6]
    await user.click(sunButton)

    expect(updatePlan).toHaveBeenCalledWith({ weekend_days: '6' })
  })

  it('FE-COMP-VACAYSETTINGS-006: public holidays section shows add button when enabled', () => {
    seedStore(useVacayStore, {
      plan: { ...basePlan, holidays_enabled: true, holiday_calendars: [] },
      isFused: false,
      users: [],
    })
    render(<VacaySettings onClose={vi.fn()} />)

    // The "add calendar" button should be visible
    const addButton = screen.getByRole('button', { name: /addCalendar|add calendar|\+/i })
    expect(addButton).toBeInTheDocument()
  })

  it('FE-COMP-VACAYSETTINGS-007: AddCalendarForm appears on add-button click', async () => {
    const user = userEvent.setup()
    seedStore(useVacayStore, {
      plan: { ...basePlan, holidays_enabled: true, holiday_calendars: [] },
      isFused: false,
      users: [],
    })
    render(<VacaySettings onClose={vi.fn()} />)

    // Find and click the add button (has rounded-md class and is in the holidays section)
    const buttons = screen.getAllByRole('button')
    const addButton = buttons.find(b => b.className.includes('rounded-md') && b.querySelector('svg'))
    expect(addButton).toBeDefined()
    await user.click(addButton!)

    // After clicking, the AddCalendarForm should be visible with a label input
    const inputs = screen.getAllByRole('textbox')
    expect(inputs.length).toBeGreaterThan(0)
  })

  it('FE-COMP-VACAYSETTINGS-008: countries are loaded from API and shown in selector', async () => {
    const user = userEvent.setup()
    seedStore(useVacayStore, {
      plan: { ...basePlan, holidays_enabled: true, holiday_calendars: [] },
      isFused: false,
      users: [],
    })
    render(<VacaySettings onClose={vi.fn()} />)

    // Click the add button to show AddCalendarForm
    const buttons = screen.getAllByRole('button')
    const addButton = buttons.find(b => b.className.includes('rounded-md') && b.querySelector('svg'))
    await user.click(addButton!)

    // Wait for countries to load (the component fetches them on mount)
    await waitFor(() => {
      // The CustomSelect for country should have Germany and France as options
      // CustomSelect renders a button showing the placeholder/selected value
      // When opened, options appear. Let's open the dropdown.
      const countrySelects = screen.getAllByRole('button').filter(b =>
        b.textContent?.includes('selectCountry') ||
        b.textContent?.includes('Select') ||
        b.textContent?.includes('country')
      )
      expect(countrySelects.length).toBeGreaterThanOrEqual(1)
    })

    // Open the country dropdown and check for Germany and France
    // Find the country selector button (CustomSelect triggers a dropdown)
    const allButtons = screen.getAllByRole('button')
    // The country select button in the AddCalendarForm should be one of the later buttons
    // Let's look for it by finding the placeholder text
    const selectButton = allButtons.find(b =>
      b.textContent?.includes('vacay.selectCountry') || b.textContent?.includes('country')
    )
    if (selectButton) {
      await user.click(selectButton)
      await waitFor(() => {
        expect(screen.queryByText('Germany')).toBeInTheDocument()
      })
    }
  })

  it('FE-COMP-VACAYSETTINGS-009: dissolve section shown only when isFused', () => {
    seedStore(useVacayStore, {
      plan: { ...basePlan },
      isFused: true,
      users: [],
    })
    const { rerender } = render(<VacaySettings onClose={vi.fn()} />)

    // Dissolve section should be visible
    // The dissolve button text comes from t('vacay.dissolveAction')
    // In test env with no translations, keys are returned - look for the dissolve button
    const buttons = screen.getAllByRole('button')
    const dissolveButton = buttons.find(b =>
      b.className.includes('bg-red-500') || b.className.includes('bg-red-600')
    )
    expect(dissolveButton).toBeDefined()

    // Re-seed with isFused: false
    seedStore(useVacayStore, { isFused: false })
    rerender(<VacaySettings onClose={vi.fn()} />)

    const buttonsAfter = screen.getAllByRole('button')
    const dissolveButtonAfter = buttonsAfter.find(b =>
      b.className.includes('bg-red-500') || b.className.includes('bg-red-600')
    )
    expect(dissolveButtonAfter).toBeUndefined()
  })

  it('FE-COMP-VACAYSETTINGS-010: dissolve button calls dissolve and onClose', async () => {
    const user = userEvent.setup()
    const dissolve = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    seedStore(useVacayStore, {
      plan: { ...basePlan },
      isFused: true,
      users: [],
      dissolve,
    })
    render(<VacaySettings onClose={onClose} />)

    const buttons = screen.getAllByRole('button')
    const dissolveButton = buttons.find(b => b.className.includes('bg-red-500'))
    expect(dissolveButton).toBeDefined()
    await user.click(dissolveButton!)

    await waitFor(() => {
      expect(dissolve).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('FE-COMP-VACAYSETTINGS-011: calendar row shows delete button and calls deleteHolidayCalendar', async () => {
    const user = userEvent.setup()
    const deleteHolidayCalendar = vi.fn().mockResolvedValue(undefined)
    seedStore(useVacayStore, {
      plan: {
        ...basePlan,
        holidays_enabled: true,
        holiday_calendars: [{ id: 5, plan_id: 1, region: 'DE', color: '#fecaca', label: null, sort_order: 0 }],
      },
      isFused: false,
      users: [],
      deleteHolidayCalendar,
    })
    render(<VacaySettings onClose={vi.fn()} />)

    // The CalendarRow has a Trash2 icon inside a button
    const buttons = screen.getAllByRole('button')
    // Find the trash button - it has p-1.5 class and shrink-0
    const trashButton = buttons.find(b =>
      b.className.includes('p-1.5') && b.className.includes('shrink-0')
    )
    expect(trashButton).toBeDefined()
    await user.click(trashButton!)

    expect(deleteHolidayCalendar).toHaveBeenCalledWith(5)
  })

  it('FE-COMP-VACAYSETTINGS-012: calendar row color picker opens on color button click', async () => {
    const user = userEvent.setup()
    seedStore(useVacayStore, {
      plan: {
        ...basePlan,
        holidays_enabled: true,
        holiday_calendars: [{ id: 5, plan_id: 1, region: 'DE', color: '#fecaca', label: null, sort_order: 0 }],
      },
      isFused: false,
      users: [],
      deleteHolidayCalendar: vi.fn(),
    })
    render(<VacaySettings onClose={vi.fn()} />)

    // The color button in CalendarRow has width:28 and height:28 inline style
    const colorButton = screen.getAllByRole('button').find(b =>
      b.style.width === '28px' && b.style.height === '28px'
    )
    expect(colorButton).toBeDefined()
    await user.click(colorButton!)

    // Color picker should now be visible (12 preset color swatches with width:24)
    const swatches = screen.getAllByRole('button').filter(b =>
      b.style.width === '24px' && b.style.height === '24px'
    )
    expect(swatches.length).toBe(12)
  })

  it('FE-COMP-VACAYSETTINGS-013: clicking a color swatch calls onUpdate with new color', async () => {
    const user = userEvent.setup()
    const updateHolidayCalendar = vi.fn().mockResolvedValue(undefined)
    seedStore(useVacayStore, {
      plan: {
        ...basePlan,
        holidays_enabled: true,
        holiday_calendars: [{ id: 5, plan_id: 1, region: 'DE', color: '#fecaca', label: null, sort_order: 0 }],
      },
      isFused: false,
      users: [],
      updateHolidayCalendar,
    })
    render(<VacaySettings onClose={vi.fn()} />)

    // Open color picker
    const colorButton = screen.getAllByRole('button').find(b =>
      b.style.width === '28px' && b.style.height === '28px'
    )
    await user.click(colorButton!)

    // Click a different color swatch (second swatch = '#fed7aa', not the current '#fecaca')
    const swatches = screen.getAllByRole('button').filter(b =>
      b.style.width === '24px' && b.style.height === '24px'
    )
    await user.click(swatches[1]) // '#fed7aa'

    expect(updateHolidayCalendar).toHaveBeenCalledWith(5, { color: '#fed7aa' })
  })

  it('FE-COMP-VACAYSETTINGS-014: calendar row label blur calls onUpdate when changed', async () => {
    const user = userEvent.setup()
    const updateHolidayCalendar = vi.fn().mockResolvedValue(undefined)
    seedStore(useVacayStore, {
      plan: {
        ...basePlan,
        holidays_enabled: true,
        holiday_calendars: [{ id: 5, plan_id: 1, region: 'DE', color: '#fecaca', label: null, sort_order: 0 }],
      },
      isFused: false,
      users: [],
      updateHolidayCalendar,
    })
    render(<VacaySettings onClose={vi.fn()} />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'My Calendar')
    await user.tab() // triggers blur

    expect(updateHolidayCalendar).toHaveBeenCalledWith(5, { label: 'My Calendar' })
  })

  it('FE-COMP-VACAYSETTINGS-015: AddCalendarForm cancel button hides form', async () => {
    const user = userEvent.setup()
    seedStore(useVacayStore, {
      plan: { ...basePlan, holidays_enabled: true, holiday_calendars: [] },
      isFused: false,
      users: [],
    })
    render(<VacaySettings onClose={vi.fn()} />)

    // Open the form
    const addButton = screen.getAllByRole('button').find(b =>
      b.className.includes('rounded-md') && b.querySelector('svg')
    )
    await user.click(addButton!)
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0)

    // Click cancel (✕ button)
    const cancelButton = screen.getAllByRole('button').find(b => b.textContent === '✕')
    expect(cancelButton).toBeDefined()
    await user.click(cancelButton!)

    // Form should be hidden again - no textbox
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('FE-COMP-VACAYSETTINGS-016: carry-over toggle calls updatePlan', async () => {
    const user = userEvent.setup()
    const updatePlan = vi.fn().mockResolvedValue(undefined)
    seedStore(useVacayStore, {
      plan: { ...basePlan, block_weekends: false, carry_over_enabled: false },
      isFused: false,
      users: [],
      updatePlan,
    })
    render(<VacaySettings onClose={vi.fn()} />)

    const toggleButtons = screen.getAllByRole('button').filter(b =>
      b.className.includes('inline-flex') && b.className.includes('rounded-full')
    )
    // carry_over_enabled is the second toggle (block_weekends, carry_over, company, holidays)
    await user.click(toggleButtons[1])

    expect(updatePlan).toHaveBeenCalledWith({ carry_over_enabled: true })
  })

  it('FE-COMP-VACAYSETTINGS-017: company holidays toggle calls updatePlan', async () => {
    const user = userEvent.setup()
    const updatePlan = vi.fn().mockResolvedValue(undefined)
    seedStore(useVacayStore, {
      plan: { ...basePlan, block_weekends: false, company_holidays_enabled: false },
      isFused: false,
      users: [],
      updatePlan,
    })
    render(<VacaySettings onClose={vi.fn()} />)

    const toggleButtons = screen.getAllByRole('button').filter(b =>
      b.className.includes('inline-flex') && b.className.includes('rounded-full')
    )
    // company_holidays_enabled is the third toggle
    await user.click(toggleButtons[2])

    expect(updatePlan).toHaveBeenCalledWith({ company_holidays_enabled: true })
  })

  it('FE-COMP-VACAYSETTINGS-018: adding weekend day calls updatePlan with day added', async () => {
    const user = userEvent.setup()
    const updatePlan = vi.fn().mockResolvedValue(undefined)
    seedStore(useVacayStore, {
      plan: { ...basePlan, block_weekends: true, weekend_days: '6' },
      isFused: false,
      users: [],
      updatePlan,
    })
    render(<VacaySettings onClose={vi.fn()} />)

    // Click Sun button (day=0, currently NOT in '6')
    const dayButtons = screen.getAllByRole('button').filter(b =>
      b.style.padding === '4px 10px'
    )
    const sunButton = dayButtons[6] // last button = Sunday
    await user.click(sunButton)

    expect(updatePlan).toHaveBeenCalledWith({ weekend_days: expect.stringContaining('0') })
  })
})
