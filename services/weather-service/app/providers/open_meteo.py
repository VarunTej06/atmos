from __future__ import annotations

import httpx

BASE_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"


async def search_locations(query: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=12.0) as client:
        response = await client.get(
            GEOCODING_URL,
            params={"name": query, "count": 8, "language": "en", "format": "json"},
        )
        response.raise_for_status()
        payload = response.json()

    results = []
    for item in payload.get("results", []):
        results.append({
            "name": item["name"],
            "country": item.get("country", "Unknown"),
            "admin1": item.get("admin1"),
            "latitude": item["latitude"],
            "longitude": item["longitude"],
            "timezone": item.get("timezone", "auto"),
        })
    return results


async def get_forecast(latitude: float, longitude: float, timezone: str = "auto") -> dict:
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "timezone": timezone or "auto",
        "forecast_days": 7,
        "current": ",".join([
            "temperature_2m", "relative_humidity_2m", "apparent_temperature",
            "is_day", "precipitation", "weather_code", "wind_speed_10m",
            "wind_direction_10m",
        ]),
        "hourly": ",".join([
            "temperature_2m", "precipitation_probability", "weather_code",
        ]),
        "daily": ",".join([
            "weather_code", "temperature_2m_max", "temperature_2m_min",
            "precipitation_probability_max", "sunrise", "sunset",
            "wind_speed_10m_max",
        ]),
        "wind_speed_unit": "kmh",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(BASE_URL, params=params)
        response.raise_for_status()
        return response.json()
