"use client";

import React from "react";
import { ShadowMetrics } from "./types";

interface MetricsOverviewProps {
  metrics: ShadowMetrics | null;
  loading: boolean;
}

export default function MetricsOverview({ metrics, loading }: MetricsOverviewProps) {
  if (loading && !metrics) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="card"
            style={{
              padding: 20,
              minHeight: 140,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div className="skeleton" style={{ width: 110, height: 14, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: 90, height: 32, borderRadius: 8, marginTop: 12 }} />
            </div>
            <div className="skeleton" style={{ width: 140, height: 14, borderRadius: 6, marginTop: 14 }} />
          </div>
        ))}
      </div>
    );
  }

  const coveragePct = metrics?.dataQuality.evaluationCoveragePct;
  const coverageDisplay =
    coveragePct !== null && coveragePct !== undefined ? `${coveragePct.toFixed(1)}%` : "N/A";

  const maeVal = metrics?.temperature.mae;
  const maeDisplay =
    maeVal !== null && maeVal !== undefined ? `${maeVal.toFixed(2)}°C` : "N/A";

  const rmseVal = metrics?.temperature.rmse;
  const rmseDisplay =
    rmseVal !== null && rmseVal !== undefined ? `${rmseVal.toFixed(2)}°C` : "N/A";

  const biasVal = metrics?.temperature.meanBias;
  const biasDisplay =
    biasVal !== null && biasVal !== undefined
      ? `${biasVal > 0 ? "+" : ""}${biasVal.toFixed(2)}°C`
      : "N/A";

  const precisionVal = metrics?.rain.precision;
  const precisionDisplay =
    precisionVal !== null && precisionVal !== undefined ? `${(precisionVal * 100).toFixed(1)}%` : "N/A";

  const recallVal = metrics?.rain.recall;
  const recallDisplay =
    recallVal !== null && recallVal !== undefined ? `${(recallVal * 100).toFixed(1)}%` : "N/A";

  const f1Val = metrics?.rain.f1Score;
  const f1Display =
    f1Val !== null && f1Val !== undefined ? f1Val.toFixed(3) : "N/A";

  const staleRate = metrics?.dataQuality.staleInputRate;
  const staleDisplay =
    staleRate !== null && staleRate !== undefined ? `${(staleRate * 100).toFixed(1)}%` : "0.0%";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Evaluated Predictions */}
      <div
        className="card"
        style={{
          padding: 20,
          minHeight: 140,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Evaluated Predictions
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.5px", lineHeight: 1 }}>
              {metrics ? metrics.sampleCounts.evaluatedCount : "-"}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
              / {metrics ? metrics.sampleCounts.totalPredictions : "-"}
            </span>
          </div>
        </div>
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
          <span>Coverage rate</span>
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{coverageDisplay}</span>
        </div>
      </div>

      {/* Card 2: Temperature MAE */}
      <div
        className="card"
        style={{
          padding: 20,
          minHeight: 140,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Temperature MAE
          </div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.5px", lineHeight: 1 }}>
            {maeDisplay}
          </div>
        </div>
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>RMSE: <strong style={{ fontWeight: 600, color: "var(--text-primary)" }}>{rmseDisplay}</strong></span>
          <span>Bias: <strong style={{ fontWeight: 600, color: "var(--text-primary)" }}>{biasDisplay}</strong></span>
        </div>
      </div>

      {/* Card 3: Rain Prediction */}
      <div
        className="card"
        style={{
          padding: 20,
          minHeight: 140,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Rain Prediction
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.5px", lineHeight: 1 }}>
              {precisionDisplay}
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>Precision</span>
          </div>
        </div>
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>Recall: <strong style={{ fontWeight: 600, color: "var(--text-primary)" }}>{recallDisplay}</strong></span>
          <span>F1: <strong style={{ fontWeight: 600, color: "var(--text-primary)" }}>{f1Display}</strong></span>
        </div>
      </div>

      {/* Card 4: Data Integrity */}
      <div
        className="card"
        style={{
          padding: 20,
          minHeight: 140,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Data Integrity
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.5px", lineHeight: 1 }}>
              {staleDisplay}
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>Stale Rate</span>
          </div>
        </div>
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>Incomplete: <strong style={{ fontWeight: 600, color: "var(--text-primary)" }}>{metrics ? metrics.sampleCounts.incompleteCount : 0}</strong></span>
          <span>Failures: <strong style={{ fontWeight: 600, color: "var(--text-primary)" }}>{metrics ? metrics.sampleCounts.failedCount : 0}</strong></span>
        </div>
      </div>
    </div>
  );
}
