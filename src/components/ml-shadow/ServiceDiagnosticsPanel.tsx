"use client";

import React from "react";
import { ServiceHealthData } from "./types";
import { CheckCircle2, AlertCircle, Wifi, Database, Brain, Cloud } from "lucide-react";

interface ServiceDiagnosticsPanelProps {
  health: ServiceHealthData | null;
  loading: boolean;
}

const STATUS_STYLES = {
  healthy:     { color: "var(--green)",      bg: "var(--green-light)",   border: "var(--green-border)"  },
  degraded:    { color: "var(--yellow)",     bg: "var(--yellow-light)",  border: "var(--yellow-border)" },
  unavailable: { color: "var(--red)",        bg: "var(--red-light)",     border: "var(--red-border)"    },
  unknown:     { color: "var(--text-muted)", bg: "var(--surface-hover)", border: "var(--border)"        },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.unknown;
  const Icon = status === "healthy" ? CheckCircle2 : status === "unavailable" ? Wifi : AlertCircle;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 9px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        textTransform: "capitalize",
      }}
    >
      <Icon style={{ width: 11, height: 11 }} />
      {status}
    </span>
  );
}

export default function ServiceDiagnosticsPanel({
  health,
  loading,
}: ServiceDiagnosticsPanelProps) {
  const rows = [
    {
      key: "mlService",
      label: "Python ML Service",
      Icon: Brain,
      data: health?.services.mlService,
      extra: health?.services.mlService?.featureCount !== undefined
        ? `${health.services.mlService.featureCount} features loaded`
        : undefined,
    },
    {
      key: "database",
      label: "MongoDB Database",
      Icon: Database,
      data: health?.services.database,
    },
    {
      key: "weatherProvider",
      label: "Open-Meteo (Weather Provider)",
      Icon: Cloud,
      data: health?.services.weatherProvider,
    },
  ];

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          Service Diagnostics
        </h3>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
          Live dependency health checks.
          {health?.checkedAt && (
            <span style={{ marginLeft: 6, color: "var(--text-muted)" }}>
              Checked {new Date(health.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}
            </span>
          )}
        </p>
      </div>

      {loading && !health ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ width: "100%", height: 56, borderRadius: "var(--radius)" }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map(({ key, label, Icon, data, extra }) => (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                background: "var(--surface-hover)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon style={{ width: 16, height: 16, color: "var(--text-secondary)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                    {data?.detail ?? "Checking…"}
                    {extra && <span style={{ marginLeft: 6 }}>· {extra}</span>}
                    {data?.responseTimeMs !== null && data?.responseTimeMs !== undefined && (
                      <span style={{ marginLeft: 6 }}>· {data.responseTimeMs}ms</span>
                    )}
                  </div>
                </div>
              </div>
              <StatusBadge status={data?.status ?? "unknown"} />
            </div>
          ))}
        </div>
      )}

      {health?.overallStatus && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Overall system status</span>
          <StatusBadge status={health.overallStatus} />
        </div>
      )}
    </div>
  );
}

