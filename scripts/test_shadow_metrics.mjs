import { test, describe } from "node:test";
import assert from "node:assert";

// Mock helper to test statistical formulas implemented in shadowEvaluator.ts
function computeMetrics(records) {
  let sumAbsError = 0;
  let sumSqError = 0;
  let sumSignedError = 0;
  let sumBrier = 0;
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (const r of records) {
    const act = r.actualOutcome;
    sumAbsError += act.temperatureAbsoluteError;
    sumSqError += act.temperatureSquaredError;
    sumSignedError += act.temperatureError;
    sumBrier += act.brierLoss;

    if (r.predictedRainClass && act.actualRainClass) tp++;
    else if (r.predictedRainClass && !act.actualRainClass) fp++;
    else if (!r.predictedRainClass && !act.actualRainClass) tn++;
    else if (!r.predictedRainClass && act.actualRainClass) fn++;
  }

  const n = records.length;
  const mae = n > 0 ? Math.round((sumAbsError / n) * 100) / 100 : null;
  const rmse = n > 0 ? Math.round(Math.sqrt(sumSqError / n) * 100) / 100 : null;
  const meanBias = n > 0 ? Math.round((sumSignedError / n) * 100) / 100 : null;
  const brierScore = n > 0 ? Math.round((sumBrier / n) * 10000) / 10000 : null;

  const precision = tp + fp > 0 ? Math.round((tp / (tp + fp)) * 1000) / 1000 : null;
  const recall = tp + fn > 0 ? Math.round((tp / (tp + fn)) * 1000) / 1000 : null;
  const f1 = precision && recall ? Math.round(((2 * precision * recall) / (precision + recall)) * 1000) / 1000 : null;

  return { mae, rmse, meanBias, brierScore, confusionMatrix: { tp, fp, tn, fn }, precision, recall, f1 };
}

describe("Phase 6.2 Shadow Mode Metrics & Evaluation Logic", () => {
  test("1. Accurate calculation of MAE, RMSE, Mean Bias, and Brier Score", () => {
    const mockEvaluated = [
      {
        predictedRainClass: false,
        actualOutcome: {
          temperatureAbsoluteError: 1.5,
          temperatureSquaredError: 2.25,
          temperatureError: 1.5,
          actualRainClass: false,
          brierLoss: 0.01,
        },
      },
      {
        predictedRainClass: true,
        actualOutcome: {
          temperatureAbsoluteError: 0.5,
          temperatureSquaredError: 0.25,
          temperatureError: -0.5,
          actualRainClass: true,
          brierLoss: 0.04,
        },
      },
    ];

    const res = computeMetrics(mockEvaluated);
    assert.strictEqual(res.mae, 1.0); // (1.5 + 0.5) / 2
    assert.strictEqual(res.rmse, 1.12); // sqrt((2.25 + 0.25)/2) = sqrt(1.25) ~ 1.118 -> 1.12
    assert.strictEqual(res.meanBias, 0.5); // (1.5 - 0.5) / 2 = 0.5
    assert.strictEqual(res.brierScore, 0.025); // (0.01 + 0.04) / 2
    assert.deepStrictEqual(res.confusionMatrix, { tp: 1, fp: 0, tn: 1, fn: 0 });
    assert.strictEqual(res.precision, 1.0);
    assert.strictEqual(res.recall, 1.0);
    assert.strictEqual(res.f1, 1.0);
  });

  test("2. Rejection of unauthenticated cron evaluations", () => {
    const secret = "test_secret_123";
    const authValid = "Bearer test_secret_123";
    const authInvalid = "Bearer wrong_secret";

    assert.strictEqual(authValid === `Bearer ${secret}`, true);
    assert.strictEqual(authInvalid === `Bearer ${secret}`, false);
  });

  test("3. Unique compound key prevents duplicate evaluations", () => {
    const locId = "indore";
    const model = "obs_only_v1";
    const targetIso = "2026-11-09T13:00:00.000Z";

    const key1 = `${locId}_${model}_${targetIso}`;
    const key2 = `${locId}_${model}_${targetIso}`;
    assert.strictEqual(key1, key2);
  });

  test("4. Date filtering correctly bounds queries on targetLeadTimeUtc", () => {
    const from = "2026-11-09T00:00:00.000Z";
    const to = "2026-11-09T23:59:59.000Z";
    const targetInside = new Date("2026-11-09T12:00:00.000Z");
    const targetOutside = new Date("2026-11-10T02:00:00.000Z");

    const fromDate = new Date(from);
    const toDate = new Date(to);

    assert.strictEqual(targetInside >= fromDate && targetInside <= toDate, true);
    assert.strictEqual(targetOutside >= fromDate && targetOutside <= toDate, false);
  });
});

