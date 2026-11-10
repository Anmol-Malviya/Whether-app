"use client";

import React from "react";
import LocationSelector, { LocationOption } from "../LocationSelector";
import { WeatherPulseLogo, NavTabIcon } from "./NavIcons";
import { NAV_ITEMS, NavigationProps } from "./nav-config";

export default function DesktopNavbar({
  activeTab,
  onTabChange,
  locationName,
  onSelectLocation,
  onUseCurrentLocation,
  isLocating,
}: NavigationProps) {
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
      <header
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "0 24px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        {/* Left: Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <WeatherPulseLogo onClick={() => onTabChange("dashboard")} />

          {activeTab === "shadow" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#D1D5DB", fontSize: 14 }}>/</span>
              <span style={{ color: "#64748B", fontSize: 13, fontWeight: 500 }}>ML Monitoring</span>
            </div>
          )}
        </div>

        {/* Center: Desktop horizontal links aligned in one row, no wrapping */}
        <nav
          aria-label="Desktop primary navigation"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexWrap: "nowrap",
          }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                aria-current={isActive ? "page" : undefined}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 11px",
                  fontSize: 12.5,
                  fontWeight: isActive ? 600 : 500,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  background: isActive ? "var(--accent-light)" : "transparent",
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  transition: "background-color 0.15s ease, color 0.15s ease",
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 0 2px rgba(33, 101, 245, 0.35)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <span style={{ display: "flex", alignItems: "center" }}>
                  <NavTabIcon tabId={item.id} isActive={isActive} />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Location selector, Notification, Profile */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {onSelectLocation && onUseCurrentLocation && (
            <div style={{ minWidth: 140, maxWidth: 200 }}>
              <LocationSelector
                currentLocationName={locationName}
                onSelectLocation={onSelectLocation}
                onUseCurrentLocation={onUseCurrentLocation}
                isLocating={isLocating}
                customTrigger={(open) => (
                  <button
                    onClick={open}
                    aria-label={`Select location, current: ${locationName}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#F8FAFC",
                      border: "1px solid #E2ECF8",
                      borderRadius: 10,
                      padding: "6px 10px",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "#101828",
                      fontFamily: "inherit",
                      transition: "border-color 0.15s ease, background 0.15s ease",
                      maxWidth: "100%",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#2165F5";
                      e.currentTarget.style.background = "#EEF4FE";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#E2ECF8";
                      e.currentTarget.style.background = "#F8FAFC";
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "#2165F5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                      </svg>
                    </div>
                    <span
                      style={{
                        maxWidth: 100,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontWeight: 600,
                      }}
                    >
                      {locationName}
                    </span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#64748B"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                )}
              />
            </div>
          )}

          {/* Notification bell */}
          <button
            aria-label="View notifications"
            style={{
              position: "relative",
              background: "#F8FAFC",
              border: "1px solid #E2ECF8",
              borderRadius: 10,
              width: 38,
              height: 38,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748B",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#101828";
              e.currentTarget.style.borderColor = "#CBD5E1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#64748B";
              e.currentTarget.style.borderColor = "#E2ECF8";
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
              aria-hidden="true"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span
              style={{
                position: "absolute",
                top: 7,
                right: 8,
                width: 7,
                height: 7,
                background: "#DC2626",
                borderRadius: "50%",
                border: "1.5px solid #FFFFFF",
              }}
              aria-hidden="true"
            />
          </button>

          {/* User profile avatar */}
          <button
            aria-label="User profile account"
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "#EEF4FE",
              border: "1px solid #D0E1FD",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2165F5",
              cursor: "pointer",
              padding: 0,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M12 2a5 5 0 100 10 5 5 0 000-10zm-7 18a7 7 0 0114 0H5z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </header>
    </div>
  );
}

