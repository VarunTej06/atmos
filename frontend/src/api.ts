import type { LocationResult, WeatherResponse } from './types'

const WEATHER_API = import.meta.env.VITE_WEATHER_API_URL ?? 'http://localhost:8001'
const USER_API = import.meta.env.VITE_USER_API_URL ?? 'http://localhost:8002'

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

export async function getSavedLocations() {
  const response = await fetch(`${USER_API}/api/v1/locations`)
  return readJson<LocationResult[]>(response)
}

export async function saveLocation(location: LocationResult) {
  const response = await fetch(`${USER_API}/api/v1/locations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(location),
  })
  return readJson<LocationResult>(response)
}

export async function deleteLocation(latitude: number, longitude: number) {
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) })
  const response = await fetch(`${USER_API}/api/v1/locations?${params.toString()}`, { method: 'DELETE' })
  if (!response.ok) throw new Error('Could not remove saved location')
}

export async function getPreferences(): Promise<{ temperature_unit: 'celsius' | 'fahrenheit'; theme: 'system' | 'light' | 'dark' }> {
  const response = await fetch(`${USER_API}/api/v1/preferences`)
  return readJson(response)
}

export async function savePreferences(body: { temperature_unit: 'celsius' | 'fahrenheit'; theme: 'system' | 'light' | 'dark' }) {
  const response = await fetch(`${USER_API}/api/v1/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return readJson(response)
}


export type ExplorePlace = { id: string; name: string; category: string; latitude: number; longitude: number; distance_km: number; reason: string; map_url: string }
export async function getNearbyPlaces(latitude: number, longitude: number, temperature: number, rainProbability: number, weatherCode: number, windSpeed: number): Promise<ExplorePlace[]> {
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), temperature: String(temperature), rain_probability: String(rainProbability), weather_code: String(weatherCode), wind_speed: String(windSpeed) })
  return readJson<ExplorePlace[]>(await fetch(`${WEATHER_API}/api/v1/explore/nearby?${params}`))
}


export type AuthUser = { id: number; email: string; full_name: string; home_city: string; date_of_birth: string; gender: string; bike: boolean; car: boolean; transport_mode: string; provider?: string }
export type ProfilePayload = { full_name: string; home_city: string; date_of_birth: string; gender: string; bike: boolean; car: boolean; transport_mode: 'private' | 'public' | 'mixed' | 'walking-cycling' }
export async function saveProfile(body: ProfilePayload): Promise<AuthUser> { return readJson<AuthUser>(await fetch(`${USER_API}/api/v1/profile`, { method: 'PUT', headers: {'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify(body) })) }
export async function authMe(): Promise<AuthUser> { return readJson<AuthUser>(await fetch(`${USER_API}/api/v1/auth/me`, { credentials: 'include' })) }
export async function registerAccount(email: string, password: string, fullName: string, extra: Partial<ProfilePayload> = {}): Promise<AuthUser> { return readJson<AuthUser>(await fetch(`${USER_API}/api/v1/auth/register`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify({email,password,full_name:fullName, ...extra}) })) }
export async function loginAccount(email: string, password: string): Promise<AuthUser> { return readJson<AuthUser>(await fetch(`${USER_API}/api/v1/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify({email,password}) })) }
export async function logoutAccount() { await fetch(`${USER_API}/api/v1/auth/logout`, { method:'POST', credentials:'include' }) }

