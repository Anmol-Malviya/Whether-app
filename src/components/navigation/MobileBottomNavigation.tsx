"use client";

import React from "react";
import { NavTabIcon } from "./NavIcons";
import { NAV_ITEMS, NavTabId } from "./nav-config";

interface MobileBottomNavigationProps {
  activeTab: NavTabId;
  onTabChange: (tab: NavTabId) => void;
}

export default function MobileBottomNavigation({
  activeTab,
  onTabChange,
}: MobileBottomNavigationProps) {
  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile bottom navigation"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: "#FFFFFF",
        boxShadow: "0 -2px 14px rgba(0, 0, 0, 0.06)",
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
          height: 60,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: isActive ? "#2165F5" : "#8A96AB",
                fontFamily: "inherit",
                position: "relative",
                padding: "6px 0",
                transition: "color 0.15s ease",
              }}
              id={`nav-tab-${item.id}`}
            >
              {/* Active indicator bar at top of active tab */}
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 44,
                    height: 3,
                    borderRadius: "0 0 3px 3px",
                    background: "#2165F5",
                  }}
                  aria-hidden="true"
                />
              )}

              <div
                style={{
                  transform: isActive ? "scale(1.05)" : "scale(1)",
                  transition: "transform 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <NavTabIcon tabId={item.id} isActive={isActive} />
              </div>

              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: isActive ? 600 : 500,
                  letterSpacing: "-0.1px",
                  lineHeight: 1,
                }}
              >
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

