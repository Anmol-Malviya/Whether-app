"use client";

import { useState } from "react";

export interface LocationOption {
  id: string;
  name: string;
  lat?: number;
  lon?: number;
}

const PRESET_LOCATIONS: LocationOption[] = [
  { id: "indore",     name: "Indore, Madhya Pradesh",   lat: 22.7196, lon: 75.8577 },
  { id: "bhopal",     name: "Bhopal, Madhya Pradesh",   lat: 23.2599, lon: 77.4126 },
  { id: "delhi",      name: "New Delhi, Delhi",          lat: 28.6139, lon: 77.2090 },
  { id: "mumbai",     name: "Mumbai, Maharashtra",       lat: 19.0760, lon: 72.8777 },
  { id: "bengaluru",  name: "Bengaluru, Karnataka",      lat: 12.9716, lon: 77.5946 },
  { id: "pune",       name: "Pune, Maharashtra",         lat: 18.5204, lon: 73.8567 },
  { id: "jaipur",     name: "Jaipur, Rajasthan",         lat: 26.9124, lon: 75.7873 },
  { id: "ahmedabad",  name: "Ahmedabad, Gujarat",        lat: 23.0225, lon: 72.5714 },
  { id: "kolkata",    name: "Kolkata, West Bengal",      lat: 22.5726, lon: 88.3639 },
  { id: "hyderabad",  name: "Hyderabad, Telangana",      lat: 17.3850, lon: 78.4867 },
  { id: "ujjain",     name: "Ujjain, Madhya Pradesh",    lat: 23.1765, lon: 75.7885 },
  { id: "gwalior",    name: "Gwalior, Madhya Pradesh",   lat: 26.2183, lon: 78.1828 },
  { id: "jabalpur",   name: "Jabalpur, Madhya Pradesh",  lat: 23.1815, lon: 79.9864 },
];

interface LocationSelectorProps {
  currentLocationName: string;
  onSelectLocation: (loc: LocationOption) => void;
  onUseCurrentLocation: () => void;
  isLocating?: boolean;
  /** If provided, renders this element as the trigger instead of the default button */
  customTrigger?: (open: () => void) => React.ReactNode;
}

export default function LocationSelector({
  currentLocationName,
  onSelectLocation,
  onUseCurrentLocation,
  isLocating,
  customTrigger,
}: LocationSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = PRESET_LOCATIONS.filter((l) =>
    l.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (loc: LocationOption) => {
    onSelectLocation(loc);
    setOpen(false);
    setQuery("");
  };

  const handleCurrentLocation = () => {
    onUseCurrentLocation();
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Trigger */}
      {customTrigger ? (
        customTrigger(() => setOpen((v) => !v))
      ) : (
        <button
          onClick={() => setOpen((v) => !v)}
          id="location-selector-btn"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#EEF4FE",
            border: "1px solid #D5E4F8",
            borderRadius: 20,
            padding: "6px 14px",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: "#101828",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#2165F5">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
          <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>
            {currentLocationName}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2165F5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* Dropdown panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => { setOpen(false); setQuery(""); }}
            style={{ position: "fixed", inset: 0, zIndex: 200 }}
          />

          {/* Panel */}
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              zIndex: 201,
              background: "#FFFFFF",
              border: "1px solid #DCE7F5",
              borderRadius: 16,
              boxShadow: "0 10px 32px rgba(33, 101, 245, 0.12), 0 2px 8px rgba(0,0,0,0.06)",
              minWidth: 260,
              overflow: "hidden",
            }}
          >
            {/* Search */}
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #EEF3FA" }}>
              <div style={{ position: "relative" }}>
                <svg
                  width="14" height="14"
                  viewBox="0 0 24 24" fill="none" stroke="#8A96AB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
                >
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search city…"
                  style={{
                    width: "100%",
                    padding: "7px 10px 7px 32px",
                    border: "1px solid #DCE7F5",
                    borderRadius: 10,
                    fontSize: 13,
                    fontFamily: "inherit",
                    outline: "none",
                    background: "#F8FBFF",
                    color: "#101828",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Use current location */}
            <button
              onClick={handleCurrentLocation}
              disabled={isLocating}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                border: "none",
                borderBottom: "1px solid #EEF3FA",
                background: "transparent",
                cursor: isLocating ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                color: "#2165F5",
                textAlign: "left",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: isLocating ? "spin 1s linear infinite" : "none", flexShrink: 0 }}>
                <circle cx="12" cy="12" r="7" /><polyline points="12 2 12 6" /><polyline points="12 18 12 22" /><polyline points="2 12 6 12" /><polyline points="18 12 22 12" />
              </svg>
              {isLocating ? "Detecting location…" : "Use my current location"}
            </button>

            {/* City list */}
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "16px 14px", fontSize: 13, color: "#8A96AB", textAlign: "center" }}>
                  No cities found
                </div>
              ) : (
                filtered.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => handleSelect(loc)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "10px 14px",
                      border: "none",
                      borderBottom: "1px solid #F4F8FD",
                      background: "transparent",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 13,
                      color: "#101828",
                      textAlign: "left",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F4F8FD")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span>{loc.name}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
