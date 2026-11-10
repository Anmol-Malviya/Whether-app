import { NextRequest, NextResponse } from "next/server";
import { getMlPrediction } from "@/lib/mlPrediction";
import { runShadowEvaluation } from "@/lib/shadowEvaluator";

/**
 * POST /api/cron/ml-pipeline
 *
 * Automated Scheduled Ingestion & Inference Pipeline:
 * 1. Collects fresh hourly weather observations from Open-Meteo.
 * 2. Validates observation timestamps & meteorological values.
 * 3. Invokes the FastAPI ML service for next-hour (t+1) temperature and rain occurrence.
 * 4. Idempotently persists prediction records in MongoDB (E11000 duplicate-key safe).
 * 5. Runs the shadow evaluator to score mature predictions whose actuals have arrived.
 * 6. Logs structured pipeline telemetry.
 *
 * Auth:
 * - Requires Authorization: Bearer <CRON_SECRET> if CRON_SECRET is configured.
 * - Allowed without auth in development / local trigger.
 */
export async function POST(request: NextRequest) {
  return handlePipeline(request);
}

export async function GET(request: NextRequest) {
  return handlePipeline(request);
}

async function handlePipeline(request: NextRequest) {
  const startTime = Date.now();
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const { searchParams } = request.nextUrl;
    const secretQuery = searchParams.get("secret");
    if (secretQuery !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized cron execution" }, { status: 401 });
    }
  }

  const { searchParams } = request.nextUrl;
  const latStr = searchParams.get("lat");
  const lonStr = searchParams.get("lon");
  const locationId = searchParams.get("location") || "indore";

  const lat = latStr ? parseFloat(latStr) : 22.7196;
  const lon = lonStr ? parseFloat(lonStr) : 75.8577;

  try {
    // 1. Run live ML inference (collects observations, validates, predicts, persists)
    const predictionResult = await getMlPrediction(lat, lon, locationId);

    // 2. Run shadow evaluation cycle to score previous predictions with completed outcomes
    let evaluationResult = null;
    try {
      evaluationResult = await runShadowEvaluation();
    } catch (evalErr) {
      console.warn("[Cron ml-pipeline] Evaluation step warning:", evalErr);
    }

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs,
      location: { locationId, lat, lon },
      prediction: {
        status: predictionResult.status,
        targetLeadTimeUtc: predictionResult.targetLeadTimeUtc,
        predictedTemperature: predictionResult.predictedTemperature,
        rainProbability: predictionResult.rainProbability,
        rainPredicted: predictionResult.rainPredicted,
        persistenceStatus: predictionResult.persistenceStatus,
      },
      evaluation: evaluationResult,
    });
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    console.error("[Cron ml-pipeline] Pipeline execution error:", err);
    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        durationMs,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

