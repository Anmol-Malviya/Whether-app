"use client";

import { useEffect, useState } from "react";

type Tab = "dashboard" | "sources" | "moments" | "share";

interface NavbarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  locationName: string;
  onSelectLocation?: (loc: import("./LocationSelector").LocationOption) => void;
  onUseCurrentLocation?: () => void;
  isLocating?: boolean;
}

import LocationSelector from "./LocationSelector";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id: "sources",
    label: "Sources",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
      </svg>
    ),
  },
  {
    id: "moments",
    label: "Moments",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
  },
  {
    id: "share",
    label: "Share",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    ),
  },
];

export default function Navbar({
  activeTab,
  onTabChange,
  locationName,
  onSelectLocation,
  onUseCurrentLocation,
  isLocating,
}: NavbarProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* ── Desktop top navbar ── */
  if (!isMobile) {
    return (
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 52,
          }}
        >
          {/* Wordmark & Location */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>
                WeatherPulse
              </span>
            </div>

            {onSelectLocation && onUseCurrentLocation && (
              <LocationSelector
                currentLocationName={locationName}
                onSelectLocation={onSelectLocation}
                onUseCurrentLocation={onUseCurrentLocation}
                isLocating={isLocating}
              />
            )}
          </div>

          {/* Tabs */}
          <nav style={{ display: "flex", gap: 2 }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                  background: activeTab === tab.id ? "var(--accent-light)" : "transparent",
                  color: activeTab === tab.id ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
    );
  }

  /* ── Mobile compact top bar ── */
  return (
    <>
      {/* Slim top bar — brand & Location Selector */}
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          height: 50,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
              <circle cx="12" cy="12" r="4"/>
            </svg>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>WeatherPulse</span>
          </div>

          {onSelectLocation && onUseCurrentLocation ? (
            <LocationSelector
              currentLocationName={locationName}
              onSelectLocation={onSelectLocation}
              onUseCurrentLocation={onUseCurrentLocation}
              isLocating={isLocating}
            />
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{locationName}</span>
          )}
        </div>
      </header>

      {/* Bottom tab bar */}
      <nav
        id="mobile-bottom-nav"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(16px)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "stretch",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                padding: "8px 4px 10px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: isActive ? "var(--accent)" : "var(--text-muted)",
                fontFamily: "inherit",
                transition: "color 0.15s",
                position: "relative",
              }}
              id={`mobile-tab-${tab.id}`}
            >
              {/* Active indicator dot */}
              {isActive && (
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 24,
                  height: 2.5,
                  borderRadius: "0 0 4px 4px",
                  background: "var(--accent)",
                }} />
              )}
              <div style={{ opacity: isActive ? 1 : 0.65, transition: "transform 0.15s", transform: isActive ? "scale(1.05)" : "scale(1)" }}>
                {tab.icon}
              </div>
              <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, letterSpacing: "0.01em" }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
