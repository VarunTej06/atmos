import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from '../App'

const mockWeatherResponse = {
  location: {
    name: 'Hyderabad',
    country: 'India',
    admin1: 'Telangana',
    latitude: 17.385,
    longitude: 78.4867,
    timezone: 'Asia/Kolkata',
  },
  current: {
    time: '2026-11-17T12:00',
    temperature: 28.5,
    apparent_temperature: 30.1,
    relative_humidity: 65,
    is_day: 1,
    precipitation: 0.0,
    weather_code: 0,
    wind_speed: 12.0,
    wind_direction: 180,
  },
  hourly: [
    {
      time: '2026-11-17T12:00',
      temperature: 28.5,
      precipitation_probability: 0,
      weather_code: 0,
    },
    {
      time: '2026-11-17T13:00',
      temperature: 29.0,
      precipitation_probability: 0,
      weather_code: 0,
    },
  ],
  daily: [
    {
      date: '2026-11-17',
      weather_code: 0,
      temperature_max: 32.0,
      temperature_min: 22.0,
      precipitation_probability_max: 10,
      sunrise: '2026-11-17T06:15',
      sunset: '2026-11-17T17:45',
      wind_speed_max: 15.0,
    },
  ],
  attribution: 'Weather data by Open-Meteo',
}

const mockLocations = [
  {
    name: 'Hyderabad',
    country: 'India',
    admin1: 'Telangana',
    latitude: 17.385,
    longitude: 78.4867,
    timezone: 'Asia/Kolkata',
  },
]

describe('App smoke test', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    globalThis.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes('/api/v1/weather')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockWeatherResponse,
        } as Response)
      }
      if (urlStr.includes('/api/v1/locations/search')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockLocations,
        } as Response)
      }
      if (urlStr.includes('/api/v1/explore/nearby')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [],
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ authenticated: false, locations: [], preferences: {} }),
      } as Response)
    })
  })

  it('renders the weather dashboard application and verifies key elements', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/atmos/i)).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText(/search/i)
    expect(searchInput).toBeDefined()
  })
})

