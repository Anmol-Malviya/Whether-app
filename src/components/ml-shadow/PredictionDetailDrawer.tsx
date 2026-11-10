"use client";

import React, { useEffect, useCallback, useState } from "react";
import { PredictionDetail, InputFeatureAvailability } from "./types";
import { X, CheckCircle2, XCircle, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import FeatureHealthPanel from "./FeatureHealthPanel";
import { formatUtcTime12h } from "./timeUtils";

interface PredictionDetailDrawerProps {
  predictionId: string | null;
  onClose: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  input_validation:               "Input Validation",
  weather_data_collection:        "Weather Data Collection",
  feature_engineering:            "Feature Engineering",
  ml_service_connection:          "ML Service Connection",
  model_inference:                "Model Inference",
  prediction_response_validation: "Response Validation",
  database_persistence:           "Database Persistence",
};

const FAILURE_CODE_DESCRIPTIONS: Record<string, { label: string; description: string }> = {
  ML_SERVICE_TIMEOUT:        { label: "ML Service Timeout",      description: "The FastAPI ML service did not respond within the 3-second timeout. The service may be overloaded or starting up." },
  ML_SERVICE_UNAVAILABLE:    { label: "ML Service Unavailable",  description: "Could not reach the Python ML microservice. The process may not be running or the port may be blocked." },
  ML_HTTP_ERROR:             { label: "HTTP Error from ML API",  description: "The ML service returned an HTTP error status code. Check if the request payload is valid or if the service has an internal error." },
  INPUT_VALIDATION_FAILED:   { label: "Input Validation Failed", description: "The 3 hourly weather observations did not pass validation checks (e.g. wrong interval, out-of-range values, missing fields)." },
  FEATURE_MISSING:           { label: "Missing Weather Feature",  description: "One or more of the 8 required meteorological variables was null or non-finite in the Open-Meteo response." },
  FEATURE_STALE:             { label: "Stale Input Features",    description: "The latest available observation was older than the 2.5-hour staleness threshold. No fresh data was available." },
  INVALID_MODEL_OUTPUT:      { label: "Invalid Model Output",    description: "The ML model returned a NaN or null value for the temperature or rain probability prediction." },
  DB_WRITE_FAILED:           { label: "Database Write Failed",   description: "MongoDB could not persist the prediction record within the 2.5-second write timeout." },
  UNKNOWN_ERROR:             { label: "Unknown Error",           description: "An unclassified error occurred. Check server logs for more context." },
};

export default function PredictionDetailDrawer({
  predictionId,
  onClose,
}: PredictionDetailDrawerProps) {
  const [detail, setDetail] = useState<PredictionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setDetail(null);
    try {
      const res = await fetch(`/api/weather/ml-shadow/diagnostics/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data: PredictionDetail = await res.json();
      setDetail(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load prediction details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (predictionId) {
      fetchDetail(predictionId);
    } else {
      setDetail(null);
      setError(null);
    }
  }, [predictionId, fetchDetail]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!predictionId) return null;

  const failureInfo = detail?.failure?.code
    ? FAILURE_CODE_DESCRIPTIONS[detail.failure.code]
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(16,24,40,0.3)",
          backdropFilter: "blur(2px)",
          zIndex: 40,
          transition: "opacity 0.2s ease",
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(100vw, 540px)",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          animation: "slideInRight 0.22s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 20px 14px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            background: "var(--surface)",
            zIndex: 10,
          }}
        >
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Prediction Diagnostics
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono, monospace)" }}>
              {predictionId}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface-hover)",
              cursor: "pointer",
              color: "var(--text-secondary)",
              flexShrink: 0,
            }}
            aria-label="Close details panel"
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: 18 }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 10, color: "var(--text-muted)" }}>
              <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 13 }}>Loading diagnostic data…</span>
            </div>
          )}

          {error && (
            <div
              style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "12px 14px", borderRadius: "var(--radius)",
                background: "var(--red-light)", border: "1px solid var(--red-border)", color: "var(--red)",
              }}
            >
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13 }}>{error}</span>
            </div>
          )}

          {detail && (
            <>
              {/* ── Failure Classification ─────────────────────────────── */}
              {detail.failure && (
                <section>
                  <SectionHeader
                    title="Failure Classification"
                    badge={{ text: detail.failure.code, color: "var(--red)", bg: "var(--red-light)", border: "var(--red-border)" }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <InfoRow label="Error Code" value={<MonoCode text={detail.failure.code} />} />
                    <InfoRow
                      label="Pipeline Stage"
                      value={
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5 }}>
                          {detail.failure.stage ? (STAGE_LABELS[detail.failure.stage] ?? detail.failure.stage) : "—"}
                          {detail.failure.stage && (
                            <MonoCode text={detail.failure.stage} />
                          )}
                        </span>
                      }
                    />
                    {detail.failure.httpStatusCode && (
                      <InfoRow label="HTTP Status" value={<MonoCode text={String(detail.failure.httpStatusCode)} />} />
                    )}
                    <InfoRow
                      label="Retry Count"
                      value={
                        <span style={{ color: detail.failure.retryCount > 0 ? "var(--yellow)" : "var(--text-primary)", fontWeight: 600 }}>
                          {detail.failure.retryCount}× attempted
                        </span>
                      }
                    />
                    {detail.failure.inferenceLatencyMs && (
                      <InfoRow label="Inference Duration" value={`${detail.failure.inferenceLatencyMs}ms`} />
                    )}
                    {detail.failure.reason && (
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>
                          Error Detail
                        </div>
                        <div
                          style={{
                            padding: "10px 12px",
                            background: "var(--red-light)",
                            border: "1px solid var(--red-border)",
                            borderRadius: "var(--radius)",
                            fontSize: 12.5,
                            color: "var(--red)",
                            fontFamily: "var(--font-mono, monospace)",
                            wordBreak: "break-word",
                            lineHeight: 1.5,
                          }}
                        >
                          {detail.failure.reason}
                        </div>
                      </div>
                    )}
                    {failureInfo && (
                      <div
                        style={{
                          padding: "10px 12px",
                          background: "var(--accent-light)",
                          border: "1px solid var(--accent-border)",
                          borderRadius: "var(--radius)",
                          fontSize: 12.5,
                          color: "var(--accent)",
                          lineHeight: 1.5,
                        }}
                      >
                        <strong>{failureInfo.label}:</strong> {failureInfo.description}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* ── Prediction Metadata ────────────────────────────────── */}
              <section>
                <SectionHeader title="Prediction Metadata" />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <InfoRow label="Location" value={`${detail.locationId} (${detail.coordinates.lat.toFixed(4)}°N, ${detail.coordinates.lon.toFixed(4)}°E)`} />
                  <InfoRow label="Target Time (UTC)" value={<MonoCode text={formatUtcTime12h(detail.targetLeadTimeUtc, true)} />} />
                  <InfoRow label="Generated At (UTC)" value={<MonoCode text={formatUtcTime12h(detail.generatedAt, true)} />} />
                  <InfoRow label="Dataset Version" value={<MonoCode text={detail.datasetVersion ?? "unknown"} />} />
                  <InfoRow label="Input Source" value={detail.inputSource} />
                  <InfoRow label="Evaluation Status" value={<StatusPill status={detail.evaluation.status} />} />
                  <InfoRow label="Evaluation Attempts" value={String(detail.evaluation.attempts)} />
                </div>
              </section>

              {/* ── Prediction Values ──────────────────────────────────── */}
              <section>
                <SectionHeader title="Prediction Values" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <MetricTile
                    label="Predicted Temperature"
                    value={detail.prediction.temperature !== null ? `${detail.prediction.temperature.toFixed(1)}°C` : "—"}
                    present={detail.prediction.temperature !== null}
                  />
                  <MetricTile
                    label="Rain Probability"
                    value={detail.prediction.rainProbability !== null ? `${(detail.prediction.rainProbability * 100).toFixed(1)}%` : "—"}
                    present={detail.prediction.rainProbability !== null}
                  />
                  <MetricTile
                    label="Rain Classification"
                    value={detail.prediction.rainClass !== null ? (detail.prediction.rainClass ? "Rain" : "No Rain") : "—"}
                    present={detail.prediction.rainClass !== null}
                  />
                  <MetricTile
                    label="Rain Threshold"
                    value={`${(detail.prediction.rainThreshold * 100).toFixed(2)}%`}
                    present={true}
                  />
                </div>
              </section>

              {/* ── Feature Health ─────────────────────────────────────── */}
              <section>
                <SectionHeader title="Input Feature Availability" />
                <FeatureHealthPanel
                  featureAvailability={detail.inputFeatureAvailability}
                  loading={false}
                />
              </section>

              {/* ── Service Response ───────────────────────────────────── */}
              {Object.keys(detail.providerMetadata).length > 0 && (
                <section>
                  <SectionHeader title="Service Response" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {detail.providerMetadata.endpoint !== undefined && detail.providerMetadata.endpoint !== null && (
                      <InfoRow label="Endpoint" value={<MonoCode text={String(detail.providerMetadata.endpoint)} />} />
                    )}
                    {Boolean(detail.providerMetadata.systemVersions) && (
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>
                          System Versions
                        </div>
                        <pre
                          style={{
                            fontSize: 11.5,
                            fontFamily: "var(--font-mono, monospace)",
                            padding: "10px 12px",
                            background: "var(--surface-hover)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius)",
                            overflowX: "auto",
                            margin: 0,
                            color: "var(--text-secondary)",
                          }}
                        >
                          {JSON.stringify(detail.providerMetadata.systemVersions, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* ── Actual Outcome (if evaluated) ──────────────────────── */}
              {detail.actualOutcome && (
                <section>
                  <SectionHeader title="Actual Outcome" badge={{ text: "Evaluated", color: "var(--green)", bg: "var(--green-light)", border: "var(--green-border)" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <InfoRow label="Actual Temperature" value={`${detail.actualOutcome.actualTemperature.toFixed(1)}°C`} />
                    <InfoRow label="Temperature Error (|ΔT|)" value={`${detail.actualOutcome.temperatureAbsoluteError.toFixed(2)}°C`} />
                    <InfoRow label="Actual Rain" value={detail.actualOutcome.actualRainClass ? "Rain" : "No Rain"} />
                    <InfoRow label="Rain Correct" value={detail.actualOutcome.rainCorrect ? "✓ Yes" : "✗ No"} />
                    <InfoRow label="Brier Loss" value={detail.actualOutcome.brierLoss.toFixed(4)} />
                    <InfoRow label="Outcome Source" value={detail.actualOutcome.outcomeSource} />
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  badge,
}: {
  title: string;
  badge?: { text: string; color: string; bg: string; border: string };
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <h3 style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>
        {title}
      </h3>
      {badge && (
        <span
          style={{
            fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
            background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
          }}
        >
          {badge.text}
        </span>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--surface-hover)" }}>
      <span style={{ fontSize: 12.5, color: "var(--text-secondary)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", textAlign: "right", wordBreak: "break-word" }}>
        {value}
      </span>
    </div>
  );
}

function MonoCode({ text }: { text: string }) {
  return (
    <code
      style={{
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 11.5,
        background: "var(--surface-hover)",
        border: "1px solid var(--border)",
        padding: "1px 6px",
        borderRadius: 6,
        color: "var(--text-primary)",
      }}
    >
      {text}
    </code>
  );
}

function MetricTile({ label, value, present }: { label: string; value: string; present: boolean }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: present ? "var(--surface-hover)" : "var(--red-light)",
        border: `1px solid ${present ? "var(--border)" : "var(--red-border)"}`,
        borderRadius: "var(--radius)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: present ? "var(--text-primary)" : "var(--red)" }}>
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const configs: Record<string, { color: string; bg: string; border: string }> = {
    evaluated:         { color: "var(--green)",  bg: "var(--green-light)",  border: "var(--green-border)"  },
    pending:           { color: "var(--accent)",  bg: "var(--accent-light)",  border: "var(--accent-border)"  },
    failed_prediction: { color: "var(--red)",     bg: "var(--red-light)",     border: "var(--red-border)"    },
    evaluating:        { color: "var(--yellow)",  bg: "var(--yellow-light)",  border: "var(--yellow-border)" },
  };
  const cfg = configs[status] ?? { color: "var(--text-muted)", bg: "var(--surface-hover)", border: "var(--border)" };
  return (
    <span style={{ fontSize: 11.5, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {status}
    </span>
  );
}

