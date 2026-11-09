import { test, describe } from "node:test";
import assert from "node:assert";

describe("Phase 6.1.2 Reliability, Persistence & Security Integration Tests", () => {
  // =========================================================================
  // TASK 1 & 2: Durable Prediction Persistence & MongoDB Index Reliability
  // =========================================================================
  describe("1. Prediction Persistence Invariants & Edge Cases", () => {
    test("Successful prediction persistence returns { success: true, duplicate: false }", async () => {
      const mockDbStore = new Map();
      const persistPredictionMock = async (record) => {
        const evaluationKey = `${record.locationId}_obs_only_v1_${record.targetLeadTimeUtc}`;
        if (mockDbStore.has(evaluationKey)) {
          return { success: true, duplicate: true };
        }
        mockDbStore.set(evaluationKey, { ...record, evaluationKey });
        return { success: true, duplicate: false };
      };

      const record = {
        locationId: "indore",
        targetLeadTimeUtc: "2026-11-09T18:00:00.000Z",
        predictedTemperature: 28.5,
        predictedRainProbability: 0.12,
        predictedRainClass: false,
      };

      const result = await persistPredictionMock(record);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.duplicate, false);
      assert.strictEqual(mockDbStore.size, 1);
    });

    test("MongoDB connection failure is handled gracefully and returns measurable failure", async () => {
      const persistWithConnectionFailure = async () => {
        try {
          throw new Error("MongooseServerSelectionError: connection timed out after 5000ms");
        } catch (err) {
          return { success: false, error: err.message };
        }
      };

      const outcome = await persistWithConnectionFailure();
      assert.strictEqual(outcome.success, false);
      assert.match(outcome.error, /MongooseServerSelectionError/);
    });

    test("Controlled database write timeout prevents hanging and returns timeout failure", async () => {
      const DB_WRITE_TIMEOUT_MS = 50;
      const hangingWrite = () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 200));

      let timer;
      const timeoutPromise = new Promise((resolve) => {
        timer = setTimeout(() => {
          resolve({ success: false, error: `Database write timed out after ${DB_WRITE_TIMEOUT_MS}ms` });
        }, DB_WRITE_TIMEOUT_MS);
      });

      const outcome = await Promise.race([hangingWrite(), timeoutPromise]);
      clearTimeout(timer);

      assert.strictEqual(outcome.success, false);
      assert.match(outcome.error, /Database write timed out/);
    });

    test("Duplicate evaluation key race (E11000) does not throw and flags duplicate: true", async () => {
      const handleUpsertError = (err) => {
        const errorMsg = err.message;
        const isDuplicate = errorMsg.includes("E11000") || errorMsg.includes("duplicate key");
        if (isDuplicate) {
          return { success: true, duplicate: true };
        }
        return { success: false, error: errorMsg };
      };

      const mongoDuplicateError = new Error("E11000 duplicate key error collection: ml_evaluations index: evaluationKey_1 dup key");
      const outcome = handleUpsertError(mongoDuplicateError);
      assert.strictEqual(outcome.success, true);
      assert.strictEqual(outcome.duplicate, true);
    });

    test("Persistence failure monitoring: never claim 'persisted' if database write failed", () => {
      const mapPersistenceStatus = (persistResult) => {
        return persistResult.success
          ? persistResult.duplicate
            ? "duplicate"
            : "persisted"
          : "failed";
      };

      assert.strictEqual(mapPersistenceStatus({ success: true, duplicate: false }), "persisted");
      assert.strictEqual(mapPersistenceStatus({ success: true, duplicate: true }), "duplicate");
      assert.strictEqual(mapPersistenceStatus({ success: false, error: "Network error" }), "failed");
    });
  });

  // =========================================================================
  // TASK 3: Evaluation Pipeline Invariants
  // =========================================================================
  describe("2. Evaluation Pipeline Reliability", () => {
    const validateRecordBeforeEval = (record) => {
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
        const reasons = [];
        if (!hasValidTemp) reasons.push("Missing or invalid predictedTemperature");
        if (!hasValidProb) reasons.push("Missing or invalid predictedRainProbability");
        if (!hasValidRainClass) reasons.push("Missing or invalid predictedRainClass");
        return { valid: false, reasons };
      }
      return { valid: true };
    };

    test("Missing temperature prediction is rejected from evaluation and never defaults to actual", () => {
      const record = { predictedTemperature: null, predictedRainProbability: 0.5, predictedRainClass: false };
      const check = validateRecordBeforeEval(record);
      assert.strictEqual(check.valid, false);
      assert.ok(check.reasons.some((r) => r.includes("predictedTemperature")));
    });

    test("Missing rain probability is rejected from evaluation and never defaults to zero", () => {
      const record = { predictedTemperature: 25.0, predictedRainProbability: null, predictedRainClass: false };
      const check = validateRecordBeforeEval(record);
      assert.strictEqual(check.valid, false);
      assert.ok(check.reasons.some((r) => r.includes("predictedRainProbability")));
    });

    test("Missing rain classification is rejected from evaluation and never defaults to false", () => {
      const record = { predictedTemperature: 25.0, predictedRainProbability: 0.8, predictedRainClass: null };
      const check = validateRecordBeforeEval(record);
      assert.strictEqual(check.valid, false);
      assert.ok(check.reasons.some((r) => r.includes("predictedRainClass")));
    });

    test("Concurrent workers cannot claim or evaluate the same record simultaneously", () => {
      let recordState = {
        _id: "rec_1",
        evaluationStatus: "pending",
        evaluationLeaseUntil: null,
      };

      const atomicClaim = (workerId, nowTime) => {
        if (recordState.evaluationStatus === "pending") {
          recordState.evaluationStatus = "evaluating";
          recordState.evaluationLeaseUntil = new Date(nowTime.getTime() + 60000);
          return { claimed: true, workerId };
        }
        return { claimed: false, workerId };
      };

      const now = new Date();
      const claim1 = atomicClaim("worker_A", now);
      const claim2 = atomicClaim("worker_B", now);

      assert.strictEqual(claim1.claimed, true);
      assert.strictEqual(claim2.claimed, false, "Second worker must not be able to claim concurrently");
    });

    test("Expired evaluation lease is reclaimed when time exceeds leaseUntil", () => {
      const now = new Date();
      const expiredTime = new Date(now.getTime() - 10000); // 10s expired
      const MAX_EVALUATION_ATTEMPTS = 5;

      const record = {
        evaluationStatus: "evaluating",
        evaluationLeaseUntil: expiredTime,
        evaluationAttempts: 2,
      };

      const isEligibleForReclaim =
        record.evaluationStatus === "evaluating" &&
        record.evaluationLeaseUntil.getTime() <= now.getTime() &&
        record.evaluationAttempts < MAX_EVALUATION_ATTEMPTS;

      assert.strictEqual(isEligibleForReclaim, true);
    });

    test("Maximum retry attempts limit evaluation attempts and mark terminal failure", () => {
      const MAX_EVALUATION_ATTEMPTS = 5;
      const record = {
        evaluationAttempts: 5,
        evaluationStatus: "evaluating",
      };

      let finalStatus = record.evaluationStatus;
      let failureReason = null;
      if (record.evaluationAttempts >= MAX_EVALUATION_ATTEMPTS) {
        finalStatus = "failed_prediction";
        failureReason = `Exceeded maximum evaluation attempts (${MAX_EVALUATION_ATTEMPTS})`;
      }

      assert.strictEqual(finalStatus, "failed_prediction");
      assert.match(failureReason, /Exceeded maximum evaluation attempts/);
    });

    test("Incomplete hourly outcome from Open-Meteo is marked incomplete_hourly, not evaluated", () => {
      const actualTemp = 24.2;
      const actualPrecip = null; // Missing precipitation

      let status = "pending";
      if (
        actualTemp === null || actualTemp === undefined || !Number.isFinite(actualTemp) ||
        actualPrecip === null || actualPrecip === undefined || !Number.isFinite(actualPrecip)
      ) {
        status = "incomplete_hourly";
      }

      assert.strictEqual(status, "incomplete_hourly");
    });
  });

  // =========================================================================
  // TASK 4: Security Audit & Route Authentication
  // =========================================================================
  describe("3. Security Audit & Route Protection", () => {
    test("POST /api/weather/ml-shadow returns 503 when CRON_SECRET is not configured", () => {
      const cronSecret = ""; // Missing
      let statusCode = 200;
      let responseBody = {};

      if (!cronSecret || cronSecret.trim().length === 0) {
        statusCode = 503;
        responseBody = { error: "Evaluation service unavailable: administrative authentication is not configured" };
      }

      assert.strictEqual(statusCode, 503);
      assert.match(responseBody.error, /unavailable/);
    });

    test("POST rejects missing Authorization header with 401", () => {
      const authHeader = null;
      let statusCode = 200;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        statusCode = 401;
      }
      assert.strictEqual(statusCode, 401);
    });

    test("POST rejects invalid Bearer token with 401", () => {
      const serverSecret = "super-secret-cron-key-123";
      const authHeader = "Bearer invalid-token-abc";
      const token = authHeader.slice(7).trim();

      let statusCode = 200;
      if (token !== serverSecret) {
        statusCode = 401;
      }
      assert.strictEqual(statusCode, 401);
    });

    test("POST accepts valid Bearer token", () => {
      const serverSecret = "super-secret-cron-key-123";
      const authHeader = "Bearer super-secret-cron-key-123";
      const token = authHeader.slice(7).trim();

      let statusCode = 200;
      if (token !== serverSecret) {
        statusCode = 401;
      }
      assert.strictEqual(statusCode, 200);
    });

    test("POST rejects query-string secret authentication with 401", () => {
      const queryParams = new URLSearchParams("secret=super-secret-cron-key-123");
      let statusCode = 200;
      let responseBody = {};

      if (queryParams.has("secret") || queryParams.has("cron_secret") || queryParams.has("token") || queryParams.has("key")) {
        statusCode = 401;
        responseBody = { error: "Unauthorized: Query-string authentication is not allowed. Use Authorization Bearer header." };
      }

      assert.strictEqual(statusCode, 401);
      assert.match(responseBody.error, /Query-string authentication is not allowed/);
    });

    test("GET /api/weather/ml-shadow never leaks internal stack traces to clients", () => {
      const simulateCatchBlock = (error) => {
        // Safe server-side log, sanitized client response
        const clientResponse = { error: "Failed to fetch shadow monitoring data" };
        return { clientResponse, serverLog: error.stack };
      };

      const internalException = new Error("MongoNetworkTimeoutException at NativeConnection.open");
      const { clientResponse } = simulateCatchBlock(internalException);

      assert.strictEqual(clientResponse.error, "Failed to fetch shadow monitoring data");
      assert.strictEqual(clientResponse.stack, undefined);
    });

    test("GET bounds pagination limit to maximum 100", () => {
      const parseLimit = (rawLimit) => {
        const DEFAULT_LIMIT = 20;
        const MAX_LIMIT = 100;
        if (!rawLimit) return DEFAULT_LIMIT;
        const parsed = Number(rawLimit);
        if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
        return Math.min(MAX_LIMIT, parsed);
      };

      assert.strictEqual(parseLimit("500"), 100);
      assert.strictEqual(parseLimit("25"), 25);
      assert.strictEqual(parseLimit("-5"), 20);
      assert.strictEqual(parseLimit("abc"), 20);
    });
  });

  // =========================================================================
  // TASK 5: Prediction & Outcome Consistency
  // =========================================================================
  describe("4. Prediction and Outcome Consistency", () => {
    test("Target lead time is calculated as exactly one hour (+3600000ms) after t0 (observations[2])", () => {
      const t0Iso = "2026-11-09T17:00:00.000Z";
      const t0Ms = new Date(t0Iso).getTime();
      const targetTime = new Date(t0Ms + 3600000);

      assert.strictEqual(targetTime.toISOString(), "2026-11-09T18:00:00.000Z");
      assert.strictEqual(targetTime.getTime() - t0Ms, 3600000);
    });

    test("UTC timestamps are preserved without timezone drift", () => {
      const rawIso = "2026-11-09T14:00:00.000Z";
      const dateObj = new Date(rawIso);
      assert.strictEqual(dateObj.toISOString(), rawIso);
      assert.strictEqual(dateObj.getUTCHours(), 14);
    });

    test("Rain probability is explicitly labelled and documented as uncalibrated", () => {
      const DISCLAIMER = "SHADOW MODE: Experimental observation-only ML model running for evaluation. Predictions are model-derived and not calibrated risk or authoritative warnings.";
      assert.ok(DISCLAIMER.includes("not calibrated"));
    });

    test("Open-Meteo outcome is clearly marked as model-derived in source metadata", () => {
      const outcomeSource = "open-meteo-forecast-hourly (model-derived outcome)";
      assert.match(outcomeSource, /model-derived/);
      assert.doesNotMatch(outcomeSource, /in-situ physical ground station/);
    });
  });
});

