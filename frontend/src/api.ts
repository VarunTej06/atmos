import type { LocationResult, WeatherResponse } from './types'

const WEATHER_API = import.meta.env.VITE_WEATHER_API_URL ?? 'http://localhost:8001'

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export async function searchLocations(query: string): Promise<LocationResult[]> {
  const response = await fetch(`${WEATHER_API}/api/v1/locations/search?q=${encodeURIComponent(query)}`)
  return readJson<LocationResult[]>(response)
}

export async function getWeather(latitude: number, longitude: number, name: string, country: string): Promise<WeatherResponse> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    name,
    country,
  })
  const response = await fetch(`${WEATHER_API}/api/v1/weather?${params.toString()}`)
  return readJson<WeatherResponse>(response)
}

export type ExplorePlace = { id: string; name: string; category: string; latitude: number; longitude: number; distance_km: number; reason: string; map_url: string }
export async function getNearbyPlaces(latitude: number, longitude: number, temperature: number, rainProbability: number, weatherCode: number, windSpeed: number): Promise<ExplorePlace[]> {
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), temperature: String(temperature), rain_probability: String(rainProbability), weather_code: String(weatherCode), wind_speed: String(windSpeed) })
  return readJson<ExplorePlace[]>(await fetch(`${WEATHER_API}/api/v1/explore/nearby?${params}`))
}
