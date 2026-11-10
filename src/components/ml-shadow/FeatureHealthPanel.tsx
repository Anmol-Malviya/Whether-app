"use client";

import React from "react";
import { InputFeatureAvailability } from "./types";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface FeatureHealthPanelProps {
  /** Feature availability from the most recently attempted prediction (may be null if no data) */
  featureAvailability: InputFeatureAvailability | null | undefined;
  loading: boolean;
}

const FEATURE_LABELS: { key: keyof Omit<InputFeatureAvailability, "observationCount" | "intervalsValid">; label: string }[] = [
  { key: "temperature_2m",        label: "Temperature (2m)" },
  { key: "relative_humidity_2m",  label: "Relative Humidity" },
  { key: "dew_point_2m",          label: "Dew Point" },
  { key: "precipitation",         label: "Precipitation" },
  { key: "wind_speed_10m",        label: "Wind Speed (10m)" },
  { key: "wind_direction_10m",    label: "Wind Direction" },
  { key: "surface_pressure",      label: "Surface Pressure" },
  { key: "cloud_cover",           label: "Cloud Cover" },
];

export default function FeatureHealthPanel({
  featureAvailability,
  loading,
}: FeatureHealthPanelProps) {
  if (loading && !featureAvailability) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div className="skeleton" style={{ width: 160, height: 14, borderRadius: 6, marginBottom: 20 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
          {FEATURE_LABELS.map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 44, borderRadius: "var(--radius)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (!featureAvailability) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Input Feature Health
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
            Per-variable availability from the most recent inference attempt.
          </p>
        </div>
        <div style={{ marginTop: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          <AlertCircle style={{ width: 28, height: 28, margin: "0 auto 8px", display: "block", color: "var(--border)" }} />
          No feature availability data recorded yet.
          <br />
          Data populates after the next inference attempt.
        </div>
      </div>
    );
  }

  const availableCount = FEATURE_LABELS.filter((f) => featureAvailability[f.key]).length;
  const missingCount = FEATURE_LABELS.length - availableCount;

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Input Feature Health
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
              Per-variable availability across last 3 observation windows.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <span
              style={{
                fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                background: "var(--green-light)", color: "var(--green)", border: "1px solid var(--green-border)",
              }}
            >
              {availableCount} available
            </span>
            {missingCount > 0 && (
              <span
                style={{
                  fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                  background: "var(--red-light)", color: "var(--red)", border: "1px solid var(--red-border)",
                }}
              >
                {missingCount} missing
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Feature grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))", gap: 10 }}>
        {FEATURE_LABELS.map(({ key, label }) => {
          const available = featureAvailability[key];
          return (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                borderRadius: "var(--radius)",
                background: available ? "var(--green-light)" : "var(--red-light)",
                border: `1px solid ${available ? "var(--green-border)" : "var(--red-border)"}`,
              }}
            >
              {available ? (
                <CheckCircle2 style={{ width: 14, height: 14, color: "var(--green)", flexShrink: 0 }} />
              ) : (
                <XCircle style={{ width: 14, height: 14, color: "var(--red)", flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 12, fontWeight: 600, color: available ? "var(--green)" : "var(--red)", lineHeight: 1.3 }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer: observation count + interval validity */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          fontSize: 12,
          color: "var(--text-secondary)",
        }}
      >
        <span>
          Observation windows: <strong style={{ color: "var(--text-primary)" }}>{featureAvailability.observationCount}</strong>
          <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>(need ≥ 3)</span>
        </span>
        <span>
          Hourly intervals:&nbsp;
          {featureAvailability.intervalsValid ? (
            <strong style={{ color: "var(--green)" }}>Valid</strong>
          ) : (
            <strong style={{ color: "var(--red)" }}>Invalid</strong>
          )}
        </span>
      </div>
    </div>
  );
}

