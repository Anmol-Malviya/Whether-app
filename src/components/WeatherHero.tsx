"use client";

import { WeatherAggregation } from "@/lib/types/weather";

interface WeatherHeroProps {
  weather: WeatherAggregation | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}

// SVG icons — no emoji
function WindIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
    </svg>
  );
}
function DropIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6 10 4 14 4 16a8 8 0 0 0 16 0c0-2-2-6-8-14z"/>
    </svg>
  );
}
function RainIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="19" x2="8" y2="21"/><line x1="8" y1="23" x2="8" y2="25"/><line x1="12" y1="18" x2="12" y2="20"/><line x1="16" y1="19" x2="16" y2="21"/>
    </svg>
  );
}
function CompassIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  );
}

function Skeleton({ w, h }: { w: string | number; h: number }) {
  return <div className="skeleton" style={{ width: w, height: h }} />;
}

function MetricCard({ label, value, icon }: { label: string; value: string | null; icon: React.ReactNode }) {
  return (
    <div
      style={{
        flex: "1 1 110px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "14px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function ConfidenceMeter({ score, label, breakdown }: {
  score: number | null;
  label: string;
  breakdown: { agreementScore: number; freshnessScore: number; availabilityScore: number };
}) {
  const color =
    score === null ? "var(--text-muted)"
    : score >= 80 ? "var(--green)"
    : score >= 60 ? "var(--yellow)"
    : "var(--red)";

  const subItems = [
    { label: "Agreement", val: breakdown.agreementScore, weight: "40%" },
    { label: "Freshness", val: breakdown.freshnessScore, weight: "30%" },
    { label: "Availability", val: breakdown.availabilityScore, weight: "30%" },
  ];

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "18px 20px",
        background: "var(--surface)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
          Confidence Score
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>
          {score !== null ? `${score} / 100` : "N/A"} &nbsp;·&nbsp; {label}
        </span>
      </div>
      {/* Main bar */}
      <div className="progress-track" style={{ marginBottom: 14 }}>
        <div className="progress-fill" style={{ width: score !== null ? `${score}%` : "0%", background: color }} />
      </div>
      {/* Sub-items */}
      <div style={{ display: "flex", gap: 12 }}>
        {subItems.map((item) => {
          const c = item.val >= 80 ? "var(--green)" : item.val >= 60 ? "var(--yellow)" : "var(--red)";
          return (
            <div key={item.label} style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: c }}>{item.val}</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${item.val}%`, background: c }} />
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
                {item.weight}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        This score reflects source agreement, data freshness, and provider availability — not probability of rain.
      </div>
    </div>
  );
}

export default function WeatherHero({ weather, loading, error, refreshing, onRefresh }: WeatherHeroProps) {
  if (error) {
    return (
      <div className="alert alert-error" style={{ marginTop: 24 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Unable to load weather</div>
          <div style={{ marginBottom: 10 }}>{error}</div>
          <button className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 12 }} onClick={onRefresh}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card" style={{ padding: 28 }}>
          <Skeleton w="35%" h={13} />
          <div style={{ marginTop: 20 }} />
          <Skeleton w="25%" h={60} />
          <div style={{ marginTop: 10 }} />
          <Skeleton w="50%" h={13} />
          <div style={{ marginTop: 20 }} />
          <Skeleton w="100%" h={6} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {[0,1,2,3].map(i => <Skeleton key={i} w="100%" h={80} />)}
        </div>
      </div>
    );
  }

  if (!weather) return null;

  const s = weather.summary;
  const timeLabel = new Date(weather.generatedAt).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  });

  return (
    <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Stale banner */}
      {weather.stale && (
        <div className="alert alert-warn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Showing cached data from {timeLabel}. Live fetch failed.
        </div>
      )}

      {/* Main card */}
      <div className="card" style={{ padding: "28px 28px 24px" }}>
        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
            {weather.locationName}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Updated {timeLabel}</span>
            <button
              className="btn btn-ghost"
              onClick={onRefresh}
              disabled={refreshing}
              style={{ padding: "4px 12px", fontSize: 12 }}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Temperature + condition */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, margin: "18px 0 8px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span className="temp-value">
              {s.temperature !== null ? `${Math.round(s.temperature)}°` : "—"}
            </span>
            <span style={{ fontSize: 18, color: "var(--text-muted)", fontWeight: 400 }}>C</span>
          </div>
          <div style={{ paddingBottom: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>
              {s.conditionDescription}
            </div>
            {s.feelsLike !== null && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Feels like {Math.round(s.feelsLike)}°C
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="divider" />

        {/* Disagreement */}
        {weather.disagreementFlags.length > 0 && (
          <div className="alert alert-warn" style={{ marginTop: 16 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Sources disagree</div>
              {weather.disagreementFlags.map((f, i) => <div key={i}>{f}</div>)}
            </div>
          </div>
        )}
      </div>

      {/* Metric cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <MetricCard label="Humidity" value={s.humidity !== null ? `${Math.round(s.humidity)}%` : null} icon={<DropIcon />} />
        <MetricCard label="Wind" value={s.windSpeed !== null ? `${Math.round(s.windSpeed)} km/h` : null} icon={<WindIcon />} />
        <MetricCard label="Rain" value={s.precipitation !== null ? `${s.precipitation} mm/h` : null} icon={<RainIcon />} />
        <MetricCard label="Direction" value={s.windDirection !== null ? `${s.windDirection}°` : null} icon={<CompassIcon />} />
      </div>

      {/* Confidence meter */}
      <ConfidenceMeter
        score={weather.confidenceScore}
        label={weather.confidenceLabel}
        breakdown={weather.confidenceBreakdown}
      />
    </div>
  );
}
