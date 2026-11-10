"use client";

import React from "react";
import { FailureDistributionEntry } from "./types";

interface FailureDistributionChartProps {
  distribution: FailureDistributionEntry[];
  loading: boolean;
}

const FAILURE_CODE_LABELS: Record<string, string> = {
  ML_SERVICE_TIMEOUT:                "ML Timeout",
  ML_SERVICE_UNAVAILABLE:            "Service Unavailable",
  ML_HTTP_ERROR:                     "HTTP Error",
  INPUT_VALIDATION_FAILED:           "Invalid Input",
  FEATURE_MISSING:                   "Missing Features",
  FEATURE_STALE:                     "Stale Features",
  INVALID_MODEL_OUTPUT:              "Invalid Output",
  DB_WRITE_FAILED:                   "DB Persistence",
  UNKNOWN_ERROR:                     "Unknown Error",
};

const BAR_COLORS = [
  "var(--red)",
  "#F97316",
  "#EAB308",
  "#6366F1",
  "#0EA5E9",
  "#10B981",
  "#8B5CF6",
  "#F43F5E",
  "var(--text-muted)",
];

export default function FailureDistributionChart({
  distribution,
  loading,
}: FailureDistributionChartProps) {
  if (loading) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div className="skeleton" style={{ width: 160, height: 14, borderRadius: 6, marginBottom: 20 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div className="skeleton" style={{ width: 100, height: 12, borderRadius: 6, marginBottom: 6 }} />
            <div className="skeleton" style={{ width: "100%", height: 24, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    );
  }

  if (!distribution || distribution.length === 0) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Failure Distribution
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
            Failure categories grouped by root cause classification.
          </p>
        </div>
        <div style={{ marginTop: 32, textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No failures recorded in this time range</div>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          Failure Distribution
        </h3>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
          Failure categories grouped by root cause classification.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {distribution.map((entry, idx) => {
          const label = FAILURE_CODE_LABELS[entry.code] ?? entry.code;
          const barWidth = `${Math.round((entry.count / maxCount) * 100)}%`;
          const color = BAR_COLORS[idx % BAR_COLORS.length];

          return (
            <div key={entry.code}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-primary)" }}>
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono, monospace)",
                      background: "var(--surface-hover)",
                      padding: "1px 6px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                    }}
                  >
                    {entry.code}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>{entry.count}</span>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>({entry.percentage.toFixed(1)}%)</span>
                </div>
              </div>
              <div
                style={{
                  width: "100%",
                  height: 8,
                  background: "var(--surface-hover)",
                  borderRadius: 4,
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    width: barWidth,
                    height: "100%",
                    background: color,
                    borderRadius: 4,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--text-muted)" }}>
        Total failure events: <strong style={{ color: "var(--text-secondary)" }}>{distribution.reduce((s, d) => s + d.count, 0)}</strong>
      </div>
    </div>
  );
}

