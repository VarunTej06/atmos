from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx

from app.providers.open_meteo import get_forecast, search_locations

app = FastAPI(
    title="Atmos Weather Service",
    version="0.1.0",
    description="Weather provider adapter and normalized forecast API for Atmos.",
)

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins],
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


class Location(BaseModel):
    name: str
    country: str
    admin1: str | None = None
    latitude: float
    longitude: float
    timezone: str = "auto"


class CurrentWeather(BaseModel):
    time: str
    temperature: float
    apparent_temperature: float
    relative_humidity: int
    is_day: int
    precipitation: float
    weather_code: int
    wind_speed: float
    wind_direction: int


class HourlyWeather(BaseModel):
    time: str
    temperature: float
    precipitation_probability: int
    weather_code: int


class DailyWeather(BaseModel):
    date: str
    weather_code: int
    temperature_max: float
    temperature_min: float
    precipitation_probability_max: int
    sunrise: str
    sunset: str
    wind_speed_max: float


class WeatherResponse(BaseModel):
    location: Location
    current: CurrentWeather
    hourly: list[HourlyWeather]
    daily: list[DailyWeather]
    attribution: str = "Weather data by Open-Meteo"


class ExplorePlace(BaseModel):
    id: str
    name: str
    category: str
    latitude: float
    longitude: float
    distance_km: float
    reason: str
    map_url: str


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    from math import asin, cos, radians, sin, sqrt
    dlat, dlon = radians(lat2-lat1), radians(lon2-lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
    return 6371 * 2 * asin(sqrt(min(1, a)))


def _activity_reason(category: str, temperature: float, rain_chance: int, weather_code: int, wind: float) -> str:
    wet = rain_chance >= 50 or weather_code >= 51
    hot = temperature >= 33
    stormy = weather_code >= 95 or wind >= 45
    if stormy:
        return 'Weather may be hazardous outdoors; consider an indoor venue and check local warnings.'
    if wet:
        return 'Rain is possible. Prefer covered attractions and check conditions before leaving.'
    if hot and category in {'park', 'garden', 'beach', 'viewpoint', 'trail'}:
        return 'Hot conditions: consider an early-morning or evening visit, shade, and water.'
    if category == 'beach' and wind >= 30:
        return 'Windy conditions: check local beach and water-safety advisories before visiting.'
    return 'Conditions look reasonably suitable for an outdoor visit; check local opening hours.'


@app.get('/api/v1/explore/nearby', response_model=list[ExplorePlace])
async def explore_nearby(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    temperature: float = Query(default=25, ge=-60, le=60),
    rain_probability: int = Query(default=0, ge=0, le=100),
    weather_code: int = Query(default=0, ge=0, le=99),
    wind_speed: float = Query(default=0, ge=0, le=300),
    radius_m: int = Query(default=8000, ge=1000, le=20000),
) -> list[ExplorePlace]:
    # OpenStreetMap/Overpass provides mapped nearby places; availability varies by region.
    query = f"[out:json][timeout:18];(node(around:{radius_m},{latitude},{longitude})[leisure~'park|garden|nature_reserve|sports_centre|playground|fitness_centre'];way(around:{radius_m},{latitude},{longitude})[leisure~'park|garden|nature_reserve|sports_centre|playground|fitness_centre'];relation(around:{radius_m},{latitude},{longitude})[leisure~'park|garden|nature_reserve'];node(around:{radius_m},{latitude},{longitude})[natural~'beach|water'];way(around:{radius_m},{latitude},{longitude})[natural~'beach|water'];node(around:{radius_m},{latitude},{longitude})[tourism~'museum|attraction|zoo|aquarium|viewpoint|theme_park'];way(around:{radius_m},{latitude},{longitude})[tourism~'museum|attraction|zoo|aquarium|viewpoint|theme_park'];node(around:{radius_m},{latitude},{longitude})[amenity~'cinema|theatre|arts_centre|restaurant|cafe|marketplace'];way(around:{radius_m},{latitude},{longitude})[amenity~'cinema|theatre|arts_centre|restaurant|cafe|marketplace'];node(around:{radius_m},{latitude},{longitude})[shop~'mall'];way(around:{radius_m},{latitude},{longitude})[shop~'mall'];);out center tags 120;"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post('https://overpass-api.de/api/interpreter', content=query, headers={'Content-Type':'text/plain', 'User-Agent':'AtmosWeatherDashboard/0.1'})
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(status_code=502, detail='Nearby places provider is temporarily unavailable')
    found = []
    seen = set()
    for item in payload.get('elements', []):
        tags = item.get('tags') or {}
        name = tags.get('name') or tags.get('name:en')
        if not name or name in seen:
            continue
        lat = item.get('lat', (item.get('center') or {}).get('lat'))
        lon = item.get('lon', (item.get('center') or {}).get('lon'))
        if lat is None or lon is None:
            continue
        leisure = tags.get('leisure', '')
        natural = tags.get('natural', '')
        tourism = tags.get('tourism', '')
        if natural == 'beach': category = 'beach'
        elif leisure == 'park': category = 'park'
        elif leisure == 'garden': category = 'garden'
        elif natural == 'water': category = 'waterfront'
        elif tourism in {'museum','attraction','zoo','aquarium','theme_park'}: category = 'attraction'
        elif tourism == 'viewpoint': category = 'viewpoint'
        elif leisure in {'sports_centre', 'playground', 'fitness_centre'}: category = 'activity'
        elif natural == 'nature_reserve': category = 'nature'
        elif tags.get('amenity') in {'cinema', 'theatre', 'arts_centre'}: category = 'entertainment'
        elif tags.get('amenity') in {'restaurant', 'cafe', 'marketplace'}: category = 'food'
        elif tags.get('shop') == 'mall': category = 'shopping'
        else: category = 'place'
        distance = _haversine_km(latitude, longitude, float(lat), float(lon))
        if distance > radius_m / 1000: continue
        seen.add(name)
        found.append(ExplorePlace(id=f"{item.get('type')}:{item.get('id')}", name=name, category=category, latitude=float(lat), longitude=float(lon), distance_km=round(distance, 1), reason=_activity_reason(category, temperature, rain_probability, weather_code, wind_speed), map_url=f"https://www.google.com/maps/search/?api=1&query={lat}%2C{lon}"))
    found.sort(key=lambda place: place.distance_km)
    return found[:24]


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "healthy", "service": "weather-service"}


@app.get("/api/v1/locations/search", response_model=list[Location])
async def location_search(q: str = Query(min_length=2, max_length=100)) -> list[Location]:
    try:
        return [Location(**item) for item in await search_locations(q)]
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Weather geocoding provider is unavailable") from exc


@app.get("/api/v1/weather", response_model=WeatherResponse)
async def weather(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    name: str = Query(min_length=1, max_length=100),
    country: str = Query(min_length=1, max_length=100),
    timezone_name: str = Query(default="auto", alias="timezone", max_length=80),
) -> WeatherResponse:
    try:
        raw: dict[str, Any] = await get_forecast(latitude, longitude, timezone_name)
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Weather provider is unavailable") from exc

    current = raw.get("current")
    hourly = raw.get("hourly")
    daily = raw.get("daily")
    if not current or not hourly or not daily:
        raise HTTPException(status_code=502, detail="Weather provider returned incomplete data")

    current_result = CurrentWeather(
        time=current["time"],
        temperature=current["temperature_2m"],
        apparent_temperature=current["apparent_temperature"],
        relative_humidity=current["relative_humidity_2m"],
        is_day=current["is_day"],
        precipitation=current["precipitation"],
        weather_code=current["weather_code"],
        wind_speed=current["wind_speed_10m"],
        wind_direction=current["wind_direction_10m"],
    )

    hourly_result = [
        HourlyWeather(
            time=hourly["time"][i],
            temperature=hourly["temperature_2m"][i],
            precipitation_probability=hourly["precipitation_probability"][i] or 0,
            weather_code=hourly["weather_code"][i],
        )
        for i in range(min(24, len(hourly["time"])))
    ]

    daily_result = [
        DailyWeather(
            date=daily["time"][i],
            weather_code=daily["weather_code"][i],
            temperature_max=daily["temperature_2m_max"][i],
            temperature_min=daily["temperature_2m_min"][i],
            precipitation_probability_max=daily["precipitation_probability_max"][i] or 0,
            sunrise=daily["sunrise"][i],
            sunset=daily["sunset"][i],
            wind_speed_max=daily["wind_speed_10m_max"][i],
        )
        for i in range(min(7, len(daily["time"])))
    ]

    return WeatherResponse(
        location=Location(
            name=name,
            country=country,
            latitude=latitude,
            longitude=longitude,
            timezone=raw.get("timezone", "auto"),
        ),
        current=current_result,
        hourly=hourly_result,
        daily=daily_result,
    )
