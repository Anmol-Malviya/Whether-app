import { MlPredictionPayload } from "@/lib/types/weather";
import { connectToDatabase } from "@/lib/db";
import { MlEvaluation } from "@/lib/models/MlEvaluation";

export interface HourlyObservationInput {
  timestamp_utc: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  dew_point_2m: number;
  precipitation: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  surface_pressure: number;
  cloud_cover: number;
}

const DEFAULT_ML_SERVICE_URL = "http://127.0.0.1:8000";
const REQUEST_TIMEOUT_MS = 3000;
const MAX_STALENESS_HOURS = 2.5;
const RAIN_THRESHOLD = 0.7425;
const DISCLAIMER_TEXT =
  "SHADOW MODE: Experimental observation-only ML model running for evaluation. Predictions are model-derived and not calibrated risk or authoritative warnings.";

/**
 * Validates and extracts consecutive hourly observations from Open-Meteo payload.
 */
export function parseAndValidateObservations(
  hourly: Record<string, unknown>,
  nowUtcMs: number = Date.now()
): { observations: HourlyObservationInput[]; stale: boolean; reason?: string } {
  const times = hourly.time as string[] | undefined;
  if (!times || !Array.isArray(times) || times.length === 0) {
    return { observations: [], stale: false, reason: "Missing or invalid time array in hourly payload" };
  }

  const t2mArr = hourly.temperature_2m as (number | null)[] | undefined;
  const rhArr = hourly.relative_humidity_2m as (number | null)[] | undefined;
  const dpArr = hourly.dew_point_2m as (number | null)[] | undefined;
  const precipArr = hourly.precipitation as (number | null)[] | undefined;
  const wsArr = hourly.wind_speed_10m as (number | null)[] | undefined;
  const wdArr = hourly.wind_direction_10m as (number | null)[] | undefined;
  const spArr = hourly.surface_pressure as (number | null)[] | undefined;
  const ccArr = hourly.cloud_cover as (number | null)[] | undefined;

  // Filter completed past hourly records
  const completedIndices: number[] = [];
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

  // Select the last 3 completed hours
  const selectedIndices = completedIndices.slice(-3);
  const observations: HourlyObservationInput[] = [];

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

    // Reject missing, null, or non-finite numbers (zero-imputation strictly forbidden)
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

    // Physical limits check
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

  // Sequence interval check: exactly 1 hour (3600s) between consecutive steps
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

  // Staleness check on t2 (newest observation)
  const stalenessHours = (nowUtcMs - t2) / (1000 * 3600);
  const isStale = stalenessHours > MAX_STALENESS_HOURS;

  return {
    observations,
    stale: isStale,
    reason: isStale ? `Latest observation is ${stalenessHours.toFixed(1)}h old (> ${MAX_STALENESS_HOURS}h)` : undefined,
  };
}

/**
 * Fetches recent hourly data from Open-Meteo for Indore coordinates.
 */
export async function fetchLiveHourlyObservations(
  lat: number,
  lon: number
): Promise<{ observations: HourlyObservationInput[]; stale: boolean; reason?: string }> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,` +
    `wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover` +
    `&past_hours=6&forecast_days=1&wind_speed_unit=kmh&timezone=UTC`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { observations: [], stale: false, reason: `Open-Meteo HTTP error: ${res.status}` };
    }

    const data = await res.json();
    return parseAndValidateObservations(data.hourly ?? {});
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const isAbort = err instanceof Error && err.name === "AbortError";
    return { observations: [], stale: false, reason: isAbort ? "Open-Meteo request timed out" : String(err) };
  }
}

/**
 * Safely persists a shadow prediction evaluation record into MongoDB.
 * Implements deterministic duplicate prevention using evaluationKey.
 * Handles duplicate-key races safely (E11000) and tracks database persistence outcomes.
 */
async function persistShadowPrediction(recordData: {
  locationId: string;
  lat: number;
  lon: number;
  inputTimestampsUtc: Date[];
  inputSource: string;
  datasetVersion: string;
  predictedTemperature: number | null;
  predictedRainProbability: number | null;
  predictedRainClass: boolean | null;
  rainThreshold: number;
  targetLeadTimeUtc: Date;
  providerMetadata: Record<string, unknown>;
  failureStatus?: string;
  failureReason?: string;
  evaluationStatus: "pending" | "failed_prediction";
}): Promise<{ success: boolean; duplicate?: boolean; error?: string }> {
  try {
    await connectToDatabase();
    const evaluationKey = `${recordData.locationId}_obs_only_v1_${recordData.targetLeadTimeUtc.toISOString()}`;

    // Ensure model indexes are initialized (creates unique evaluationKey index & lease indexes)
    await MlEvaluation.init().catch((initErr) => {
      console.warn("[mlPrediction] MlEvaluation index initialization warning:", initErr);
    });

    await MlEvaluation.updateOne(
      { evaluationKey },
      {
        $setOnInsert: {
          evaluationKey,
          ...recordData,
          evaluationAttempts: 0,
          evaluationLeaseUntil: null,
          generatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const isDuplicate = typeof errorMsg === "string" && (errorMsg.includes("E11000") || errorMsg.includes("duplicate key"));
    if (isDuplicate) {
      console.info(`[mlPrediction] Safe duplicate-key race handled for key: ${recordData.locationId}_obs_only_v1_${recordData.targetLeadTimeUtc.toISOString()}`);
      return { success: true, duplicate: true };
    }
    // Non-blocking: database logging errors must not break user-facing aggregation, but remain measurable
    console.warn("[mlPrediction] Failed to persist shadow record to MongoDB:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Predicts next-hour weather in SHADOW MODE.
 */
export async function getMlPrediction(
  lat: number,
  lon: number,
  locationId: string = "indore"
): Promise<MlPredictionPayload> {
  const generatedAt = new Date().toISOString();
  const serviceBaseUrl = process.env.ML_SERVICE_URL || DEFAULT_ML_SERVICE_URL;
  const predictEndpoint = `${serviceBaseUrl.replace(/\/$/, "")}/predict`;

  const { observations, stale } = await fetchLiveHourlyObservations(lat, lon);

  if (observations.length !== 3) {
    const status = stale ? "stale_inputs" : "unavailable";
    return {
      status,
      targetLeadTimeUtc: null,
      predictedTemperature: null,
      rainProbability: null,
      rainPredicted: null,
      rainThreshold: RAIN_THRESHOLD,
      modelMetadata: null,
      generatedAt,
      disclaimer: DISCLAIMER_TEXT,
    };
  }

  if (stale) {
    return {
      status: "stale_inputs",
      targetLeadTimeUtc: null,
      predictedTemperature: null,
      rainProbability: null,
      rainPredicted: null,
      rainThreshold: RAIN_THRESHOLD,
      modelMetadata: null,
      generatedAt,
      disclaimer: DISCLAIMER_TEXT,
    };
  }

  const payload = { observations };
  const targetLeadTime = new Date(new Date(observations[2].timestamp_utc).getTime() + 3600000);

  // Invoke FastAPI POST /predict with 3.0s timeout and 1 retry
  let attempt = 0;
  const maxAttempts = 2;
  let lastErrorMsg = "";

  while (attempt < maxAttempts) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(predictEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const predictedTemp = data.temperature_celsius_prediction;
        const rainProb = data.rain_probability;
        const rainClass = data.rain_classification;
        const rainThresh = data.selected_rain_threshold ?? RAIN_THRESHOLD;

        // Persist shadow record to MongoDB asynchronously
        persistShadowPrediction({
          locationId,
          lat,
          lon,
          inputTimestampsUtc: observations.map((o) => new Date(o.timestamp_utc)),
          inputSource: "open-meteo-forecast-hourly (interpolated)",
          datasetVersion: data.model_version?.dataset_version || "training_dataset.csv",
          predictedTemperature: predictedTemp,
          predictedRainProbability: rainProb,
          predictedRainClass: rainClass,
          rainThreshold: rainThresh,
          targetLeadTimeUtc: targetLeadTime,
          providerMetadata: {
            serviceUrl: serviceBaseUrl,
            endpoint: "/predict",
            systemVersions: data.model_version?.system_versions,
          },
          evaluationStatus: "pending",
        });

        return {
          status: "available",
          targetLeadTimeUtc: data.target_lead_time_utc,
          predictedTemperature: predictedTemp,
          rainProbability: rainProb,
          rainPredicted: rainClass,
          rainThreshold: rainThresh,
          modelMetadata: {
            temperatureModelType: data.model_version?.temperature_model_type,
            rainModelType: data.model_version?.rain_model_type,
            datasetVersion: data.model_version?.dataset_version,
            systemVersions: data.model_version?.system_versions,
          },
          generatedAt,
          disclaimer: DISCLAIMER_TEXT,
        };
      } else {
        lastErrorMsg = `HTTP ${response.status}: ${await response.text()}`;
        // If 4xx client/validation error, do not retry
        if (response.status >= 400 && response.status < 500) {
          console.error(`[mlPrediction] Validation error from ML service: ${lastErrorMsg}`);
          break;
        }
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === "AbortError";
      lastErrorMsg = isAbort ? "ML service request timed out (>3000ms)" : String(err);
      console.warn(`[mlPrediction] Request attempt ${attempt} failed: ${lastErrorMsg}`);
    }

    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Record failure state in shadow log
  persistShadowPrediction({
    locationId,
    lat,
    lon,
    inputTimestampsUtc: observations.map((o) => new Date(o.timestamp_utc)),
    inputSource: "open-meteo-forecast-hourly (interpolated)",
    datasetVersion: "unknown",
    predictedTemperature: null,
    predictedRainProbability: null,
    predictedRainClass: null,
    rainThreshold: RAIN_THRESHOLD,
    targetLeadTimeUtc: targetLeadTime,
    providerMetadata: { error: lastErrorMsg },
    failureStatus: "unavailable",
    failureReason: lastErrorMsg,
    evaluationStatus: "failed_prediction",
  });

  return {
    status: "unavailable",
    targetLeadTimeUtc: null,
    predictedTemperature: null,
    rainProbability: null,
    rainPredicted: null,
    rainThreshold: RAIN_THRESHOLD,
    modelMetadata: null,
    generatedAt,
    disclaimer: DISCLAIMER_TEXT,
  };
}
