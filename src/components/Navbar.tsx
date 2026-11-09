"use client";

import LocationSelector, { LocationOption } from "./LocationSelector";

type Tab = "dashboard" | "sources" | "shadow" | "moments" | "triage";

const tabs: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "sources", label: "Sources" },
  { id: "shadow", label: "ML Shadow" },
  { id: "moments", label: "Moments" },
  { id: "triage", label: "Incident Desk" },
];

interface NavbarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  locationName: string;
  coords?: { lat?: number; lon?: number; name?: string } | null;
  onSelectLocation?: (loc: LocationOption) => void;
  onUseCurrentLocation?: () => void;
  isLocating?: boolean;
}

export default function Navbar({
  activeTab,
  onTabChange,
  locationName,
  coords,
  onSelectLocation,
  onUseCurrentLocation,
  isLocating,
}: NavbarProps) {
  // Format coordinates string for location bar
  const latStr = coords?.lat !== undefined ? coords.lat.toFixed(2) : "22.76";
  const lonStr = coords?.lon !== undefined ? coords.lon.toFixed(2) : "75.89";
  const coordsLabel = `(${latStr}, ${lonStr})`;

  return (
    <>
      {/* ── Top Header Bar ── */}
      <div style={{ width: "100%", background: "#FFFFFF", borderBottom: "1px solid #E5E7EB", position: "sticky", top: 0, zIndex: 90 }}>
        <header
          style={{
            maxWidth: activeTab === "shadow" ? 1440 : 440,
            margin: "0 auto",
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "max-width 0.2s ease",
          }}
        >
        {/* Brand & Optional Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Sun icon */}
          <div
            style={{
              width: 26,
              height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            onClick={() => onTabChange("dashboard")}
          >
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="7.5" fill="#FBBF24" />
              {/* Sun rays */}
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

          <div
            style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.4px", cursor: "pointer", display: "flex", alignItems: "center" }}
            onClick={() => onTabChange("dashboard")}
          >
            <span style={{ color: "#111827" }}>Weather</span>
            <span style={{ color: "#2563EB" }}>Pulse</span>
          </div>

          {activeTab === "shadow" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 2 }}>
              <span style={{ color: "#D1D5DB", fontSize: 14 }}>/</span>
              <span style={{ color: "#64748B", fontSize: 13, fontWeight: 500 }}>ML Monitoring</span>
            </div>
          )}
        </div>

        {/* Desktop Navigation Links for Wide Screens */}
        <div className="hidden md:flex" style={{ alignItems: "center", gap: 6 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="btn-compact"
                style={{
                  padding: "6px 12px",
                  fontSize: 12.5,
                  fontWeight: isActive ? 600 : 500,
                  borderRadius: "var(--radius)",
                  border: "none",
                  cursor: "pointer",
                  background: isActive ? "var(--accent-light)" : "transparent",
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  transition: "all 0.15s ease",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right actions: Location Selector, Bell, Profile */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Header Location Selector for ML Monitoring view on desktop */}
          {activeTab === "shadow" && onSelectLocation && onUseCurrentLocation && (
            <div className="hidden sm:block" style={{ minWidth: 200 }}>
              <LocationSelector
                currentLocationName={locationName}
                onSelectLocation={onSelectLocation}
                onUseCurrentLocation={onUseCurrentLocation}
                isLocating={isLocating}
                customTrigger={(open) => (
                  <button
                    onClick={open}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#F8FAFC",
                      border: "1px solid #E5E7EB",
                      borderRadius: 8,
                      padding: "5px 10px",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "#111827",
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: "#2563EB",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="#FFFFFF">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                      </svg>
                    </div>
                    <span style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                      {locationName}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                )}
              />
            </div>
          )}

          {/* Notification bell with red dot */}
          <button
            style={{
              position: "relative",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748B",
            }}
            aria-label="Notifications"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {/* Red badge dot */}
            <span
              style={{
                position: "absolute",
                top: 5,
                right: 6,
                width: 6,
                height: 6,
                background: "#DC2626",
                borderRadius: "50%",
                border: "1.5px solid #FFFFFF",
              }}
            />
          </button>

          {/* User profile avatar */}
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#EEF2FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2563EB",
              cursor: "pointer",
              border: "1px solid #E0E7FF",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M12 2a5 5 0 100 10 5 5 0 000-10zm-7 18a7 7 0 0114 0H5z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </header>
      </div>

      {/* ── Mobile/Default Location Selector Bar (Hidden completely on Shadow Monitoring tab to avoid duplicate location bars) ── */}
      {activeTab !== "shadow" && (
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          margin: "6px auto 14px",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxSizing: "border-box",
        }}
      >
        {onSelectLocation && onUseCurrentLocation ? (
          <div style={{ flex: 1 }}>
            <LocationSelector
              currentLocationName={locationName}
              onSelectLocation={onSelectLocation}
              onUseCurrentLocation={onUseCurrentLocation}
              isLocating={isLocating}
              customTrigger={(open) => (
                <button
                  onClick={open}
                  id="location-picker-bar-btn"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#EEF4FE",
                    border: "1px solid #D5E4F8",
                    borderRadius: 24,
                    padding: "9px 16px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, overflow: "hidden" }}>
                    {/* Blue location pin icon */}
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: "#2165F5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFFFFF">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                      </svg>
                    </div>

                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: "#101828" }}>
                        Current Location
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#475467" }}>
                        {coordsLabel}
                      </span>
                    </div>
                  </div>

                  {/* Dropdown chevron */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2165F5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              )}
            />
          </div>
        ) : null}

        {/* Separate rounded location-target button on right */}
        {onUseCurrentLocation && (
          <button
            onClick={onUseCurrentLocation}
            disabled={isLocating}
            title="Recenter GPS"
            id="gps-target-btn"
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "#EEF4FE",
              border: "1px solid #D5E4F8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2165F5",
              cursor: isLocating ? "not-allowed" : "pointer",
              flexShrink: 0,
              transition: "transform 0.15s ease",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: isLocating ? "spin 1.2s linear infinite" : "none" }}
            >
              <circle cx="12" cy="12" r="7" />
              <polyline points="12 2 12 6" />
              <polyline points="12 18 12 22" />
              <polyline points="2 12 6 12" />
              <polyline points="18 12 22 12" />
            </svg>
          </button>
        )}
      </div>
      )}

      {/* ── Fixed Bottom Navigation Bar matching screenshot (Mobile only) ── */}
      <nav
        id="mobile-bottom-nav"
        className="md:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: "#FFFFFF",
          boxShadow: "0 -2px 14px rgba(0, 0, 0, 0.05)",
          borderTop: "1px solid #EEF3FA",
          display: "flex",
          justifyContent: "center",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div
          style={{
            maxWidth: 440,
            width: "100%",
            display: "flex",
            alignItems: "stretch",
            height: 64,
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
                  gap: 4,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: isActive ? "#2165F5" : "#8A96AB",
                  fontFamily: "inherit",
                  position: "relative",
                  transition: "color 0.15s",
                }}
                id={`nav-tab-${tab.id}`}
              >
                {/* Active indicator bar at top of active tab */}
                {isActive && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 54,
                      height: 3,
                      borderRadius: "3px 3px 0 0",
                      background: "#2165F5",
                    }}
                  />
                )}
                <div
                  suppressHydrationWarning
                  style={{ transform: isActive ? "scale(1.05)" : "scale(1)", transition: "transform 0.15s" }}
                >
                  {tab.id === "dashboard" && (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill={isActive ? "#2165F5" : "none"} stroke="#2165F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
                    </svg>
                  )}
                  {tab.id === "sources" && (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                  )}
                  {tab.id === "moments" && (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  )}
                  {tab.id === "shadow" && (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  )}
                  {tab.id === "triage" && (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill={isActive ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: isActive ? 600 : 500,
                    letterSpacing: "-0.1px",
                  }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
