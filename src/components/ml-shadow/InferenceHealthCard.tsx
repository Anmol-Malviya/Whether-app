"use client";

import React from "react";
import { InferenceHealthMetrics, ServiceStatus } from "./types";
import { Activity, CheckCircle2, AlertCircle, Clock, Wifi } from "lucide-react";

interface InferenceHealthCardProps {
  health: InferenceHealthMetrics | null;
  serviceStatus: ServiceStatus | null;
  loading: boolean;
}

const STATUS_CONFIG: Record<ServiceStatus, { label: string; color: string; bg: string; border: string; Icon: React.FC<{ style?: React.CSSProperties }> }> = {
  healthy:     { label: "Healthy",     color: "var(--green)",  bg: "var(--green-light)",  border: "var(--green-border)",  Icon: ({ style }) => <CheckCircle2 style={style} /> },
  degraded:    { label: "Degraded",    color: "var(--yellow)", bg: "var(--yellow-light)", border: "var(--yellow-border)", Icon: ({ style }) => <AlertCircle   style={style} /> },
  unavailable: { label: "Unavailable", color: "var(--red)",    bg: "var(--red-light)",    border: "var(--red-border)",    Icon: ({ style }) => <Wifi          style={style} /> },
  unknown:     { label: "Unknown",     color: "var(--text-muted)", bg: "var(--surface-hover)", border: "var(--border)", Icon: ({ style }) => <Activity style={style} /> },
};

export default function InferenceHealthCard({
  health,
  serviceStatus,
  loading,
}: InferenceHealthCardProps) {
  if (loading && !health) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card" style={{ padding: 20, minHeight: 110, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div className="skeleton" style={{ width: 100, height: 12, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: 80, height: 28, borderRadius: 8, marginTop: 10 }} />
            <div className="skeleton" style={{ width: 120, height: 12, borderRadius: 6, marginTop: 10 }} />
          </div>
        ))}
      </div>
    );
  }

  const successRateDisplay = health?.successRate !== null && health?.successRate !== undefined
    ? `${(health.successRate * 100).toFixed(1)}%`
    : "N/A";

  const failedDisplay = health?.failedPredictions ?? "—";

  const avgLatencyDisplay = health?.avgLatencyMs !== null && health?.avgLatencyMs !== undefined
    ? `${health.avgLatencyMs.toFixed(0)}ms`
    : "N/A";

  const p95LatencyDisplay = health?.p95LatencyMs !== null && health?.p95LatencyMs !== undefined
    ? `p95 ${health.p95LatencyMs.toFixed(0)}ms`
    : "No p95 data";

  const status: ServiceStatus = serviceStatus ?? "unknown";
  const cfg = STATUS_CONFIG[status];

  const successRateColor =
    health?.successRate === null || health?.successRate === undefined
      ? "var(--text-primary)"
      : health.successRate >= 0.9
      ? "var(--green)"
      : health.successRate >= 0.7
      ? "var(--yellow)"
      : "var(--red)";

  const failureRateColor =
    health?.failedPredictions === undefined || health?.failedPredictions === 0
      ? "var(--text-primary)"
      : health.failedPredictions > 5
      ? "var(--red)"
      : "var(--yellow)";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Success Rate */}
      <div className="card" style={{ padding: 20, minHeight: 110, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          Inference Success Rate
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: successRateColor, letterSpacing: "-0.5px", lineHeight: 1, marginTop: 8 }}>
          {successRateDisplay}
        </div>
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
          <span>Total</span>
          <strong style={{ color: "var(--text-primary)" }}>{health?.totalRequests ?? "—"}</strong>
        </div>
      </div>

      {/* Card 2: Failed Predictions */}
      <div className="card" style={{ padding: 20, minHeight: 110, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          Failed Predictions
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: failureRateColor, letterSpacing: "-0.5px", lineHeight: 1, marginTop: 8 }}>
          {failedDisplay}
        </div>
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
          <span>Failure rate</span>
          <strong style={{ color: failureRateColor }}>
            {health?.failureRate !== null && health?.failureRate !== undefined
              ? `${(health.failureRate * 100).toFixed(1)}%`
              : "N/A"}
          </strong>
        </div>
      </div>

      {/* Card 3: Average Latency */}
      <div className="card" style={{ padding: 20, minHeight: 110, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em", display: "flex", alignItems: "center", gap: 5 }}>
          <Clock style={{ width: 12, height: 12 }} />
          Avg Inference Latency
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.5px", lineHeight: 1, marginTop: 8 }}>
          {avgLatencyDisplay}
        </div>
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)" }}>
          {p95LatencyDisplay}
        </div>
      </div>

      {/* Card 4: Service Status */}
      <div className="card" style={{ padding: 20, minHeight: 110, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          ML Service Status
        </div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: 15,
              fontWeight: 700,
              background: cfg.bg,
              color: cfg.color,
              border: `1px solid ${cfg.border}`,
            }}
          >
            <cfg.Icon style={{ width: 14, height: 14 }} />
            {cfg.label}
          </span>
        </div>
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
          <span>Successful</span>
          <strong style={{ color: "var(--green)" }}>{health?.successfulPredictions ?? "—"}</strong>
        </div>
      </div>
    </div>
  );
}

