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

