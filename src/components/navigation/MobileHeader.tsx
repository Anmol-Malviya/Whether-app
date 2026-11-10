"use client";

import React from "react";
import LocationSelector, { LocationOption } from "../LocationSelector";
import { WeatherPulseLogo } from "./NavIcons";
import { NavigationProps } from "./nav-config";

export default function MobileHeader({
  onTabChange,
  locationName,
  coords,
  onSelectLocation,
  onUseCurrentLocation,
  isLocating,
}: NavigationProps) {
  // Format coordinates string for location bar
  const latStr = coords?.lat !== undefined ? coords.lat.toFixed(2) : "22.76";
  const lonStr = coords?.lon !== undefined ? coords.lon.toFixed(2) : "75.89";
  const coordsLabel = `(${latStr}, ${lonStr})`;

  return (
    <div
      style={{
        width: "100%",
        background: "#FFFFFF",
        borderBottom: "1px solid #E5E7EB",
        position: "sticky",
        top: 0,
        zIndex: 90,
      }}
    >
      {/* Top row: Brand + Notifications + User Avatar */}
      <header
        style={{
          width: "100%",
          maxWidth: 440,
          margin: "0 auto",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxSizing: "border-box",
        }}
      >
        <WeatherPulseLogo onClick={() => onTabChange("dashboard")} />

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Notification bell */}
          <button
            aria-label="Notifications"
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
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
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
              aria-hidden="true"
            />
          </button>

          {/* User profile avatar */}
          <button
            aria-label="User account profile"
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#EEF2FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2165F5",
              cursor: "pointer",
              border: "1px solid #E0E7FF",
              padding: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M12 2a5 5 0 100 10 5 5 0 000-10zm-7 18a7 7 0 0114 0H5z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </header>

      {/* Sub-header: Location Selector Bar for Mobile */}
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          margin: "0 auto 10px",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxSizing: "border-box",
        }}
      >
        {onSelectLocation && onUseCurrentLocation ? (
          <div style={{ flex: 1, minWidth: 0 }}>
            <LocationSelector
              currentLocationName={locationName}
              onSelectLocation={onSelectLocation}
              onUseCurrentLocation={onUseCurrentLocation}
              isLocating={isLocating}
              customTrigger={(open) => (
                <button
                  onClick={open}
                  id="mobile-location-picker-bar-btn"
                  aria-label={`Select location, current: ${locationName}`}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#EEF4FE",
                    border: "1px solid #D5E4F8",
                    borderRadius: 24,
                    padding: "8px 14px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, overflow: "hidden" }}>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#2165F5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                      </svg>
                    </div>

                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#101828" }}>
                        Current Location
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "#475467" }}>
                        {coordsLabel}
                      </span>
                    </div>
                  </div>

                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2165F5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              )}
            />
          </div>
        ) : null}

        {onUseCurrentLocation && (
          <button
            onClick={onUseCurrentLocation}
            disabled={isLocating}
            title="Recenter GPS"
            aria-label="Recenter GPS location"
            id="mobile-gps-target-btn"
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "#EEF4FE",
              border: "1px solid #D5E4F8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2165F5",
              cursor: isLocating ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
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
    </div>
  );
}

