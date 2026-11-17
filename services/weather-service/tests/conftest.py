import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def mock_open_meteo_forecast() -> dict:
    return {
        "latitude": 17.385,
        "longitude": 78.4867,
        "timezone": "Asia/Kolkata",
        "current": {
            "time": "2026-11-17T12:00",
            "temperature_2m": 28.5,
            "apparent_temperature": 30.1,
            "relative_humidity_2m": 65,
            "is_day": 1,
            "precipitation": 0.0,
            "weather_code": 0,
            "wind_speed_10m": 12.0,
            "wind_direction_10m": 180,
        },
        "hourly": {
            "time": [f"2026-11-17T{i:02d}:00" for i in range(24)],
            "temperature_2m": [25.0 + (i % 5) for i in range(24)],
            "precipitation_probability": [5 for _ in range(24)],
            "weather_code": [0 for _ in range(24)],
        },
        "daily": {
            "time": ["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"],
            "weather_code": [0, 1, 2, 0, 0, 1, 0],
            "temperature_2m_max": [32.0, 31.5, 30.0, 31.0, 33.0, 32.5, 31.0],
            "temperature_2m_min": [22.0, 21.5, 20.0, 21.0, 22.0, 22.5, 21.0],
            "precipitation_probability_max": [10, 20, 15, 5, 0, 10, 5],
            "sunrise": [f"2026-11-{17+i}T06:15" for i in range(7)],
            "sunset": [f"2026-11-{17+i}T17:45" for i in range(7)],
            "wind_speed_10m_max": [15.0 for _ in range(7)],
        },
    }


@pytest.fixture
def mock_open_meteo_geocoding() -> dict:
    return {
        "results": [
            {
                "id": 1269843,
                "name": "Hyderabad",
                "latitude": 17.38405,
                "longitude": 78.45636,
                "country": "India",
                "admin1": "Telangana",
                "timezone": "Asia/Kolkata",
            },
            {
                "id": 1269844,
                "name": "Hyderabad",
                "latitude": 25.39689,
                "longitude": 68.37718,
                "country": "Pakistan",
                "admin1": "Sindh",
                "timezone": "Asia/Karachi",
            },
        ]
    }

