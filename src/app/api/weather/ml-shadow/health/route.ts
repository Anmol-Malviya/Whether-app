import { NextResponse } from "next/server";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";
const HEALTH_TIMEOUT_MS = 3000;
const OPEN_METEO_PROBE_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=22.7196&longitude=75.8577&hourly=temperature_2m&forecast_days=1&timezone=UTC";

/**
 * GET /api/weather/ml-shadow/health
 *
 * Performs live health checks against:
 * 1. Python ML service (FastAPI /health/ready endpoint)
 * 2. MongoDB connectivity (via existing connection state)
 * 3. Open-Meteo weather data provider (probe request)
 *
 * Returns structured service health without exposing internal URLs or credentials.
 * Never assumes healthy — each dependency is independently checked.
 */
export async function GET() {
  const checkedAt = new Date().toISOString();

  // ── 1. Python ML service check ─────────────────────────────────────────────
  const mlHealth = await checkMlService();

  // ── 2. MongoDB connectivity check ─────────────────────────────────────────
  const dbHealth = await checkMongoDb();

  // ── 3. Open-Meteo provider check ──────────────────────────────────────────
  const weatherProviderHealth = await checkOpenMeteo();

  // ── Compute overall service status ────────────────────────────────────────
  const overallStatus = computeOverallStatus(mlHealth.status, dbHealth.status, weatherProviderHealth.status);

  return NextResponse.json({
    checkedAt,
    overallStatus,
    services: {
      mlService: mlHealth,
      database: dbHealth,
      weatherProvider: weatherProviderHealth,
    },
  });
}

type ServiceStatus = "healthy" | "degraded" | "unavailable" | "unknown";

interface ServiceCheck {
  status: ServiceStatus;
  responseTimeMs: number | null;
  detail: string;
  modelReady?: boolean;
  featureCount?: number;
}

async function checkMlService(): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    const res = await fetch(`${ML_SERVICE_URL}/health/ready`, {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - start;

    if (!res.ok) {
      return {
        status: "degraded",
        responseTimeMs,
        detail: `Health endpoint returned HTTP ${res.status}`,
        modelReady: false,
      };
    }

    const data = await res.json() as {
      ready?: boolean;
      temperature_model_loaded?: boolean;
      rain_model_loaded?: boolean;
      feature_count?: number;
      message?: string;
    };

    return {
      status: data.ready ? "healthy" : "degraded",
      responseTimeMs,
      detail: data.message ?? (data.ready ? "Models loaded and ready" : "Models not ready"),
      modelReady: data.ready ?? false,
      featureCount: data.feature_count,
    };
  } catch (err: unknown) {
    const responseTimeMs = Date.now() - start;
    const isTimeout = err instanceof Error && (err.name === "AbortError" || err.message?.includes("abort"));
    return {
      status: "unavailable",
      responseTimeMs: isTimeout ? responseTimeMs : null,
      detail: isTimeout ? "ML service request timed out" : "ML service unreachable",
      modelReady: false,
    };
  }
}

async function checkMongoDb(): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    // Use dynamic import to avoid circular dependency on the module-level connectToDatabase
    const { connectToDatabase } = await import("@/lib/db");
    await connectToDatabase();
    // If we got here without throwing, the connection pool is established
    const responseTimeMs = Date.now() - start;
    return {
      status: "healthy",
      responseTimeMs,
      detail: "Database connection established",
    };
  } catch (err: unknown) {
    const responseTimeMs = Date.now() - start;
    console.error("[health] MongoDB check failed:", err instanceof Error ? err.message : String(err));
    return {
      status: "unavailable",
      responseTimeMs,
      detail: "Database connection failed",
    };
  }
}

async function checkOpenMeteo(): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const res = await fetch(OPEN_METEO_PROBE_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - start;
    if (res.ok) {
      return { status: "healthy", responseTimeMs, detail: "Weather provider responding" };
    }
    return {
      status: "degraded",
      responseTimeMs,
      detail: `Weather provider returned HTTP ${res.status}`,
    };
  } catch (err: unknown) {
    const responseTimeMs = Date.now() - start;
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return {
      status: "unavailable",
      responseTimeMs: isTimeout ? responseTimeMs : null,
      detail: isTimeout ? "Weather provider request timed out" : "Weather provider unreachable",
    };
  }
}

function computeOverallStatus(
  ml: ServiceStatus,
  db: ServiceStatus,
  weather: ServiceStatus
): ServiceStatus {
  if (ml === "unavailable" || db === "unavailable") return "unavailable";
  if (ml === "degraded" || db === "degraded" || weather === "unavailable") return "degraded";
  if (ml === "healthy" && db === "healthy") return "healthy";
  return "unknown";
}

