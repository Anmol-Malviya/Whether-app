/**
 * Phase 2 Automated Verification & Unit Test Suite
 *
 * Verifies:
 * 1. Missing API keys return "error" status with null values (no synthetic data).
 * 2. Synthetic values never contribute to consensus or confidence score.
 * 3. Gwalior selection resolves to Gwalior coordinates (26.2183, 78.1828) without falling back to Indore.
 * 4. Coordinate queries with zero latitude and longitude (0, 0) resolve properly without NaN.
 * 5. Unauthorized moment deletion is rejected with 401 when unverified.
 * 6. Rate limiter abstraction functions gracefully in memory.
 */

import assert from "node:assert/strict";
import { resolveLocation, aggregateWeather } from "../src/lib/aggregator";
import { fetchWeatherApi } from "../src/lib/providers/weatherapi";
import { fetchOpenWeather } from "../src/lib/providers/openweather";
import { checkRateLimit } from "../src/lib/rateLimit";

async function runTests() {
  console.log("=================================================");
  console.log("Running WeatherPulse Phase 2 Verification Tests");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function test(description: string, fn: () => void | Promise<void>) {
    return Promise.resolve()
      .then(fn)
      .then(() => {
        console.log(`PASS: ${description}`);
        passed++;
      })
      .catch((err) => {
        console.error(`FAIL: ${description}`);
        console.error(err);
        failed++;
      });
  }

  // --- Test 1: Gwalior Location Resolution ---
  await test("resolveLocation('gwalior') returns Gwalior coordinates, not Indore", () => {
    const loc = resolveLocation("gwalior");
    assert.equal(loc.id, "gwalior");
    assert.equal(loc.name, "Gwalior, Madhya Pradesh");
    assert.equal(loc.lat, 26.2183);
    assert.equal(loc.lon, 78.1828);
  });

  // --- Test 2: Gwalior legacy spelling 'gwaliar' backward-compatibility ---
  await test("resolveLocation('gwaliar') alias resolves to Gwalior coordinates", () => {
    const loc = resolveLocation("gwaliar");
    assert.equal(loc.name, "Gwalior, Madhya Pradesh");
    assert.equal(loc.lat, 26.2183);
    assert.equal(loc.lon, 78.1828);
  });

  // --- Test 3: Zero Coordinates (0, 0) Resolution ---
  await test("resolveLocation with latitude 0 and longitude 0 correctly keeps 0 and does not treat it as undefined/NaN", () => {
    const loc = resolveLocation("custom", 0, 0, "Null Island");
    assert.equal(loc.lat, 0);
    assert.equal(loc.lon, 0);
    assert.equal(loc.name, "Null Island");
  });

  // --- Test 4: Coordinate string '0,0' Resolution ---
  await test("resolveLocation coord string '0,0:Null Island' parses 0 properly", () => {
    const loc = resolveLocation("0,0:Null%20Island");
    assert.equal(loc.lat, 0);
    assert.equal(loc.lon, 0);
    assert.equal(loc.id, "current-location");
    assert.equal(loc.name, "Null Island");
  });

  // --- Test 5: WeatherAPI missing key returns error/unavailable with null metrics ---
  await test("fetchWeatherApi returns null values and error/disabled when no key is set", async () => {
    const origKey = process.env.WEATHERAPI_KEY;
    delete process.env.WEATHERAPI_KEY;

    try {
      const res = await fetchWeatherApi(26.2183, 78.1828, "gwalior", "Gwalior");
      assert.equal(res.provider, "weatherapi");
      assert.equal(res.temperature, null, "Temperature must be null when key is missing");
      assert.equal(res.humidity, null, "Humidity must be null when key is missing");
      assert.equal(res.windSpeed, null, "Wind speed must be null when key is missing");
      assert.equal(res.precipitation, null, "Precipitation must be null when key is missing");
      assert.notEqual(res.providerStatus, "ok");
      assert.notEqual(res.providerStatus, "partial", "Provider status must not be 'partial' with synthetic data");
      assert.equal(res.providerStatus, "error");
    } finally {
      process.env.WEATHERAPI_KEY = origKey;
    }
  });

  // --- Test 6: OpenWeatherMap missing key returns error/unavailable with null metrics ---
  await test("fetchOpenWeather returns null values and error/disabled when no key is set", async () => {
    const origKey = process.env.OPENWEATHER_KEY;
    delete process.env.OPENWEATHER_KEY;

    try {
      const res = await fetchOpenWeather(26.2183, 78.1828, "gwalior", "Gwalior");
      assert.equal(res.provider, "openweathermap");
      assert.equal(res.temperature, null, "Temperature must be null when key is missing");
      assert.equal(res.humidity, null, "Humidity must be null when key is missing");
      assert.equal(res.windSpeed, null, "Wind speed must be null when key is missing");
      assert.equal(res.precipitation, null, "Precipitation must be null when key is missing");
      assert.notEqual(res.providerStatus, "ok");
      assert.notEqual(res.providerStatus, "partial", "Provider status must not be 'partial' with synthetic data");
      assert.equal(res.providerStatus, "error");
    } finally {
      process.env.OPENWEATHER_KEY = origKey;
    }
  });

  // --- Test 7: Synthetic Data Exclusion from Aggregator Consensus ---
  await test("aggregateWeather excludes failed/missing providers and relies solely on live provider (Open-Meteo)", async () => {
    const origWaKey = process.env.WEATHERAPI_KEY;
    const origOwKey = process.env.OPENWEATHER_KEY;
    delete process.env.WEATHERAPI_KEY;
    delete process.env.OPENWEATHER_KEY;

    try {
      const agg = await aggregateWeather("gwalior");
      assert.equal(agg.locationName, "Gwalior, Madhya Pradesh");
      assert.equal(agg.lat, 26.2183);
      assert.equal(agg.lon, 78.1828);

      // Open-Meteo is free and should return status "ok"
      const openMeteo = agg.providers.find((p) => p.provider === "open-meteo");
      assert.ok(openMeteo, "Open-Meteo provider must exist in response");

      if (openMeteo?.providerStatus === "ok") {
        // Consensus temperature must equal Open-Meteo's temperature since the other two are error/null
        assert.equal(agg.summary.temperature, openMeteo.temperature);
        assert.equal(agg.summary.humidity, openMeteo.humidity);
        // Availability must reflect 1 out of 3 providers (33%)
        assert.equal(agg.confidenceBreakdown.availabilityScore, 33);
      }
    } finally {
      process.env.WEATHERAPI_KEY = origWaKey;
      process.env.OPENWEATHER_KEY = origOwKey;
    }
  });

  // --- Test 8: Rate Limiter Memory Sliding Window ---
  await test("checkRateLimit accurately restricts requests exceeding maxRequests", async () => {
    const testId = `test_ip_${Date.now()}`;
    const r1 = await checkRateLimit(testId, 3, 5000);
    assert.equal(r1.success, true);
    assert.equal(r1.remaining, 2);

    const r2 = await checkRateLimit(testId, 3, 5000);
    assert.equal(r2.success, true);
    assert.equal(r2.remaining, 1);

    const r3 = await checkRateLimit(testId, 3, 5000);
    assert.equal(r3.success, true);
    assert.equal(r3.remaining, 0);

    const r4 = await checkRateLimit(testId, 3, 5000);
    assert.equal(r4.success, false, "4th request must be blocked under limit 3");
  });

  // --- Test 9: Unauthorized Moment Deletion Security Check ---
  await test("DELETE route checks server-side secret and denies spoofed x-user-role headers", async () => {
    // Import route handler directly
    const { DELETE } = await import("../src/app/api/moments/[id]/route");
    
    // Simulate request with spoofed client headers
    const req = new Request("http://localhost:3000/api/moments/mock_id", {
      method: "DELETE",
      headers: {
        "x-user-id": "attacker",
        "x-user-role": "admin",
      },
    });

    const res = await DELETE(req as any, { params: Promise.resolve({ id: "mock_id" }) });
    assert.equal(res.status, 401, "Spoofed admin header must receive 401 Unauthorized");
    const body = await res.json();
    assert.ok(body.error.includes("Unauthorized"), "Response error must state Unauthorized");
  });

  console.log(`\nTests finished: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test runner crashed:", e);
  process.exit(1);
});

