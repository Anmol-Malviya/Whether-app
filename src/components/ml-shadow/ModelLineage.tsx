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

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Row 1 */}
          <div
            style={{
              padding: "10px 14px",
              background: "var(--surface-hover)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Temperature Model
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono, monospace)", wordBreak: "break-word" }}>
              {meta?.temperatureModelType || "XGBoost Regressor v1 (Lead t+1)"}
            </span>
          </div>

          {/* Row 2 */}
          <div
            style={{
              padding: "10px 14px",
              background: "var(--surface-hover)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Rain Model
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono, monospace)", wordBreak: "break-word" }}>
              {meta?.rainModelType || "XGBoost Classifier v1 (Binary Precip)"}
            </span>
          </div>

          {/* Row 3 */}
          <div
            style={{
              padding: "10px 14px",
              background: "var(--surface-hover)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Feature Pipeline
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono, monospace)", wordBreak: "break-word" }}>
              {meta?.datasetVersion || "Phase 3.3 Engineered Features (14 predictors)"}
            </span>
          </div>

          {/* Row 4 */}
          <div
            style={{
              padding: "10px 14px",
              background: "var(--surface-hover)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Verification Source
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono, monospace)", wordBreak: "break-word" }}>
              {meta?.inputSource || "Open-Meteo Verified Ground Truth (ERA5 / Forecast)"}
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
