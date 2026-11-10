"use client";

import React, { useState } from "react";
import LocationSelector, { LocationOption } from "../LocationSelector";
import { WeatherPulseLogo, NavTabIcon } from "./NavIcons";
import { NAV_ITEMS, NavigationProps } from "./nav-config";

export default function TabletNavbar({
  activeTab,
  onTabChange,
  locationName,
  onSelectLocation,
  onUseCurrentLocation,
  isLocating,
}: NavigationProps) {
  const [menuOpen, setMenuOpen] = useState(false);

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
          width: "100%",
          padding: "0 20px",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          boxSizing: "border-box",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <WeatherPulseLogo
            onClick={() => {
              onTabChange("dashboard");
              setMenuOpen(false);
            }}
          />
        </div>

        {/* Center: Quick location or current tab badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "center", minWidth: 0 }}>
          {onSelectLocation && onUseCurrentLocation && (
            <div style={{ maxWidth: 220, width: "100%" }}>
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
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#F8FAFC",
                      border: "1px solid #E2ECF8",
                      borderRadius: 8,
                      padding: "5px 10px",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "#101828",
                      fontFamily: "inherit",
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: "#2165F5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                      </svg>
                    </div>
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontWeight: 600,
                        textAlign: "left",
                        flex: 1,
                      }}
                    >
                      {locationName}
                    </span>
                    <svg
                      width="12" height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#64748B"
                      strokeWidth="2"
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
        </div>

        {/* Right side: Active Tab indicator + Hamburger toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {/* Active section pill */}
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              background: "#EEF4FE",
              color: "#2165F5",
              fontSize: 11.5,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <NavTabIcon tabId={activeTab} isActive={true} />
            <span>{NAV_ITEMS.find((n) => n.id === activeTab)?.label}</span>
          </span>

          {/* Menu Drawer Toggle Button */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="tablet-nav-menu"
            aria-label={menuOpen ? "Close menu" : "Open navigation menu"}
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: menuOpen ? "#EEF4FE" : "#F8FAFC",
              border: "1px solid #E2ECF8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: menuOpen ? "#2165F5" : "#101828",
              transition: "all 0.15s ease",
            }}
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Dropdown Adaptive Menu */}
      {menuOpen && (
        <div
          id="tablet-nav-menu"
          style={{
            borderTop: "1px solid #E5E7EB",
            background: "#FFFFFF",
            padding: "12px 20px 16px",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.08)",
          }}
        >
          <nav aria-label="Tablet navigation menu" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setMenuOpen(false);
                  }}
                  aria-current={isActive ? "page" : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid",
                    borderColor: isActive ? "var(--accent-border)" : "var(--border)",
                    background: isActive ? "var(--accent-light)" : "#FFFFFF",
                    color: isActive ? "var(--accent)" : "var(--text-primary)",
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <NavTabIcon tabId={item.id} isActive={isActive} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}

