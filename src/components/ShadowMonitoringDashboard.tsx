"use client";

import { useEffect, useState, useCallback } from "react";

interface ShadowMetrics {
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

interface ShadowRecord {
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

interface HistoryPagination {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
  hasMore: boolean;
}

export default function ShadowMonitoringDashboard() {
  const [range, setRange] = useState<string>("24h");
  const [metrics, setMetrics] = useState<ShadowMetrics | null>(null);
  const [history, setHistory] = useState<ShadowRecord[]>([]);
  const [pagination, setPagination] = useState<HistoryPagination>({
    page: 1,
    limit: 10,
    totalRecords: 0,
    totalPages: 0,
    hasMore: false,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [evalMessage, setEvalMessage] = useState<string | null>(null);

  const fetchData = useCallback(
    async (selectedRange: string, pageNum: number = 1) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/weather/ml-shadow?range=${selectedRange}&page=${pageNum}&limit=10`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setMetrics(data.metrics);
        setHistory(data.history?.records || []);
        if (data.history?.pagination) {
          setPagination(data.history.pagination);
        }
      } catch (err) {
        console.error("Failed to load shadow metrics:", err);
        setError("Unable to load shadow monitoring metrics. Ensure MongoDB is connected.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchData(range, 1);
  }, [range, fetchData]);

  const handleTriggerEvaluation = async () => {
    setEvaluating(true);
    setEvalMessage(null);
    try {
      const res = await fetch("/api/weather/ml-shadow", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setEvalMessage(
          `Evaluated: ${data.result?.evaluated || 0}, Incomplete skipped: ${data.result?.incomplete || 0}, Pending: ${data.result?.skipped || 0}`
        );
        fetchData(range, pagination.page);
      } else {
        setEvalMessage(`Evaluation failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      setEvalMessage(`Error invoking evaluation: ${String(err)}`);
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 32,
        background: "#0F172A",
        color: "#F8FAFC",
        borderRadius: 24,
        padding: "24px 28px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
      }}
    >
      {/* Header bar */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                background: "#38BDF8",
                color: "#0F172A",
                fontWeight: 800,
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 9999,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Shadow Mode
            </span>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "#FFFFFF" }}>
              ML Model Monitoring & Verification Desk
            </h2>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#94A3B8" }}>
            Next-hour observation-only XGBoost nowcast evaluated against completed operational hourly outcomes.
          </p>
        </div>

        {/* Range Filter Buttons & Run Button */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {["24h", "7d", "30d", "all"].map((preset) => (
            <button
              key={preset}
              onClick={() => setRange(preset)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                border: range === preset ? "1px solid #38BDF8" : "1px solid #334155",
                background: range === preset ? "#0284C7" : "#1E293B",
                color: "#FFFFFF",
                transition: "all 0.15s ease",
              }}
            >
              {preset.toUpperCase()}
            </button>
          ))}

          <button
            onClick={handleTriggerEvaluation}
            disabled={evaluating}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: evaluating ? "not-allowed" : "pointer",
              background: "#10B981",
              border: "none",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {evaluating ? "Evaluating..." : "Run Evaluation Cycle"}
          </button>
        </div>
      </div>

      {evalMessage && (
        <div
          style={{
            marginTop: 14,
            padding: "8px 14px",
            background: "#1E293B",
            borderRadius: 8,
            fontSize: 12,
            borderLeft: "4px solid #38BDF8",
            color: "#E2E8F0",
          }}
        >
          {evalMessage}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 16, padding: "12px 16px", background: "#450A0A", borderRadius: 10, color: "#FCA5A5", fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && !metrics ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#94A3B8", fontSize: 14 }}>
          Loading shadow evaluation metrics...
        </div>
      ) : metrics ? (
        <>
          {/* Key KPI Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 14,
              marginTop: 22,
            }}
          >
            {/* KPI 1: Evaluated Count & Coverage */}
            <div style={{ background: "#1E293B", padding: "16px 18px", borderRadius: 14, border: "1px solid #334155" }}>
              <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase" }}>
                Evaluated / Total Predictions
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "#38BDF8" }}>
                {metrics.sampleCounts.evaluatedCount}{" "}
                <span style={{ fontSize: 14, color: "#64748B", fontWeight: 500 }}>
                  / {metrics.sampleCounts.totalPredictions}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
                Coverage:{" "}
                <strong style={{ color: "#F8FAFC" }}>
                  {metrics.dataQuality.evaluationCoveragePct !== null ? `${metrics.dataQuality.evaluationCoveragePct}%` : "N/A"}
                </strong>{" "}
                (Pending: {metrics.sampleCounts.pendingCount})
              </div>
            </div>

            {/* KPI 2: Temperature MAE */}
            <div style={{ background: "#1E293B", padding: "16px 18px", borderRadius: 14, border: "1px solid #334155" }}>
              <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase" }}>
                Temperature MAE (N={metrics.temperature.sampleSize})
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "#FBBF24" }}>
                {metrics.temperature.mae !== null ? `${metrics.temperature.mae.toFixed(2)}°C` : "N/A"}
              </div>
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
                RMSE: {metrics.temperature.rmse !== null ? `${metrics.temperature.rmse.toFixed(2)}°C` : "N/A"} | Bias:{" "}
                {metrics.temperature.meanBias !== null ? `${metrics.temperature.meanBias > 0 ? "+" : ""}${metrics.temperature.meanBias.toFixed(2)}°C` : "N/A"}
              </div>
            </div>

            {/* KPI 3: Rain Brier Score */}
            <div style={{ background: "#1E293B", padding: "16px 18px", borderRadius: 14, border: "1px solid #334155" }}>
              <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase" }}>
                Rain Brier Score (N={metrics.rain.sampleSize})
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "#34D399" }}>
                {metrics.rain.brierScore !== null ? metrics.rain.brierScore.toFixed(4) : "N/A"}
              </div>
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
                PR-AUC: {metrics.rain.prAuc !== null ? metrics.rain.prAuc.toFixed(3) : "N/A"} | F1:{" "}
                {metrics.rain.f1Score !== null ? metrics.rain.f1Score.toFixed(3) : "N/A"}
              </div>
            </div>

            {/* KPI 4: Reliability & Data Quality */}
            <div style={{ background: "#1E293B", padding: "16px 18px", borderRadius: 14, border: "1px solid #334155" }}>
              <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase" }}>
                Data Integrity & Staleness
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "#A78BFA" }}>
                {(metrics.dataQuality.staleInputRate * 100).toFixed(1)}%{" "}
                <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 500 }}>stale rate</span>
              </div>
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
                Incomplete outcomes: {metrics.sampleCounts.incompleteCount} | API fails: {metrics.sampleCounts.failedCount}
              </div>
            </div>
          </div>

          {/* Detailed Verification Matrix */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 16,
              marginTop: 20,
            }}
          >
            {/* Confusion Matrix Card */}
            <div style={{ background: "#1E293B", borderRadius: 14, padding: "16px 20px", border: "1px solid #334155" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", marginBottom: 10 }}>
                Rain Classification Confusion Matrix (Threshold: {(metrics.rain.selectedThreshold * 100).toFixed(1)}%)
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  textAlign: "center",
                }}
              >
                <div style={{ background: "#0F172A", padding: "10px", borderRadius: 8, border: "1px solid #334155" }}>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>True Positives (TP)</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#34D399" }}>{metrics.rain.confusionMatrix.tp}</div>
                </div>
                <div style={{ background: "#0F172A", padding: "10px", borderRadius: 8, border: "1px solid #334155" }}>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>False Positives (FP)</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#F87171" }}>{metrics.rain.confusionMatrix.fp}</div>
                </div>
                <div style={{ background: "#0F172A", padding: "10px", borderRadius: 8, border: "1px solid #334155" }}>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>False Negatives (FN)</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#F87171" }}>{metrics.rain.confusionMatrix.fn}</div>
                </div>
                <div style={{ background: "#0F172A", padding: "10px", borderRadius: 8, border: "1px solid #334155" }}>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>True Negatives (TN)</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#38BDF8" }}>{metrics.rain.confusionMatrix.tn}</div>
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: "#94A3B8", display: "flex", justifyContent: "space-between" }}>
                <span>Precision: {metrics.rain.precision !== null ? `${(metrics.rain.precision * 100).toFixed(1)}%` : "N/A"}</span>
                <span>Recall: {metrics.rain.recall !== null ? `${(metrics.rain.recall * 100).toFixed(1)}%` : "N/A"}</span>
              </div>
            </div>

            {/* Model & Source Lineage Card */}
            <div style={{ background: "#1E293B", borderRadius: 14, padding: "16px 20px", border: "1px solid #334155" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", marginBottom: 10 }}>
                Model & Ingestion Lineage
              </div>
              <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6, color: "#CBD5E1" }}>
                <div>
                  <strong style={{ color: "#94A3B8" }}>Temperature Model:</strong> {metrics.metadata.temperatureModelType}
                </div>
                <div>
                  <strong style={{ color: "#94A3B8" }}>Rain Model:</strong> {metrics.metadata.rainModelType}
                </div>
                <div>
                  <strong style={{ color: "#94A3B8" }}>Feature Pipeline:</strong> {metrics.metadata.datasetVersion}
                </div>
                <div>
                  <strong style={{ color: "#94A3B8" }}>Verification Source:</strong> {metrics.metadata.inputSource}
                </div>
              </div>
            </div>
          </div>

          {/* Paginated History Table */}
          <div style={{ marginTop: 24, background: "#1E293B", borderRadius: 14, padding: "18px 20px", border: "1px solid #334155" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>Recent Shadow Predictions History</div>
              <div style={{ fontSize: 12, color: "#94A3B8" }}>
                Page {pagination.page} of {Math.max(1, pagination.totalPages)} ({pagination.totalRecords} total)
              </div>
            </div>

            {history.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "#64748B", fontSize: 13 }}>
                No prediction records recorded for this time range.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: "#CBD5E1" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #334155", textAlign: "left", color: "#94A3B8" }}>
                      <th style={{ padding: "8px 6px" }}>Target (UTC)</th>
                      <th style={{ padding: "8px 6px" }}>Pred Temp</th>
                      <th style={{ padding: "8px 6px" }}>Actual Temp</th>
                      <th style={{ padding: "8px 6px" }}>|ΔT|</th>
                      <th style={{ padding: "8px 6px" }}>Rain Score</th>
                      <th style={{ padding: "8px 6px" }}>Rain Pred</th>
                      <th style={{ padding: "8px 6px" }}>Rain Act</th>
                      <th style={{ padding: "8px 6px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((rec) => (
                      <tr key={rec._id} style={{ borderBottom: "1px solid #1E293B" }}>
                        <td style={{ padding: "8px 6px", fontFamily: "monospace" }}>
                          {rec.targetLeadTimeUtc ? rec.targetLeadTimeUtc.slice(5, 16).replace("T", " ") : "N/A"}
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          {rec.predictedTemperature !== null ? `${rec.predictedTemperature.toFixed(1)}°` : "-"}
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          {rec.actualOutcome?.actualTemperature !== undefined
                            ? `${rec.actualOutcome.actualTemperature.toFixed(1)}°`
                            : "-"}
                        </td>
                        <td style={{ padding: "8px 6px", color: "#FBBF24" }}>
                          {rec.actualOutcome?.temperatureAbsoluteError !== undefined
                            ? `${rec.actualOutcome.temperatureAbsoluteError.toFixed(1)}°`
                            : "-"}
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          {rec.predictedRainProbability !== null
                            ? `${(rec.predictedRainProbability * 100).toFixed(1)}%`
                            : "-"}
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          <span
                            style={{
                              color: rec.predictedRainClass ? "#38BDF8" : "#94A3B8",
                              fontWeight: 600,
                            }}
                          >
                            {rec.predictedRainClass ? "Rain" : "No"}
                          </span>
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          {rec.actualOutcome ? (
                            <span
                              style={{
                                color: rec.actualOutcome.actualRainClass ? "#34D399" : "#94A3B8",
                                fontWeight: 600,
                              }}
                            >
                              {rec.actualOutcome.actualRainClass ? "Rain" : "No"}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background:
                                rec.evaluationStatus === "evaluated"
                                  ? "#065F46"
                                  : rec.evaluationStatus === "pending"
                                  ? "#1E3A8A"
                                  : "#7F1D1D",
                              color: "#FFFFFF",
                            }}
                          >
                            {rec.evaluationStatus.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => fetchData(range, pagination.page - 1)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      background: "#334155",
                      border: "none",
                      color: "#FFFFFF",
                      cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    Previous
                  </button>
                  <button
                    disabled={!pagination.hasMore}
                    onClick={() => fetchData(range, pagination.page + 1)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      background: "#334155",
                      border: "none",
                      color: "#FFFFFF",
                      cursor: !pagination.hasMore ? "not-allowed" : "pointer",
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Scientific Disclaimer Footer */}
          <div
            style={{
              marginTop: 18,
              padding: "10px 14px",
              background: "#1E293B",
              borderRadius: 8,
              fontSize: 11,
              color: "#94A3B8",
              fontStyle: "italic",
              borderLeft: "3px solid #64748B",
            }}
          >
            {metrics.metadata.disclaimer}
          </div>
        </>
      ) : null}
    </div>
  );
}

