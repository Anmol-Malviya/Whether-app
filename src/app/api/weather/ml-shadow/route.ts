import { NextRequest, NextResponse } from "next/server";
import { runShadowEvaluation, getShadowEvaluationMetrics, getPaginatedHistory } from "@/lib/shadowEvaluator";

const ALLOWED_RANGES = new Set(["24h", "7d", "30d", "all", "custom"]);
const ALLOWED_STATUSES = new Set([
  "all",
  "pending",
  "evaluating",
  "evaluated",
  "incomplete_hourly",
  "outcome_missing",
  "failed_prediction",
]);
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * Validates whether a string is a valid ISO 8601 date string that parses to a valid Date.
 */
function isValidDate(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== "string") return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

/**
 * GET /api/weather/ml-shadow
 * Query Parameters:
 * - range: "24h" | "7d" | "30d" | "all" | "custom"
 * - from: ISO string (for custom range)
 * - to: ISO string (for custom range)
 * - page: number (default 1, positive integer)
 * - limit: number (default 20, max 100, positive integer)
 * - status: "all" | "pending" | "evaluating" | "evaluated" | "incomplete_hourly" | "outcome_missing" | "failed_prediction"
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // 1. Validate 'range'
    const rangeParam = searchParams.get("range");
    const range = rangeParam || "24h";
    if (!ALLOWED_RANGES.has(range)) {
      return NextResponse.json(
        { error: "Invalid range parameter. Allowed: 24h, 7d, 30d, all, custom" },
        { status: 400 }
      );
    }

    // 2. Validate 'status'
    const statusParam = searchParams.get("status");
    const status = statusParam || "all";
    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        { error: "Invalid status parameter. Allowed: all, pending, evaluating, evaluated, incomplete_hourly, outcome_missing, failed_prediction" },
        { status: 400 }
      );
    }

    // 3. Validate 'page' and 'limit' (must be finite positive numbers, bounded)
    const rawPage = searchParams.get("page");
    const rawLimit = searchParams.get("limit");

    let page = 1;
    if (rawPage !== null) {
      const parsedPage = Number(rawPage);
      if (!Number.isFinite(parsedPage) || !Number.isInteger(parsedPage) || parsedPage < 1) {
        return NextResponse.json(
          { error: "Invalid page parameter. Must be a positive integer >= 1" },
          { status: 400 }
        );
      }
      page = parsedPage;
    }

    let limit = DEFAULT_LIMIT;
    if (rawLimit !== null) {
      const parsedLimit = Number(rawLimit);
      if (!Number.isFinite(parsedLimit) || !Number.isInteger(parsedLimit) || parsedLimit < 1) {
        return NextResponse.json(
          { error: "Invalid limit parameter. Must be a positive integer between 1 and 100" },
          { status: 400 }
        );
      }
      limit = Math.min(MAX_LIMIT, parsedLimit);
    }

    // 4. Validate 'from' and 'to' date parameters
    let fromUtc: string | null = searchParams.get("from");
    let toUtc: string | null = searchParams.get("to");

    if (fromUtc !== null) {
      if (!isValidDate(fromUtc)) {
        return NextResponse.json(
          { error: "Invalid 'from' parameter. Must be a valid ISO date string" },
          { status: 400 }
        );
      }
    }

    if (toUtc !== null) {
      if (!isValidDate(toUtc)) {
        return NextResponse.json(
          { error: "Invalid 'to' parameter. Must be a valid ISO date string" },
          { status: 400 }
        );
      }
    }

    if (fromUtc && toUtc) {
      const fromMs = new Date(fromUtc).getTime();
      const toMs = new Date(toUtc).getTime();
      if (fromMs > toMs) {
        return NextResponse.json(
          { error: "Invalid date range: 'from' must be earlier than or equal to 'to'" },
          { status: 400 }
        );
      }
    }

    // Compute presets if from/to not explicitly supplied
    const now = new Date();
    if (range === "24h" && !fromUtc && !toUtc) {
      fromUtc = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
      toUtc = now.toISOString();
    } else if (range === "7d" && !fromUtc && !toUtc) {
      fromUtc = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
      toUtc = now.toISOString();
    } else if (range === "30d" && !fromUtc && !toUtc) {
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
    // Keep detailed errors in server-side logs; never leak stack traces or internal details
    console.error("[/api/weather/ml-shadow] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch shadow monitoring data" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/weather/ml-shadow
 * Secure Cron & Admin trigger to execute outcome evaluations against completed t+1 hours.
 * Requirements:
 * - Return 503 when CRON_SECRET is absent.
 * - Require Authorization: Bearer <CRON_SECRET>.
 * - Remove query-string secret authentication.
 * - Return 401 for invalid credentials.
 * - Do not expose stack traces or internal exception details.
 * - Keep detailed errors in server-side logs.
 */
export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;

    // 1. Return 503 when CRON_SECRET is absent
    if (!cronSecret || cronSecret.trim().length === 0) {
      console.error("[/api/weather/ml-shadow] POST rejected: CRON_SECRET is not configured on the server");
      return NextResponse.json(
        { error: "Evaluation service unavailable: administrative authentication is not configured" },
        { status: 503 }
      );
    }

    // 2. Reject query-string secret authentication (query-string secret strictly forbidden)
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or malformed Authorization header with Bearer token" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7).trim();
    if (token !== cronSecret) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid administrative credentials" },
        { status: 401 }
      );
    }

    const result = await runShadowEvaluation();
    const metrics = await getShadowEvaluationMetrics();

    return NextResponse.json({
      status: "evaluation_completed",
      result,
      metrics,
    });
  } catch (err: unknown) {
    // Keep detailed errors in server-side logs; never leak stack traces or internal details to client
    console.error("[/api/weather/ml-shadow] POST error:", err);
    return NextResponse.json(
      { error: "Failed to execute shadow evaluation" },
      { status: 500 }
    );
  }
}
