export interface ShadowMetrics {
  timeRange: {
    preset: string;
    fromUtc: string | null;
    toUtc: string | null;
  };
  sampleCounts: {
    totalPredictions: number;
    evaluatedCount: number;
    pendingCount: number;
    evaluatingCount: number;
    incompleteCount: number;
    missingCount: number;
    failedCount: number;
  };
  dataQuality: {
    evaluationCoveragePct: number | null;
    staleInputRate: number;
    apiFailureRate: number;
  };
  temperature: {
    sampleSize: number;
    mae: number | null;
    rmse: number | null;
    meanBias: number | null;
  };
  rain: {
    sampleSize: number;
    confusionMatrix: {
      tp: number;
      fp: number;
      tn: number;
      fn: number;
    };
    precision: number | null;
    recall: number | null;
    f1Score: number | null;
    prAuc: number | null;
    brierScore: number | null;
    selectedThreshold: number;
  };
  metadata: {
    temperatureModelType: string;
    rainModelType: string;
    datasetVersion: string;
    inputSource: string;
    disclaimer: string;
  };
}

export interface ShadowRecord {
  _id: string;
  evaluationKey: string;
  locationId: string;
  targetLeadTimeUtc: string;
  generatedAt: string;
  predictedTemperature: number | null;
  predictedRainProbability: number | null;
  predictedRainClass: boolean | null;
  rainThreshold: number;
  evaluationStatus: string;
  failureStatus?: string;
  failureReason?: string;
  // ── Diagnostic fields ──────────────────────────────────────────────────
  failureCode?: string;
  failureStage?: string;
  inferenceLatencyMs?: number | null;
  retryCount?: number;
  httpStatusCode?: number | null;
  inputFeatureAvailability?: InputFeatureAvailability;
  // ───────────────────────────────────────────────────────────────────────
  actualOutcome?: {
    verifiedAtUtc: string;
    actualTemperature: number;
    actualPrecipitation: number;
    actualRainClass: boolean;
    temperatureAbsoluteError: number;
    rainCorrect: boolean;
    brierLoss: number;
    outcomeSource: string;
  };
}

export interface HistoryPagination {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
  hasMore: boolean;
}

// ── Diagnostics types ────────────────────────────────────────────────────────

export interface InputFeatureAvailability {
  temperature_2m: boolean;
  relative_humidity_2m: boolean;
  dew_point_2m: boolean;
  precipitation: boolean;
  wind_speed_10m: boolean;
  wind_direction_10m: boolean;
  surface_pressure: boolean;
  cloud_cover: boolean;
  observationCount: number;
  intervalsValid: boolean;
}

export interface InferenceHealthMetrics {
  totalRequests: number;
  successfulPredictions: number;
  failedPredictions: number;
  successRate: number | null;
  failureRate: number | null;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
}

export interface FailureDistributionEntry {
  code: string;
  count: number;
  percentage: number;
}

export interface FailureRecord {
  id: string;
  targetLeadTimeUtc: string;
  generatedAt: string;
  failureCode: string;
  failureStage: string | null;
  failureReason: string | null;
  retryCount: number;
  httpStatusCode: number | null;
  inferenceLatencyMs: number | null;
  inputFeatureAvailability: InputFeatureAvailability | null;
  datasetVersion: string | null;
  evaluationAttempts: number;
}

export interface DiagnosticsData {
  range: string;
  inferenceHealth: InferenceHealthMetrics;
  failureDistribution: FailureDistributionEntry[];
  recentFailures: FailureRecord[];
}

// ── Service health types ─────────────────────────────────────────────────────

export type ServiceStatus = "healthy" | "degraded" | "unavailable" | "unknown";

export interface ServiceCheck {
  status: ServiceStatus;
  responseTimeMs: number | null;
  detail: string;
  modelReady?: boolean;
  featureCount?: number;
}

export interface ServiceHealthData {
  checkedAt: string;
  overallStatus: ServiceStatus;
  services: {
    mlService: ServiceCheck;
    database: ServiceCheck;
    weatherProvider: ServiceCheck;
  };
}

// ── Prediction detail types ─────────────────────────────────────────────────

export interface PredictionDetail {
  id: string;
  evaluationKey: string;
  locationId: string;
  coordinates: { lat: number; lon: number };
  targetLeadTimeUtc: string;
  generatedAt: string;
  datasetVersion: string | null;
  inputSource: string;
  inputTimestamps: string[];
  prediction: {
    temperature: number | null;
    rainProbability: number | null;
    rainClass: boolean | null;
    rainThreshold: number;
  };
  evaluation: {
    status: string;
    attempts: number;
    lastError: string | null;
  };
  failure: {
    code: string;
    stage: string | null;
    reason: string | null;
    httpStatusCode: number | null;
    retryCount: number;
    inferenceLatencyMs: number | null;
  } | null;
  inputFeatureAvailability: InputFeatureAvailability | null;
  providerMetadata: Record<string, unknown>;
  actualOutcome: ShadowRecord["actualOutcome"] | null;
}


