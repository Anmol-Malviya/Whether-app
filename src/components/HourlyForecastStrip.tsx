"use client";

import React, { useRef, useState } from "react";
import { HourlyForecastItem, HourlyForecastMetadata } from "@/lib/types/weather";

interface HourlyForecastStripProps {
  items: HourlyForecastItem[] | undefined;
  metadata?: HourlyForecastMetadata;
}

/**
 * Cute, animated SVG vector icons with subtle gradients, glows, and sparkling stars.
 */

function CuteCrescentMoon() {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" fill="none" style={{ filter: "drop-shadow(0 2px 8px rgba(251, 191, 36, 0.45))" }}>
      <defs>
        <linearGradient id="cuteMoonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id="cuteStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FDE047" />
        </linearGradient>
      </defs>
      <path
        d="M26.5 7.5C21.8 8.8 18.5 13.1 18.5 18.2C18.5 24 23.2 28.7 29 28.7C30.6 28.7 32.1 28.3 33.5 27.6C31.5 32 27 35 21.8 35C14.7 35 9 29.3 9 22.2C9 15.6 14 10.2 20.4 9.5C22.4 9.3 24.5 8.6 26.5 7.5Z"
        fill="url(#cuteMoonGrad)"
      />
      <ellipse cx="16.5" cy="22" rx="2" ry="1.2" fill="#F472B6" opacity="0.6" />
      <path
        d="M32 10C32 10 32.8 11.8 34 12C32.8 12.2 32 14 32 14C32 14 31.2 12.2 30 12C31.2 11.8 32 10 32 10Z"
        fill="url(#cuteStarGrad)"
      />
      <path
        d="M31 22C31 22 31.5 23 32.5 23.2C31.5 23.4 31 24.5 31 24.5C31 24.5 30.5 23.4 29.5 23.2C30.5 23 31 22 31 22Z"
        fill="#FFFFFF"
        opacity="0.9"
      />
      <circle cx="13" cy="11" r="1" fill="#FFFFFF" opacity="0.8" />
    </svg>
  );
}

function CuteBrightSun() {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" fill="none" style={{ filter: "drop-shadow(0 2px 10px rgba(245, 158, 11, 0.5))" }}>
      <defs>
        <linearGradient id="cuteSunGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="45%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
        <linearGradient id="cuteRayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <g>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <rect
            key={angle}
            x="18"
            y="4"
            width="4"
            height="5.5"
            rx="2"
            fill="url(#cuteRayGrad)"
            transform={`rotate(${angle} 20 20)`}
          />
        ))}
      </g>
      <circle cx="20" cy="20" r="10" fill="url(#cuteSunGrad)" />
      <ellipse cx="16" cy="22" rx="1.5" ry="1" fill="#FB7185" opacity="0.65" />
      <ellipse cx="24" cy="22" rx="1.5" ry="1" fill="#FB7185" opacity="0.65" />
      <circle cx="17.5" cy="16.5" r="1.8" fill="#FFFFFF" opacity="0.6" />
    </svg>
  );
}

function CuteRainCloud() {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" fill="none" style={{ filter: "drop-shadow(0 2px 8px rgba(56, 189, 248, 0.4))" }}>
      <defs>
        <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>
      <path
        d="M12 24C9.8 24 8 22.2 8 20C8 18 9.5 16.3 11.5 16.1C12.3 12.6 15.4 10 19 10C23.2 10 26.7 13.2 27 17.3C28.7 17.8 30 19.3 30 21.2C30 23.3 28.3 25 26.2 25L12 24Z"
        fill="url(#cloudGrad)"
      />
      <line x1="14" y1="27" x2="12" y2="32" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="28" x2="18" y2="33" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      <line x1="26" y1="27" x2="24" y2="32" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CutePartlyCloudy({ isNight }: { isNight: boolean }) {
  return (
    <div style={{ position: "relative", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: 0, right: 1, transform: "scale(0.72)" }}>
        {isNight ? <CuteCrescentMoon /> : <CuteBrightSun />}
      </div>
      <svg width="24" height="24" viewBox="0 0 30 24" fill="none" style={{ position: "absolute", bottom: 2, left: 2, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}>
        <path
          d="M7 18C5.3 18 4 16.7 4 15C4 13.5 5.1 12.2 6.6 12C7.2 9.5 9.5 7.6 12.3 7.6C15.6 7.6 18.3 10 18.6 13.1C20 13.5 21 14.7 21 16.1C21 17.7 19.7 19 18.1 19L7 18Z"
          fill="#E2E8F0"
        />
      </svg>
    </div>
  );
}

function renderCuteWeatherIcon(item: HourlyForecastItem) {
  if ((item.precipitation !== null && item.precipitation > 0) || item.conditionCode === "rainy") {
    return <CuteRainCloud />;
  }
  if (item.conditionCode === "partly-cloudy" || item.conditionCode === "cloudy") {
    return <CutePartlyCloudy isNight={item.isNight} />;
  }
  return item.isNight ? <CuteCrescentMoon /> : <CuteBrightSun />;
}

export default function HourlyForecastStrip({ items, metadata }: HourlyForecastStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeItem, setActiveItem] = useState<number>(0);

  if (!items || items.length === 0) return null;

  return (
    <div
      style={{
        background: "#0D1424",
        borderRadius: 22,
        padding: "18px 20px 18px",
        color: "#FFFFFF",
        boxShadow: "0 12px 36px rgba(13, 20, 36, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        marginTop: 14,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background ambient glow */}
      <div
        style={{
          position: "absolute",
          top: -40,
          left: 120,
          width: 180,
          height: 100,
          background: "radial-gradient(ellipse, rgba(33, 101, 245, 0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Header with Explicit Source Provenance */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.2px", color: "#F8FAFC" }}>
            24-Hour Forecast Trend
          </span>

          {/* Explicit NWP Source Provenance Badge */}
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 20,
              background: "rgba(14, 165, 233, 0.18)",
              color: "#38BDF8",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#38BDF8" }} />
            Open-Meteo NWP Forecast
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {metadata?.lastUpdatedAt && (
            <span style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>
              Updated {new Date(metadata.lastUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}
            </span>
          )}
          <span style={{ fontSize: 11.5, color: "#94A3B8", fontWeight: 500 }}>
            Scroll horizontally →
          </span>
        </div>
      </div>

      {/* Horizontal Carousel Container */}
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
          paddingTop: 2,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
          position: "relative",
          zIndex: 2,
        }}
      >
        {items.map((item, idx) => {
          const isSelected = activeItem === idx;

          return (
            <div
              key={item.time}
              onClick={() => setActiveItem(idx)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
                minWidth: 72,
                padding: "14px 10px 14px",
                borderRadius: 16,
                background: isSelected
                  ? "rgba(255, 255, 255, 0.11)"
                  : "rgba(255, 255, 255, 0.035)",
                border: isSelected
                  ? "1.5px solid rgba(96, 165, 250, 0.55)"
                  : "1px solid rgba(255, 255, 255, 0.05)",
                boxShadow: isSelected
                  ? "0 4px 16px rgba(33, 101, 245, 0.25)"
                  : "none",
                transform: isSelected ? "translateY(-2px)" : "none",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                cursor: "pointer",
                userSelect: "none",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.07)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.035)";
                  e.currentTarget.style.transform = "none";
                }
              }}
            >
              {/* Time Label */}
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? "#93C5FD" : "#94A3B8",
                  whiteSpace: "nowrap",
                  marginBottom: 12,
                  letterSpacing: "-0.1px",
                }}
              >
                {item.hourLabel}
              </span>

              {/* Cute Weather Icon */}
              <div
                style={{
                  height: 38,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                  transform: isSelected ? "scale(1.12)" : "scale(1)",
                  transition: "transform 0.2s ease",
                }}
              >
                {renderCuteWeatherIcon(item)}
              </div>

              {/* Temperature (Strict: shows N/A if null, never 0°C fallback) */}
              <span
                style={{
                  fontSize: 19,
                  fontWeight: 800,
                  color: "#FFFFFF",
                  letterSpacing: "-0.5px",
                  lineHeight: 1,
                }}
              >
                {item.temperature !== null ? `${item.temperature}°` : "N/A"}
              </span>

              {/* Rain indicator if precipitation */}
              {item.precipitation !== null && item.precipitation > 0 ? (
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: "#38BDF8",
                    marginTop: 6,
                    padding: "1px 5px",
                    borderRadius: 8,
                    background: "rgba(56, 189, 248, 0.15)",
                  }}
                >
                  {item.precipitation}mm
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Footer Transparency Disclaimer */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 8,
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          fontSize: 11,
          color: "#64748B",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <span>
          Data Source: <strong style={{ color: "#94A3B8" }}>Open-Meteo Physical NWP Simulation</strong> (Not ML derived)
        </span>
        {metadata?.forecastValidFrom && metadata?.forecastValidTo && (
          <span>
            Horizon: {metadata.forecastValidFrom.slice(11, 16)} to {metadata.forecastValidTo.slice(11, 16)} IST (24h)
          </span>
        )}
      </div>
    </div>
  );
}
