import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../../tests/helpers/render'
import { resetAllStores } from '../../../tests/helpers/store'
import { useSettingsStore } from '../../store/settingsStore'
import WeatherWidget from './WeatherWidget'

vi.mock('../../api/client', async (importOriginal) => {
  const original = await importOriginal() as any
  return {
    ...original,
    weatherApi: {
      get: vi.fn(),
    },
  }
})

// Import after mock so we get the mocked version
import { weatherApi } from '../../api/client'

const buildWeather = (overrides = {}) => ({
  temp: 20,
  main: 'Clear',
  description: 'clear sky',
  type: 'forecast',
  ...overrides,
})

beforeEach(() => {
  sessionStorage.clear()
  vi.clearAllMocks()
  resetAllStores()
})

describe('WeatherWidget', () => {
  it('FE-COMP-WEATHERWIDGET-001: renders nothing when lat or lng is null', () => {
    const { container } = render(
      <WeatherWidget lat={null} lng={null} date="2025-06-01" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('FE-COMP-WEATHERWIDGET-002: shows loading indicator while fetching', () => {
    vi.mocked(weatherApi.get).mockReturnValue(new Promise(() => {}))
    render(<WeatherWidget lat={48.86} lng={2.35} date="2025-06-01" />)
    expect(screen.getByText('…')).toBeInTheDocument()
  })

  it('FE-COMP-WEATHERWIDGET-003: shows error dash when fetch fails', async () => {
    vi.mocked(weatherApi.get).mockRejectedValue(new Error('Network error'))
    render(<WeatherWidget lat={48.86} lng={2.35} date="2025-06-01" />)
    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  it('FE-COMP-WEATHERWIDGET-004: shows error dash when API returns error field', async () => {
    vi.mocked(weatherApi.get).mockResolvedValue({ error: 'Not available' })
    render(<WeatherWidget lat={48.86} lng={2.35} date="2025-06-01" />)
    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  it('FE-COMP-WEATHERWIDGET-005: displays temperature in Celsius', async () => {
    vi.mocked(weatherApi.get).mockResolvedValue(buildWeather({ temp: 20 }))
    useSettingsStore.setState({ settings: { ...useSettingsStore.getState().settings, temperature_unit: 'celsius' } })
    render(<WeatherWidget lat={48.86} lng={2.35} date="2025-06-01" />)
    await waitFor(() => {
      expect(screen.getByText('20°C')).toBeInTheDocument()
    })
  })

  it('FE-COMP-WEATHERWIDGET-006: converts temperature to Fahrenheit', async () => {
    vi.mocked(weatherApi.get).mockResolvedValue(buildWeather({ temp: 20 }))
    useSettingsStore.setState({ settings: { ...useSettingsStore.getState().settings, temperature_unit: 'fahrenheit' } })
    render(<WeatherWidget lat={48.86} lng={2.35} date="2025-06-01" />)
    await waitFor(() => {
      expect(screen.getByText('68°F')).toBeInTheDocument()
    })
  })

  it('FE-COMP-WEATHERWIDGET-007: shows "Ø" prefix for climate data', async () => {
    vi.mocked(weatherApi.get).mockResolvedValue(buildWeather({ temp: 15, main: 'Clouds', type: 'climate' }))
    useSettingsStore.setState({ settings: { ...useSettingsStore.getState().settings, temperature_unit: 'celsius' } })
    render(<WeatherWidget lat={48.86} lng={2.35} date="2025-06-01" />)
    await waitFor(() => {
      expect(screen.getByText(/Ø/)).toBeInTheDocument()
    })
  })

  it('FE-COMP-WEATHERWIDGET-008: compact mode renders inline without description', async () => {
    vi.mocked(weatherApi.get).mockResolvedValue(buildWeather({ description: 'clear sky' }))
    useSettingsStore.setState({ settings: { ...useSettingsStore.getState().settings, temperature_unit: 'celsius' } })
    const { container } = render(
      <WeatherWidget lat={48.86} lng={2.35} date="2025-06-01" compact={true} />
    )
    await waitFor(() => {
      expect(screen.getByText('20°C')).toBeInTheDocument()
    })
    expect(screen.queryByText('clear sky')).not.toBeInTheDocument()
    // Outer element should be a span
    const tempSpan = screen.getByText('20°C')
    expect(tempSpan.closest('span')).toBeInTheDocument()
    expect(container.querySelector('div')).toBeNull()
  })

  it('FE-COMP-WEATHERWIDGET-009: non-compact mode shows description', async () => {
    vi.mocked(weatherApi.get).mockResolvedValue(buildWeather({ description: 'clear sky' }))
    useSettingsStore.setState({ settings: { ...useSettingsStore.getState().settings, temperature_unit: 'celsius' } })
    render(<WeatherWidget lat={48.86} lng={2.35} date="2025-06-01" compact={false} />)
    await waitFor(() => {
      expect(screen.getByText('clear sky')).toBeInTheDocument()
    })
  })

  it('FE-COMP-WEATHERWIDGET-010: uses cached data from sessionStorage', async () => {
    const cached = buildWeather({ temp: 20 })
    sessionStorage.setItem('weather_48.86_2.35_2025-06-01', JSON.stringify(cached))
    useSettingsStore.setState({ settings: { ...useSettingsStore.getState().settings, temperature_unit: 'celsius' } })
    render(<WeatherWidget lat={48.86} lng={2.35} date="2025-06-01" />)
    await waitFor(() => {
      expect(screen.getByText('20°C')).toBeInTheDocument()
    })
    expect(weatherApi.get).not.toHaveBeenCalled()
  })

  it('FE-COMP-WEATHERWIDGET-011: re-fetches in background for cached climate data', async () => {
    const climateData = buildWeather({ temp: 15, main: 'Clouds', type: 'climate', description: 'cloudy' })
    const forecastData = buildWeather({ temp: 22, main: 'Clear', type: 'forecast', description: 'clear sky' })
    sessionStorage.setItem('weather_48.86_2.35_2025-06-01', JSON.stringify(climateData))
    vi.mocked(weatherApi.get).mockResolvedValue(forecastData)
    useSettingsStore.setState({ settings: { ...useSettingsStore.getState().settings, temperature_unit: 'celsius' } })

    render(<WeatherWidget lat={48.86} lng={2.35} date="2025-06-01" />)

    // Initially shows climate data
    await waitFor(() => {
      expect(screen.getByText(/Ø/)).toBeInTheDocument()
    })

    // After background fetch resolves, shows forecast data
    await waitFor(() => {
      expect(screen.getByText('22°C')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Ø/)).not.toBeInTheDocument()
  })
})
