"use client";

import React from "react";
import { ShadowRecord, HistoryPagination } from "./types";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { formatUtcTime12h } from "./timeUtils";

interface PredictionHistoryTableProps {
  history: ShadowRecord[];
  pagination: HistoryPagination;
  loading: boolean;
  onPageChange: (newPage: number) => void;
}

export default function PredictionHistoryTable({
  history,
  pagination,
  loading,
  onPageChange,
}: PredictionHistoryTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "evaluated":
        return <span className="badge badge-ok">Evaluated</span>;
      case "pending":
        return (
          <span
            className="badge"
            style={{
              background: "var(--accent-light)",
              color: "var(--accent)",
              border: "1px solid var(--accent-border)",
            }}
          >
            Pending
          </span>
        );
      case "evaluating":
        return <span className="badge badge-partial">Evaluating</span>;
      default:
        return <span className="badge badge-error">{status}</span>;
    }
  };

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Table Header Controls */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Recent Shadow Predictions
          </h3>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
            Log of continuous shadow inference and verified actual outcomes.
          </p>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Showing page <strong style={{ color: "var(--text-primary)" }}>{pagination.page}</strong> of{" "}
          <strong style={{ color: "var(--text-primary)" }}>{Math.max(1, pagination.totalPages)}</strong> ({pagination.totalRecords} total records)
        </div>
      </div>

      {/* Table Container with Sticky Header and Horizontal Scroll */}
      <div style={{ overflowX: "auto", maxHeight: 520 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760, fontSize: 12.5 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--surface-hover)" }}>
            <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", whiteSpace: "nowrap" }}>
              <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontWeight: 600, width: 160 }}>Target Time (UTC)</th>
              <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontWeight: 600, width: 110 }}>Pred Temp</th>
              <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontWeight: 600, width: 110 }}>Actual Temp</th>
              <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontWeight: 600, width: 120 }}>Temp Error (|ΔT|)</th>
              <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontWeight: 600, width: 100 }}>Rain Score</th>
              <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontWeight: 600, width: 110 }}>Predicted Rain</th>
              <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontWeight: 600, width: 110 }}>Actual Rain</th>
              <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontWeight: 600, textAlign: "right", width: 120 }}>Evaluation Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && history.length === 0 ? (
              // Skeleton Loading State
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px" }}><div className="skeleton" style={{ width: 110, height: 16 }} /></td>
                    <td style={{ padding: "12px 16px" }}><div className="skeleton" style={{ width: 55, height: 16 }} /></td>
                    <td style={{ padding: "12px 16px" }}><div className="skeleton" style={{ width: 55, height: 16 }} /></td>
                    <td style={{ padding: "12px 16px" }}><div className="skeleton" style={{ width: 50, height: 16 }} /></td>
                    <td style={{ padding: "12px 16px" }}><div className="skeleton" style={{ width: 50, height: 16 }} /></td>
                    <td style={{ padding: "12px 16px" }}><div className="skeleton" style={{ width: 55, height: 16 }} /></td>
                    <td style={{ padding: "12px 16px" }}><div className="skeleton" style={{ width: 55, height: 16 }} /></td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}><div className="skeleton" style={{ width: 70, height: 20, marginLeft: "auto", borderRadius: 12 }} /></td>
                  </tr>
                ))}
              </>
            ) : history.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={8} style={{ padding: "48px 16px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                    <Inbox style={{ width: 36, height: 36, marginBottom: 8, strokeWidth: 1.5, color: "var(--text-muted)" }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>No prediction records found</span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                      No records match the selected evaluation timeframe.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              history.map((rec) => {
                const targetTime = formatUtcTime12h(rec.targetLeadTimeUtc, true);
                const predTemp =
                  rec.predictedTemperature !== null && rec.predictedTemperature !== undefined
                    ? `${rec.predictedTemperature.toFixed(1)}°C`
                    : "—";
                const actualTemp =
                  rec.actualOutcome?.actualTemperature !== undefined
                    ? `${rec.actualOutcome.actualTemperature.toFixed(1)}°C`
                    : "—";
                const tempErr =
                  rec.actualOutcome?.temperatureAbsoluteError !== undefined
                    ? `${rec.actualOutcome.temperatureAbsoluteError.toFixed(1)}°C`
                    : "—";
                const rainProb =
                  rec.predictedRainProbability !== null && rec.predictedRainProbability !== undefined
                    ? `${(rec.predictedRainProbability * 100).toFixed(1)}%`
                    : "—";

                return (
                  <tr
                    key={rec._id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      whiteSpace: "nowrap",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono, monospace)", color: "var(--text-secondary)" }}>{targetTime}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)" }}>{predTemp}</td>
                    <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{actualTemp}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {rec.actualOutcome?.temperatureAbsoluteError !== undefined ? (
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{tempErr}</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono, monospace)", fontWeight: 500, color: "var(--text-primary)" }}>{rainProb}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {rec.predictedRainClass !== null ? (
                        <span
                          className="badge"
                          style={{
                            background: rec.predictedRainClass ? "var(--accent-light)" : "var(--surface-hover)",
                            color: rec.predictedRainClass ? "var(--accent)" : "var(--text-secondary)",
                            border: `1px solid ${rec.predictedRainClass ? "var(--accent-border)" : "var(--border)"}`,
                          }}
                        >
                          {rec.predictedRainClass ? "Rain" : "No Rain"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {rec.actualOutcome ? (
                        <span
                          className="badge"
                          style={{
                            background: rec.actualOutcome.actualRainClass ? "var(--green-light)" : "var(--surface-hover)",
                            color: rec.actualOutcome.actualRainClass ? "var(--green)" : "var(--text-secondary)",
                            border: `1px solid ${rec.actualOutcome.actualRainClass ? "var(--green-border)" : "var(--border)"}`,
                          }}
                        >
                          {rec.actualOutcome.actualRainClass ? "Rain" : "No Rain"}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>{getStatusBadge(rec.evaluationStatus)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div
        style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Page {pagination.page} of {Math.max(1, pagination.totalPages)}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1 || loading}
            className="btn-compact"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--text-primary)",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              cursor: pagination.page <= 1 || loading ? "not-allowed" : "pointer",
              opacity: pagination.page <= 1 || loading ? 0.45 : 1,
            }}
          >
            <ChevronLeft style={{ width: 14, height: 14 }} />
            <span>Previous</span>
          </button>
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={!pagination.hasMore || loading}
            className="btn-compact"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--text-primary)",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              cursor: !pagination.hasMore || loading ? "not-allowed" : "pointer",
              opacity: !pagination.hasMore || loading ? 0.45 : 1,
            }}
          >
            <span>Next</span>
            <ChevronRight style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
    </div>
  );
}
