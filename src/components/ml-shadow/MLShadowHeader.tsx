"use client";

import React from "react";
import { RefreshCw, Radio } from "lucide-react";

interface MLShadowHeaderProps {
  lastUpdated: Date | null;
  onRefresh: () => void;
  loading: boolean;
}

export default function MLShadowHeader({
  lastUpdated,
  onRefresh,
  loading,
}: MLShadowHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
        paddingBottom: 20,
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Title & Subtitle */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1
            style={{
              fontSize: "clamp(1.25rem, 3vw, 1.5rem)",
              fontWeight: 700,
              letterSpacing: "-0.5px",
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            ML Model Monitoring
          </h1>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 10px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.02em",
              background: "var(--accent-light)",
              color: "var(--accent)",
              border: "1px solid var(--accent-border)",
            }}
          >
            <Radio className="w-3 h-3 text-[#2563EB]" style={{ animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }} />
            SHADOW MODE
          </span>
        </div>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          Monitor prediction quality, data integrity and model performance in real time.
        </p>
      </div>

      {/* Right side: Timestamp & Refresh */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {lastUpdated && (
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
            Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        )}
        <button
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh metrics"
          className="btn-compact"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-primary)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-sm)",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
            opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw
            style={{
              width: 13,
              height: 13,
              color: "var(--text-secondary)",
              animation: loading ? "spin 1s linear infinite" : "none",
            }}
          />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
}
