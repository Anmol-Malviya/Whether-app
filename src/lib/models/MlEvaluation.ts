import { Schema, model, models, Model, Document } from "mongoose";

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

