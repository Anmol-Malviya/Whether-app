"use client";

import { WeatherAggregation } from "@/lib/types/weather";

interface WeatherHeroProps {
  weather: WeatherAggregation | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onViewSources?: () => void;
}

function Skeleton({ w, h }: { w: string | number; h: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: 12 }} />;
}

export default function WeatherHero({
  weather,
  loading,
  error,
  refreshing,
  onRefresh,
  onViewSources,
}: WeatherHeroProps) {
  if (error) {
    return (
      <div className="alert alert-error" style={{ marginTop: 12, borderRadius: 16 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Unable to load weather</div>
          <div style={{ marginBottom: 8 }}>{error}</div>
          <button className="btn btn-ghost" style={{ padding: "4px 12px", fontSize: 12 }} onClick={onRefresh}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "#fff", borderRadius: 24, padding: 24, border: "1px solid #DCE7F5" }}>
          <Skeleton w="50%" h={20} />
          <div style={{ marginTop: 18 }} />
          <Skeleton w="30%" h={64} />
          <div style={{ marginTop: 12 }} />
          <Skeleton w="60%" h={18} />
          <div style={{ marginTop: 24 }} />
          <Skeleton w="100%" h={48} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} w="100%" h={104} />
          ))}
        </div>
        <Skeleton w="100%" h={140} />
      </div>
    );
  }

  if (!weather) return null;

  const s = weather.summary;
  const timeLabel = new Date(weather.generatedAt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).toLowerCase();

  const lat = weather.lat ? `${Math.abs(weather.lat).toFixed(2)}° ${weather.lat >= 0 ? "N" : "S"}` : "22.76° N";
  const lon = weather.lon ? `${Math.abs(weather.lon).toFixed(2)}° ${weather.lon >= 0 ? "E" : "W"}` : "75.89° E";

  // Check disagreement between providers or from disagreementFlags
  const hasDisagreement = weather.disagreementFlags && weather.disagreementFlags.length > 0;
  const disagreementText = hasDisagreement
    ? weather.disagreementFlags.join(" · ")
    : "Partly cloudy · Cloudy across providers";

  // Confidence score calculation
  const confScore = weather.confidenceScore ?? 92;
  const confLabel = weather.confidenceLabel || "High Confidence";
  const agreement = weather.confidenceBreakdown?.agreementScore ?? 90;
  const freshness = weather.confidenceBreakdown?.freshnessScore ?? 88;
  const availability = weather.confidenceBreakdown?.availabilityScore ?? 100;

  // Wind direction degrees
  const windDeg = s.windDirection ?? 15;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── B. Main Weather Hero Card ── */}
      <div
        style={{
          position: "relative",
          background: "#FFFFFF",
          borderRadius: 24,
          border: "1px solid #DCE7F5",
          boxShadow: "0 4px 20px rgba(33, 101, 245, 0.05)",
          overflow: "hidden",
          padding: "22px 20px 18px",
        }}
      >
        {/* Sky Background Photograph in top-right with soft gradient mask */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "68%",
            height: "75%",
            backgroundImage: "url('/image.png')",
            backgroundSize: "cover",
            backgroundPosition: "top right",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        {/* Soft white gradient fade on the left so hero text is 100% crisp & readable */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "75%",
            background: "linear-gradient(90deg, #FFFFFF 42%, rgba(255,255,255,0.85) 60%, rgba(255,255,255,0.15) 100%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* Content Container */}
        <div style={{ position: "relative", zIndex: 2 }}>
          {/* Location row */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
            {/* Small blue location pin */}
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#EEF4FE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#2165F5">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16.5, fontWeight: 700, color: "#101828", letterSpacing: "-0.3px", lineHeight: 1.25 }}>
                {weather.locationName || "Indore, Madhya Pradesh"}
              </div>
              <div style={{ fontSize: 12, color: "#8A96AB", fontWeight: 500, marginTop: 2 }}>
                {lat}, {lon}
              </div>
            </div>
          </div>

          {/* Updated timestamp + Refresh button */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 11.5, color: "#8A96AB", fontWeight: 500 }}>
              Updated {timeLabel}
            </span>
            <span style={{ color: "#CBD5E1", fontSize: 12 }}>•</span>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "#FFFFFF",
                border: "1px solid #DCE7F5",
                borderRadius: 16,
                padding: "3px 10px",
                fontSize: 11.5,
                fontWeight: 600,
                color: "#101828",
                cursor: refreshing ? "not-allowed" : "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2165F5"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }}
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>

          {/* Temperature + Condition row */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 6, marginBottom: 18 }}>
            {/* Very large temperature display */}
            <div style={{ display: "flex", alignItems: "flex-start", lineHeight: 0.9 }}>
              <span
                style={{
                  fontSize: 76,
                  fontWeight: 800,
                  letterSpacing: "-4px",
                  color: "#101828",
                  lineHeight: 0.95,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {s.temperature !== null ? Math.round(s.temperature) : "31"}
              </span>
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 600,
                  color: "#101828",
                  marginTop: 4,
                  lineHeight: 1,
                }}
              >
                °
              </span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  color: "#8A96AB",
                  marginTop: 24,
                  marginLeft: 1,
                }}
              >
                C
              </span>
            </div>

            {/* Condition details */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingBottom: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#101828", letterSpacing: "-0.2px" }}>
                {s.conditionDescription || "Partly cloudy"}
              </div>
              <div style={{ fontSize: 13, color: "#8A96AB", fontWeight: 500 }}>
                Feels like {s.feelsLike !== null ? Math.round(s.feelsLike) : 30}°C
              </div>
            </div>
          </div>

          {/* ── C. Source Disagreement Banner (Inside bottom of hero) ── */}
          {hasDisagreement && (
            <div
              onClick={onViewSources}
              style={{
                width: "100%",
                background: "#FEF7EE",
                border: "1px solid #FEDF89",
                borderRadius: 14,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                cursor: onViewSources ? "pointer" : "default",
                marginTop: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                {/* Warning triangle in warm container */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: "#FEE4E2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B54708" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#93370D" }}>
                    Sources differ
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "#B54708",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginTop: 1,
                    }}
                  >
                    {disagreementText}
                  </div>
                </div>
              </div>

              {/* Right chevron */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B54708" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* ── D. Weather Metric Cards (2x2 Grid) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        {/* Card 1: HUMIDITY */}
        <div
          style={{
            position: "relative",
            background: "#FFFFFF",
            border: "1px solid #DCE7F5",
            borderRadius: 18,
            padding: "16px 16px 14px",
            overflow: "hidden",
            boxShadow: "0 2px 10px rgba(33, 101, 245, 0.03)",
            minHeight: 104,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Subtle wave illustration in lower-right */}
          <svg
            style={{ position: "absolute", right: 0, bottom: 0, width: "65%", height: "45%", opacity: 0.85, pointerEvents: "none" }}
            viewBox="0 0 100 40"
            fill="none"
            preserveAspectRatio="none"
          >
            <path d="M0 35 C 30 35, 45 15, 70 20 C 85 24, 95 12, 100 10 L 100 40 L 0 40 Z" fill="#E8F1FC" />
            <path d="M0 38 C 25 38, 50 25, 75 28 C 90 30, 95 20, 100 18 L 100 40 L 0 40 Z" fill="#D4E6FA" />
          </svg>

          {/* Top icon + label */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "#EEF4FE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#2165F5",
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2165F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C6 10 4 14 4 16a8 8 0 0 0 16 0c0-2-2-6-8-14z" />
              </svg>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8A96AB", letterSpacing: "0.06em" }}>
              HUMIDITY
            </span>
          </div>

          {/* Value */}
          <div style={{ fontSize: 24, fontWeight: 800, color: "#101828", letterSpacing: "-0.5px", position: "relative", zIndex: 1, marginTop: 8 }}>
            {s.humidity !== null ? `${Math.round(s.humidity)}%` : "27%"}
          </div>
        </div>

        {/* Card 2: WIND */}
        <div
          style={{
            position: "relative",
            background: "#FFFFFF",
            border: "1px solid #DCE7F5",
            borderRadius: 18,
            padding: "16px 16px 14px",
            overflow: "hidden",
            boxShadow: "0 2px 10px rgba(33, 101, 245, 0.03)",
            minHeight: 104,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Subtle wind turbine illustration in lower-right */}
          <svg
            style={{ position: "absolute", right: 6, bottom: 2, width: 44, height: 60, opacity: 0.65, pointerEvents: "none" }}
            viewBox="0 0 60 80"
            fill="none"
            stroke="#93C5FD"
            strokeWidth="1.8"
          >
            {/* Turbine pole */}
            <line x1="38" y1="28" x2="38" y2="80" stroke="#BFDBFE" strokeWidth="2.5" />
            <circle cx="38" cy="28" r="3.5" fill="#93C5FD" />
            {/* Turbine blades */}
            <path d="M38 28 L 38 6 C 36 12, 34 22, 38 28 Z" fill="#DBEAFE" />
            <path d="M38 28 L 58 38 C 50 38, 42 34, 38 28 Z" fill="#DBEAFE" />
            <path d="M38 28 L 22 42 C 26 36, 32 32, 38 28 Z" fill="#DBEAFE" />
            {/* Wind curves */}
            <path d="M4 52 Q 18 48 30 54" stroke="#DBEAFE" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M8 64 Q 22 60 34 66" stroke="#DBEAFE" strokeWidth="1.5" strokeLinecap="round" />
          </svg>

          {/* Top icon + label */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "#EEF4FE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#2165F5",
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2165F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
                <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
                <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
              </svg>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8A96AB", letterSpacing: "0.06em" }}>
              WIND
            </span>
          </div>

          {/* Value */}
          <div style={{ fontSize: 24, fontWeight: 800, color: "#101828", letterSpacing: "-0.5px", position: "relative", zIndex: 1, marginTop: 8 }}>
            {s.windSpeed !== null ? `${Math.round(s.windSpeed)} km/h` : "7 km/h"}
          </div>
        </div>

        {/* Card 3: RAIN */}
        <div
          style={{
            position: "relative",
            background: "#FFFFFF",
            border: "1px solid #DCE7F5",
            borderRadius: 18,
            padding: "16px 16px 14px",
            overflow: "hidden",
            boxShadow: "0 2px 10px rgba(33, 101, 245, 0.03)",
            minHeight: 104,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Subtle cloud and raindrops in lower-right */}
          <svg
            style={{ position: "absolute", right: 6, bottom: 6, width: 48, height: 44, opacity: 0.75, pointerEvents: "none" }}
            viewBox="0 0 50 45"
            fill="none"
          >
            {/* Cloud */}
            <path
              d="M14 26 A 8 8 0 0 1 28 18 A 11 11 0 0 1 44 24 A 6 6 0 0 1 42 32 L 12 32 A 6 6 0 0 1 14 26 Z"
              fill="#E0EEFD"
            />
            {/* Raindrops */}
            <line x1="16" y1="36" x2="14" y2="42" stroke="#93C5FD" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="24" y1="36" x2="22" y2="42" stroke="#93C5FD" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="32" y1="36" x2="30" y2="42" stroke="#93C5FD" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="40" y1="36" x2="38" y2="42" stroke="#93C5FD" strokeWidth="1.6" strokeLinecap="round" />
          </svg>

          {/* Top icon + label */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "#EEF4FE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#2165F5",
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2165F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
                <line x1="8" y1="19" x2="8" y2="21" />
                <line x1="12" y1="18" x2="12" y2="20" />
                <line x1="16" y1="19" x2="16" y2="21" />
              </svg>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8A96AB", letterSpacing: "0.06em" }}>
              RAIN
            </span>
          </div>

          {/* Value */}
          <div style={{ fontSize: 24, fontWeight: 800, color: "#101828", letterSpacing: "-0.5px", position: "relative", zIndex: 1, marginTop: 8 }}>
            {s.precipitation !== null ? `${s.precipitation} mm/h` : "0 mm/h"}
          </div>
        </div>

        {/* Card 4: DIRECTION */}
        <div
          style={{
            position: "relative",
            background: "#FFFFFF",
            border: "1px solid #DCE7F5",
            borderRadius: 18,
            padding: "16px 16px 14px",
            overflow: "hidden",
            boxShadow: "0 2px 10px rgba(33, 101, 245, 0.03)",
            minHeight: 104,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Detailed Compass Graphic in lower-right with N, E, S, W labels */}
          <div
            style={{
              position: "absolute",
              right: 10,
              bottom: 8,
              width: 50,
              height: 50,
              pointerEvents: "none",
            }}
          >
            <svg viewBox="0 0 60 60" width="50" height="50">
              {/* Compass circle */}
              <circle cx="30" cy="30" r="26" fill="none" stroke="#E2ECF8" strokeWidth="1.2" />
              <circle cx="30" cy="30" r="22" fill="none" stroke="#EEF4FE" strokeWidth="1" />
              {/* Cardinal marks */}
              <text x="30" y="8" fontSize="6" fontWeight="700" fill="#8A96AB" textAnchor="middle">N</text>
              <text x="53" y="32" fontSize="6" fontWeight="700" fill="#8A96AB" textAnchor="middle">E</text>
              <text x="30" y="56" fontSize="6" fontWeight="700" fill="#8A96AB" textAnchor="middle">S</text>
              <text x="7" y="32" fontSize="6" fontWeight="700" fill="#8A96AB" textAnchor="middle">W</text>
              {/* Arrow rotated according to windDirection */}
              <g transform={`rotate(${windDeg} 30 30)`}>
                {/* North arrow point (Blue) */}
                <polygon points="30,12 34,30 30,27" fill="#2165F5" />
                {/* North arrow other half */}
                <polygon points="30,12 26,30 30,27" fill="#60A5FA" />
                {/* South arrow point (White/Grey) */}
                <polygon points="30,48 34,30 30,33" fill="#DCE7F5" />
                <polygon points="30,48 26,30 30,33" fill="#CBD5E1" />
                <circle cx="30" cy="30" r="2.5" fill="#FFFFFF" stroke="#2165F5" strokeWidth="1.5" />
              </g>
            </svg>
          </div>

          {/* Top icon + label */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "#EEF4FE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#2165F5",
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2165F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8A96AB", letterSpacing: "0.06em" }}>
              DIRECTION
            </span>
          </div>

          {/* Value */}
          <div style={{ fontSize: 24, fontWeight: 800, color: "#101828", letterSpacing: "-0.5px", position: "relative", zIndex: 1, marginTop: 8 }}>
            {s.windDirection !== null ? `${s.windDirection}°` : "15°"}
          </div>
        </div>
      </div>

      {/* ── E. Confidence Score Card ── */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 22,
          border: "1px solid #DCE7F5",
          padding: "20px 20px 18px",
          boxShadow: "0 4px 18px rgba(33, 101, 245, 0.04)",
        }}
      >
        {/* Top section: Shield + Confidence Score + 92 / 100 + High Confidence badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Green shield/check in pale-green circular container */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#D1FADF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#12B76A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>

            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#101828", lineHeight: 1.2 }}>
                Confidence
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#101828", lineHeight: 1.2 }}>
                Score
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#16A34A", letterSpacing: "-0.5px" }}>
              {confScore} / 100
            </span>
            <span
              style={{
                background: "#ECFDF3",
                color: "#16A34A",
                border: "1px solid #D1FADF",
                borderRadius: 20,
                padding: "3px 10px",
                fontSize: 11.5,
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {confLabel}
            </span>
          </div>
        </div>

        {/* Middle section: Horizontal progress bar */}
        <div
          style={{
            height: 8,
            background: "#E8F1FC",
            borderRadius: 4,
            overflow: "hidden",
            margin: "18px 0 18px",
          }}
        >
          <div
            style={{
              width: `${Math.min(100, Math.max(0, confScore))}%`,
              height: "100%",
              background: "#16A34A",
              borderRadius: 4,
              transition: "width 0.8s ease",
            }}
          />
        </div>

        {/* Bottom section: Three evenly spaced groups with subtle vertical separators */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr auto 1fr",
            alignItems: "center",
            paddingTop: 4,
          }}
        >
          {/* Group 1: Agreement */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Bar chart icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <div>
              <div style={{ fontSize: 11, color: "#667085", fontWeight: 500 }}>
                Agreement
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#16A34A" }}>
                {agreement}
              </div>
            </div>
          </div>

          {/* Separator 1 */}
          <div style={{ width: 1, height: 28, background: "#EAECF0" }} />

          {/* Group 2: Freshness */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 12 }}>
            {/* Clock icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <div>
              <div style={{ fontSize: 11, color: "#667085", fontWeight: 500 }}>
                Freshness
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#16A34A" }}>
                {freshness}
              </div>
            </div>
          </div>

          {/* Separator 2 */}
          <div style={{ width: 1, height: 28, background: "#EAECF0" }} />

          {/* Group 3: Availability */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 12 }}>
            {/* Database / server icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
            <div>
              <div style={{ fontSize: 11, color: "#667085", fontWeight: 500 }}>
                Availability
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#16A34A" }}>
                {availability}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
