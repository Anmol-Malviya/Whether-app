import React from "react";
import { NavTabId } from "./nav-config";

export function WeatherPulseLogo({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "2px 0",
        fontFamily: "inherit",
        textAlign: "left",
      }}
      aria-label="WeatherPulse home"
    >
      {/* Sun icon */}
      <div
        style={{
          width: 28,
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <circle cx="16" cy="16" r="7.5" fill="#FBBF24" />
          <line x1="16" y1="2" x2="16" y2="5" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="16" y1="27" x2="16" y2="30" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="2" y1="16" x2="5" y2="16" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="27" y1="16" x2="30" y2="16" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="6.1" y1="6.1" x2="8.2" y2="8.2" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="23.8" y1="23.8" x2="25.9" y2="25.9" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="6.1" y1="25.9" x2="8.2" y2="23.8" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="23.8" y1="8.2" x2="25.9" y2="6.1" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>

      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.4px", display: "flex", alignItems: "center" }}>
        <span style={{ color: "#111828" }}>Weather</span>
        <span style={{ color: "#2165F5" }}>Pulse</span>
      </div>
    </button>
  );
}

export function NavTabIcon({ tabId, isActive }: { tabId: NavTabId; isActive: boolean }) {
  switch (tabId) {
    case "dashboard":
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill={isActive ? "#2165F5" : "none"}
          stroke={isActive ? "#2165F5" : "currentColor"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        </svg>
      );
    case "sources":
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      );
    case "shadow":
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      );
    case "moments":
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case "triage":
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill={isActive ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    default:
      return null;
  }
}

