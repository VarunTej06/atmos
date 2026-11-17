import { test, expect } from '@playwright/test'

test.describe('Weather Dashboard E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/weather*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
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
        }),
      })
    })

    await page.route('**/api/v1/locations/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            name: 'London',
            country: 'United Kingdom',
            admin1: 'England',
            latitude: 51.5074,
            longitude: -0.1278,
            timezone: 'Europe/London',
          },
        ]),
      })
    })

    await page.route('**/api/v1/explore/nearby*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'node:1',
            name: 'Hyde Park',
            category: 'park',
            latitude: 51.5074,
            longitude: -0.1278,
            distance_km: 1.2,
            reason: 'Suitable for outdoor visit',
            map_url: 'https://maps.google.com',
          },
        ]),
      })
    })
  })

  test('verifies dashboard loading, city search, and tab switching', async ({ page }) => {
    await page.goto('/')

    // Sidebar is visible
    const sidebar = page.locator('.sidebar, aside, nav')
    await expect(sidebar.first()).toBeVisible()

    // Search field is present
    const searchInput = page.getByPlaceholder(/search/i)
    await expect(searchInput).toBeVisible()

    // Weather data appears
    await expect(page.locator('text=/\\d+°/').first()).toBeVisible()

    // Search for a city
    await searchInput.fill('London')
    const searchResult = page.locator('.search-results button, [role="option"], button:has-text("London")').first()
    await expect(searchResult).toBeVisible()
    await searchResult.click()

    // Switch between Overview, Forecast, and Explore tabs
    const overviewTab = page.getByRole('button', { name: /overview/i }).first()
    const forecastTab = page.getByRole('button', { name: /forecast/i }).first()
    const exploreTab = page.getByRole('button', { name: /explore/i }).first()

    if (await forecastTab.isVisible()) {
      await forecastTab.click()
      await expect(forecastTab).toHaveClass(/active/)
    }

    if (await exploreTab.isVisible()) {
      await exploreTab.click()
      await expect(exploreTab).toHaveClass(/active/)
    }

    if (await overviewTab.isVisible()) {
      await overviewTab.click()
      await expect(overviewTab).toHaveClass(/active/)
    }
  })
})

