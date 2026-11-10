import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { MlEvaluation } from "@/lib/models/MlEvaluation";
import { deriveFailureClassification } from "@/lib/failureClassifier";
import mongoose from "mongoose";

/**
 * GET /api/weather/ml-shadow/diagnostics/[id]
 *
 * Returns full diagnostic detail for a single prediction record by MongoDB _id.
 * Redacts: internal URLs, stack traces, file paths, MongoDB connection details.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate MongoDB ObjectId format
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid prediction ID format" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const record = await MlEvaluation.findById(id).lean();

    if (!record) {
      return NextResponse.json(
        { error: "Prediction record not found" },
        { status: 404 }
      );
    }

    // Build safe response — never expose providerMetadata.serviceUrl or MongoDB internals
    const safeProviderMetadata: Record<string, unknown> = {};
    const rawMeta = record.providerMetadata as Record<string, unknown> | undefined;
    if (rawMeta) {
      // Expose only non-sensitive keys
      if (rawMeta.endpoint) safeProviderMetadata.endpoint = rawMeta.endpoint;
      if (rawMeta.systemVersions) safeProviderMetadata.systemVersions = rawMeta.systemVersions;
      // Explicitly omit: serviceUrl, error (may contain URLs)
    }

    const response = {
      id: String(record._id),
      evaluationKey: record.evaluationKey,
      locationId: record.locationId,
      coordinates: { lat: record.lat, lon: record.lon },
      targetLeadTimeUtc: record.targetLeadTimeUtc,
      generatedAt: record.generatedAt,
      datasetVersion: record.datasetVersion,
      inputSource: record.inputSource,
      inputTimestamps: record.inputTimestampsUtc,
      prediction: {
        temperature: record.predictedTemperature,
        rainProbability: record.predictedRainProbability,
        rainClass: record.predictedRainClass,
        rainThreshold: record.rainThreshold,
      },
      evaluation: {
        status: record.evaluationStatus,
        attempts: record.evaluationAttempts,
        lastError: sanitizeText(record.lastEvaluationError),
      },
      failure: record.evaluationStatus === "failed_prediction"
        ? (() => {
            const derived = deriveFailureClassification(
              record.failureCode,
              record.failureStage,
              record.failureReason,
              record.httpStatusCode
            );
            return {
              code: derived.code,
              stage: derived.stage,
              reason: sanitizeText(record.failureReason),
              httpStatusCode: record.httpStatusCode ?? null,
              retryCount: record.retryCount ?? 0,
              inferenceLatencyMs: record.inferenceLatencyMs ?? null,
            };
          })()
        : null,
      inputFeatureAvailability: record.inputFeatureAvailability ?? null,
      providerMetadata: safeProviderMetadata,
      actualOutcome: record.actualOutcome ?? null,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error("[/api/weather/ml-shadow/diagnostics/[id]] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch prediction detail" },
      { status: 500 }
    );
  }
}

function sanitizeText(text: string | null | undefined): string | null {
  if (!text) return null;
  let sanitized = text.replace(/https?:\/\/[^\s"'`]+/gi, "[URL REDACTED]");
  sanitized = sanitized.replace(/([A-Za-z]:\\[^\s"'`]*|\/[^\s"'`]{10,})/g, "[PATH REDACTED]");
  sanitized = sanitized.replace(/\s+at\s+\S+\s*\([^)]*\)/g, "");
  if (sanitized.length > 500) sanitized = sanitized.slice(0, 497) + "...";
  return sanitized.trim() || null;
}

