"use client";

import React from "react";
import { Info } from "lucide-react";

interface ShadowNoticeProps {
  disclaimer?: string;
}

export default function ShadowNotice({ disclaimer }: ShadowNoticeProps) {
  const text =
    disclaimer ||
    "Continuous automated verification running in shadow mode. XGBoost model inferences are computed non-blocking in parallel with primary production forecasts and systematically evaluated against verified ground-truth meteorological outcomes. Operational user-facing endpoints are isolated from shadow predictions.";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 18px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        fontSize: 12,
        color: "var(--text-secondary)",
        lineHeight: 1.6,
      }}
    >
      <Info
        style={{
          width: 16,
          height: 16,
          color: "var(--accent)",
          flexShrink: 0,
          marginTop: 2,
        }}
      />
      <div>
        <strong style={{ color: "var(--text-primary)", marginRight: 6 }}>
          Shadow Monitoring Protocol:
        </strong>
        {text}
      </div>
    </div>
  );
}
