"use client";

import React from "react";
import { ShadowMetrics } from "./types";

interface RainPerformanceCardProps {
  metrics: ShadowMetrics | null;
}

export default function RainPerformanceCard({ metrics }: RainPerformanceCardProps) {
  const rain = metrics?.rain;
  const precision =
    rain?.precision !== null && rain?.precision !== undefined
      ? `${(rain.precision * 100).toFixed(1)}%`
      : "N/A";
  const recall =
    rain?.recall !== null && rain?.recall !== undefined
      ? `${(rain.recall * 100).toFixed(1)}%`
      : "N/A";
  const f1Score =
    rain?.f1Score !== null && rain?.f1Score !== undefined
      ? rain.f1Score.toFixed(3)
      : "N/A";
  const prAuc =
    rain?.prAuc !== null && rain?.prAuc !== undefined
      ? rain.prAuc.toFixed(3)
      : "N/A";
  const brierScore =
    rain?.brierScore !== null && rain?.brierScore !== undefined
      ? rain.brierScore.toFixed(4)
      : "N/A";
  const sampleSize = rain?.sampleSize ?? 0;

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
            Rain Classification Performance
          </h3>
          <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono, monospace)", color: "var(--text-secondary)", background: "var(--surface-hover)", padding: "2px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
            N = {sampleSize}
          </span>
        </div>

        <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Binary precipitation discrimination and probability calibration scores.
        </p>

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
          <div style={{ padding: "10px 12px", background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block" }}>Precision</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginTop: 4, display: "block" }}>{precision}</span>
          </div>

          <div style={{ padding: "10px 12px", background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block" }}>Recall</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginTop: 4, display: "block" }}>{recall}</span>
          </div>

          <div style={{ padding: "10px 12px", background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block" }}>F1-Score</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginTop: 4, display: "block" }}>{f1Score}</span>
          </div>

          <div style={{ padding: "10px 12px", background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block" }}>PR-AUC</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginTop: 4, display: "block" }}>{prAuc}</span>
          </div>

          <div style={{ padding: "10px 12px", background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block" }}>Brier Score</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginTop: 4, display: "block" }}>{brierScore}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Calibration: <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Strictly proper score</strong></span>
        <span>Goal: <code style={{ fontFamily: "monospace", color: "var(--accent)" }}>Brier &rarr; 0</code></span>
      </div>
    </div>
  );
}
