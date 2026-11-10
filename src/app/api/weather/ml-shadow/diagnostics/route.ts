import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { MlEvaluation } from "@/lib/models/MlEvaluation";
import { deriveFailureClassification } from "@/lib/failureClassifier";

const ALLOWED_RANGES = new Set(["24h", "7d", "30d", "all"]);

/**
 * GET /api/weather/ml-shadow/diagnostics
 *
 * Returns:
 * - Inference health metrics (totals, success/failure rates, latency stats)
 * - Failure distribution grouped by failureCode
 * - Recent failure timeline records (up to 100)
 *
 * Query params:
 * - range: "24h" | "7d" | "30d" | "all" (default: "24h")
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const rangeParam = searchParams.get("range") || "24h";

    if (!ALLOWED_RANGES.has(rangeParam)) {
      return NextResponse.json(
        { error: "Invalid range parameter. Allowed: 24h, 7d, 30d, all" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Compute time bounds
    const now = new Date();
    let fromUtc: Date | null = null;
    if (rangeParam === "24h") fromUtc = new Date(now.getTime() - 24 * 3600 * 1000);
    else if (rangeParam === "7d") fromUtc = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    else if (rangeParam === "30d") fromUtc = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    const timeQuery = fromUtc ? { targetLeadTimeUtc: { $gte: fromUtc } } : {};

    // ── Parallel queries ──────────────────────────────────────────────────────
    const [
      totalCount,
      successCount,
      failedCount,
      latencyAgg,
      failureDistAgg,
      recentFailures,
      lastSuccess,
      lastFailure,
    ] = await Promise.all([
      // 1. Total predictions in range
      MlEvaluation.countDocuments(timeQuery),

      // 2. Successful predictions (pending or evaluated — have valid prediction values)
      MlEvaluation.countDocuments({
        ...timeQuery,
        evaluationStatus: { $in: ["pending", "evaluating", "evaluated"] },
        predictedTemperature: { $ne: null },
      }),

      // 3. Failed predictions
      MlEvaluation.countDocuments({
        ...timeQuery,
        evaluationStatus: "failed_prediction",
      }),

      // 4. Latency aggregation (avg + p95) — only on records with inferenceLatencyMs
      MlEvaluation.aggregate([
        {
          $match: {
            ...timeQuery,
            inferenceLatencyMs: { $ne: null, $exists: true, $gt: 0 },
            evaluationStatus: { $in: ["pending", "evaluating", "evaluated"] },
          },
        },
        {
          $group: {
            _id: null,
            avgLatencyMs: { $avg: "$inferenceLatencyMs" },
            latencyValues: { $push: "$inferenceLatencyMs" },
            count: { $sum: 1 },
          },
        },
      ]),

      // 5. Failure distribution by failureCode
      MlEvaluation.aggregate([
        {
          $match: {
            ...timeQuery,
            evaluationStatus: "failed_prediction",
          },
        },
        {
          $group: {
            _id: { $ifNull: ["$failureCode", "UNKNOWN_ERROR"] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // 6. Recent failures timeline (last 100, only safe fields exposed)
      MlEvaluation.find(
        {
          ...timeQuery,
          evaluationStatus: "failed_prediction",
        },
        {
          _id: 1,
          targetLeadTimeUtc: 1,
          generatedAt: 1,
          failureCode: 1,
          failureStage: 1,
          failureReason: 1,
          retryCount: 1,
          httpStatusCode: 1,
          inferenceLatencyMs: 1,
          inputFeatureAvailability: 1,
          datasetVersion: 1,
          evaluationAttempts: 1,
        }
      )
        .sort({ targetLeadTimeUtc: -1 })
        .limit(100)
        .lean(),

      // 7. Last successful inference timestamp
      MlEvaluation.findOne(
        {
          evaluationStatus: { $in: ["pending", "evaluating", "evaluated"] },
          predictedTemperature: { $ne: null },
        },
        { generatedAt: 1, targetLeadTimeUtc: 1 }
      )
        .sort({ targetLeadTimeUtc: -1 })
        .lean(),

      // 8. Last failed inference timestamp
      MlEvaluation.findOne(
        { evaluationStatus: "failed_prediction" },
        { generatedAt: 1, targetLeadTimeUtc: 1 }
      )
        .sort({ targetLeadTimeUtc: -1 })
        .lean(),
    ]);

    // ── Compute latency metrics ───────────────────────────────────────────────
    let avgLatencyMs: number | null = null;
    let p95LatencyMs: number | null = null;
    if (latencyAgg.length > 0) {
      const agg = latencyAgg[0];
      avgLatencyMs = typeof agg.avgLatencyMs === "number" ? Math.round(agg.avgLatencyMs * 10) / 10 : null;

      // P95 via nearest-rank on sorted values (require ≥ 20 samples)
      const vals: number[] = Array.isArray(agg.latencyValues) ? agg.latencyValues : [];
      if (vals.length >= 20) {
        const sorted = [...vals].sort((a, b) => a - b);
        const idx = Math.ceil(0.95 * sorted.length) - 1;
        p95LatencyMs = Math.round(sorted[Math.max(0, idx)] * 10) / 10;
      }
    }

    // ── Compute rates ─────────────────────────────────────────────────────────
    const successRate = totalCount > 0 ? successCount / totalCount : null;
    const failureRate = totalCount > 0 ? failedCount / totalCount : null;

    // ── Build failure distribution with percentages & accurate code derivation ──
    const sanitizedFailures = recentFailures.map((rec) => {
      const derived = deriveFailureClassification(
        rec.failureCode,
        rec.failureStage,
        rec.failureReason,
        rec.httpStatusCode
      );

      return {
        id: String(rec._id),
        targetLeadTimeUtc: rec.targetLeadTimeUtc,
        generatedAt: rec.generatedAt,
        failureCode: derived.code,
        failureStage: derived.stage,
        failureReason: sanitizeFailureReason(rec.failureReason),
        retryCount: rec.retryCount ?? 0,
        httpStatusCode: rec.httpStatusCode ?? null,
        inferenceLatencyMs: rec.inferenceLatencyMs ?? null,
        inputFeatureAvailability: rec.inputFeatureAvailability ?? null,
        datasetVersion: rec.datasetVersion ?? null,
        evaluationAttempts: rec.evaluationAttempts ?? 0,
      };
    });

    // Recompute failure distribution from the accurately derived codes
    const distributionCounts = new Map<string, number>();
    for (const f of sanitizedFailures) {
      distributionCounts.set(f.failureCode, (distributionCounts.get(f.failureCode) || 0) + 1);
    }

    const failureDistribution = Array.from(distributionCounts.entries())
      .map(([code, count]) => ({
        code,
        count,
        percentage: failedCount > 0 ? Math.round((count / failedCount) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      service: "WeatherPulse ML Diagnostics",
      range: rangeParam,
      inferenceHealth: {
        totalRequests: totalCount,
        successfulPredictions: successCount,
        failedPredictions: failedCount,
        successRate,
        failureRate,
        avgLatencyMs,
        p95LatencyMs,
        lastSuccessAt: lastSuccess ? (lastSuccess as { generatedAt?: Date }).generatedAt?.toISOString() ?? null : null,
        lastFailureAt: lastFailure ? (lastFailure as { generatedAt?: Date }).generatedAt?.toISOString() ?? null : null,
      },
      failureDistribution,
      recentFailures: sanitizedFailures,
    });
  } catch (err: unknown) {
    console.error("[/api/weather/ml-shadow/diagnostics] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch diagnostics data" },
      { status: 500 }
    );
  }
}

/**
 * Sanitizes a raw failure reason string for safe frontend display.
 * - Redacts any URL-like patterns
 * - Truncates to 300 characters
 * - Strips stack trace markers
 */
function sanitizeFailureReason(reason: string | undefined | null): string | null {
  if (!reason) return null;
  // Redact URLs (http/https/ws schemes)
  let sanitized = reason.replace(/https?:\/\/[^\s"'`]+/gi, "[URL REDACTED]");
  // Redact anything that looks like a file path
  sanitized = sanitized.replace(/([A-Za-z]:\\[^\s"'`]*|\/[^\s"'`]{10,})/g, "[PATH REDACTED]");
  // Strip "at " stack frame lines
  sanitized = sanitized.replace(/\s+at\s+\S+\s*\([^)]*\)/g, "");
  // Truncate
  if (sanitized.length > 300) sanitized = sanitized.slice(0, 297) + "...";
  return sanitized.trim() || null;
}

