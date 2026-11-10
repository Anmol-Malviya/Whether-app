/**
 * Derives a structured failure code and stage from existing failure fields
 * when explicit failureCode is not stored (e.g. on legacy records).
 */
export function deriveFailureClassification(
  storedCode?: string | null,
  storedStage?: string | null,
  failureReason?: string | null,
  httpStatus?: number | null
): { code: string; stage: string } {
  if (storedCode && storedCode !== "UNKNOWN_ERROR") {
    return {
      code: storedCode,
      stage: storedStage ?? "model_inference",
    };
  }

  const reason = (failureReason || "").toLowerCase();

  if (reason.includes("timed out") || reason.includes("timeout") || reason.includes("aborterror")) {
    return { code: "ML_SERVICE_TIMEOUT", stage: "ml_service_connection" };
  }

  if (
    reason.includes("fetch failed") ||
    reason.includes("econnrefused") ||
    reason.includes("unreachable") ||
    reason.includes("econnreset")
  ) {
    return { code: "ML_SERVICE_UNAVAILABLE", stage: "ml_service_connection" };
  }

  if (httpStatus === 422 || httpStatus === 400 || reason.includes("validation")) {
    return { code: "INPUT_VALIDATION_FAILED", stage: "input_validation" };
  }

  if (reason.includes("http 4") || reason.includes("http 5") || (httpStatus && httpStatus >= 400)) {
    return { code: "ML_HTTP_ERROR", stage: "model_inference" };
  }

  if (reason.includes("stale")) {
    return { code: "FEATURE_STALE", stage: "weather_data_collection" };
  }

  if (reason.includes("missing") || reason.includes("null") || reason.includes("nan")) {
    return { code: "FEATURE_MISSING", stage: "feature_engineering" };
  }

  if (reason.includes("database") || reason.includes("mongo") || reason.includes("persistence")) {
    return { code: "DB_WRITE_FAILED", stage: "database_persistence" };
  }

  return { code: "UNKNOWN_ERROR", stage: storedStage ?? "model_inference" };
}

