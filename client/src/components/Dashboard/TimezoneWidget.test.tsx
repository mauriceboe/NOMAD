import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '../../../tests/helpers/render'
import userEvent from '@testing-library/user-event'
import { resetAllStores, seedStore } from '../../../tests/helpers/store'
import { useSettingsStore } from '../../store/settingsStore'
import TimezoneWidget from './TimezoneWidget'

beforeEach(() => {
  resetAllStores()
  vi.clearAllMocks()
  localStorage.clear()
  seedStore(useSettingsStore, { settings: { time_format: '24h' } } as any)
})

describe('TimezoneWidget', () => {
  it('FE-COMP-TIMEZONE-001: renders without crashing with default zones', () => {
    render(<TimezoneWidget />)
    expect(document.body).toBeInTheDocument()
    expect(screen.getByText('New York')).toBeInTheDocument()
    expect(screen.getByText('Tokyo')).toBeInTheDocument()
  })

  it('FE-COMP-TIMEZONE-002: shows local time text', () => {
    render(<TimezoneWidget />)
    const timeElements = screen.getAllByText(/\d{1,2}:\d{2}/)
    expect(timeElements.length).toBeGreaterThan(0)
  })

  it('FE-COMP-TIMEZONE-003: shows timezone section label', () => {
    render(<TimezoneWidget />)
    expect(screen.getByText(/timezones/i)).toBeInTheDocument()
  })

  it('FE-COMP-TIMEZONE-004: default zones render on first load (no localStorage)', () => {
    localStorage.clear()
    render(<TimezoneWidget />)
    expect(screen.getByText('New York')).toBeInTheDocument()
    expect(screen.getByText('Tokyo')).toBeInTheDocument()
  })

  it('FE-COMP-TIMEZONE-005: zones saved in localStorage are restored', () => {
    localStorage.setItem('dashboard_timezones', JSON.stringify([{ label: 'Berlin', tz: 'Europe/Berlin' }]))
    render(<TimezoneWidget />)
    expect(screen.getByText('Berlin')).toBeInTheDocument()
    expect(screen.queryByText('New York')).toBeNull()
  })

  it('FE-COMP-TIMEZONE-006: clicking the Plus button opens the add-zone panel', async () => {
    const user = userEvent.setup()
    render(<TimezoneWidget />)
    const allButtons = screen.getAllByRole('button')
    await user.click(allButtons[0])
    expect(await screen.findByText('Custom Timezone')).toBeInTheDocument()
  })

  it('FE-COMP-TIMEZONE-007: adding a popular zone from the dropdown adds it to the list', async () => {
    const user = userEvent.setup()
    render(<TimezoneWidget />)
    // Open add panel
    const allButtons = screen.getAllByRole('button')
    await user.click(allButtons[0])
    // Find and click Berlin in the popular zones list
    const berlinButton = await screen.findByRole('button', { name: /Berlin/i })
    await user.click(berlinButton)
    expect(screen.getByText('Berlin')).toBeInTheDocument()
    // Panel should be closed
    expect(screen.queryByText('Custom Timezone')).toBeNull()
  })

  it('FE-COMP-TIMEZONE-008: adding a custom valid timezone with label shows in the list', async () => {
    const user = userEvent.setup()
    render(<TimezoneWidget />)
    // Open add panel
    const allButtons = screen.getAllByRole('button')
    await user.click(allButtons[0])
    // Type label and timezone
    const labelInput = screen.getByPlaceholderText('Label (optional)')
    const tzInput = screen.getByPlaceholderText('e.g. America/New_York')
    await user.type(labelInput, 'My City')
    await user.type(tzInput, 'Europe/Paris')
    // Click Add
    const addButton = screen.getByRole('button', { name: 'Add' })
    await user.click(addButton)
    expect(await screen.findByText('My City')).toBeInTheDocument()
  })

  it('FE-COMP-TIMEZONE-009: adding a custom invalid timezone shows an error', async () => {
    const user = userEvent.setup()
    render(<TimezoneWidget />)
    const allButtons = screen.getAllByRole('button')
    await user.click(allButtons[0])
    const tzInput = screen.getByPlaceholderText('e.g. America/New_York')
    await user.type(tzInput, 'Invalid/Timezone')
    const addButton = screen.getByRole('button', { name: 'Add' })
    await user.click(addButton)
    expect(await screen.findByText(/invalid timezone/i)).toBeInTheDocument()
  })

  it('FE-COMP-TIMEZONE-010: adding a duplicate timezone shows a duplicate error', async () => {
    const user = userEvent.setup()
    render(<TimezoneWidget />)
    // Default zones include New York (America/New_York)
    const allButtons = screen.getAllByRole('button')
    await user.click(allButtons[0])
    const tzInput = screen.getByPlaceholderText('e.g. America/New_York')
    await user.type(tzInput, 'America/New_York')
    const addButton = screen.getByRole('button', { name: 'Add' })
    await user.click(addButton)
    expect(await screen.findByText(/already added/i)).toBeInTheDocument()
  })

  it('FE-COMP-TIMEZONE-011: remove button removes a zone from the list', async () => {
    const user = userEvent.setup()
    render(<TimezoneWidget />)
    expect(screen.getByText('New York')).toBeInTheDocument()
    // The remove buttons are always in the DOM (opacity-0 in CSS, not hidden from DOM)
    // There are 2 zone rows (New York, Tokyo), plus the Plus button = 3 buttons total
    // Remove buttons for New York and Tokyo come after the Plus button
    const allButtons = screen.getAllByRole('button')
    // allButtons[0] = Plus, allButtons[1] = remove New York, allButtons[2] = remove Tokyo
    await user.click(allButtons[1])
    expect(screen.queryByText('New York')).toBeNull()
    expect(screen.getByText('Tokyo')).toBeInTheDocument()
  })

  it('FE-COMP-TIMEZONE-012: adding a zone persists to localStorage', async () => {
    const user = userEvent.setup()
    render(<TimezoneWidget />)
    const allButtons = screen.getAllByRole('button')
    await user.click(allButtons[0])
    const berlinButton = await screen.findByRole('button', { name: /Berlin/i })
    await user.click(berlinButton)
    const saved = JSON.parse(localStorage.getItem('dashboard_timezones') || '[]')
    expect(saved.some((z: { tz: string }) => z.tz === 'Europe/Berlin')).toBe(true)
  })

  it('FE-COMP-TIMEZONE-013: Enter key in custom tz input triggers addCustomZone', async () => {
    const user = userEvent.setup()
    render(<TimezoneWidget />)
    const allButtons = screen.getAllByRole('button')
    await user.click(allButtons[0])
    const labelInput = screen.getByPlaceholderText('Label (optional)')
    const tzInput = screen.getByPlaceholderText('e.g. America/New_York')
    await user.type(labelInput, 'Singapore')
    await user.type(tzInput, 'Asia/Singapore')
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Singapore')).toBeInTheDocument()
  })
})
