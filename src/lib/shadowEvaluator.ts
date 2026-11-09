import { connectToDatabase } from "@/lib/db";
import { MlEvaluation } from "@/lib/models/MlEvaluation";

export interface ShadowEvaluationMetrics {
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

const DISCLAIMER_NOTICE =
  "SHADOW MONITORING NOTICE: Model evaluations are performed against Open-Meteo operational hourly feeds (NWP ensemble assimilation), which are model-derived and not physical in-situ station observations. Rain probabilities are raw occurrence scores from XGBoost and not calibrated Bayesian risks.";

/**
 * Calculates Trapezoidal Area Under the Precision-Recall Curve (PR-AUC).
 * Returns null if positive samples are fewer than 2 or total evaluated < 5.
 */
function calculatePrAuc(items: { prob: number; actualBinary: number }[]): number | null {
  if (items.length < 5) return null;
  const totalPositives = items.filter((x) => x.actualBinary === 1).length;
  if (totalPositives < 2 || totalPositives === items.length) return null;

  // Sort descending by predicted probability
  const sorted = [...items].sort((a, b) => b.prob - a.prob);

  let currentTp = 0;
  let currentFp = 0;
  const curvePoints: { recall: number; precision: number }[] = [{ recall: 0, precision: 1.0 }];

  for (const item of sorted) {
    if (item.actualBinary === 1) currentTp++;
    else currentFp++;

    const recall = currentTp / totalPositives;
    const precision = currentTp / (currentTp + currentFp);
    curvePoints.push({ recall, precision });
  }

  // Trapezoidal integration
  let auc = 0;
  for (let i = 1; i < curvePoints.length; i++) {
    const p1 = curvePoints[i - 1];
    const p2 = curvePoints[i];
    const dx = p2.recall - p1.recall;
    const avgY = (p1.precision + p2.precision) / 2;
    auc += dx * avgY;
  }

  return Math.max(0, Math.min(1, Math.round(auc * 10000) / 10000));
}

/**
 * Idempotent, concurrency-safe evaluation workflow using atomic conditional updates:
 * - Selects pending records with targetLeadTimeUtc <= now - 15m.
 * - Transitions state atomically to 'evaluating' to lock against concurrent cron runs.
 * - Fetches recorded outcome from Open-Meteo.
 * - Computes signed error, squared error, absolute error, confusion matrix, and Brier loss.
 * - Transitions state to 'evaluated' or 'incomplete_hourly'/'outcome_missing'.
 */
export async function runShadowEvaluation(): Promise<{ evaluated: number; skipped: number; incomplete: number }> {
  await connectToDatabase();

  const now = new Date();
  // Cutoff: allow 15m accumulation post target hour
  const cutoffTime = new Date(now.getTime() - 15 * 60 * 1000);

  // Claim batch atomically using findOneAndUpdate to prevent race conditions across concurrent requests
  let evaluated = 0;
  let skipped = 0;
  let incomplete = 0;

  const maxBatch = 50;
  for (let i = 0; i < maxBatch; i++) {
    const record = await MlEvaluation.findOneAndUpdate(
      {
        evaluationStatus: "pending",
        targetLeadTimeUtc: { $lte: cutoffTime },
      },
      {
        $set: { evaluationStatus: "evaluating" },
      },
      { new: true }
    );

    if (!record) break; // No more pending records ready for evaluation

    try {
      const targetIso = record.targetLeadTimeUtc.toISOString();
      const datePart = targetIso.slice(0, 10);

      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${record.lat}&longitude=${record.lon}` +
        `&hourly=temperature_2m,precipitation&start_date=${datePart}&end_date=${datePart}&timezone=UTC`;

      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        // Revert lock to pending for next cycle
        await MlEvaluation.updateOne({ _id: record._id }, { $set: { evaluationStatus: "pending" } });
        skipped++;
        continue;
      }

      const data = await res.json();
      const hourly = data.hourly;
      if (!hourly || !Array.isArray(hourly.time)) {
        await MlEvaluation.updateOne({ _id: record._id }, { $set: { evaluationStatus: "pending" } });
        skipped++;
        continue;
      }

      const targetHourPrefix = targetIso.slice(0, 13); // "YYYY-MM-DDTHH"
      const matchIdx = hourly.time.findIndex((t: string) => t.startsWith(targetHourPrefix));

      if (matchIdx === -1) {
        await MlEvaluation.updateOne({ _id: record._id }, { $set: { evaluationStatus: "outcome_missing" } });
        skipped++;
        continue;
      }

      const actualTemp = hourly.temperature_2m?.[matchIdx];
      const actualPrecip = hourly.precipitation?.[matchIdx];

      // Incomplete outcome validation (never mark incomplete as evaluated)
      if (
        actualTemp === null || actualTemp === undefined || !Number.isFinite(actualTemp) ||
        actualPrecip === null || actualPrecip === undefined || !Number.isFinite(actualPrecip)
      ) {
        await MlEvaluation.updateOne({ _id: record._id }, { $set: { evaluationStatus: "incomplete_hourly" } });
        incomplete++;
        continue;
      }

      const actualRainClass = actualPrecip >= 0.1;
      const actualRainBinary = actualRainClass ? 1 : 0;

      const predTemp = record.predictedTemperature ?? actualTemp;
      const predProb = record.predictedRainProbability ?? 0.0;
      const predRainClass = record.predictedRainClass ?? false;

      const tempError = predTemp - actualTemp;
      const tempAbsError = Math.abs(tempError);
      const tempSqError = Math.pow(tempError, 2);
      const rainCorrect = predRainClass === actualRainClass;
      const brierLoss = Math.pow(predProb - actualRainBinary, 2);

      await MlEvaluation.updateOne(
        { _id: record._id },
        {
          $set: {
            actualOutcome: {
              verifiedAtUtc: new Date(),
              actualTemperature: Number(actualTemp),
              actualPrecipitation: Number(actualPrecip),
              actualRainClass,
              temperatureAbsoluteError: Math.round(tempAbsError * 100) / 100,
              temperatureError: Math.round(tempError * 100) / 100,
              temperatureSquaredError: Math.round(tempSqError * 1000) / 1000,
              rainCorrect,
              brierLoss: Math.round(brierLoss * 10000) / 10000,
              outcomeSource: "open-meteo-forecast-hourly (model-derived outcome)",
            },
            evaluationStatus: "evaluated",
          },
        }
      );
      evaluated++;
    } catch (err) {
      console.warn(`[shadowEvaluator] Error processing record ${record.evaluationKey}:`, err);
      // Revert lock so transient failures can be retried
      await MlEvaluation.updateOne({ _id: record._id }, { $set: { evaluationStatus: "pending" } });
      skipped++;
    }
  }

  return { evaluated, skipped, incomplete };
}

/**
 * Computes comprehensive statistical metrics filtered by targetLeadTimeUtc.
 */
export async function getShadowEvaluationMetrics(filterRange?: {
  fromUtc?: string | null;
  toUtc?: string | null;
  preset?: string;
}): Promise<ShadowEvaluationMetrics> {
  await connectToDatabase();

  const query: Record<string, unknown> = {};

  // Date filtering strictly on targetLeadTimeUtc
  if (filterRange?.fromUtc || filterRange?.toUtc) {
    query.targetLeadTimeUtc = {};
    if (filterRange.fromUtc) {
      (query.targetLeadTimeUtc as Record<string, unknown>).$gte = new Date(filterRange.fromUtc);
    }
    if (filterRange.toUtc) {
      (query.targetLeadTimeUtc as Record<string, unknown>).$lte = new Date(filterRange.toUtc);
    }
  }

  const [total, evaluatedCount, pendingCount, evaluatingCount, incompleteCount, missingCount, failedCount, staleCount] =
    await Promise.all([
      MlEvaluation.countDocuments(query),
      MlEvaluation.countDocuments({ ...query, evaluationStatus: "evaluated" }),
      MlEvaluation.countDocuments({ ...query, evaluationStatus: "pending" }),
      MlEvaluation.countDocuments({ ...query, evaluationStatus: "evaluating" }),
      MlEvaluation.countDocuments({ ...query, evaluationStatus: "incomplete_hourly" }),
      MlEvaluation.countDocuments({ ...query, evaluationStatus: "outcome_missing" }),
      MlEvaluation.countDocuments({ ...query, evaluationStatus: "failed_prediction" }),
      MlEvaluation.countDocuments({ ...query, failureStatus: "stale_inputs" }),
    ]);

  // Fetch evaluated records bounded to 5000 max for calculation safety
  const evaluatedRecords = await MlEvaluation.find({ ...query, evaluationStatus: "evaluated" })
    .select("predictedTemperature predictedRainProbability predictedRainClass actualOutcome rainThreshold")
    .limit(5000)
    .lean();

  let sumAbsError = 0;
  let sumSqError = 0;
  let sumSignedError = 0;
  let sumBrier = 0;
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  const prItems: { prob: number; actualBinary: number }[] = [];

  for (const r of evaluatedRecords) {
    if (r.actualOutcome) {
      sumAbsError += r.actualOutcome.temperatureAbsoluteError ?? 0;
      sumSqError += r.actualOutcome.temperatureSquaredError ?? Math.pow(r.actualOutcome.temperatureAbsoluteError ?? 0, 2);
      sumSignedError += r.actualOutcome.temperatureError ?? 0;
      sumBrier += r.actualOutcome.brierLoss ?? 0;

      const pred = r.predictedRainClass ?? false;
      const actual = r.actualOutcome.actualRainClass;

      if (pred && actual) tp++;
      else if (pred && !actual) fp++;
      else if (!pred && !actual) tn++;
      else if (!pred && actual) fn++;

      if (r.predictedRainProbability !== null && r.predictedRainProbability !== undefined) {
        prItems.push({
          prob: r.predictedRainProbability,
          actualBinary: actual ? 1 : 0,
        });
      }
    }
  }

  const n = evaluatedRecords.length;
  const temperatureMae = n > 0 ? Math.round((sumAbsError / n) * 100) / 100 : null;
  const temperatureRmse = n > 0 ? Math.round(Math.sqrt(sumSqError / n) * 100) / 100 : null;
  const temperatureBias = n > 0 ? Math.round((sumSignedError / n) * 100) / 100 : null;
  const brierScore = n > 0 ? Math.round((sumBrier / n) * 10000) / 10000 : null;

  const precision = tp + fp > 0 ? Math.round((tp / (tp + fp)) * 1000) / 1000 : null;
  const recall = tp + fn > 0 ? Math.round((tp / (tp + fn)) * 1000) / 1000 : null;
  const f1Score =
    precision && recall && precision + recall > 0
      ? Math.round(((2 * precision * recall) / (precision + recall)) * 1000) / 1000
      : null;
  const prAuc = calculatePrAuc(prItems);

  const evaluationCoveragePct = total > 0 ? Math.round((evaluatedCount / total) * 1000) / 10 : null;
  const staleInputRate = total > 0 ? Math.round((staleCount / total) * 1000) / 1000 : 0;
  const apiFailureRate = total > 0 ? Math.round((failedCount / total) * 1000) / 1000 : 0;

  return {
    timeRange: {
      preset: filterRange?.preset || "all",
      fromUtc: filterRange?.fromUtc || null,
      toUtc: filterRange?.toUtc || null,
    },
    sampleCounts: {
      totalPredictions: total,
      evaluatedCount,
      pendingCount,
      evaluatingCount,
      incompleteCount,
      missingCount,
      failedCount,
    },
    dataQuality: {
      evaluationCoveragePct,
      staleInputRate,
      apiFailureRate,
    },
    temperature: {
      sampleSize: n,
      mae: temperatureMae,
      rmse: temperatureRmse,
      meanBias: temperatureBias,
    },
    rain: {
      sampleSize: n,
      confusionMatrix: { tp, fp, tn, fn },
      precision,
      recall,
      f1Score,
      prAuc,
      brierScore,
      selectedThreshold: 0.7425,
    },
    metadata: {
      temperatureModelType: "XGBRegressor (obs_only)",
      rainModelType: "XGBClassifier (obs_only)",
      datasetVersion: "training_dataset.csv (32 feats)",
      inputSource: "open-meteo-forecast-hourly (interpolated NWP)",
      disclaimer: DISCLAIMER_NOTICE,
    },
  };
}

/**
 * Returns paginated prediction records bounded to page size <= 100.
 */
export async function getPaginatedHistory(options: {
  page?: number;
  limit?: number;
  status?: string;
  fromUtc?: string | null;
  toUtc?: string | null;
}) {
  await connectToDatabase();

  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};

  if (options.status && options.status !== "all") {
    query.evaluationStatus = options.status;
  }

  if (options.fromUtc || options.toUtc) {
    query.targetLeadTimeUtc = {};
    if (options.fromUtc) {
      (query.targetLeadTimeUtc as Record<string, unknown>).$gte = new Date(options.fromUtc);
    }
    if (options.toUtc) {
      (query.targetLeadTimeUtc as Record<string, unknown>).$lte = new Date(options.toUtc);
    }
  }

  const [totalRecords, records] = await Promise.all([
    MlEvaluation.countDocuments(query),
    MlEvaluation.find(query)
      .sort({ targetLeadTimeUtc: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return {
    records,
    pagination: {
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      hasMore: skip + records.length < totalRecords,
    },
  };
}
