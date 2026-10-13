export type LocationResult = {
  name: string
  country: string
  admin1?: string | null
  latitude: number
  longitude: number
  timezone?: string
}

export type CurrentWeather = {
  time: string
  temperature: number
  apparent_temperature: number
  relative_humidity: number
  is_day: number
  precipitation: number
  weather_code: number
  wind_speed: number
  wind_direction: number
}

export type HourlyForecast = {
  time: string
  temperature: number
  precipitation_probability: number
  weather_code: number
}

export type DailyForecast = {
  date: string
  weather_code: number
  temperature_max: number
  temperature_min: number
  precipitation_probability_max: number
  sunrise: string
  sunset: string
  wind_speed_max: number
}

export type WeatherResponse = {
  location: LocationResult
  current: CurrentWeather
  hourly: HourlyForecast[]
  daily: DailyForecast[]
  attribution: string
}
