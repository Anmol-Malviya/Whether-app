"use client";

import React, { useRef } from "react";
import { HourlyForecastItem, HourlyForecastMetadata } from "@/lib/types/weather";

interface HourlyForecastStripProps {
  items: HourlyForecastItem[] | undefined;
  metadata?: HourlyForecastMetadata;
}

/**
 * Pixel-accurate vector representation matching the user's reference image:
 * A rich golden yellow crescent moon with two sharp 4-pointed stars.
 */
function ReferenceMoon() {
  return (
    <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
      {/* Golden yellow crescent moon */}
      <path
        d="M20.2 6.5C16.8 8.2 14.5 11.8 14.5 16C14.5 21.8 19.2 26.5 25 26.5C26.5 26.5 27.9 26.2 29.2 25.6C26.8 29.6 22.4 32.2 17.5 32.2C10 32.2 4 26.2 4 18.7C4 11.9 9 6.3 15.6 5.3C17.1 5 18.7 5.4 20.2 6.5Z"
        fill="#FFBE1A"
      />
      {/* Top star */}
      <path
        d="M27.5 9.5C27.5 11.2 28.5 12.5 30 12.5C28.5 12.5 27.5 13.8 27.5 15.5C27.5 13.8 26.5 12.5 25 12.5C26.5 12.5 27.5 11.2 27.5 9.5Z"
        fill="#FFBE1A"
      />
      {/* Lower star */}
      <path
        d="M30 18.5C30 19.8 30.8 20.8 32 20.8C30.8 20.8 30 21.8 30 23C30 21.8 29.2 20.8 28 20.8C29.2 20.8 30 19.8 30 18.5Z"
        fill="#FFBE1A"
      />
    </svg>
  );
}

/**
 * Pixel-accurate matching golden sun for daytime hours.
 */
function ReferenceSun() {
  return (
    <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
      {/* Petal/rounded rays */}
      <g fill="#FFBE1A">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <circle
            key={angle}
            cx="18"
            cy="5.5"
            r="2.8"
            transform={`rotate(${angle} 18 18)`}
          />
        ))}
      </g>
      {/* Main core circle */}
      <circle cx="18" cy="18" r="8.5" fill="#FFBE1A" />
    </svg>
  );
}

/**
 * Matching golden rain cloud
 */
function ReferenceRainCloud() {
  return (
    <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
      <path
        d="M10 22C8 22 6.5 20.4 6.5 18.5C6.5 16.7 7.8 15.2 9.6 15C10.3 11.8 13.1 9.5 16.5 9.5C20.3 9.5 23.5 12.4 23.8 16.1C25.3 16.6 26.5 18 26.5 19.7C26.5 21.6 25 23 23.1 23L10 22Z"
        fill="#94A3B8"
      />
      <line x1="12" y1="25" x2="10" y2="29" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      <line x1="17" y1="26" x2="15" y2="30" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      <line x1="22" y1="25" x2="20" y2="29" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function renderReferenceIcon(item: HourlyForecastItem) {
  if (item.precipitation !== null && item.precipitation > 0) {
    return <ReferenceRainCloud />;
  }
  return item.isNight ? <ReferenceMoon /> : <ReferenceSun />;
}

export default function HourlyForecastStrip({ items }: HourlyForecastStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  return (
    <div
      style={{
        background: "#1E2E4E", // Exact deep indigo navy background from reference
        borderRadius: 24,       // Exactly rounded pill-like corners from reference
        padding: "16px 20px 18px",
        marginTop: 14,
        marginBottom: 14,
        overflow: "hidden",
      }}
    >
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 22,
          overflowX: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
          paddingLeft: 2,
          paddingRight: 2,
        }}
      >
        {items.map((item, idx) => (
          <div
            key={item.time}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              userSelect: "none",
            }}
          >
            {/* Exact Time sequence (Now, 11:00 pm, 12:00 am, 1:00 am...) */}
            <span
              style={{
                fontSize: 14,
                fontWeight: idx === 0 ? 600 : 500,
                color: "#FFFFFF",
                whiteSpace: "nowrap",
                marginBottom: 10,
                lineHeight: 1,
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              {item.hourLabel}
            </span>

            {/* Exact Moon/Sun Icon */}
            <div
              style={{
                height: 34,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 8,
              }}
            >
              {renderReferenceIcon(item)}
            </div>

            {/* Exact Temperature (27°, 20°, 19°, 19°, 18°...) */}
            <span
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: "#FFFFFF",
                letterSpacing: "-0.5px",
                lineHeight: 1,
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              {item.temperature !== null ? `${Math.round(item.temperature)}°` : "N/A"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
