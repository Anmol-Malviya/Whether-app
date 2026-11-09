"use client";

import React from "react";
import { ShadowMetrics } from "./types";

interface ConfusionMatrixProps {
  metrics: ShadowMetrics | null;
}

export default function ConfusionMatrix({ metrics }: ConfusionMatrixProps) {
  const cm = metrics?.rain.confusionMatrix || { tp: 0, fp: 0, tn: 0, fn: 0 };
  const thresholdPct =
    metrics?.rain.selectedThreshold !== undefined
      ? `${(metrics.rain.selectedThreshold * 100).toFixed(1)}%`
      : "50.0%";

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Rain Classification Confusion Matrix
          </h3>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
            Threshold: <strong style={{ color: "var(--accent)", fontFamily: "var(--font-mono, monospace)" }}>{thresholdPct}</strong>
          </span>
        </div>

        <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Observed vs predicted contingency counts based on calibrated threshold.
        </p>

        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 6, fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ width: "30%", padding: "6px 8px" }}></th>
                <th
                  style={{
                    width: "35%",
                    padding: "8px 10px",
                    textAlign: "center",
                    fontWeight: 600,
                    fontSize: 11.5,
                    color: "var(--text-secondary)",
                    background: "var(--surface-hover)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Predicted Rain (+)
                </th>
                <th
                  style={{
                    width: "35%",
                    padding: "8px 10px",
                    textAlign: "center",
                    fontWeight: 600,
                    fontSize: 11.5,
                    color: "var(--text-secondary)",
                    background: "var(--surface-hover)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Predicted No Rain (-)
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Actual Rain (+) */}
              <tr>
                <td
                  style={{
                    padding: "10px 12px",
                    fontWeight: 600,
                    fontSize: 12,
                    color: "var(--text-primary)",
                    background: "var(--surface-hover)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Actual Rain (+)
                </td>
                {/* TP - Emerald */}
                <td>
                  <div
                    style={{
                      padding: "12px 10px",
                      borderRadius: "var(--radius)",
                      background: "var(--green-light)",
                      border: "1px solid var(--green-border)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--green)" }}>True Positive (TP)</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "var(--green)", marginTop: 2 }}>{cm.tp}</div>
                  </div>
                </td>
                {/* FN - Red */}
                <td>
                  <div
                    style={{
                      padding: "12px 10px",
                      borderRadius: "var(--radius)",
                      background: "var(--red-light)",
                      border: "1px solid var(--red-border)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--red)" }}>False Negative (FN)</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "var(--red)", marginTop: 2 }}>{cm.fn}</div>
                  </div>
                </td>
              </tr>

              {/* Row 2: Actual No Rain (-) */}
              <tr>
                <td
                  style={{
                    padding: "10px 12px",
                    fontWeight: 600,
                    fontSize: 12,
                    color: "var(--text-primary)",
                    background: "var(--surface-hover)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Actual No Rain (-)
                </td>
                {/* FP - Red */}
                <td>
                  <div
                    style={{
                      padding: "12px 10px",
                      borderRadius: "var(--radius)",
                      background: "var(--red-light)",
                      border: "1px solid var(--red-border)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--red)" }}>False Positive (FP)</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "var(--red)", marginTop: 2 }}>{cm.fp}</div>
                  </div>
                </td>
                {/* TN - Blue/Neutral */}
                <td>
                  <div
                    style={{
                      padding: "12px 10px",
                      borderRadius: "var(--radius)",
                      background: "var(--accent-light)",
                      border: "1px solid var(--accent-border)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)" }}>True Negative (TN)</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)", marginTop: 2 }}>{cm.tn}</div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
        <span>Correct classifications: <strong style={{ color: "var(--green)", fontWeight: 600 }}>{cm.tp + cm.tn}</strong></span>
        <span>Misclassifications: <strong style={{ color: "var(--red)", fontWeight: 600 }}>{cm.fp + cm.fn}</strong></span>
      </div>
    </div>
  );
}
