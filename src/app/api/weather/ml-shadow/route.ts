import { NextRequest, NextResponse } from "next/server";
import { runShadowEvaluation, getShadowEvaluationMetrics, getPaginatedHistory } from "@/lib/shadowEvaluator";

/**
 * GET /api/weather/ml-shadow
 * Query Parameters:
 * - range: "24h" | "7d" | "30d" | "all" | "custom"
 * - from: ISO string (for custom range)
 * - to: ISO string (for custom range)
 * - page: number (default 1)
 * - limit: number (default 20, max 100)
 * - status: "all" | "pending" | "evaluated" | "incomplete_hourly" | "failed_prediction"
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const range = searchParams.get("range") || "24h";
    let fromUtc: string | null = searchParams.get("from");
    let toUtc: string | null = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status") || "all";

    // Compute presets if from/to not explicitly supplied
    const now = new Date();
    if (range === "24h") {
      fromUtc = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
      toUtc = now.toISOString();
    } else if (range === "7d") {
      fromUtc = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
      toUtc = now.toISOString();
    } else if (range === "30d") {
      fromUtc = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
      toUtc = now.toISOString();
    }

    const [metrics, history] = await Promise.all([
      getShadowEvaluationMetrics({ fromUtc, toUtc, preset: range }),
      getPaginatedHistory({ page, limit, status, fromUtc, toUtc }),
    ]);

    return NextResponse.json({
      service: "WeatherPulse Shadow Mode ML Evaluator",
      status: "ok",
      metrics,
      history,
    });
  } catch (err: unknown) {
    console.error("[/api/weather/ml-shadow] GET error:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    return NextResponse.json({
      error: "Failed to fetch shadow monitoring data",
      details: errorMessage,
      stack: errorStack,
    }, { status: 500 });
  }
}

/**
 * POST /api/weather/ml-shadow
 * Secure Cron & Admin trigger to execute outcome evaluations against completed t+1 hours.
 * Protected by Bearer token matching CRON_SECRET or ?secret= query param.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { searchParams } = request.nextUrl;
    const secretQuery = searchParams.get("secret");
    const cronSecret = process.env.CRON_SECRET;

    // Secure authentication check
    if (cronSecret) {
      const authorizedBearer = authHeader === `Bearer ${cronSecret}`;
      const authorizedQuery = secretQuery === cronSecret;
      if (!authorizedBearer && !authorizedQuery) {
        return NextResponse.json(
          { error: "Unauthorized: Invalid or missing administrative token" },
          { status: 401 }
        );
      }
    }

    const result = await runShadowEvaluation();
    const metrics = await getShadowEvaluationMetrics();

    return NextResponse.json({
      status: "evaluation_completed",
      result,
      metrics,
    });
  } catch (err) {
    console.error("[/api/weather/ml-shadow] POST error:", err);
    return NextResponse.json({ error: "Failed to execute shadow evaluation" }, { status: 500 });
  }
}
