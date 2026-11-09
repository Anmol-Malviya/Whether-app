"use client";

import React from "react";
import { Play, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface EvaluationControlsProps {
  range: string;
  onRangeChange: (preset: string) => void;
  onRunEvaluation: () => void;
  evaluating: boolean;
  evalMessage: { type: "success" | "error" | "info"; text: string } | null;
}

const RANGE_OPTIONS = [
  { id: "24h", label: "24 Hours" },
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "all", label: "All Time" },
];

export default function EvaluationControls({
  range,
  onRangeChange,
  onRunEvaluation,
  evaluating,
  evalMessage,
}: EvaluationControlsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {/* Date Range Selector Segmented Control */}
        <div
          style={{
            display: "inline-flex",
            padding: 3,
            background: "var(--surface-hover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            gap: 2,
          }}
        >
          {RANGE_OPTIONS.map((opt) => {
            const isActive = range === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onRangeChange(opt.id)}
                className="btn-compact"
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 500,
                  borderRadius: "calc(var(--radius) - 2px)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: isActive ? "var(--accent)" : "transparent",
                  color: isActive ? "#FFFFFF" : "var(--text-secondary)",
                  boxShadow: isActive ? "0 1px 3px rgba(37,99,235,0.2)" : "none",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Trigger Evaluation Button */}
        <button
          onClick={onRunEvaluation}
          disabled={evaluating}
          className="btn btn-primary btn-compact"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: "var(--radius)",
            cursor: evaluating ? "not-allowed" : "pointer",
            opacity: evaluating ? 0.7 : 1,
          }}
        >
          {evaluating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Running Evaluation...</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current" />
              <span>Run Evaluation Cycle</span>
            </>
          )}
        </button>
      </div>

      {/* Inline Feedback Banner */}
      {evalMessage && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "10px 14px",
            borderRadius: "var(--radius)",
            fontSize: 12.5,
            lineHeight: 1.5,
            background:
              evalMessage.type === "success"
                ? "var(--green-light)"
                : evalMessage.type === "error"
                ? "var(--red-light)"
                : "var(--accent-light)",
            color:
              evalMessage.type === "success"
                ? "var(--green)"
                : evalMessage.type === "error"
                ? "var(--red)"
                : "var(--accent)",
            border: `1px solid ${
              evalMessage.type === "success"
                ? "var(--green-border)"
                : evalMessage.type === "error"
                ? "var(--red-border)"
                : "var(--accent-border)"
            }`,
          }}
        >
          {evalMessage.type === "success" && (
            <CheckCircle2 style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1, color: "var(--green)" }} />
          )}
          {evalMessage.type === "error" && (
            <AlertCircle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1, color: "var(--red)" }} />
          )}
          <span>{evalMessage.text}</span>
        </div>
      )}
    </div>
  );
}
