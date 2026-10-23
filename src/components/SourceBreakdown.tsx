"use client";

import { WeatherAggregation, NormalizedWeatherData } from "@/lib/types/weather";

function SignalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.51 4.49A14 14 0 0 1 22.49 4.49"/><path d="M5.12 7.88A9 9 0 0 1 18.88 7.88"/><path d="M8.73 11.27a4 4 0 0 1 6.54 0"/><circle cx="12" cy="15" r="1"/>
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}

const PROVIDER_LINKS: Record<string, { name: string; href: string; attribution: string }> = {
  "open-meteo":    { name: "Open-Meteo",    href: "https://open-meteo.com",         attribution: "Open-Meteo · CC BY 4.0" },
  weatherapi:      { name: "WeatherAPI",    href: "https://www.weatherapi.com",      attribution: "WeatherAPI.com" },
  openweathermap:  { name: "OpenWeatherMap",href: "https://openweathermap.org",      attribution: "OpenWeatherMap" },
};

const STATUS_LABELS: Record<string, string> = {
  ok: "Live", partial: "Estimated", error: "Error", timeout: "Timeout", disabled: "Disabled",
};

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: value ? "var(--text-primary)" : "var(--text-muted)" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function ProviderCard({ p }: { p: NormalizedWeatherData }) {
  const link = PROVIDER_LINKS[p.provider];
  const isAvailable = p.providerStatus === "ok" || p.providerStatus === "partial";

  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SignalIcon />
          <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
            {p.providerDisplayName}
          </span>
        </div>
        <span className={`badge badge-${p.providerStatus}`}>
          {STATUS_LABELS[p.providerStatus] ?? p.providerStatus}
        </span>
      </div>

      {!isAvailable ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
          {p.errorMessage ?? "No data from this provider."}
        </div>
      ) : (
        <div>
          {/* Condition + temp summary */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{p.conditionDescription}</div>
              {p.observedAt && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Observed {new Date(p.observedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
            {p.temperature !== null && (
              <span style={{ fontSize: 26, fontWeight: 700, color: "var(--accent)", letterSpacing: "-1px" }}>
                {Math.round(p.temperature)}°C
              </span>
            )}
          </div>

          {/* Metrics */}
          <div style={{ fontSize: 13 }}>
            <Row label="Feels like"    value={p.feelsLike    !== null ? `${Math.round(p.feelsLike)}°C` : null} />
            <Row label="Humidity"      value={p.humidity     !== null ? `${Math.round(p.humidity)}%` : null} />
            <Row label="Wind"          value={p.windSpeed    !== null ? `${Math.round(p.windSpeed)} km/h` : null} />
            <Row label="Precipitation" value={p.precipitation !== null ? `${p.precipitation} mm/h` : null} />
          </div>

          {/* Partial note */}
          {p.providerStatus === "partial" && (
            <div className="alert alert-warn" style={{ marginTop: 12, fontSize: 12, padding: "8px 12px" }}>
              {p.errorMessage ?? "Estimated — no API key configured"}
            </div>
          )}
        </div>
      )}

      {/* Attribution */}
      <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{link?.attribution}</span>
        {link && (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent)", textDecoration: "none" }}
          >
            {link.name} <ExternalLinkIcon />
          </a>
        )}
      </div>
    </div>
  );
}

export default function SourceBreakdown({ weather, loading }: { weather: WeatherAggregation | null; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="skeleton" style={{ height: 16, width: "30%" }} />
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 180 }} />)}
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="alert alert-info" style={{ marginTop: 24 }}>
        Load the dashboard first to see source details.
      </div>
    );
  }

  const okCount = weather.providers.filter(p => p.providerStatus === "ok").length;

  return (
    <div style={{ marginTop: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Data Sources</h2>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {okCount} of {weather.providers.length} live
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {weather.providers.map(p => <ProviderCard key={p.provider} p={p} />)}
      </div>

      {/* Scoring note */}
      <div className="card" style={{ padding: "16px 20px", marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
          How the confidence score works
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>
          <strong style={{ color: "var(--text-primary)" }}>40%</strong> source agreement (temperature + condition consensus) &nbsp;·&nbsp;
          <strong style={{ color: "var(--text-primary)" }}>30%</strong> data freshness (how recent observations are) &nbsp;·&nbsp;
          <strong style={{ color: "var(--text-primary)" }}>30%</strong> provider availability (how many sources responded).
          The score does <em>not</em> represent probability of rain.
        </div>
      </div>
    </div>
  );
}
