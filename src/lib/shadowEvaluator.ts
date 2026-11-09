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
 *
 * Rules:
 * - Group tied probability scores correctly so all instances with identical score
 *   are assigned to the positive class together at that threshold.
 * - Precision-recall points are computed threshold by threshold.
 * - If positive samples are fewer than 1 (or total items < 1), returns null (insufficient positive samples).
 * - If positive samples < 2 or total evaluated < 5, returns null (insufficient sample size).
 * - Curve starts at recall = 0 and precision of first evaluated point (or 1.0).
 * - Uses trapezoidal integration across monotonic recall steps.
 */
export function calculatePrAuc(items: { prob: number; actualBinary: number }[]): number | null {
  if (!items || items.length < 5) return null;
  const totalPositives = items.filter((x) => x.actualBinary === 1).length;
  if (totalPositives < 2 || totalPositives === items.length) return null;

  // Group items by distinct probability threshold in descending order to properly handle tied scores
  const sorted = [...items].sort((a, b) => b.prob - a.prob);

  // Collect distinct thresholds
  const distinctThresholds: number[] = [];
  for (const item of sorted) {
    if (distinctThresholds.length === 0 || distinctThresholds[distinctThresholds.length - 1] !== item.prob) {
      distinctThresholds.push(item.prob);
    }
  }

  // Calculate precision and recall points across distinct score thresholds
  const curvePoints: { recall: number; precision: number }[] = [{ recall: 0, precision: 1.0 }];

  let currentTp = 0;
  let currentFp = 0;
  let idx = 0;

  for (const thresh of distinctThresholds) {
    // Process all tied instances at this threshold together
    while (idx < sorted.length && sorted[idx].prob === thresh) {
      if (sorted[idx].actualBinary === 1) {
        currentTp++;
      } else {
        currentFp++;
      }
      idx++;
    }

    const recall = currentTp / totalPositives;
    const precision = currentTp / (currentTp + currentFp);
    curvePoints.push({ recall, precision });
  }

  // Trapezoidal integration across recall steps
  let auc = 0;
  for (let i = 1; i < curvePoints.length; i++) {
    const p1 = curvePoints[i - 1];
    const p2 = curvePoints[i];
    const dx = p2.recall - p1.recall;
    if (dx > 0) {
      const avgY = (p1.precision + p2.precision) / 2;
      auc += dx * avgY;
    }
  }

  return Math.max(0, Math.min(1, Math.round(auc * 10000) / 10000));
}

const LEASE_DURATION_MS = 60 * 1000; // 60 seconds lease
const MAX_EVALUATION_ATTEMPTS = 5;

/**
 * Idempotent, concurrency-safe evaluation workflow using atomic conditional claims and leases:
 * - Claims pending records or reclaims records with expired evaluation leases where attempts < MAX_EVALUATION_ATTEMPTS.
 * - Prevents two workers from evaluating the same record simultaneously via atomic findOneAndUpdate.
 * - Validates all required prediction values (predictedTemperature, predictedRainProbability, predictedRainClass)
 *   and never substitutes actual values, 0.0, or false.
 * - Invalid prediction records are marked as 'failed_prediction' with explicit failureReason.
 * - Applies a bounded retry policy with evaluationAttempts and visible failure states.
 * - Uses conditional update ({ _id, evaluationStatus: "evaluating" }) when saving results.
 */
export async function runShadowEvaluation(): Promise<{ evaluated: number; skipped: number; incomplete: number; failed: number }> {
  await connectToDatabase();

  const now = new Date();
  // Cutoff: allow 15m accumulation post target hour
  const cutoffTime = new Date(now.getTime() - 15 * 60 * 1000);

  let evaluated = 0;
  let skipped = 0;
  let incomplete = 0;
  let failed = 0;

  const maxBatch = 50;
  for (let i = 0; i < maxBatch; i++) {
    const claimTime = new Date();
    const leaseUntil = new Date(claimTime.getTime() + LEASE_DURATION_MS);

    // Atomically claim a pending record OR reclaim an expired-lease record
    const record = await MlEvaluation.findOneAndUpdate(
      {
        targetLeadTimeUtc: { $lte: cutoffTime },
        $or: [
          { evaluationStatus: "pending" },
          {
            evaluationStatus: "evaluating",
            evaluationLeaseUntil: { $lte: claimTime },
            evaluationAttempts: { $lt: MAX_EVALUATION_ATTEMPTS },
          },
        ],
      },
      {
        $set: {
          evaluationStatus: "evaluating",
          evaluationLeaseUntil: leaseUntil,
        },
        $inc: { evaluationAttempts: 1 },
      },
      { new: true }
    );

    if (!record) break; // No more records ready for evaluation

    // If max attempts reached on this claimed record, mark terminally failed
    if (record.evaluationAttempts > MAX_EVALUATION_ATTEMPTS) {
      await MlEvaluation.updateOne(
        { _id: record._id, evaluationStatus: "evaluating" },
        {
          $set: {
            evaluationStatus: "failed_prediction",
            failureReason: `Exceeded maximum evaluation attempts (${MAX_EVALUATION_ATTEMPTS})`,
            evaluationLeaseUntil: null,
          },
        }
      );
      failed++;
      continue;
    }

    try {
      // 1. Strict validation of prediction fields before evaluating metrics
      // NEVER substitute actual temperature, 0.0 prob, or false rain class.
      const hasValidTemp =
        record.predictedTemperature !== null &&
        record.predictedTemperature !== undefined &&
        Number.isFinite(record.predictedTemperature);

      const hasValidProb =
        record.predictedRainProbability !== null &&
        record.predictedRainProbability !== undefined &&
        Number.isFinite(record.predictedRainProbability) &&
        record.predictedRainProbability >= 0 &&
        record.predictedRainProbability <= 1;

      const hasValidRainClass =
        record.predictedRainClass !== null &&
        record.predictedRainClass !== undefined &&
        typeof record.predictedRainClass === "boolean";

      if (!hasValidTemp || !hasValidProb || !hasValidRainClass) {
        const reasons: string[] = [];
        if (!hasValidTemp) reasons.push("Missing or invalid predictedTemperature");
        if (!hasValidProb) reasons.push("Missing or invalid predictedRainProbability");
        if (!hasValidRainClass) reasons.push("Missing or invalid predictedRainClass");

        const explicitReason = reasons.join("; ");
        await MlEvaluation.updateOne(
          { _id: record._id, evaluationStatus: "evaluating" },
          {
            $set: {
              evaluationStatus: "failed_prediction",
              failureStatus: "invalid_prediction_values",
              failureReason: explicitReason,
              lastEvaluationError: explicitReason,
              evaluationLeaseUntil: null,
            },
          }
        );
        failed++;
        continue;
      }

      const targetIso = record.targetLeadTimeUtc.toISOString();
      const datePart = targetIso.slice(0, 10);

      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${record.lat}&longitude=${record.lon}` +
        `&hourly=temperature_2m,precipitation&start_date=${datePart}&end_date=${datePart}&timezone=UTC`;

      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        const errorMsg = `Open-Meteo API response status ${res.status}`;
        const willRetry = record.evaluationAttempts < MAX_EVALUATION_ATTEMPTS;
        await MlEvaluation.updateOne(
          { _id: record._id, evaluationStatus: "evaluating" },
          {
            $set: {
              evaluationStatus: willRetry ? "pending" : "failed_prediction",
              lastEvaluationError: errorMsg,
              failureReason: willRetry ? undefined : `Fetch failed after ${MAX_EVALUATION_ATTEMPTS} attempts: ${errorMsg}`,
              evaluationLeaseUntil: null,
            },
          }
        );
        if (willRetry) skipped++; else failed++;
        continue;
      }

      const data = await res.json();
      const hourly = data.hourly;
      if (!hourly || !Array.isArray(hourly.time)) {
        const errorMsg = "Missing or malformed hourly time array in Open-Meteo response";
        const willRetry = record.evaluationAttempts < MAX_EVALUATION_ATTEMPTS;
        await MlEvaluation.updateOne(
          { _id: record._id, evaluationStatus: "evaluating" },
          {
            $set: {
              evaluationStatus: willRetry ? "pending" : "failed_prediction",
              lastEvaluationError: errorMsg,
              failureReason: willRetry ? undefined : errorMsg,
              evaluationLeaseUntil: null,
            },
          }
        );
        if (willRetry) skipped++; else failed++;
        continue;
      }

      const targetHourPrefix = targetIso.slice(0, 13); // "YYYY-MM-DDTHH"
      const matchIdx = hourly.time.findIndex((t: string) => t.startsWith(targetHourPrefix));

      if (matchIdx === -1) {
        await MlEvaluation.updateOne(
          { _id: record._id, evaluationStatus: "evaluating" },
          {
            $set: {
              evaluationStatus: "outcome_missing",
              lastEvaluationError: `No matching hourly slot for prefix ${targetHourPrefix}`,
              evaluationLeaseUntil: null,
            },
          }
        );
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
        await MlEvaluation.updateOne(
          { _id: record._id, evaluationStatus: "evaluating" },
          {
            $set: {
              evaluationStatus: "incomplete_hourly",
              lastEvaluationError: "Hourly temperature or precipitation is missing or non-finite",
              evaluationLeaseUntil: null,
            },
          }
        );
        incomplete++;
        continue;
      }

      const actualRainClass = actualPrecip >= 0.1;
      const actualRainBinary = actualRainClass ? 1 : 0;

      // Genuine predictions verified without contamination
      const predTemp = record.predictedTemperature as number;
      const predProb = record.predictedRainProbability as number;
      const predRainClass = record.predictedRainClass as boolean;

      const tempError = predTemp - actualTemp;
      const tempAbsError = Math.abs(tempError);
      const tempSqError = Math.pow(tempError, 2);
      const rainCorrect = predRainClass === actualRainClass;
      const brierLoss = Math.pow(predProb - actualRainBinary, 2);

      // Conditional update to ensure the record is still owned by this lease
      const updateResult = await MlEvaluation.updateOne(
        { _id: record._id, evaluationStatus: "evaluating" },
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
            evaluationLeaseUntil: null,
            lastEvaluationError: null,
          },
        }
      );

      if (updateResult.modifiedCount > 0) {
        evaluated++;
      } else {
        // Record was modified or reclaimed by another process
        console.warn(`[shadowEvaluator] Lost lease or ownership for record ${record.evaluationKey}`);
        skipped++;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[shadowEvaluator] Error processing record ${record.evaluationKey}:`, errorMsg);
      const willRetry = record.evaluationAttempts < MAX_EVALUATION_ATTEMPTS;

      await MlEvaluation.updateOne(
        { _id: record._id, evaluationStatus: "evaluating" },
        {
          $set: {
            evaluationStatus: willRetry ? "pending" : "failed_prediction",
            lastEvaluationError: errorMsg,
            failureReason: willRetry ? undefined : `Failed after ${MAX_EVALUATION_ATTEMPTS} attempts: ${errorMsg}`,
            evaluationLeaseUntil: null,
          },
        }
      );
      if (willRetry) skipped++; else failed++;
    }
  }

  return { evaluated, skipped, incomplete, failed };
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

      // Classification metrics evaluated strictly from non-null predictedRainClass
      if (typeof r.predictedRainClass === "boolean") {
        const pred = r.predictedRainClass;
        const actual = r.actualOutcome.actualRainClass;

        if (pred && actual) tp++;
        else if (pred && !actual) fp++;
        else if (!pred && !actual) tn++;
        else if (!pred && actual) fn++;
      }

      // Raw continuous probability metric (PR-AUC) kept strictly separate from thresholded classification
      if (r.predictedRainProbability !== null && r.predictedRainProbability !== undefined && Number.isFinite(r.predictedRainProbability)) {
        prItems.push({
          prob: r.predictedRainProbability,
          actualBinary: r.actualOutcome.actualRainClass ? 1 : 0,
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
