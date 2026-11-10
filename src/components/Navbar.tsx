"use client";

import React from "react";
import DesktopNavbar from "./navigation/DesktopNavbar";
import TabletNavbar from "./navigation/TabletNavbar";
import MobileHeader from "./navigation/MobileHeader";
import MobileBottomNavigation from "./navigation/MobileBottomNavigation";
import { NavigationProps, NavTabId } from "./navigation/nav-config";
import { LocationOption } from "./LocationSelector";

export type { NavTabId };

export default function Navbar(props: NavigationProps) {
  return (
    <>
      {/* ── 1. Desktop Navigation (1024px and above) ── */}
      <div className="nav-desktop-container hidden lg:block w-full">
        <DesktopNavbar {...props} />
      </div>

      {/* ── 2. Tablet Navigation (768px to 1023px) ── */}
      <div className="nav-tablet-container hidden md:block lg:hidden w-full">
        <TabletNavbar {...props} />
      </div>

      {/* ── 3. Mobile Navigation (Below 768px) ── */}
      <div className="nav-mobile-container block md:hidden w-full">
        <MobileHeader {...props} />
        <MobileBottomNavigation
          activeTab={props.activeTab}
          onTabChange={props.onTabChange}
        />
      </div>
    </>
  );
}
