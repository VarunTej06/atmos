from unittest.mock import AsyncMock, patch
import httpx
from fastapi.testclient import TestClient


def test_locations_search_success(client: TestClient, mock_open_meteo_geocoding: dict):
    req = httpx.Request("GET", "https://geocoding-api.open-meteo.com/v1/search")
    mock_resp = httpx.Response(200, json=mock_open_meteo_geocoding, request=req)

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        response = client.get("/api/v1/locations/search?q=Hyderabad")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2
    assert data[0]["name"] == "Hyderabad"
    assert data[0]["country"] == "India"
    assert data[0]["latitude"] == 17.38405
    assert data[0]["longitude"] == 78.45636


def test_locations_search_validation_error(client: TestClient):
    response = client.get("/api/v1/locations/search?q=a")
    assert response.status_code == 422


def test_locations_search_upstream_error(client: TestClient):
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = httpx.ConnectError("Connection refused")
        response = client.get("/api/v1/locations/search?q=Hyderabad")

    assert response.status_code == 502
    assert "Weather geocoding provider is unavailable" in response.json()["detail"]


def test_weather_endpoint_success(client: TestClient, mock_open_meteo_forecast: dict):
    req = httpx.Request("GET", "https://api.open-meteo.com/v1/forecast")
    mock_resp = httpx.Response(200, json=mock_open_meteo_forecast, request=req)

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        response = client.get(
            "/api/v1/weather",
            params={
                "latitude": 17.385,
                "longitude": 78.4867,
                "name": "Hyderabad",
                "country": "India",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["location"]["name"] == "Hyderabad"
    assert data["location"]["country"] == "India"
    assert data["current"]["temperature"] == 28.5
    assert data["current"]["apparent_temperature"] == 30.1
    assert len(data["hourly"]) == 24
    assert len(data["daily"]) == 7
    assert data["attribution"] == "Weather data by Open-Meteo"


def test_weather_endpoint_missing_params(client: TestClient):
    response = client.get("/api/v1/weather")
    assert response.status_code == 422


def test_weather_endpoint_upstream_error(client: TestClient):
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = httpx.HTTPError("Open-Meteo timeout")
        response = client.get(
            "/api/v1/weather",
            params={
                "latitude": 17.385,
                "longitude": 78.4867,
                "name": "Hyderabad",
                "country": "India",
            },
        )

    assert response.status_code == 502
    assert "Weather provider is unavailable" in response.json()["detail"]


def test_weather_endpoint_incomplete_data(client: TestClient):
    req = httpx.Request("GET", "https://api.open-meteo.com/v1/forecast")
    mock_resp = httpx.Response(200, json={"current": None}, request=req)

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        response = client.get(
            "/api/v1/weather",
            params={
                "latitude": 17.385,
                "longitude": 78.4867,
                "name": "Hyderabad",
                "country": "India",
            },
        )

    assert response.status_code == 502
    assert "Weather provider returned incomplete data" in response.json()["detail"]

