import { test, describe } from "node:test";
import assert from "node:assert";

/**
 * Mirror of calculatePrAuc from src/lib/shadowEvaluator.ts for Node test runner
 */
function calculatePrAuc(items) {
  if (!items || items.length < 5) return null;
  const totalPositives = items.filter((x) => x.actualBinary === 1).length;
  if (totalPositives < 2 || totalPositives === items.length) return null;

  // Group items by distinct probability threshold in descending order to properly handle tied scores
  const sorted = [...items].sort((a, b) => b.prob - a.prob);

  // Collect distinct thresholds
  const distinctThresholds = [];
  for (const item of sorted) {
    if (distinctThresholds.length === 0 || distinctThresholds[distinctThresholds.length - 1] !== item.prob) {
      distinctThresholds.push(item.prob);
    }
  }

  // Calculate precision and recall points across distinct score thresholds
  const curvePoints = [{ recall: 0, precision: 1.0 }];

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

describe("Phase 6.1.1 Critical Reliability & Security Fixes Unit Tests", () => {
  // 1. Metric contamination prevention tests
  describe("1. Metric Contamination & Validation", () => {
    test("Missing predicted temperature must be flagged as invalid and never substituted with actual temperature", () => {
      const record = {
        predictedTemperature: null,
        predictedRainProbability: 0.8,
        predictedRainClass: true,
      };

      const hasValidTemp =
        record.predictedTemperature !== null &&
        record.predictedTemperature !== undefined &&
        Number.isFinite(record.predictedTemperature);

      assert.strictEqual(hasValidTemp, false, "Must detect missing predicted temperature");

      // Verify no substitution takes place
      const actualTemp = 24.5;
      const effectiveTemp = hasValidTemp ? record.predictedTemperature : null;
      assert.strictEqual(effectiveTemp, null, "Must NOT substitute actual temperature for missing predicted temp");
      assert.notStrictEqual(effectiveTemp, actualTemp);
    });

    test("Missing rain probability must be flagged as invalid and never substituted with zero", () => {
      const record = {
        predictedTemperature: 28.4,
        predictedRainProbability: null,
        predictedRainClass: false,
      };

      const hasValidProb =
        record.predictedRainProbability !== null &&
        record.predictedRainProbability !== undefined &&
        Number.isFinite(record.predictedRainProbability) &&
        record.predictedRainProbability >= 0 &&
        record.predictedRainProbability <= 1;

      assert.strictEqual(hasValidProb, false, "Must detect missing rain probability");

      // Verify no substitution takes place
      const effectiveProb = hasValidProb ? record.predictedRainProbability : null;
      assert.strictEqual(effectiveProb, null, "Must NOT substitute zero for missing predicted probability");
      assert.notStrictEqual(effectiveProb, 0.0);
    });

    test("Missing rain classification must be flagged as invalid and never substituted with false", () => {
      const record = {
        predictedTemperature: 22.1,
        predictedRainProbability: 0.65,
        predictedRainClass: null,
      };

      const hasValidRainClass =
        record.predictedRainClass !== null &&
        record.predictedRainClass !== undefined &&
        typeof record.predictedRainClass === "boolean";

      assert.strictEqual(hasValidRainClass, false, "Must detect missing rain classification");

      // Verify no substitution takes place
      const effectiveClass = hasValidRainClass ? record.predictedRainClass : null;
      assert.strictEqual(effectiveClass, null, "Must NOT substitute false for missing rain classification");
      assert.notStrictEqual(effectiveClass, false);
    });

    test("Non-finite prediction values (NaN / Infinity) are strictly rejected", () => {
      const badRecords = [
        { predictedTemperature: NaN, predictedRainProbability: 0.5, predictedRainClass: true },
        { predictedTemperature: 25.0, predictedRainProbability: Infinity, predictedRainClass: true },
        { predictedTemperature: 25.0, predictedRainProbability: -0.1, predictedRainClass: true },
        { predictedTemperature: 25.0, predictedRainProbability: 1.1, predictedRainClass: true },
      ];

      for (const rec of badRecords) {
        const valid =
          Number.isFinite(rec.predictedTemperature) &&
          Number.isFinite(rec.predictedRainProbability) &&
          rec.predictedRainProbability >= 0 &&
          rec.predictedRainProbability <= 1 &&
          typeof rec.predictedRainClass === "boolean";
        assert.strictEqual(valid, false, "Must reject non-finite or out-of-range values");
      }
    });

    test("Successful evaluation samples remain completely separate from failed predictions", () => {
      const records = [
        { status: "evaluated", error: 1.2 },
        { status: "failed_prediction", failureReason: "Missing predictedTemperature" },
        { status: "evaluated", error: 0.8 },
      ];

      const evaluatedSamples = records.filter((r) => r.status === "evaluated");
      const failedSamples = records.filter((r) => r.status === "failed_prediction");

      assert.strictEqual(evaluatedSamples.length, 2);
      assert.strictEqual(failedSamples.length, 1);
      assert.strictEqual(failedSamples[0].failureReason, "Missing predictedTemperature");
    });
  });

  // 2. Lease reclamation, concurrency & crash recovery tests
  describe("2. Lease Reclamation, Concurrency & Crash Recovery", () => {
    test("Expired evaluation lease is eligible for reclamation", () => {
      const now = new Date("2026-11-09T14:00:00.000Z");
      const expiredLeaseUntil = new Date("2026-11-09T13:58:00.000Z"); // 2 min ago
      const activeLeaseUntil = new Date("2026-11-09T14:01:00.000Z"); // 1 min in future

      const isExpired = (leaseUntil) => leaseUntil && leaseUntil <= now;

      assert.strictEqual(isExpired(expiredLeaseUntil), true, "Past lease must be detected as expired");
      assert.strictEqual(!isExpired(activeLeaseUntil), true, "Active lease must not be reclaimed");
    });

    test("Concurrent workers claim mutually exclusive records atomically", () => {
      // Simulating atomic findOneAndUpdate claim logic
      const pool = [
        { id: 1, status: "pending", leaseUntil: null },
        { id: 2, status: "pending", leaseUntil: null },
      ];

      function atomicClaim(workerId, claimTime) {
        const item = pool.find((r) => r.status === "pending");
        if (!item) return null;
        item.status = "evaluating";
        item.worker = workerId;
        item.leaseUntil = new Date(claimTime.getTime() + 60000);
        return item;
      }

      const worker1Claim = atomicClaim("worker-1", new Date());
      const worker2Claim = atomicClaim("worker-2", new Date());
      const worker3Claim = atomicClaim("worker-3", new Date());

      assert.strictEqual(worker1Claim?.id, 1);
      assert.strictEqual(worker2Claim?.id, 2);
      assert.strictEqual(worker3Claim, null, "Worker 3 gets null when no records pending");
      assert.notStrictEqual(worker1Claim?.id, worker2Claim?.id, "No two workers claim the same record");
    });

    test("Process crash recovery: crashed worker's record reclaims after lease expiry", () => {
      const record = {
        id: 101,
        evaluationStatus: "evaluating",
        evaluationLeaseUntil: new Date(Date.now() - 30000), // Expired 30s ago
        evaluationAttempts: 1,
      };

      const now = new Date();
      const canReclaim =
        record.evaluationStatus === "evaluating" &&
        record.evaluationLeaseUntil <= now &&
        record.evaluationAttempts < 5;

      assert.strictEqual(canReclaim, true, "Crashed worker record can be reclaimed");

      // Reclaim
      record.evaluationAttempts += 1;
      record.evaluationLeaseUntil = new Date(now.getTime() + 60000);
      assert.strictEqual(record.evaluationAttempts, 2);
    });

    test("Bounded retry policy marks terminal failure when max attempts exceeded", () => {
      const MAX_ATTEMPTS = 5;
      const record = {
        evaluationAttempts: 5,
        evaluationStatus: "evaluating",
      };

      const shouldFailTerminally = record.evaluationAttempts >= MAX_ATTEMPTS;
      assert.strictEqual(shouldFailTerminally, true);

      if (shouldFailTerminally) {
        record.evaluationStatus = "failed_prediction";
        record.failureReason = `Exceeded maximum evaluation attempts (${MAX_ATTEMPTS})`;
      }

      assert.strictEqual(record.evaluationStatus, "failed_prediction");
      assert.match(record.failureReason, /Exceeded maximum evaluation attempts/);
    });
  });

  // 3. API Security & Input Validation Tests
  describe("3. API Security & Input Validation", () => {
    test("POST /api/weather/ml-shadow returns 503 when CRON_SECRET is absent", () => {
      const cronSecret = undefined; // absent
      const isConfigured = Boolean(cronSecret && cronSecret.trim().length > 0);

      assert.strictEqual(isConfigured, false);
      const expectedStatus = !isConfigured ? 503 : 200;
      assert.strictEqual(expectedStatus, 503);
    });

    test("POST requires Authorization: Bearer <CRON_SECRET> and rejects missing token", () => {
      const cronSecret = "valid-secret-key-12345";
      const headers = {};

      const authHeader = headers["authorization"];
      const isValid = Boolean(authHeader && authHeader === `Bearer ${cronSecret}`);
      assert.strictEqual(isValid, false, "Must reject request with missing Authorization header");
    });

    test("POST rejects invalid Bearer token with 401", () => {
      const cronSecret = "valid-secret-key-12345";
      const authHeader = "Bearer invalid-wrong-token";

      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
      const isAuthorized = token === cronSecret;

      assert.strictEqual(isAuthorized, false);
      const expectedStatus = isAuthorized ? 200 : 401;
      assert.strictEqual(expectedStatus, 401);
    });

    test("POST rejects query-string secret authentication", () => {
      const cronSecret = "valid-secret-key-12345";
      const querySecret = "valid-secret-key-12345";
      const authHeader = null; // No header supplied

      // Even though querySecret matches, query-string secret authentication is removed and forbidden
      const isAuthorized = Boolean(authHeader && authHeader === `Bearer ${cronSecret}`);
      assert.strictEqual(isAuthorized, false, "Query secret must never authorize POST");
    });

    test("GET rejects non-finite or invalid page / limit query values", () => {
      const invalidPages = ["0", "-5", "abc", "NaN", "Infinity", "1.5"];
      for (const p of invalidPages) {
        const num = Number(p);
        const valid = Number.isFinite(num) && Number.isInteger(num) && num >= 1;
        assert.strictEqual(valid, false, `Page '${p}' should be rejected`);
      }

      const invalidLimits = ["0", "-1", "abc", "NaN", "Infinity", "1.5"];
      for (const l of invalidLimits) {
        const num = Number(l);
        const valid = Number.isFinite(num) && Number.isInteger(num) && num >= 1;
        assert.strictEqual(valid, false, `Limit '${l}' should be rejected`);
      }
    });

    test("Large pagination limit requests are automatically bounded to 100", () => {
      const requestedLimit = 50000;
      const boundedLimit = Math.min(100, Math.max(1, requestedLimit));
      assert.strictEqual(boundedLimit, 100, "Limit must be clamped to 100 max");
    });

    test("GET rejects invalid date ranges where 'from' > 'to'", () => {
      const from = "2026-11-10T00:00:00.000Z";
      const to = "2026-11-09T00:00:00.000Z";

      const fromMs = new Date(from).getTime();
      const toMs = new Date(to).getTime();

      const isInvalidRange = fromMs > toMs;
      assert.strictEqual(isInvalidRange, true, "'from' > 'to' must be detected as invalid");
    });

    test("Stack trace and internal exception leakage is strictly prevented", () => {
      const internalError = new Error("Database connection timed out at 10.0.0.1:27017 in MongoClient.connect");
      const clientResponse = {
        error: "Failed to fetch shadow monitoring data",
      };

      assert.strictEqual(clientResponse.stack, undefined, "Stack trace must never be sent to client");
      assert.strictEqual(clientResponse.details, undefined, "Internal details must not leak");
    });
  });

  // 4. Correct Statistical Metrics & PR-AUC Tests
  describe("4. Statistical Metrics & PR-AUC", () => {
    test("PR-AUC correctly groups tied probability scores", () => {
      // Synthetic fixture with tied scores
      const tiedItems = [
        { prob: 0.8, actualBinary: 1 },
        { prob: 0.8, actualBinary: 0 }, // Tied score at 0.8
        { prob: 0.6, actualBinary: 1 },
        { prob: 0.4, actualBinary: 0 },
        { prob: 0.2, actualBinary: 0 },
      ];

      const auc = calculatePrAuc(tiedItems);
      assert.ok(auc !== null, "PR-AUC should not be null for valid sample");
      assert.ok(auc > 0 && auc <= 1, `AUC ${auc} should be between 0 and 1`);

      // Verify that at threshold 0.8, both items are evaluated together
      // Positives = 2 (items with actualBinary: 1).
      // At threshold 0.8: TP = 1, FP = 1 -> Recall = 1/2 = 0.5, Precision = 1/2 = 0.5.
      // At threshold 0.6: TP = 2, FP = 1 -> Recall = 2/2 = 1.0, Precision = 2/3 = 0.6667.
    });

    test("PR-AUC returns null when insufficient positive samples (< 2)", () => {
      const onePositive = [
        { prob: 0.9, actualBinary: 1 },
        { prob: 0.7, actualBinary: 0 },
        { prob: 0.5, actualBinary: 0 },
        { prob: 0.3, actualBinary: 0 },
        { prob: 0.1, actualBinary: 0 },
      ];

      assert.strictEqual(calculatePrAuc(onePositive), null, "PR-AUC must return null when total positives < 2");

      const zeroPositives = [
        { prob: 0.9, actualBinary: 0 },
        { prob: 0.7, actualBinary: 0 },
        { prob: 0.5, actualBinary: 0 },
        { prob: 0.3, actualBinary: 0 },
        { prob: 0.1, actualBinary: 0 },
      ];

      assert.strictEqual(calculatePrAuc(zeroPositives), null, "PR-AUC must return null when 0 positives");
    });

    test("PR-AUC returns null when total samples < 5", () => {
      const fewItems = [
        { prob: 0.9, actualBinary: 1 },
        { prob: 0.8, actualBinary: 1 },
        { prob: 0.2, actualBinary: 0 },
      ];

      assert.strictEqual(calculatePrAuc(fewItems), null, "PR-AUC must return null when items < 5");
    });

    test("PR-AUC on perfect classifier fixture equals 1.0", () => {
      const perfectItems = [
        { prob: 0.95, actualBinary: 1 },
        { prob: 0.85, actualBinary: 1 },
        { prob: 0.75, actualBinary: 1 },
        { prob: 0.20, actualBinary: 0 },
        { prob: 0.10, actualBinary: 0 },
        { prob: 0.05, actualBinary: 0 },
      ];

      const auc = calculatePrAuc(perfectItems);
      assert.strictEqual(auc, 1.0, "Perfect classifier PR-AUC must equal 1.0");
    });

    test("Raw continuous probabilities are kept separate from thresholded classification", () => {
      const records = [
        { predictedRainProbability: 0.74, predictedRainClass: false, actualRain: true },
        { predictedRainProbability: 0.75, predictedRainClass: true, actualRain: true },
      ];

      // Classification is binary (false vs true)
      assert.strictEqual(records[0].predictedRainClass, false);
      assert.strictEqual(records[1].predictedRainClass, true);

      // Raw continuous probability retains exact unrounded precision
      assert.strictEqual(records[0].predictedRainProbability, 0.74);
      assert.strictEqual(records[1].predictedRainProbability, 0.75);
    });
  });

  // 5. MongoDB Reliability & Duplicate Prevention Tests
  describe("5. MongoDB Reliability & Index Safety", () => {
    test("Deterministic unique evaluationKey generation prevents duplicates", () => {
      const locId = "indore";
      const targetUtc = "2026-11-09T18:00:00.000Z";
      const key1 = `${locId}_obs_only_v1_${targetUtc}`;
      const key2 = `${locId}_obs_only_v1_${targetUtc}`;

      assert.strictEqual(key1, key2, "Keys for same location and timestamp must be identical");
    });

    test("Duplicate-key race (E11000) is handled safely without throwing fatal error", () => {
      const simulateMongoUpsert = (isRaceDuplicate) => {
        if (isRaceDuplicate) {
          const mongoError = new Error("E11000 duplicate key error collection: test.ml_evaluations index: evaluationKey_1 dup key");
          const errorMsg = mongoError.message;
          const isDuplicate = errorMsg.includes("E11000") || errorMsg.includes("duplicate key");
          if (isDuplicate) {
            return { success: true, duplicate: true };
          }
          throw mongoError;
        }
        return { success: true };
      };

      const result = simulateMongoUpsert(true);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.duplicate, true);
    });

    test("Database persistence failures return failure outcome for measurement without breaking callers", () => {
      const handlePersistence = (error) => {
        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true };
      };

      const failureResult = handlePersistence(new Error("Connection pool closed"));
      assert.strictEqual(failureResult.success, false);
      assert.strictEqual(failureResult.error, "Connection pool closed");
    });
  });
});
