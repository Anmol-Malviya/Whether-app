"use client";

import React from "react";
import { ShadowMetrics } from "./types";

interface ModelLineageProps {
  metrics: ShadowMetrics | null;
}

export default function ModelLineage({ metrics }: ModelLineageProps) {
  const meta = metrics?.metadata;

  return (
    <div
      className="card"
      style={{
        padding: 20,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Model & Ingestion Lineage
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Provenance details, active weights, and operational ground-truth source.
          </p>
        </div>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid var(--border)", gap: 12 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500, flexShrink: 0 }}>Temperature Model</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono, monospace)", textAlign: "right", wordBreak: "break-word" }}>
              {meta?.temperatureModelType || "XGBoost Regressor v1 (Lead t+1)"}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid var(--border)", gap: 12 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500, flexShrink: 0 }}>Rain Model</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono, monospace)", textAlign: "right", wordBreak: "break-word" }}>
              {meta?.rainModelType || "XGBoost Classifier v1 (Binary Precip)"}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid var(--border)", gap: 12 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500, flexShrink: 0 }}>Feature Pipeline</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono, monospace)", textAlign: "right", wordBreak: "break-word" }}>
              {meta?.datasetVersion || "Phase 3.3 Engineered Features (14 predictors)"}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid var(--border)", gap: 12 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500, flexShrink: 0 }}>Verification Source</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono, monospace)", textAlign: "right", wordBreak: "break-word" }}>
              {meta?.inputSource || "Open-Meteo Verified Ground Truth (ERA5 / Forecast)"}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", gap: 12 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500, flexShrink: 0 }}>Model Update Status</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono, monospace)", textAlign: "right", wordBreak: "break-word" }}>
              Active Operational Weights
            </span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Execution mode: <strong style={{ color: "var(--accent)", fontWeight: 600 }}>Shadow / Non-blocking</strong></span>
        <span>Environment: <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Production</strong></span>
      </div>
    </div>
  );
}
