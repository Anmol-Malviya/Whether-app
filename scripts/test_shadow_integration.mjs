import { test, describe } from "node:test";
import assert from "node:assert";

// Clean JS test implementation of parseAndValidateObservations logic to test integration invariants
const MAX_STALENESS_HOURS = 2.5;

function parseAndValidateObservations(hourly, nowUtcMs = Date.now()) {
  const times = hourly.time;
  if (!times || !Array.isArray(times) || times.length === 0) {
    return { observations: [], stale: false, reason: "Missing or invalid time array in hourly payload" };
  }

  const t2mArr = hourly.temperature_2m;
  const rhArr = hourly.relative_humidity_2m;
  const dpArr = hourly.dew_point_2m;
  const precipArr = hourly.precipitation;
  const wsArr = hourly.wind_speed_10m;
  const wdArr = hourly.wind_direction_10m;
  const spArr = hourly.surface_pressure;
  const ccArr = hourly.cloud_cover;

  const completedIndices = [];
  for (let i = 0; i < times.length; i++) {
    const rawTime = times[i];
    const timeWithZ = rawTime.endsWith("Z") ? rawTime : `${rawTime}:00Z`;
    const recordMs = new Date(timeWithZ).getTime();
    if (!isNaN(recordMs) && recordMs <= nowUtcMs) {
      completedIndices.push(i);
    }
  }

  if (completedIndices.length < 3) {
    return {
      observations: [],
      stale: false,
      reason: `Insufficient completed past records: ${completedIndices.length} < 3`,
    };
  }

  const selectedIndices = completedIndices.slice(-3);
  const observations = [];

  for (const idx of selectedIndices) {
    const rawTime = times[idx];
    const isoUtc = rawTime.endsWith("Z") ? rawTime : (rawTime.length === 16 ? `${rawTime}:00Z` : `${rawTime}Z`);

    const t2m = t2mArr?.[idx];
    const rh = rhArr?.[idx];
    const dp = dpArr?.[idx];
    const precip = precipArr?.[idx];
    const ws = wsArr?.[idx];
    const wd = wdArr?.[idx];
    const sp = spArr?.[idx];
    const cc = ccArr?.[idx];

    if (
      t2m === null || t2m === undefined || !Number.isFinite(t2m) ||
      rh === null || rh === undefined || !Number.isFinite(rh) ||
      dp === null || dp === undefined || !Number.isFinite(dp) ||
      precip === null || precip === undefined || !Number.isFinite(precip) ||
      ws === null || ws === undefined || !Number.isFinite(ws) ||
      wd === null || wd === undefined || !Number.isFinite(wd) ||
      sp === null || sp === undefined || !Number.isFinite(sp) ||
      cc === null || cc === undefined || !Number.isFinite(cc)
    ) {
      return {
        observations: [],
        stale: false,
        reason: `Missing or non-finite value in meteorological variables at index ${idx}`,
      };
    }

    if (t2m < -20 || t2m > 60 || rh < 0 || rh > 100 || dp < -30 || dp > 45 ||
        precip < 0 || precip > 300 || ws < 0 || ws > 150 || wd < 0 || wd > 360 ||
        sp < 800 || sp > 1100 || cc < 0 || cc > 100) {
      return {
        observations: [],
        stale: false,
        reason: `Meteorological value outside physical boundaries at index ${idx}`,
      };
    }

    observations.push({
      timestamp_utc: isoUtc,
      temperature_2m: Number(t2m),
      relative_humidity_2m: Number(rh),
      dew_point_2m: Number(dp),
      precipitation: Number(precip),
      wind_speed_10m: Number(ws),
      wind_direction_10m: Number(wd),
      surface_pressure: Number(sp),
      cloud_cover: Number(cc),
    });
  }

  const t0 = new Date(observations[0].timestamp_utc).getTime();
  const t1 = new Date(observations[1].timestamp_utc).getTime();
  const t2 = new Date(observations[2].timestamp_utc).getTime();

  if (t1 - t0 !== 3600000 || t2 - t1 !== 3600000) {
    return {
      observations: [],
      stale: false,
      reason: `Intervals are not spaced by exactly 1 hour: ${(t1 - t0) / 1000}s, ${(t2 - t1) / 1000}s`,
    };
  }

  const stalenessHours = (nowUtcMs - t2) / (1000 * 3600);
  const isStale = stalenessHours > MAX_STALENESS_HOURS;

  return {
    observations,
    stale: isStale,
    reason: isStale ? `Latest observation is ${stalenessHours.toFixed(1)}h old (> ${MAX_STALENESS_HOURS}h)` : undefined,
  };
}

describe("Phase 6.1 Shadow Mode ML Integration Tests", () => {
  const baseTimeMs = new Date("2026-11-09T12:00:00Z").getTime();

  function makeValidHourlyPayload() {
    return {
      time: [
        "2026-11-09T08:00",
        "2026-11-09T09:00",
        "2026-11-09T10:00",
        "2026-11-09T11:00",
        "2026-11-09T12:00",
      ],
      temperature_2m: [25.0, 26.0, 27.0, 27.5, 28.0],
      relative_humidity_2m: [50.0, 48.0, 45.0, 42.0, 40.0],
      dew_point_2m: [12.0, 12.5, 13.0, 12.8, 12.5],
      precipitation: [0.0, 0.0, 0.0, 0.0, 0.0],
      wind_speed_10m: [10.0, 11.0, 12.0, 11.5, 10.5],
      wind_direction_10m: [180.0, 185.0, 190.0, 195.0, 200.0],
      surface_pressure: [950.0, 949.5, 949.0, 948.5, 948.0],
      cloud_cover: [20.0, 25.0, 30.0, 25.0, 20.0],
    };
  }

  test("1. Valid observation extraction: exactly 3 consecutive hourly records", () => {
    const payload = makeValidHourlyPayload();
    const result = parseAndValidateObservations(payload, baseTimeMs);
    assert.strictEqual(result.observations.length, 3);
    assert.strictEqual(result.stale, false);
    assert.strictEqual(result.observations[0].timestamp_utc, "2026-11-09T10:00:00Z");
    assert.strictEqual(result.observations[1].timestamp_utc, "2026-11-09T11:00:00Z");
    assert.strictEqual(result.observations[2].timestamp_utc, "2026-11-09T12:00:00Z");
    assert.strictEqual(result.observations[2].temperature_2m, 28.0);
  });

  test("2. Rejects missing required meteorological variables", () => {
    const payload = makeValidHourlyPayload();
    payload.precipitation[4] = null;
    const result = parseAndValidateObservations(payload, baseTimeMs);
    assert.strictEqual(result.observations.length, 0);
    assert.match(result.reason || "", /Missing or non-finite value/);
  });

  test("3. Rejects non-consecutive timestamp gaps", () => {
    const payload = makeValidHourlyPayload();
    payload.time[4] = "2026-11-09T13:00";
    const result = parseAndValidateObservations(payload, new Date("2026-11-09T13:00:00Z").getTime());
    assert.strictEqual(result.observations.length, 0);
    assert.match(result.reason || "", /not spaced by exactly 1 hour/);
  });

  test("4. Detects stale inputs when latest record is older than 2.5 hours", () => {
    const payload = makeValidHourlyPayload();
    const futureNowMs = new Date("2026-11-09T15:30:00Z").getTime();
    const result = parseAndValidateObservations(payload, futureNowMs);
    assert.strictEqual(result.observations.length, 3);
    assert.strictEqual(result.stale, true);
    assert.match(result.reason || "", /old/);
  });

  test("5. Rejects out-of-bounds physical limits (temperature > 60 C)", () => {
    const payload = makeValidHourlyPayload();
    payload.temperature_2m[4] = 68.5;
    const result = parseAndValidateObservations(payload, baseTimeMs);
    assert.strictEqual(result.observations.length, 0);
    assert.match(result.reason || "", /outside physical boundaries/);
  });

  test("6. Insufficient completed observations (< 3)", () => {
    const payload = {
      time: ["2026-11-09T11:00", "2026-11-09T12:00"],
      temperature_2m: [25.0, 26.0],
      relative_humidity_2m: [50.0, 48.0],
      dew_point_2m: [12.0, 12.5],
      precipitation: [0.0, 0.0],
      wind_speed_10m: [10.0, 11.0],
      wind_direction_10m: [180.0, 185.0],
      surface_pressure: [950.0, 949.5],
      cloud_cover: [20.0, 25.0],
    };
    const result = parseAndValidateObservations(payload, baseTimeMs);
    assert.strictEqual(result.observations.length, 0);
    assert.match(result.reason || "", /Insufficient completed past records/);
  });
});
