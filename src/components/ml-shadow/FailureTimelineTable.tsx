"use client";

import React from "react";
import { FailureRecord } from "./types";
import { ChevronRight, Inbox } from "lucide-react";
import { formatUtcTime12h } from "./timeUtils";

interface FailureTimelineTableProps {
  failures: FailureRecord[];
  loading: boolean;
  onViewDetails: (id: string) => void;
}

const STAGE_LABELS: Record<string, string> = {
  input_validation:               "Input Validation",
  weather_data_collection:        "Data Collection",
  feature_engineering:            "Feature Engineering",
  ml_service_connection:          "Service Connection",
  model_inference:                "Model Inference",
  prediction_response_validation: "Response Validation",
  database_persistence:           "DB Persistence",
};

const CODE_LABELS: Record<string, string> = {
  ML_SERVICE_TIMEOUT:        "ML_TIMEOUT",
  ML_SERVICE_UNAVAILABLE:    "SVC_UNAVAIL",
  ML_HTTP_ERROR:             "HTTP_ERROR",
  INPUT_VALIDATION_FAILED:   "INPUT_FAIL",
  FEATURE_MISSING:           "FEAT_MISSING",
  FEATURE_STALE:             "FEAT_STALE",
  INVALID_MODEL_OUTPUT:      "INVALID_OUT",
  DB_WRITE_FAILED:           "DB_FAIL",
  UNKNOWN_ERROR:             "UNKNOWN",
};

export default function FailureTimelineTable({
  failures,
  loading,
  onViewDetails,
}: FailureTimelineTableProps) {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Failure Timeline
          </h3>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
            Recent prediction failures with diagnostic classification.
          </p>
        </div>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {loading ? "Loading…" : `${failures.length} record${failures.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760, fontSize: 12.5 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--surface-hover)" }}>
            <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", whiteSpace: "nowrap" }}>
              <th style={{ padding: "11px 16px", color: "var(--text-secondary)", fontWeight: 600, width: 160 }}>Target Time (UTC)</th>
              <th style={{ padding: "11px 16px", color: "var(--text-secondary)", fontWeight: 600, width: 140 }}>Failure Stage</th>
              <th style={{ padding: "11px 16px", color: "var(--text-secondary)", fontWeight: 600, width: 110 }}>Error Code</th>
              <th style={{ padding: "11px 16px", color: "var(--text-secondary)", fontWeight: 600, width: 130 }}>Dataset Version</th>
              <th style={{ padding: "11px 16px", color: "var(--text-secondary)", fontWeight: 600, width: 80 }}>Retries</th>
              <th style={{ padding: "11px 16px", color: "var(--text-secondary)", fontWeight: 600, textAlign: "right", width: 110 }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && failures.length === 0 ? (
              <>
                {[1, 2, 3].map((i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    {[140, 100, 90, 110, 50, 70].map((w, j) => (
                      <td key={j} style={{ padding: "12px 16px" }}>
                        <div className="skeleton" style={{ width: w, height: 14 }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ) : failures.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "40px 16px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <Inbox style={{ width: 32, height: 32, color: "var(--border)" }} />
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>No failures in this time range</span>
                  </div>
                </td>
              </tr>
            ) : (
              failures.map((rec) => {
                const targetTime = formatUtcTime12h(rec.targetLeadTimeUtc, true);
                const stageLabel = rec.failureStage ? (STAGE_LABELS[rec.failureStage] ?? rec.failureStage) : "—";
                const codeShort = CODE_LABELS[rec.failureCode] ?? rec.failureCode;

                return (
                  <tr
                    key={rec.id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      whiteSpace: "nowrap",
                      transition: "background 0.12s ease",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--surface-hover)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "")}
                  >
                    <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono, monospace)", color: "var(--text-secondary)" }}>
                      {targetTime}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>
                      {stageLabel}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono, monospace)",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--red)",
                          background: "var(--red-light)",
                          border: "1px solid var(--red-border)",
                          padding: "2px 7px",
                          borderRadius: 10,
                        }}
                      >
                        {codeShort}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontFamily: "var(--font-mono, monospace)", fontSize: 11.5 }}>
                      {rec.datasetVersion ?? "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: 24,
                          padding: "2px 7px",
                          borderRadius: 10,
                          fontSize: 11.5,
                          fontWeight: 600,
                          background: rec.retryCount > 0 ? "var(--yellow-light)" : "var(--surface-hover)",
                          color: rec.retryCount > 0 ? "var(--yellow)" : "var(--text-muted)",
                          border: `1px solid ${rec.retryCount > 0 ? "var(--yellow-border)" : "var(--border)"}`,
                        }}
                      >
                        {rec.retryCount}×
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        onClick={() => onViewDetails(rec.id)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "4px 10px",
                          borderRadius: "var(--radius)",
                          fontSize: 11.5,
                          fontWeight: 600,
                          background: "var(--accent-light)",
                          color: "var(--accent)",
                          border: "1px solid var(--accent-border)",
                          cursor: "pointer",
                          transition: "all 0.12s ease",
                          fontFamily: "inherit",
                        }}
                      >
                        View
                        <ChevronRight style={{ width: 12, height: 12 }} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

