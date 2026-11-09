import { NextRequest, NextResponse } from "next/server";
import { runShadowEvaluation, getShadowEvaluationMetrics } from "@/lib/shadowEvaluator";

/**
 * POST /api/weather/ml-shadow/evaluate
 *
 * Internal UI endpoint triggered by the user clicking "Run Evaluation Cycle"
 * on the ML Model Monitoring dashboard.
 *
 * Secure server-side execution:
 * Calls runShadowEvaluation() and returns updated metrics directly to the UI,
 * keeping external cron authentication (/api/weather/ml-shadow with CRON_SECRET)
 * intact for scheduled tasks and automated pipelines.
 */
export async function POST(_request: NextRequest) {
  try {
    const result = await runShadowEvaluation();
    const metrics = await getShadowEvaluationMetrics();

    return NextResponse.json({
      status: "evaluation_completed",
      result,
      metrics,
    });
  } catch (err: unknown) {
    console.error("[/api/weather/ml-shadow/evaluate] POST error:", err);
    return NextResponse.json(
      { error: "Failed to execute shadow evaluation" },
      { status: 500 }
    );
  }
}

