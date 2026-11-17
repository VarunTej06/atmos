import { useEffect, useMemo, useState } from 'react'
import {
  Activity, Bookmark, CalendarDays, Check, ChevronDown, Cloud, CloudDrizzle,
  CloudRain, CloudSun, Compass, Droplets, Gauge, MapPin, Moon, Search, Settings2,
  Sun, Sunrise, Sunset, Wind, X, RefreshCw, Bell, CloudLightning, ShieldCheck, Trash2, Plus
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import { getNearbyPlaces, getWeather, searchLocations } from './api'

import type { ExplorePlace } from './api'
import type { DailyForecast, LocationResult, WeatherResponse } from './types'


type Theme = 'light' | 'dark'
type AlertRule = { id: number; title: string; location: string; condition: string; threshold: number; enabled: boolean }

const SAVED_KEY = 'atmos-saved-locations'

const defaultLocation: LocationResult = {
  name: 'Hyderabad', country: 'India', latitude: 17.385, longitude: 78.4867, timezone: 'Asia/Kolkata'
}

function readSaved(): LocationResult[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') } catch { return [] }
}
function writeSaved(items: LocationResult[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(items))
}

function weatherLabel(code: number) {
  if (code === 0) return 'Clear sky'
  if ([1, 2].includes(code)) return 'Mostly clear'
  if (code === 3) return 'Overcast'
  if ([45, 48].includes(code)) return 'Foggy'
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain showers'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow'
  if ([95, 96, 99].includes(code)) return 'Thunderstorms'
  return 'Variable conditions'
}

function WeatherGlyph({ code, size = 34 }: { code: number; size?: number }) {
  if ([0, 1].includes(code)) return <Sun size={size} className="weather-glyph sun-glyph" />
  if ([2, 3, 45, 48].includes(code)) return <CloudSun size={size} className="weather-glyph" />
  if ([51, 53, 55, 56, 57].includes(code)) return <CloudDrizzle size={size} className="weather-glyph rain-glyph" />
  if ([61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return <CloudRain size={size} className="weather-glyph rain-glyph" />
  return <Cloud size={size} className="weather-glyph" />
}

function formatHour(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric' })
}
function formatDay(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString([], { weekday: 'short' })
}
function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
function celsius(value: number, unit: 'celsius' | 'fahrenheit') {
  return Math.round(unit === 'celsius' ? value : value * 9 / 5 + 32)
}
function tempLabel(value: number, unit: 'celsius' | 'fahrenheit') {
  return `${celsius(value, unit)}°`
}

/* SVG arc gauge for sidebar overview cards */
function ArcGauge({ value, max, label, unit: gaugeUnit, accent }: { value: number; max: number; label: string; unit: string; accent: string }) {
  const r = 36
  const circumference = Math.PI * r
  const pct = Math.min(value / max, 1)
  const offset = circumference * (1 - pct)
  return (
    <div className="arc-gauge">
      <svg viewBox="0 0 88 52" width={88} height={52}>
        <path d="M 8 48 A 36 36 0 0 1 80 48" fill="none" stroke="var(--border)" strokeWidth={5} strokeLinecap="round" />
        <path d="M 8 48 A 36 36 0 0 1 80 48" fill="none" stroke={accent} strokeWidth={5} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <span className="arc-value" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{value}{gaugeUnit}</span>
      <span className="arc-label">{label}</span>
    </div>
  )
}

/* Skeleton loader placeholder */
function Skeleton({ height = 160 }: { height?: number }) {
  return (
    <div className="skeleton" style={{ height }}>
      <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 400 160">
        <rect x="0" y="12" rx="4" ry="4" width="55%" height="10" fill="var(--surface-2)" />
        <rect x="0" y="34" rx="4" ry="4" width="80%" height="10" fill="var(--surface-2)" />
        <rect x="0" y="56" rx="4" ry="4" width="40%" height="10" fill="var(--surface-2)" />
        <rect x="0" y="82" rx="6" ry="6" width="100%" height="68" fill="var(--surface-2)" />
      </svg>
    </div>
  )
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('atmos-theme') as Theme) || 'dark')
  const [unit, setUnit] = useState<'celsius' | 'fahrenheit'>('celsius')
  const [location, setLocation] = useState<LocationResult>(defaultLocation)
  const [weather, setWeather] = useState<WeatherResponse | null>(null)
  const [saved, setSaved] = useState<LocationResult[]>(readSaved)
  const [nearbyPlaces, setNearbyPlaces] = useState<ExplorePlace[]>([])
  const [placesLoading, setPlacesLoading] = useState(false)
  const [placesError, setPlacesError] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [activeNav, setActiveNav] = useState('Overview')
  const [showSaved, setShowSaved] = useState(false)
  const [toast, setToast] = useState('')
  const [alerts, setAlerts] = useState<AlertRule[]>(() => { try { return JSON.parse(localStorage.getItem('atmos-alerts') || '[]') } catch { return [] } })
  const [alertTitle, setAlertTitle] = useState('Rain expected')
  const [alertCondition, setAlertCondition] = useState('precipitation')
  const [alertThreshold, setAlertThreshold] = useState(60)

  useEffect(() => {
    localStorage.setItem('atmos-theme', theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => { localStorage.setItem('atmos-alerts', JSON.stringify(alerts)) }, [alerts])

  // Persist saved locations to localStorage
  useEffect(() => { writeSaved(saved) }, [saved])

  async function loadWeather(target: LocationResult) {
    setLoading(true)
    setError('')
    try {
      const data = await getWeather(target.latitude, target.longitude, target.name, target.country)
      setWeather(data)
      setLocation(target)
    } catch {
      setError('Unable to load weather. Check your connection and try refreshing.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadWeather(defaultLocation)
  }, [])

  useEffect(() => {
    if (activeNav !== 'Explore') return
    let cancelled = false
    setPlacesLoading(true)
    setPlacesError('')
    getNearbyPlaces(location.latitude, location.longitude, weather?.current.temperature ?? 25, weather?.daily[0]?.precipitation_probability_max ?? 0, weather?.current.weather_code ?? 0, weather?.current.wind_speed ?? 0)
      .then(items => { if (!cancelled) setNearbyPlaces(items) })
      .catch(() => { if (!cancelled) { setNearbyPlaces([]); setPlacesError('Nearby places could not be loaded right now. Try again in a moment.') } })
      .finally(() => { if (!cancelled) setPlacesLoading(false) })
    return () => { cancelled = true }
  }, [activeNav, location.latitude, location.longitude, weather?.current.temperature, weather?.daily[0]?.precipitation_probability_max, weather?.current.weather_code, weather?.current.wind_speed])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        setResults(await searchLocations(query.trim()))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const hourly = useMemo(() => weather?.hourly.slice(0, 12) ?? [], [weather])
  const daily = useMemo(() => weather?.daily ?? [], [weather])
  const chartData = useMemo(() => hourly.map((h) => ({
    hour: formatHour(h.time),
    temperature: celsius(h.temperature, unit),
    rain: h.precipitation_probability,
  })), [hourly, unit])

  async function chooseLocation(item: LocationResult) {
    setSearchOpen(false)
    setQuery('')
    setResults([])
    await loadWeather(item)
  }

  async function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Your browser does not support location access. Search for a city instead.')
      return
    }
    setLocating(true)
    setError('')
    navigator.geolocation.getCurrentPosition(async position => {
      const { latitude, longitude } = position.coords
      let name = 'My location'
      let country = 'Current area'
      let admin1: string | undefined
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`)
        if (response.ok) {
          const data = await response.json()
          const address = data.address || {}
          name = address.city || address.town || address.village || address.suburb || address.county || name
          country = address.country || country
          admin1 = address.state || undefined
        }
      } catch { /* Coordinates still work if reverse geocoding is unavailable. */ }
      await loadWeather({ name, country, admin1, latitude, longitude, timezone: 'auto' })
      setLocating(false)
      setToast('Weather updated for your current location')
      window.setTimeout(() => setToast(''), 2800)
    }, error => {
      setLocating(false)
      setError(error.code === error.PERMISSION_DENIED ? 'Location permission was denied. Allow location access in your browser or search for a city.' : 'Could not determine your location. Try again or search for a city.')
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 })
  }

  function toggleSaved() {
    const exists = saved.some(s => s.latitude === location.latitude && s.longitude === location.longitude)
    if (exists) {
      setSaved(prev => prev.filter(s => !(s.latitude === location.latitude && s.longitude === location.longitude)))
      setToast('Location removed from saved cities')
    } else {
      setSaved(prev => [...prev.filter(s => !(s.latitude === location.latitude && s.longitude === location.longitude)), location])
      setToast('Location saved')
    }
    window.setTimeout(() => setToast(''), 2800)
  }

  const isSaved = saved.some(s => s.latitude === location.latitude && s.longitude === location.longitude)
  const current = weather?.current
  const firstDay: DailyForecast | undefined = daily[0]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><CloudSun size={20} strokeWidth={1.5} /></div>
          <div><strong>atmos</strong><span>WEATHER INTELLIGENCE</span></div>
        </div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="main-nav">
          {[
            { label: 'Overview', icon: Activity },
            { label: 'Forecast', icon: CalendarDays },
            { label: 'Explore', icon: Compass },
            { label: 'Alerts', icon: Bell },
          ].map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => setActiveNav(label)}>
              <Icon size={17} strokeWidth={1.5} /><span>{label}</span>{label === 'Alerts' && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-label saved-heading">SAVED LOCATIONS <button aria-label="Show saved locations" onClick={() => setShowSaved(!showSaved)}><ChevronDown size={13} strokeWidth={1.5} /></button></div>
        {showSaved && <div className="saved-list">
          {saved.length === 0 && <p className="muted small">No saved cities yet.</p>}
          {saved.map(item => <button key={`${item.latitude}-${item.longitude}`} onClick={() => void chooseLocation(item)}><MapPin size={13} strokeWidth={1.5}/><span>{item.name}</span></button>)}
        </div>}
        <div className="sidebar-spacer" />
        <div className="sidebar-bottom">
          <div className="live-pill"><span /> Weather service connected</div>
          <button className={`nav-item ${activeNav === 'Settings' ? 'active' : ''}`} onClick={() => setActiveNav('Settings')}><Settings2 size={17} strokeWidth={1.5}/><span>Settings</span></button>

          {/* Sidebar arc gauge summaries */}
          {current && <div className="sidebar-gauges">
            <ArcGauge value={current.relative_humidity} max={100} label="Relative Humidity" unit="%" accent="var(--accent-teal)" />
            <ArcGauge value={Math.round(current.wind_speed)} max={120} label="Wind Speed (km/h)" unit="" accent="var(--accent-amber)" />
          </div>}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">Workspace <span>/</span> <strong>{activeNav}</strong></div>
          <div className="top-actions">
            <div className="search-wrap">
              <Search size={16} strokeWidth={1.5} />
              <input value={query} onFocus={() => setSearchOpen(true)} onChange={e => { setQuery(e.target.value); setSearchOpen(true) }} placeholder="Search a city..." aria-label="Search a city" />
              {searching && <div className="search-spinner" />}
              {searchOpen && query.trim().length >= 2 && (
                <div className="search-results">
                  {results.length === 0 && !searching && <div className="search-empty">No matching cities found</div>}
                  {results.map(item => <button key={`${item.latitude}-${item.longitude}`} onClick={() => void chooseLocation(item)}>
                    <MapPin size={15} strokeWidth={1.5}/><span><strong>{item.name}</strong><small>{[item.admin1, item.country].filter(Boolean).join(', ')}</small></span>
                  </button>)}
                </div>
              )}
              {searchOpen && <button className="search-dismiss" aria-label="Close search" onClick={() => { setSearchOpen(false); setQuery('') }}><X size={13} strokeWidth={1.5}/></button>}
            </div>
            <button className="secondary-button current-location-button" onClick={() => void useMyLocation()} disabled={locating} title="Use GPS to show local weather and nearby places"><MapPin size={14} strokeWidth={1.5}/>{locating ? 'Locating…' : 'My location'}</button>
            <button className="icon-button" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17} strokeWidth={1.5}/> : <Moon size={17} strokeWidth={1.5}/>}</button>
            <button className="unit-button" onClick={() => setUnit(unit === 'celsius' ? 'fahrenheit' : 'celsius')}>°{unit === 'celsius' ? 'C' : 'F'} <ChevronDown size={13} strokeWidth={1.5}/></button>
          </div>
        </header>

        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-dot"/> ATMOS WEATHER INTELLIGENCE</div>
            <h1>{activeNav === 'Overview' ? `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}.` : activeNav}</h1>
            <p>{({ Overview: `Here's what's happening in your corner of the world.`, Forecast: `Plan ahead with hourly conditions and the 7-day outlook for ${location.name}.`, Explore: 'Discover weather conditions in places that matter to you.', Alerts: 'Set up weather conditions you want Atmos to help you watch.', Settings: 'Personalize your Atmos experience.' } as Record<string, string>)[activeNav] || ''}</p>
          </div>
          <button className="secondary-button" onClick={() => void loadWeather(location)} disabled={loading}><RefreshCw size={14} strokeWidth={1.5} className={loading ? 'spin' : ''}/> Refresh</button>
        </section>

        {error && <div className="error-banner">{error}<button onClick={() => void loadWeather(location)}>Retry</button></div>}

        {activeNav === 'Overview' && <section className="dashboard-grid">
          <article className="card hero-card">
            <div className="hero-top">
              <div className="location-title"><MapPin size={15} strokeWidth={1.5}/><span>{location.name}, {location.country}</span><span className="location-current">CURRENT LOCATION</span></div>
              <button className={`save-button ${isSaved ? 'saved' : ''}`} onClick={() => toggleSaved()} aria-label={isSaved ? 'Remove saved location' : 'Save location'}><Bookmark size={16} strokeWidth={1.5} fill={isSaved ? 'currentColor' : 'none'}/></button>
            </div>
            {loading && !current ? <Skeleton height={178} /> : (
              <div className="hero-weather">
                <div className="hero-temp">
                  <div className="temperature">{current ? tempLabel(current.temperature, unit) : '--°'}</div>
                  <div className="condition">{current ? weatherLabel(current.weather_code) : 'Weather unavailable'}</div>
                  <div className="feels-like">Feels like {current ? tempLabel(current.apparent_temperature, unit) : '--°'}</div>
                  <div className="high-low">H: {firstDay ? tempLabel(firstDay.temperature_max, unit) : '--'} <span>·</span> L: {firstDay ? tempLabel(firstDay.temperature_min, unit) : '--'}</div>
                </div>
                <div className="hero-art"><WeatherGlyph code={current?.weather_code ?? 2} size={88}/></div>
              </div>
            )}
            <div className="hero-footer">
              <div><span>Relative Humidity</span><strong className="mono">{current ? `${current.relative_humidity}%` : '--'}</strong></div>
              <div><span>Wind Speed (km/h)</span><strong className="mono">{current ? `${Math.round(current.wind_speed)}` : '--'}</strong></div>
              <div><span>Precipitation (mm)</span><strong className="mono">{current ? `${current.precipitation}` : '--'}</strong></div>
            </div>
          </article>

          <article className="card insight-card">
            <div className="card-heading"><div className="heading-icon"><Activity size={16} strokeWidth={1.5}/></div><div><h2>Weather Snapshot</h2><p>At a glance</p></div></div>
            <div className="snapshot-list">
              <div><span><Wind size={15} strokeWidth={1.5}/> Wind Speed</span><strong className="mono">{current ? `${Math.round(current.wind_speed)} km/h` : '--'}</strong></div>
              <div><span><Droplets size={15} strokeWidth={1.5}/> Relative Humidity</span><strong className="mono">{current ? `${current.relative_humidity}%` : '--'}</strong></div>
              <div><span><Gauge size={15} strokeWidth={1.5}/> Apparent Temperature</span><strong className="mono">{current ? tempLabel(current.apparent_temperature, unit) : '--'}</strong></div>
            </div>
            <div className="insight-note"><p>{current ? `${weatherLabel(current.weather_code)} conditions in ${location.name}. Check the hourly trend before planning outdoor activities.` : 'Weather insights will appear when forecast data is available.'}</p></div>
          </article>

          <article className="card hourly-card">
            <div className="card-heading"><div className="heading-icon"><CloudSun size={16} strokeWidth={1.5}/></div><div><h2>Today's Forecast</h2><p>Temperature over the next hours</p></div><span className="card-unit mono">°{unit === 'celsius' ? 'C' : 'F'}</span></div>
            {loading && !weather ? <Skeleton height={175} /> : chartData.length > 0 ? <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 14, right: 8, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="temperatureFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-amber)" stopOpacity={0.22}/><stop offset="100%" stopColor="var(--accent-amber)" stopOpacity={0.01}/></linearGradient>
                    <linearGradient id="rainFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-teal)" stopOpacity={0.18}/><stop offset="100%" stopColor="var(--accent-teal)" stopOpacity={0.01}/></linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="4 5"/>
                  <XAxis dataKey="hour" tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} interval={2}/>
                  <YAxis tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }} formatter={(value) => [`${value}°`, 'Temperature']} />
                  <Area type="monotone" dataKey="temperature" stroke="var(--accent-amber)" strokeWidth={2} fill="url(#temperatureFill)" activeDot={{ r: 4, stroke: 'var(--accent-amber)', strokeWidth: 1.5 }}/>
                </AreaChart>
              </ResponsiveContainer>
            </div> : <div className="empty-chart">{loading ? 'Loading forecast…' : 'Forecast unavailable'}</div>}
            <div className="hourly-strip">
              {hourly.slice(0, 6).map((hour, i) => <div key={hour.time} className="hour-item"><span className="mono">{i === 0 ? 'Now' : formatHour(hour.time)}</span><WeatherGlyph code={hour.weather_code} size={20}/><strong className="mono">{tempLabel(hour.temperature, unit)}</strong><small><Droplets size={10} strokeWidth={1.5}/>{hour.precipitation_probability}%</small></div>)}
            </div>
          </article>

          <article className="card week-card">
            <div className="card-heading"><div className="heading-icon"><CalendarDays size={16} strokeWidth={1.5}/></div><div><h2>7-Day Forecast</h2><p>The week ahead</p></div></div>
            <div className="week-list">
              {daily.map((day, i) => <div className="week-row" key={day.date}>
                <span className="week-day mono">{i === 0 ? 'Today' : formatDay(day.date)}</span>
                <WeatherGlyph code={day.weather_code} size={20}/>
                <span className="week-condition">{weatherLabel(day.weather_code)}</span>
                <span className="week-rain"><Droplets size={11} strokeWidth={1.5}/><span className="mono">{day.precipitation_probability_max}%</span></span>
                <div className="week-range"><strong className="mono">{tempLabel(day.temperature_max, unit)}</strong><span className="mono">{tempLabel(day.temperature_min, unit)}</span></div>
              </div>)}
              {!daily.length && <p className="muted">Forecast data unavailable.</p>}
            </div>
          </article>

          <article className="card details-card">
            <div className="card-heading"><div className="heading-icon"><Compass size={16} strokeWidth={1.5}/></div><div><h2>Wind &amp; Daylight</h2><p>Local conditions</p></div></div>
            <div className="details-grid">
              <div className="detail-tile"><Wind size={18} strokeWidth={1.5}/><span>Wind Speed</span><strong className="mono">{current ? `${Math.round(current.wind_speed)} km/h` : '--'}</strong><small className="mono">{current ? `${current.wind_direction}° direction` : 'No data'}</small></div>
              <div className="detail-tile"><Sunrise size={18} strokeWidth={1.5}/><span>Sunrise</span><strong className="mono">{firstDay ? formatTime(firstDay.sunrise) : '--'}</strong><small>Local time</small></div>
              <div className="detail-tile"><Sunset size={18} strokeWidth={1.5}/><span>Sunset</span><strong className="mono">{firstDay ? formatTime(firstDay.sunset) : '--'}</strong><small>Local time</small></div>
              <div className="detail-tile"><CloudRain size={18} strokeWidth={1.5}/><span>Precipitation Probability (%)</span><strong className="mono">{firstDay ? `${firstDay.precipitation_probability_max}` : '--'}</strong><small>Today's maximum</small></div>
            </div>
          </article>
        </section>}

        {activeNav === 'Forecast' && <section className="page-stack">
          <article className="card"><div className="card-heading"><div className="heading-icon"><CloudSun size={16} strokeWidth={1.5}/></div><div><h2>Hourly Forecast</h2><p>Next 12 hours · {location.name}</p></div><span className="card-unit mono">°{unit === 'celsius' ? 'C' : 'F'}</span></div>
            {loading && !weather ? <Skeleton height={270} /> : chartData.length ? <div className="chart-wrap forecast-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 14, right: 8, left: -22, bottom: 0 }}><defs><linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-amber)" stopOpacity={0.22}/><stop offset="100%" stopColor="var(--accent-amber)" stopOpacity={0.01}/></linearGradient></defs><CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="4 5"/><XAxis dataKey="hour" tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false}/><YAxis tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }} formatter={(value) => [`${value}°`, 'Temperature']}/><Area type="monotone" dataKey="temperature" stroke="var(--accent-amber)" strokeWidth={2} fill="url(#forecastFill)"/></AreaChart></ResponsiveContainer></div> : <div className="empty-chart">{loading ? 'Loading forecast…' : 'Forecast unavailable'}</div>}
            <div className="hourly-strip forecast-hourly">{hourly.map((hour, i) => <div key={hour.time} className="hour-item"><span className="mono">{i === 0 ? 'Now' : formatHour(hour.time)}</span><WeatherGlyph code={hour.weather_code} size={20}/><strong className="mono">{tempLabel(hour.temperature, unit)}</strong><small><Droplets size={10} strokeWidth={1.5}/>{hour.precipitation_probability}%</small></div>)}</div></article>
          <article className="card"><div className="card-heading"><div className="heading-icon"><CalendarDays size={16} strokeWidth={1.5}/></div><div><h2>7-Day Outlook</h2><p>Daily highs, lows and precipitation probability</p></div></div><div className="forecast-table">{daily.map((day, i) => <div className="forecast-day" key={day.date}><div><strong className="mono">{i === 0 ? 'Today' : formatDay(day.date)}</strong><small className="mono">{day.date}</small></div><WeatherGlyph code={day.weather_code} size={23}/><span>{weatherLabel(day.weather_code)}</span><span className="forecast-rain"><Droplets size={12} strokeWidth={1.5}/><span className="mono">{day.precipitation_probability_max}%</span></span><div className="week-range"><strong className="mono">{tempLabel(day.temperature_max, unit)}</strong><span className="mono">{tempLabel(day.temperature_min, unit)}</span></div></div>)}{!daily.length && <p className="muted">Forecast data unavailable.</p>}</div></article>
          <div className="section-note"><ShieldCheck size={15} strokeWidth={1.5}/> Forecasts are estimates and may change. Follow official local warnings for severe weather.</div>
        </section>}

        {activeNav === 'Explore' && <section className="page-stack">
          <article className="card"><div className="card-heading"><div className="heading-icon"><Compass size={16} strokeWidth={1.5}/></div><div><h2>Explore Locations</h2><p>Search for a city using the search field above, then save places to your list.</p></div></div><div className="explore-current"><div className="explore-icon"><WeatherGlyph code={current?.weather_code ?? 2} size={28}/></div><div className="explore-main"><strong>{location.name}, {location.country}</strong><span>{current ? weatherLabel(current.weather_code) : 'Weather unavailable'}</span></div><div className="explore-temp mono">{current ? tempLabel(current.temperature, unit) : '--°'}</div><button className="secondary-button" onClick={() => toggleSaved()}><Bookmark size={13} strokeWidth={1.5}/>{isSaved ? 'Saved' : 'Save place'}</button></div></article>
          <article className="card"><div className="card-heading"><div className="heading-icon"><Compass size={16} strokeWidth={1.5}/></div><div><h2>Things to Do Nearby</h2><p>Nearby parks, beaches, cinemas, malls, museums and activities near {location.name}, sorted by distance.</p></div><span className="places-count mono">{nearbyPlaces.length} places</span></div>
            {placesLoading ? <Skeleton height={200} /> : placesError ? <div className="empty-state"><Compass size={24} strokeWidth={1.5}/><strong>Places are temporarily unavailable</strong><span>{placesError}</span></div> : nearbyPlaces.length ? <div className="nearby-grid">{nearbyPlaces.map(place => <article className="nearby-place" key={place.id}><div className={`nearby-art nearby-${place.category}`}><MapPin size={20} strokeWidth={1.5}/><span>{place.category.replace('-', ' ')}</span></div><div className="nearby-copy"><strong>{place.name}</strong><span className="mono">{place.distance_km} km away · {place.category}</span><p>{place.reason}</p><a href={place.map_url} target="_blank" rel="noreferrer">Open directions <span>&#8599;</span></a></div></article>)}</div> : <div className="empty-state"><Compass size={26} strokeWidth={1.5}/><strong>No mapped places found nearby</strong><span>Try a larger city or another location. Place coverage depends on OpenStreetMap contributions.</span></div>}
            <div className="section-note"><ShieldCheck size={14} strokeWidth={1.5}/> Recommendations use current weather as a planning hint, not a safety guarantee. Confirm opening hours and local warnings before travelling. Place data © OpenStreetMap contributors.</div>
          </article>
          <article className="card"><div className="card-heading"><div className="heading-icon"><MapPin size={16} strokeWidth={1.5}/></div><div><h2>Your Places</h2><p>{saved.length} saved location{saved.length === 1 ? '' : 's'}</p></div></div>{saved.length ? <div className="place-grid">{saved.map(item => <button className="place-card" key={`${item.latitude}-${item.longitude}`} onClick={() => void chooseLocation(item)}><MapPin size={15} strokeWidth={1.5}/><strong>{item.name}</strong><span>{item.country}</span><small>View weather <span>&#8594;</span></small></button>)}</div> : <div className="empty-state"><Compass size={26} strokeWidth={1.5}/><strong>No saved places yet</strong><span>Search for a city above and use Save place to build your personal weather list.</span></div>}</article>
          <article className="card"><div className="card-heading"><div className="heading-icon"><CloudLightning size={16} strokeWidth={1.5}/></div><div><h2>Weather-Aware Planning</h2><p>Quick checks before you head out</p></div></div><div className="planning-grid"><div><Wind size={17} strokeWidth={1.5}/><strong>Wind Speed</strong><span className="mono">{current ? `${Math.round(current.wind_speed)} km/h` : 'No data'}</span><small>Consider conditions for cycling or riding.</small></div><div><Droplets size={17} strokeWidth={1.5}/><strong>Precipitation Probability (%)</strong><span className="mono">{firstDay ? `${firstDay.precipitation_probability_max}` : 'No data'}</span><small>Check before outdoor travel.</small></div><div><CloudLightning size={17} strokeWidth={1.5}/><strong>Severe Weather</strong><span>Check official alerts</span><small>Atmos alerts are user-configured in this preview; official warning feeds are not integrated.</small></div></div></article>
        </section>}

        {activeNav === 'Alerts' && <section className="page-stack">
          <div className="section-note warning-note"><Bell size={15} strokeWidth={1.5}/> Alert rules in this preview are saved in this browser only. They do not send push, SMS, or email notifications and are not yet evaluated by a backend scheduler.</div>
          <article className="card"><div className="card-heading"><div className="heading-icon"><Bell size={16} strokeWidth={1.5}/></div><div><h2>Create a Weather Alert</h2><p>Configure a condition you want to monitor for {location.name}.</p></div></div><form className="form-grid" onSubmit={e => { e.preventDefault(); setAlerts(prev => [{ id: Date.now(), title: alertTitle.trim() || 'Weather alert', location: location.name, condition: alertCondition, threshold: alertThreshold, enabled: true }, ...prev]); setToast('Alert rule saved in this browser'); }}><label>Alert name<input value={alertTitle} onChange={e => setAlertTitle(e.target.value)} maxLength={80} required/></label><label>Condition<select value={alertCondition} onChange={e => setAlertCondition(e.target.value)}><option value="precipitation">Precipitation probability above</option><option value="temperature-high">Temperature above (°{unit === 'celsius' ? 'C' : 'F'})</option><option value="temperature-low">Temperature below (°{unit === 'celsius' ? 'C' : 'F'})</option><option value="wind">Wind speed above (km/h)</option></select></label><label>Threshold <strong className="mono">{alertThreshold}{alertCondition === 'precipitation' ? '%' : alertCondition.includes('temperature') ? '°' : ' km/h'}</strong><input type="range" min={alertCondition === 'precipitation' ? 10 : 0} max={alertCondition === 'precipitation' ? 100 : alertCondition.includes('temperature') ? 50 : 120} step={5} value={alertThreshold} onChange={e => setAlertThreshold(Number(e.target.value))}/></label><div className="form-actions"><button className="primary-button" type="submit"><Plus size={14} strokeWidth={1.5}/> Save alert rule</button></div></form></article>
          <article className="card"><div className="card-heading"><div className="heading-icon"><Activity size={16} strokeWidth={1.5}/></div><div><h2>Your Alert Rules</h2><p>{alerts.length} configured</p></div></div>{alerts.length ? <div className="alert-list">{alerts.map(alert => <div className="alert-row" key={alert.id}><div className="alert-symbol"><Bell size={16} strokeWidth={1.5}/></div><div className="alert-description"><strong>{alert.title}</strong><span>{alert.location} · {alert.condition.replace('-', ' ')} · threshold <span className="mono">{alert.threshold}{alert.condition === 'precipitation' ? '%' : alert.condition.includes('temperature') ? '°' : ' km/h'}</span></span><small>Rule configured · notifications not connected</small></div><label className="switch-label"><input type="checkbox" checked={alert.enabled} onChange={e => setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, enabled: e.target.checked } : a))}/><span>{alert.enabled ? 'On' : 'Off'}</span></label><button className="icon-button danger-button" aria-label={`Delete ${alert.title}`} onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}><Trash2 size={14} strokeWidth={1.5}/></button></div>)}</div> : <div className="empty-state"><Bell size={26} strokeWidth={1.5}/><strong>No alert rules yet</strong><span>Create an alert rule above. Real notifications will require backend evaluation and a delivery provider.</span></div>}</article>
        </section>}

        {activeNav === 'Settings' && <section className="page-stack">
          <article className="card"><div className="card-heading"><div className="heading-icon"><Settings2 size={16} strokeWidth={1.5}/></div><div><h2>Display Preferences</h2><p>Customize your Atmos dashboard</p></div></div><div className="settings-row"><div><strong>Appearance</strong><span>Choose a theme for the dashboard</span></div><div className="segmented"><button className={theme === 'light' ? 'selected' : ''} onClick={() => setTheme('light')}><Sun size={13} strokeWidth={1.5}/> Light</button><button className={theme === 'dark' ? 'selected' : ''} onClick={() => setTheme('dark')}><Moon size={13} strokeWidth={1.5}/> Dark</button></div></div><div className="settings-row"><div><strong>Temperature unit</strong><span>Set how temperatures are displayed</span></div><div className="segmented"><button className={unit === 'celsius' ? 'selected' : ''} onClick={() => setUnit('celsius')}>°C</button><button className={unit === 'fahrenheit' ? 'selected' : ''} onClick={() => setUnit('fahrenheit')}>°F</button></div></div></article>
        </section>}

        <footer className="page-footer">
          <span>Atmos Weather Intelligence</span>
          <span>Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0)</span>
          <span>Geocoding by <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors (ODbL)</span>
          <span>Forecasts can change · Check official warnings for severe weather</span>
        </footer>
      </main>
      {toast && <div className="toast"><Check size={15} strokeWidth={1.5}/>{toast}</div>}
    </div>
  )
}
