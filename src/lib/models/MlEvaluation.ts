import { Schema, model, models, Model, Document } from "mongoose";

/**
 * Structured failure classification codes for ML inference pipeline.
 * Maps to specific failure stages for deterministic root-cause attribution.
 */
export type FailureCode =
  | "INPUT_VALIDATION_FAILED"    // Stage: input_validation — missing/invalid observations
  | "FEATURE_STALE"              // Stage: weather_data_collection — data older than MAX_STALENESS_HOURS
  | "FEATURE_MISSING"            // Stage: feature_engineering — null/NaN in required variable
  | "ML_SERVICE_TIMEOUT"         // Stage: ml_service_connection — AbortError / fetch timeout
  | "ML_SERVICE_UNAVAILABLE"     // Stage: ml_service_connection — ECONNREFUSED / network error
  | "ML_HTTP_ERROR"              // Stage: model_inference — HTTP 4xx/5xx from FastAPI
  | "INVALID_MODEL_OUTPUT"       // Stage: prediction_response_validation — NaN/null in response
  | "DB_WRITE_FAILED"            // Stage: database_persistence — Mongo write timeout/error
  | "UNKNOWN_ERROR";             // Stage: model_inference — catch-all

export type FailureStage =
  | "input_validation"
  | "weather_data_collection"
  | "feature_engineering"
  | "ml_service_connection"
  | "model_inference"
  | "prediction_response_validation"
  | "database_persistence";

/**
 * Per-variable feature availability at inference time.
 * Captured from the hourly observation payload before the ML service call.
 */
export interface InputFeatureAvailability {
  temperature_2m: boolean;
  relative_humidity_2m: boolean;
  dew_point_2m: boolean;
  precipitation: boolean;
  wind_speed_10m: boolean;
  wind_direction_10m: boolean;
  surface_pressure: boolean;
  cloud_cover: boolean;
  /** Total observation slots received (should be >= 3 for valid inference) */
  observationCount: number;
  /** Whether all 3 sequential observations have exactly 1-hour intervals */
  intervalsValid: boolean;
}

export interface IMlEvaluationRecord extends Document {
  evaluationKey: string; // Unique deterministic key: `${locationId}_obs_only_v1_${targetLeadTimeUtc.toISOString()}`
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
  generatedAt: Date;
  providerMetadata: Record<string, unknown>;
  failureStatus?: string; // "available" | "unavailable" | "stale_inputs"
  failureReason?: string;
  // ── Diagnostic fields (Phase 2 additions — optional, undefined on pre-existing records) ──
  failureCode?: FailureCode;
  failureStage?: FailureStage;
  inferenceLatencyMs?: number | null;
  retryCount?: number;
  httpStatusCode?: number | null;
  inputFeatureAvailability?: InputFeatureAvailability;
  // ─────────────────────────────────────────────────────────────────────────────────────────
  evaluationStatus: "pending" | "evaluating" | "evaluated" | "outcome_missing" | "incomplete_hourly" | "failed_prediction";
  evaluationLeaseUntil?: Date | null;
  evaluationAttempts: number;
  lastEvaluationError?: string | null;
  actualOutcome?: {
    verifiedAtUtc: Date;
    actualTemperature: number;
    actualPrecipitation: number;
    actualRainClass: boolean;
    temperatureAbsoluteError: number;
    temperatureError: number; // Signed error (pred - actual)
    temperatureSquaredError: number; // (pred - actual)^2
    rainCorrect: boolean;
    brierLoss: number;
    outcomeSource: string;
  };
}

const MlEvaluationSchema = new Schema<IMlEvaluationRecord>(
  {
    evaluationKey: { type: String, required: true, unique: true, index: true },
    locationId: { type: String, required: true, index: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    inputTimestampsUtc: { type: [Date], default: [] },
    inputSource: { type: String, required: true },
    datasetVersion: { type: String, default: "unknown" },
    predictedTemperature: { type: Number, default: null },
    predictedRainProbability: { type: Number, default: null },
    predictedRainClass: { type: Boolean, default: null },
    rainThreshold: { type: Number, required: true, default: 0.7425 },
    targetLeadTimeUtc: { type: Date, required: true, index: true },
    generatedAt: { type: Date, required: true, default: Date.now },
    providerMetadata: { type: Schema.Types.Mixed, default: {} },
    failureStatus: { type: String },
    failureReason: { type: String },
    // ── Diagnostic fields — optional, undefined on pre-existing records ──
    failureCode: { type: String },
    failureStage: { type: String },
    inferenceLatencyMs: { type: Number, default: null },
    retryCount: { type: Number },
    httpStatusCode: { type: Number, default: null },
    inputFeatureAvailability: {
      temperature_2m: { type: Boolean },
      relative_humidity_2m: { type: Boolean },
      dew_point_2m: { type: Boolean },
      precipitation: { type: Boolean },
      wind_speed_10m: { type: Boolean },
      wind_direction_10m: { type: Boolean },
      surface_pressure: { type: Boolean },
      cloud_cover: { type: Boolean },
      observationCount: { type: Number },
      intervalsValid: { type: Boolean },
    },
    // ────────────────────────────────────────────────────────────────────
    evaluationStatus: {
      type: String,
      enum: ["pending", "evaluating", "evaluated", "outcome_missing", "incomplete_hourly", "failed_prediction"],
      default: "pending",
      index: true,
    },
    evaluationLeaseUntil: { type: Date, default: null, index: true },
    evaluationAttempts: { type: Number, default: 0 },
    lastEvaluationError: { type: String, default: null },
    actualOutcome: {
      verifiedAtUtc: { type: Date },
      actualTemperature: { type: Number },
      actualPrecipitation: { type: Number },
      actualRainClass: { type: Boolean },
      temperatureAbsoluteError: { type: Number },
      temperatureError: { type: Number },
      temperatureSquaredError: { type: Number },
      rainCorrect: { type: Boolean },
      brierLoss: { type: Number },
      outcomeSource: { type: String },
    },
  },
  { collection: "ml_evaluations", timestamps: true }
);

// Compound indexes for fast, bounded time-range queries and lease recovery
MlEvaluationSchema.index({ targetLeadTimeUtc: -1, evaluationStatus: 1 });
MlEvaluationSchema.index({ locationId: 1, targetLeadTimeUtc: -1 });
MlEvaluationSchema.index({ evaluationStatus: 1, evaluationLeaseUntil: 1, targetLeadTimeUtc: 1 });
MlEvaluationSchema.index({ failureCode: 1, targetLeadTimeUtc: -1 });

export const MlEvaluation: Model<IMlEvaluationRecord> =
  models.MlEvaluation || model<IMlEvaluationRecord>("MlEvaluation", MlEvaluationSchema);

let indexesInitialized = false;

/**
 * Safely ensures production indexes on MlEvaluation are verified and created.
 * Uses a single-flight cache to prevent redundant index builds per Node process.
 * Never drops or rebuilds existing production collections or indexes.
 */
export async function ensureMlEvaluationIndexes(): Promise<void> {
  if (indexesInitialized) return;
  try {
    await MlEvaluation.createIndexes();
    indexesInitialized = true;
    console.info("[MlEvaluation] Production indexes verified successfully.");
  } catch (err) {
    console.warn("[MlEvaluation] Index synchronization check encountered an issue:", err);
  }
}

