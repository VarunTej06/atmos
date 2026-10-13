import { useEffect, useMemo, useState } from 'react'
import {
  Activity, Bookmark, CalendarDays, Check, ChevronDown, Cloud, CloudDrizzle,
  CloudRain, CloudSun, Compass, Droplets, Gauge, MapPin, Moon, Search, Settings2,
  Sun, Sunrise, Sunset, Wind, X, LoaderCircle, RefreshCw, Bell, CloudLightning, ShieldCheck, UserRound, LockKeyhole, Car, Bike, Bus, Trash2, Plus, Mail, Eye, EyeOff
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import { authMe, saveProfile, deleteLocation, getNearbyPlaces, getSavedLocations, getWeather, loginAccount, logoutAccount, registerAccount, saveLocation, searchLocations } from './api'
import type { AuthUser, ProfilePayload } from './api'

import type { ExplorePlace } from './api'
import type { DailyForecast, LocationResult, WeatherResponse } from './types'


type Theme = 'light' | 'dark'
type AlertRule = { id: number; title: string; location: string; condition: string; threshold: number; enabled: boolean }
type Profile = { email: string; fullName: string; dob: string; homeCity: string; gender: string; bike: boolean; car: boolean; transport: string }
const emptyProfile: Profile = { email: '', fullName: '', dob: '', homeCity: '', gender: '', bike: false, car: false, transport: 'private' }
const defaultLocation: LocationResult = {
  name: 'Hyderabad', country: 'India', latitude: 17.385, longitude: 78.4867, timezone: 'Asia/Kolkata'
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

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('atmos-theme') as Theme) || 'dark')
  const [unit, setUnit] = useState<'celsius' | 'fahrenheit'>('celsius')
  const [location, setLocation] = useState<LocationResult>(defaultLocation)
  const [weather, setWeather] = useState<WeatherResponse | null>(null)
  const [saved, setSaved] = useState<LocationResult[]>([])
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
  const [authMode, setAuthMode] = useState<'signin' | 'register' | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [profile, setProfile] = useState<Profile>(() => { try { return { ...emptyProfile, ...JSON.parse(localStorage.getItem('atmos-profile') || '{}') } } catch { return emptyProfile } })
  const [showPassword, setShowPassword] = useState(false)
  const [alerts, setAlerts] = useState<AlertRule[]>(() => { try { return JSON.parse(localStorage.getItem('atmos-alerts') || '[]') } catch { return [] } })
  const [alertTitle, setAlertTitle] = useState('Rain expected')
  const [alertCondition, setAlertCondition] = useState('precipitation')
  const [alertThreshold, setAlertThreshold] = useState(60)

  function profileFromUser(user: AuthUser): Profile {
    return { email: user.email, fullName: user.full_name || '', dob: user.date_of_birth || '', homeCity: user.home_city || '', gender: user.gender || '', bike: Boolean(user.bike), car: Boolean(user.car), transport: user.transport_mode || 'private' }
  }

  useEffect(() => {
    authMe()
      .then(user => { setAuthUser(user); setProfile(profileFromUser(user)); setAuthMode(null) })
      .catch(() => { setAuthUser(null); setAuthMode('signin') })
      .finally(() => setAuthChecked(true))
  }, [])

  useEffect(() => {
    localStorage.setItem('atmos-theme', theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => { localStorage.setItem('atmos-alerts', JSON.stringify(alerts)) }, [alerts])

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
    void getSavedLocations().then(setSaved).catch(() => setSaved([]))
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

  async function toggleSaved() {
    const exists = saved.some(s => s.latitude === location.latitude && s.longitude === location.longitude)
    try {
      if (exists) {
        await deleteLocation(location.latitude, location.longitude)
        setSaved(prev => prev.filter(s => !(s.latitude === location.latitude && s.longitude === location.longitude)))
        setToast('Location removed from saved cities')
      } else {
        const item = await saveLocation(location)
        setSaved(prev => [...prev.filter(s => !(s.latitude === item.latitude && s.longitude === item.longitude)), item])
        setToast('Location saved')
      }
    } catch {
      setToast('Could not update saved locations. Is the user service running?')
    }
    window.setTimeout(() => setToast(''), 2800)
  }

  const isSaved = saved.some(s => s.latitude === location.latitude && s.longitude === location.longitude)
  const current = weather?.current
  const firstDay: DailyForecast | undefined = daily[0]

  if (!authChecked) return <div className="auth-loading"><div className="brand-mark"><CloudSun size={22}/></div><strong>Preparing Atmos…</strong></div>

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><CloudSun size={23} /></div>
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
              <Icon size={18} /><span>{label}</span>{label === 'Alerts' && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-label saved-heading">SAVED LOCATIONS <button aria-label="Show saved locations" onClick={() => setShowSaved(!showSaved)}><ChevronDown size={14} /></button></div>
        {showSaved && <div className="saved-list">
          {saved.length === 0 && <p className="muted small">No saved cities yet.</p>}
          {saved.map(item => <button key={`${item.latitude}-${item.longitude}`} onClick={() => void chooseLocation(item)}><MapPin size={14}/><span>{item.name}</span></button>)}
        </div>}
        <div className="sidebar-spacer" />
        <div className="sidebar-bottom">
          <div className="live-pill"><span /> Weather service connected</div>
          <button className={`nav-item ${activeNav === 'Settings' ? 'active' : ''}`} onClick={() => setActiveNav('Settings')}><Settings2 size={18}/><span>Settings</span></button>
          <div className="profile">
            <div className="avatar">{(authUser?.full_name || authUser?.email || 'A').slice(0,1).toUpperCase()}</div>
            <div><strong>{authUser?.full_name || authUser?.email || 'Atmos Guest'}</strong><span>{authUser ? authUser.email : 'Signed out'}</span></div>
            <button aria-label={authUser ? 'Open personal profile' : 'Sign in'} title={authUser ? 'Open personal profile' : 'Sign in'} onClick={() => { if (authUser) setActiveNav('Settings'); else setAuthMode('signin') }}><UserRound size={17}/></button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">Workspace <span>/</span> <strong>{activeNav}</strong></div>
          <div className="top-actions">
            <div className="search-wrap">
              <Search size={17} />
              <input value={query} onFocus={() => setSearchOpen(true)} onChange={e => { setQuery(e.target.value); setSearchOpen(true) }} placeholder="Search a city..." aria-label="Search a city" />
              {searching && <LoaderCircle className="spin" size={16}/>}
              {searchOpen && query.trim().length >= 2 && (
                <div className="search-results">
                  {results.length === 0 && !searching && <div className="search-empty">No matching cities found</div>}
                  {results.map(item => <button key={`${item.latitude}-${item.longitude}`} onClick={() => void chooseLocation(item)}>
                    <MapPin size={16}/><span><strong>{item.name}</strong><small>{[item.admin1, item.country].filter(Boolean).join(', ')}</small></span>
                  </button>)}
                </div>
              )}
              {searchOpen && <button className="search-dismiss" aria-label="Close search" onClick={() => { setSearchOpen(false); setQuery('') }}><X size={14}/></button>}
            </div>
            <button className="secondary-button current-location-button" onClick={() => void useMyLocation()} disabled={locating} title="Use GPS to show local weather and nearby places"><MapPin size={15}/>{locating ? 'Locating…' : 'My location'}</button>
            <button className="icon-button" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button>
            <button className="unit-button" onClick={() => setUnit(unit === 'celsius' ? 'fahrenheit' : 'celsius')}>°{unit === 'celsius' ? 'C' : 'F'} <ChevronDown size={14}/></button>
          </div>
        </header>

        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-dot"/> ATMOS WEATHER INTELLIGENCE</div>
            <h1>{activeNav === 'Overview' ? `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}.` : activeNav}</h1>
            <p>{({ Overview: `Here's what's happening in your corner of the world.`, Forecast: `Plan ahead with hourly conditions and the 7-day outlook for ${location.name}.`, Explore: 'Discover weather conditions in places that matter to you.', Alerts: 'Set up weather conditions you want Atmos to help you watch.', Settings: 'Personalize your Atmos experience and profile.' } as Record<string, string>)[activeNav] || ''}</p>
          </div>
          <button className="secondary-button" onClick={() => void loadWeather(location)} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''}/> Refresh</button>
        </section>

        {error && <div className="error-banner">{error}<button onClick={() => void loadWeather(location)}>Retry</button></div>}

        {activeNav === 'Overview' && <section className="dashboard-grid">
          <article className="card hero-card">
            <div className="hero-glow" />
            <div className="hero-top">
              <div className="location-title"><MapPin size={16}/><span>{location.name}, {location.country}</span><span className="location-current">CURRENT LOCATION</span></div>
              <button className={`save-button ${isSaved ? 'saved' : ''}`} onClick={() => void toggleSaved()} aria-label={isSaved ? 'Remove saved location' : 'Save location'}><Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'}/></button>
            </div>
            {loading && !current ? <div className="hero-loading"><LoaderCircle className="spin" size={26}/> Loading current weather…</div> : (
              <div className="hero-weather">
                <div className="hero-temp">
                  <div className="temperature">{current ? tempLabel(current.temperature, unit) : '--°'}</div>
                  <div className="condition">{current ? weatherLabel(current.weather_code) : 'Weather unavailable'}</div>
                  <div className="feels-like">Feels like {current ? tempLabel(current.apparent_temperature, unit) : '--°'}</div>
                  <div className="high-low">H: {firstDay ? tempLabel(firstDay.temperature_max, unit) : '--'} <span>·</span> L: {firstDay ? tempLabel(firstDay.temperature_min, unit) : '--'}</div>
                </div>
                <div className="hero-art"><div className="sun-halo" /><WeatherGlyph code={current?.weather_code ?? 2} size={92}/></div>
              </div>
            )}
            <div className="hero-footer">
              <div><span>Humidity</span><strong>{current ? `${current.relative_humidity}%` : '--'}</strong></div>
              <div><span>Wind</span><strong>{current ? `${Math.round(current.wind_speed)} km/h` : '--'}</strong></div>
              <div><span>Precipitation</span><strong>{current ? `${current.precipitation} mm` : '--'}</strong></div>
            </div>
          </article>

          <article className="card insight-card">
            <div className="card-heading"><div className="heading-icon violet"><Activity size={17}/></div><div><h2>Weather snapshot</h2><p>At a glance</p></div></div>
            <div className="snapshot-list">
              <div><span><Wind size={16}/> Wind</span><strong>{current ? `${Math.round(current.wind_speed)} km/h` : '--'}</strong></div>
              <div><span><Droplets size={16}/> Humidity</span><strong>{current ? `${current.relative_humidity}%` : '--'}</strong></div>
              <div><span><Gauge size={16}/> Feels like</span><strong>{current ? tempLabel(current.apparent_temperature, unit) : '--'}</strong></div>
            </div>
            <div className="insight-note"><span className="sparkle">✦</span><p>{current ? `${weatherLabel(current.weather_code)} conditions in ${location.name}. Check the hourly trend before planning outdoor activities.` : 'Weather insights will appear when forecast data is available.'}</p></div>
          </article>

          <article className="card hourly-card">
            <div className="card-heading"><div className="heading-icon blue"><CloudSun size={17}/></div><div><h2>Today's forecast</h2><p>Temperature over the next hours</p></div><span className="card-unit">°{unit === 'celsius' ? 'C' : 'F'}</span></div>
            {chartData.length > 0 ? <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 14, right: 8, left: -22, bottom: 0 }}>
                  <defs><linearGradient id="temperatureFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#69A9F7" stopOpacity={0.34}/><stop offset="100%" stopColor="#69A9F7" stopOpacity={0.01}/></linearGradient></defs>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} strokeDasharray="4 5"/>
                  <XAxis dataKey="hour" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval={2}/>
                  <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)' }} formatter={(value) => [`${value}°`, 'Temperature']} />
                  <Area type="monotone" dataKey="temperature" stroke="#69A9F7" strokeWidth={2.5} fill="url(#temperatureFill)" activeDot={{ r: 5 }}/>
                </AreaChart>
              </ResponsiveContainer>
            </div> : <div className="empty-chart">{loading ? 'Loading forecast…' : 'Forecast unavailable'}</div>}
            <div className="hourly-strip">
              {hourly.slice(0, 6).map((hour, i) => <div key={hour.time} className="hour-item"><span>{i === 0 ? 'Now' : formatHour(hour.time)}</span><WeatherGlyph code={hour.weather_code} size={21}/><strong>{tempLabel(hour.temperature, unit)}</strong><small><Droplets size={11}/>{hour.precipitation_probability}%</small></div>)}
            </div>
          </article>

          <article className="card week-card">
            <div className="card-heading"><div className="heading-icon orange"><CalendarDays size={17}/></div><div><h2>7-day forecast</h2><p>The week ahead</p></div></div>
            <div className="week-list">
              {daily.map((day, i) => <div className="week-row" key={day.date}>
                <span className="week-day">{i === 0 ? 'Today' : formatDay(day.date)}</span>
                <WeatherGlyph code={day.weather_code} size={21}/>
                <span className="week-condition">{weatherLabel(day.weather_code)}</span>
                <span className="week-rain"><Droplets size={12}/>{day.precipitation_probability_max}%</span>
                <div className="week-range"><strong>{tempLabel(day.temperature_max, unit)}</strong><span>{tempLabel(day.temperature_min, unit)}</span></div>
              </div>)}
              {!daily.length && <p className="muted">Forecast data unavailable.</p>}
            </div>
          </article>

          <article className="card details-card">
            <div className="card-heading"><div className="heading-icon cyan"><Compass size={17}/></div><div><h2>Wind & daylight</h2><p>Local conditions</p></div></div>
            <div className="details-grid">
              <div className="detail-tile"><Wind size={19}/><span>Wind speed</span><strong>{current ? `${Math.round(current.wind_speed)} km/h` : '--'}</strong><small>{current ? `${current.wind_direction}° direction` : 'No data'}</small></div>
              <div className="detail-tile"><Sunrise size={19}/><span>Sunrise</span><strong>{firstDay ? formatTime(firstDay.sunrise) : '--'}</strong><small>Local time</small></div>
              <div className="detail-tile"><Sunset size={19}/><span>Sunset</span><strong>{firstDay ? formatTime(firstDay.sunset) : '--'}</strong><small>Local time</small></div>
              <div className="detail-tile"><CloudRain size={19}/><span>Rain chance</span><strong>{firstDay ? `${firstDay.precipitation_probability_max}%` : '--'}</strong><small>Today's maximum</small></div>
            </div>
          </article>
        </section>}

        {activeNav === 'Forecast' && <section className="page-stack">
          <article className="card"><div className="card-heading"><div className="heading-icon blue"><CloudSun size={17}/></div><div><h2>Hourly forecast</h2><p>Next 12 hours · {location.name}</p></div><span className="card-unit">°{unit === 'celsius' ? 'C' : 'F'}</span></div>
            {chartData.length ? <div className="chart-wrap forecast-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 14, right: 8, left: -22, bottom: 0 }}><defs><linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#69A9F7" stopOpacity={0.34}/><stop offset="100%" stopColor="#69A9F7" stopOpacity={0.01}/></linearGradient></defs><CartesianGrid stroke="var(--chart-grid)" vertical={false} strokeDasharray="4 5"/><XAxis dataKey="hour" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)' }} formatter={(value) => [`${value}°`, 'Temperature']}/><Area type="monotone" dataKey="temperature" stroke="#69A9F7" strokeWidth={2.5} fill="url(#forecastFill)"/></AreaChart></ResponsiveContainer></div> : <div className="empty-chart">{loading ? 'Loading forecast…' : 'Forecast unavailable'}</div>}
            <div className="hourly-strip forecast-hourly">{hourly.map((hour, i) => <div key={hour.time} className="hour-item"><span>{i === 0 ? 'Now' : formatHour(hour.time)}</span><WeatherGlyph code={hour.weather_code} size={21}/><strong>{tempLabel(hour.temperature, unit)}</strong><small><Droplets size={11}/>{hour.precipitation_probability}%</small></div>)}</div></article>
          <article className="card"><div className="card-heading"><div className="heading-icon orange"><CalendarDays size={17}/></div><div><h2>7-day outlook</h2><p>Daily highs, lows and precipitation chance</p></div></div><div className="forecast-table">{daily.map((day, i) => <div className="forecast-day" key={day.date}><div><strong>{i === 0 ? 'Today' : formatDay(day.date)}</strong><small>{day.date}</small></div><WeatherGlyph code={day.weather_code} size={24}/><span>{weatherLabel(day.weather_code)}</span><span className="forecast-rain"><Droplets size={13}/>{day.precipitation_probability_max}%</span><div className="week-range"><strong>{tempLabel(day.temperature_max, unit)}</strong><span>{tempLabel(day.temperature_min, unit)}</span></div></div>)}{!daily.length && <p className="muted">Forecast data unavailable.</p>}</div></article>
          <div className="section-note"><ShieldCheck size={16}/> Forecasts are estimates and may change. Follow official local warnings for severe weather.</div>
        </section>}

        {activeNav === 'Explore' && <section className="page-stack">
          <article className="card"><div className="card-heading"><div className="heading-icon violet"><Compass size={17}/></div><div><h2>Explore locations</h2><p>Search for a city using the search field above, then save places to your list.</p></div></div><div className="explore-current"><div className="explore-icon"><WeatherGlyph code={current?.weather_code ?? 2} size={30}/></div><div className="explore-main"><strong>{location.name}, {location.country}</strong><span>{current ? weatherLabel(current.weather_code) : 'Weather unavailable'}</span></div><div className="explore-temp">{current ? tempLabel(current.temperature, unit) : '--°'}</div><button className="secondary-button" onClick={() => void toggleSaved()}><Bookmark size={14}/>{isSaved ? 'Saved' : 'Save place'}</button></div></article>
          <article className="card"><div className="card-heading"><div className="heading-icon green"><Compass size={17}/></div><div><h2>Things to do nearby</h2><p>Nearby parks, beaches, cinemas, malls, museums and activities near {location.name}, sorted by distance.</p></div><span className="places-count">{nearbyPlaces.length} places</span></div>
            {placesLoading ? <div className="empty-state"><LoaderCircle className="spin" size={24}/><strong>Finding nearby places</strong><span>Checking mapped entertainment, parks, beaches and activities around {location.name}.</span></div> : placesError ? <div className="empty-state"><Compass size={25}/><strong>Places are temporarily unavailable</strong><span>{placesError}</span></div> : nearbyPlaces.length ? <div className="nearby-grid">{nearbyPlaces.map(place => <article className="nearby-place" key={place.id}><div className={`nearby-art nearby-${place.category}`}><MapPin size={22}/><span>{place.category.replace('-', ' ')}</span></div><div className="nearby-copy"><strong>{place.name}</strong><span>{place.distance_km} km away · {place.category}</span><p>{place.reason}</p><a href={place.map_url} target="_blank" rel="noreferrer">Open directions <span>↗</span></a></div></article>)}</div> : <div className="empty-state"><Compass size={28}/><strong>No mapped places found nearby</strong><span>Try a larger city or another location. Place coverage depends on OpenStreetMap contributions.</span></div>}
            <div className="section-note"><ShieldCheck size={15}/> Recommendations use current weather as a planning hint, not a safety guarantee. Confirm opening hours and local warnings before travelling. Place data © OpenStreetMap contributors.</div>
          </article>
          <article className="card"><div className="card-heading"><div className="heading-icon cyan"><MapPin size={17}/></div><div><h2>Your places</h2><p>{saved.length} saved location{saved.length === 1 ? '' : 's'}</p></div></div>{saved.length ? <div className="place-grid">{saved.map(item => <button className="place-card" key={`${item.latitude}-${item.longitude}`} onClick={() => void chooseLocation(item)}><MapPin size={16}/><strong>{item.name}</strong><span>{item.country}</span><small>View weather <span>→</span></small></button>)}</div> : <div className="empty-state"><Compass size={28}/><strong>No saved places yet</strong><span>Search for a city above and use Save place to build your personal weather list.</span></div>}</article>
          <article className="card"><div className="card-heading"><div className="heading-icon orange"><Bus size={17}/></div><div><h2>Weather-aware planning</h2><p>Quick checks before you head out</p></div></div><div className="planning-grid"><div><Wind size={18}/><strong>Wind</strong><span>{current ? `${Math.round(current.wind_speed)} km/h` : 'No data'}</span><small>Consider conditions for cycling or riding.</small></div><div><Droplets size={18}/><strong>Rain probability</strong><span>{firstDay ? `${firstDay.precipitation_probability_max}%` : 'No data'}</span><small>Check before outdoor travel.</small></div><div><CloudLightning size={18}/><strong>Severe weather</strong><span>Check official alerts</span><small>Atmos alerts are user-configured in this preview; official warning feeds are not integrated.</small></div></div></article>
        </section>}

        {activeNav === 'Alerts' && <section className="page-stack">
          <div className="section-note warning-note"><Bell size={16}/> Alert rules in this preview are saved in this browser only. They do not send push, SMS, or email notifications and are not yet evaluated by a backend scheduler.</div>
          <article className="card"><div className="card-heading"><div className="heading-icon orange"><Bell size={17}/></div><div><h2>Create a weather alert</h2><p>Configure a condition you want to monitor for {location.name}.</p></div></div><form className="form-grid" onSubmit={e => { e.preventDefault(); setAlerts(prev => [{ id: Date.now(), title: alertTitle.trim() || 'Weather alert', location: location.name, condition: alertCondition, threshold: alertThreshold, enabled: true }, ...prev]); setToast('Alert rule saved in this browser'); }}><label>Alert name<input value={alertTitle} onChange={e => setAlertTitle(e.target.value)} maxLength={80} required/></label><label>Condition<select value={alertCondition} onChange={e => setAlertCondition(e.target.value)}><option value="precipitation">Chance of precipitation above</option><option value="temperature-high">Temperature above (°{unit === 'celsius' ? 'C' : 'F'})</option><option value="temperature-low">Temperature below (°{unit === 'celsius' ? 'C' : 'F'})</option><option value="wind">Wind speed above (km/h)</option></select></label><label>Threshold <strong>{alertThreshold}{alertCondition === 'precipitation' ? '%' : alertCondition.includes('temperature') ? '°' : ' km/h'}</strong><input type="range" min={alertCondition === 'precipitation' ? 10 : 0} max={alertCondition === 'precipitation' ? 100 : alertCondition.includes('temperature') ? 50 : 120} step={5} value={alertThreshold} onChange={e => setAlertThreshold(Number(e.target.value))}/></label><div className="form-actions"><button className="primary-button" type="submit"><Plus size={15}/> Save alert rule</button></div></form></article>
          <article className="card"><div className="card-heading"><div className="heading-icon blue"><Activity size={17}/></div><div><h2>Your alert rules</h2><p>{alerts.length} configured</p></div></div>{alerts.length ? <div className="alert-list">{alerts.map(alert => <div className="alert-row" key={alert.id}><div className="alert-symbol"><Bell size={17}/></div><div className="alert-description"><strong>{alert.title}</strong><span>{alert.location} · {alert.condition.replace('-', ' ')} · threshold {alert.threshold}{alert.condition === 'precipitation' ? '%' : alert.condition.includes('temperature') ? '°' : ' km/h'}</span><small>Rule configured · notifications not connected</small></div><label className="switch-label"><input type="checkbox" checked={alert.enabled} onChange={e => setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, enabled: e.target.checked } : a))}/><span>{alert.enabled ? 'On' : 'Off'}</span></label><button className="icon-button danger-button" aria-label={`Delete ${alert.title}`} onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}><Trash2 size={15}/></button></div>)}</div> : <div className="empty-state"><Bell size={28}/><strong>No alert rules yet</strong><span>Create an alert rule above. Real notifications will require backend evaluation and a delivery provider.</span></div>}</article>
        </section>}

        {activeNav === 'Settings' && <section className="page-stack">
          <article className="card"><div className="card-heading"><div className="heading-icon violet"><Settings2 size={17}/></div><div><h2>Display preferences</h2><p>Customize your Atmos dashboard</p></div></div><div className="settings-row"><div><strong>Appearance</strong><span>Choose a theme for the dashboard</span></div><div className="segmented"><button className={theme === 'light' ? 'selected' : ''} onClick={() => setTheme('light')}><Sun size={14}/> Light</button><button className={theme === 'dark' ? 'selected' : ''} onClick={() => setTheme('dark')}><Moon size={14}/> Dark</button></div></div><div className="settings-row"><div><strong>Temperature unit</strong><span>Set how temperatures are displayed</span></div><div className="segmented"><button className={unit === 'celsius' ? 'selected' : ''} onClick={() => setUnit('celsius')}>°C</button><button className={unit === 'fahrenheit' ? 'selected' : ''} onClick={() => setUnit('fahrenheit')}>°F</button></div></div></article>
          <article className="card"><div className="card-heading"><div className="heading-icon blue"><UserRound size={17}/></div><div><h2>Personal profile</h2><p>Optional details to personalize travel and weather information</p></div></div><div className="section-note">Your profile is saved to your Atmos account. Date of birth and gender are optional.</div><form className="form-grid" onSubmit={async e => { e.preventDefault(); if (!authUser) { setAuthMode('signin'); return } try { const payload: ProfilePayload = { full_name: profile.fullName, home_city: profile.homeCity, date_of_birth: profile.dob, gender: profile.gender, bike: profile.bike, car: profile.car, transport_mode: profile.transport as ProfilePayload['transport_mode'] }; const updated = await saveProfile(payload); setAuthUser(updated); setProfile(profileFromUser(updated)); setToast('Personal profile saved'); } catch { setToast('Could not save profile. Please sign in again and retry.'); } }}><label>Full name<input value={profile.fullName} onChange={e => setProfile({ ...profile, fullName: e.target.value })} autoComplete="name" maxLength={100} placeholder="Your name"/></label><label>Email address<input type="email" value={authUser?.email || profile.email} readOnly autoComplete="email"/></label><label>Date of birth (optional)<input type="date" value={profile.dob} max={new Date().toISOString().slice(0, 10)} onChange={e => setProfile({ ...profile, dob: e.target.value })}/></label><label>Home city<input value={profile.homeCity} onChange={e => setProfile({ ...profile, homeCity: e.target.value })} maxLength={120} placeholder="e.g. Hyderabad"/></label><label>Gender (optional)<select value={profile.gender} onChange={e => setProfile({ ...profile, gender: e.target.value })}><option value="">Prefer not to say</option><option value="woman">Woman</option><option value="man">Man</option><option value="non-binary">Non-binary</option><option value="self-describe">Prefer to self-describe</option></select></label><div className="field-group"><span className="field-title">Vehicles you use</span><div className="check-options"><label><input type="checkbox" checked={profile.bike} onChange={e => setProfile({ ...profile, bike: e.target.checked })}/><Bike size={16}/> Bike</label><label><input type="checkbox" checked={profile.car} onChange={e => setProfile({ ...profile, car: e.target.checked })}/><Car size={16}/> Car</label></div></div><label>Usual transport mode<select value={profile.transport} onChange={e => setProfile({ ...profile, transport: e.target.value })}><option value="private">Private transport</option><option value="public">Public transport</option><option value="mixed">Both public and private</option><option value="walking-cycling">Walking / cycling</option></select></label><div className="form-actions"><button className="primary-button" type="submit"><Check size={15}/> Save profile</button><button className="secondary-button" type="button" onClick={() => { setProfile({ ...emptyProfile, email: authUser?.email || '' }); setToast('Clear fields and save to update your profile'); }}>Clear profile</button></div></form></article>
          <article className="card security-card"><div className="card-heading"><div className="heading-icon cyan"><ShieldCheck size={17}/></div><div><h2>Account and privacy</h2><p>Account security</p></div></div><p className="muted">Signed in as {authUser?.email || 'not signed in'}. Email/password accounts are activated immediately after registration.</p><div className="form-actions"><button className="secondary-button" onClick={async () => { await logoutAccount(); setAuthUser(null); setProfile(emptyProfile); setAuthMode('signin'); setAuthMessage('You have signed out.') }}>Sign out</button></div></article>
        </section>}

        <footer className="page-footer"><span>Atmos Weather Intelligence</span><span>Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></span><span>Forecasts can change · Check official warnings for severe weather</span></footer>
      </main>
      {authMode && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (authUser && e.target === e.currentTarget) setAuthMode(null) }}><section className="auth-modal card" role="dialog" aria-modal="true" aria-labelledby="auth-title">{authUser && <button className="modal-close icon-button" aria-label="Close" onClick={() => setAuthMode(null)}><X size={17}/></button>}<div className="auth-brand"><div className="brand-mark"><CloudSun size={22}/></div><span>atmos</span></div><h2 id="auth-title">{authMode === 'register' ? 'Create your account' : 'Welcome back'}</h2><p className="muted">{authMode === 'register' ? 'Create an account to start using Atmos immediately.' : 'Sign in to continue to your weather dashboard.'}</p><form className="form-grid auth-form" onSubmit={async e => { e.preventDefault(); setAuthBusy(true); setAuthMessage(''); const form = new FormData(e.currentTarget); const email = String(form.get('email') || ''); const password = String(form.get('password') || ''); const fullName = String(form.get('fullName') || ''); const extra: Partial<ProfilePayload> = { home_city: String(form.get('homeCity') || ''), date_of_birth: String(form.get('dob') || ''), gender: String(form.get('gender') || ''), bike: form.get('bike') === 'on', car: form.get('car') === 'on', transport_mode: (String(form.get('transport') || 'private') as ProfilePayload['transport_mode']) }; try { if (authMode === 'register') { const user = await registerAccount(email, password, fullName, extra); setAuthUser(user); setProfile(profileFromUser(user)); setAuthMode(null); setAuthMessage(''); setToast('Account created successfully'); } else { const user = await loginAccount(email, password); setAuthUser(user); setProfile(profileFromUser(user)); setAuthMode(null); setToast('Signed in successfully'); } } catch (err) { setAuthMessage(err instanceof Error ? err.message.replace(/^\{\"detail\":\"?/, '').replace(/\"\}$/, '') : 'Authentication failed. Please try again.'); } finally { setAuthBusy(false); } }}><label><span className="label-with-icon"><Mail size={14}/> Gmail or email address</span><input name="email" type="email" autoComplete="email" placeholder="you@gmail.com" required/></label><label><span className="label-with-icon"><LockKeyhole size={14}/> Password</span><div className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength={authMode === 'register' ? 12 : 1} placeholder={authMode === 'register' ? "At least 12 characters" : "Your password"} required/><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>{authMode === 'register' && <><label>Full name<input name="fullName" placeholder="Your name" autoComplete="name"/></label><label>Home city<input name="homeCity" placeholder="e.g. Hyderabad"/></label><label>Date of birth (optional)<input name="dob" type="date" max={new Date().toISOString().slice(0, 10)}/></label><label>Gender (optional)<select name="gender" defaultValue=""><option value="">Prefer not to say</option><option value="woman">Woman</option><option value="man">Man</option><option value="non-binary">Non-binary</option><option value="self-describe">Prefer to self-describe</option></select></label><div className="field-group"><span className="field-title">Vehicles you use (optional)</span><div className="check-options"><label><input name="bike" type="checkbox"/> <Bike size={16}/> Bike</label><label><input name="car" type="checkbox"/> <Car size={16}/> Car</label></div></div><label>Usual transport mode<select name="transport" defaultValue="private"><option value="private">Private transport</option><option value="public">Public transport</option><option value="mixed">Both public and private</option><option value="walking-cycling">Walking / cycling</option></select></label></>}<div className="section-note">No email verification is required. Use an email address you can access in case account recovery is added later.</div>{authMessage && <div className="section-note auth-message" role="status">{authMessage}</div>}<button className="primary-button full-button" type="submit" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'register' ? 'Create account' : 'Sign in'}</button></form><p className="auth-switch">{authMode === 'register' ? 'Already have an account?' : 'New to Atmos?'} <button onClick={() => setAuthMode(authMode === 'register' ? 'signin' : 'register')}>{authMode === 'register' ? 'Sign in' : 'Create an account'}</button></p></section></div>}
      {toast && <div className="toast"><Check size={16}/>{toast}</div>}
    </div>
  )
}
