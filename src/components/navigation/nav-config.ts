import React from "react";

export type NavTabId = "dashboard" | "sources" | "shadow" | "moments" | "triage";

export interface NavItemConfig {
  id: NavTabId;
  label: string;
  shortLabel: string;
}

export const NAV_ITEMS: NavItemConfig[] = [
  { id: "dashboard", label: "Dashboard", shortLabel: "Dashboard" },
  { id: "sources", label: "Sources", shortLabel: "Sources" },
  { id: "shadow", label: "ML Shadow", shortLabel: "ML Shadow" },
  { id: "moments", label: "Moments", shortLabel: "Moments" },
  { id: "triage", label: "Incident Desk", shortLabel: "Incidents" },
];

export interface NavigationProps {
  activeTab: NavTabId;
  onTabChange: (tab: NavTabId) => void;
  locationName: string;
  coords?: { lat?: number; lon?: number; name?: string } | null;
  onSelectLocation?: (loc: { id: string; name: string; lat?: number; lon?: number }) => void;
  onUseCurrentLocation?: () => void;
  isLocating?: boolean;
}

