"use client";

import { useState } from "react";

export interface LocationOption {
  id: string;
  name: string;
  lat?: number;
  lon?: number;
}

export const PRESET_CITIES: LocationOption[] = [
  { id: "indore", name: "Indore, Madhya Pradesh", lat: 22.7196, lon: 75.8577 },
  { id: "bhopal", name: "Bhopal, Madhya Pradesh", lat: 23.2599, lon: 77.4126 },
  { id: "mumbai", name: "Mumbai, Maharashtra", lat: 19.0760, lon: 72.8777 },
  { id: "delhi", name: "New Delhi, Delhi", lat: 28.6139, lon: 77.2090 },
  { id: "bengaluru", name: "Bengaluru, Karnataka", lat: 12.9716, lon: 77.5946 },
  { id: "pune", name: "Pune, Maharashtra", lat: 18.5204, lon: 73.8567 },
  { id: "jaipur", name: "Jaipur, Rajasthan", lat: 26.9124, lon: 75.7873 },
  { id: "ahmedabad", name: "Ahmedabad, Gujarat", lat: 23.0225, lon: 72.5714 },
  { id: "kolkata", name: "Kolkata, West Bengal", lat: 22.5726, lon: 88.3639 },
  { id: "hyderabad", name: "Hyderabad, Telangana", lat: 17.3850, lon: 78.4867 },
  { id: "ujjain", name: "Ujjain, Madhya Pradesh", lat: 23.1765, lon: 75.7885 },
  { id: "gwalior", name: "Gwalior, Madhya Pradesh", lat: 26.2183, lon: 78.1828 },
  { id: "jabalpur", name: "Jabalpur, Madhya Pradesh", lat: 23.1815, lon: 79.9864 },
];

interface LocationSelectorProps {
  currentLocationName: string;
  coordsText?: string;
  onSelectLocation: (loc: LocationOption) => void;
  onUseCurrentLocation: () => void;
  isLocating?: boolean;
  customTrigger?: (open: () => void) => React.ReactNode;
}

export default function LocationSelector({
  currentLocationName,
  coordsText,
  onSelectLocation,
  onUseCurrentLocation,
  isLocating = false,
  customTrigger,
}: LocationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = PRESET_CITIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ position: "relative", width: customTrigger ? "100%" : "auto" }}>
      {customTrigger ? (
        customTrigger(() => setIsOpen(true))
      ) : (
        /* Pill button that opens modal / dropdown */
        <button
          onClick={() => setIsOpen(!isOpen)}
          id="location-picker-btn"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "var(--accent-light, #eff6ff)",
            border: "1px solid rgba(37,99,235,0.2)",
            borderRadius: 20,
            padding: "4px 10px",
            color: "var(--accent, #2563eb)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            maxWidth: 190,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            transition: "all 0.15s",
          }}
          title="Change location"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {currentLocationName.split(",")[0]}
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, opacity: 0.7 }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 998,
              background: "rgba(0,0,0,0.25)",
              backdropFilter: "blur(2px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: 290,
              maxHeight: 380,
              background: "#fff",
              borderRadius: 14,
              boxShadow: "0 12px 35px rgba(0,0,0,0.18), 0 2px 10px rgba(0,0,0,0.08)",
              border: "1px solid var(--border, #e5e7eb)",
              zIndex: 999,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              animation: "fadeIn 0.15s ease",
            }}
          >
            {/* Header / Current GPS action */}
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
              <button
                onClick={() => {
                  onUseCurrentLocation();
                  setIsOpen(false);
                }}
                disabled={isLocating}
                id="use-my-gps-btn"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "9px 12px",
                  borderRadius: 9,
                  background: "var(--accent, #2563eb)",
                  color: "#fff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: isLocating ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                {isLocating ? "Detecting GPS…" : "Use My Current Location"}
              </button>

              {/* Search input */}
              <div style={{ position: "relative", marginTop: 10 }}>
                <input
                  type="text"
                  placeholder="Search city (e.g. Bhopal, Delhi)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "7px 10px 7px 28px",
                    borderRadius: 7,
                    border: "1px solid #d1d5db",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="2"
                  style={{ position: "absolute", left: 8, top: 9 }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
            </div>

            {/* City list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "6px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted, #6b7280)", padding: "4px 8px" }}>
                POPULAR CITIES
              </div>
              {filtered.map((city) => (
                <button
                  key={city.id}
                  onClick={() => {
                    onSelectLocation(city);
                    setIsOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: currentLocationName.toLowerCase().includes(city.id)
                      ? "var(--accent-light, #eff6ff)"
                      : "transparent",
                    color: currentLocationName.toLowerCase().includes(city.id)
                      ? "var(--accent, #2563eb)"
                      : "var(--text-primary, #111827)",
                    border: "none",
                    fontSize: 13,
                    textAlign: "left",
                    cursor: "pointer",
                    fontWeight: currentLocationName.toLowerCase().includes(city.id) ? 600 : 400,
                  }}
                >
                  <span>{city.name}</span>
                  {currentLocationName.toLowerCase().includes(city.id) && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
