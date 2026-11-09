"use client";

import React from "react";
import { ShadowMetrics } from "./types";

interface TemperaturePerformanceCardProps {
  metrics: ShadowMetrics | null;
}

export default function TemperaturePerformanceCard({ metrics }: TemperaturePerformanceCardProps) {
  const temp = metrics?.temperature;
  const mae = temp?.mae !== null && temp?.mae !== undefined ? `${temp.mae.toFixed(2)}°C` : "N/A";
  const rmse = temp?.rmse !== null && temp?.rmse !== undefined ? `${temp.rmse.toFixed(2)}°C` : "N/A";
  const bias =
    temp?.meanBias !== null && temp?.meanBias !== undefined
      ? `${temp.meanBias > 0 ? "+" : ""}${temp.meanBias.toFixed(2)}°C`
      : "N/A";
  const sampleSize = temp?.sampleSize ?? 0;

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Temperature Model Performance
          </h3>
          <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono, monospace)", color: "var(--text-secondary)", background: "var(--surface-hover)", padding: "2px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
            N = {sampleSize}
          </span>
        </div>

        <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Continuous regression accuracy evaluated against hourly weather outcomes.
        </p>

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 10 }}>
          <div style={{ padding: "10px 12px", background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block" }}>MAE</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginTop: 4, display: "block" }}>{mae}</span>
          </div>

          <div style={{ padding: "10px 12px", background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block" }}>RMSE</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginTop: 4, display: "block" }}>{rmse}</span>
          </div>

          <div style={{ padding: "10px 12px", background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block" }}>Mean Bias</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginTop: 4, display: "block" }}>{bias}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Evaluated target: <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>t+1 hr lead</strong></span>
        <span>Loss: <code style={{ fontFamily: "monospace", color: "var(--accent)" }}>L1 / L2</code></span>
      </div>
    </div>
  );
}
