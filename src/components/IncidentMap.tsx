"use client";

import { useEffect, useRef, useState } from "react";
import { IncidentCluster } from "./OfficerTriagePanel";

interface IncidentMapProps {
  clusters: IncidentCluster[];
  userCoords?: { lat?: number; lon?: number; name?: string } | null;
  onSelectCluster?: (cluster: IncidentCluster) => void;
}

export default function IncidentMap({ clusters, userCoords, onSelectCluster }: IncidentMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<IncidentCluster | null>(null);

  // Center on user coords or first incident or Indore center
  const defaultLat = userCoords?.lat || (clusters.length > 0 ? clusters[0].coordinates.lat : 22.7196);
  const defaultLon = userCoords?.lon || (clusters.length > 0 ? clusters[0].coordinates.lon : 75.8577);

  useEffect(() => {
    // Dynamically inject Leaflet CSS & JS to prevent Next.js SSR window is not defined errors
    if (typeof window === "undefined") return;

    const cssId = "leaflet-css-cdn";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }

    const scriptId = "leaflet-js-cdn";
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const initializeMap = () => {
      const L = (window as any).L;
      if (!L || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [defaultLat, defaultLon],
          zoom: 13,
          zoomControl: false,
        });

        // Use 100% Free OpenStreetMap standard tiles (No API key required)
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          subdomains: ["a", "b", "c"],
          maxZoom: 19,
          crossOrigin: true,
        }).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);
        mapInstanceRef.current = map;
        setMapLoaded(true);

        // Ensure tiles render immediately without gray/blank areas
        setTimeout(() => {
          map.invalidateSize();
        }, 150);
      } else {
        // If map was already initialized, trigger size calculation
        setTimeout(() => {
          mapInstanceRef.current?.invalidateSize();
        }, 100);
      }
    };

    if (!(window as any).L) {
      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
        script.crossOrigin = "";
        script.onload = () => initializeMap();
        document.body.appendChild(script);
      } else {
        script.addEventListener("load", initializeMap);
      }
    } else {
      initializeMap();
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setMapLoaded(false);
      }
    };
  }, []);

  // Update Markers & Cluster Circles whenever clusters or map updates
  useEffect(() => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map || !mapLoaded) return;

    // Clear old markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    // Add user marker if available
    if (userCoords?.lat && userCoords?.lon) {
      const userIcon = L.divIcon({
        className: "custom-user-pin",
        html: `
          <div style="position: relative; width: 20px; height: 20px;">
            <div style="position: absolute; inset: -4px; border-radius: 50%; background: rgba(33, 101, 245, 0.25); animation: pulse 2s infinite;"></div>
            <div style="width: 16px; height: 16px; border-radius: 50%; background: #2165F5; border: 2.5px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const userMarker = L.marker([userCoords.lat, userCoords.lon], { icon: userIcon })
        .addTo(map)
        .bindPopup(`<b>Your Live Location</b><br/>${userCoords.name || "Indore GPS"}`);
      markersRef.current.push(userMarker);
    }

    // Add incident markers & cluster radius zones
    clusters.forEach((c) => {
      const isCritical = c.priority === "CRITICAL";
      const isHigh = c.priority === "HIGH";
      const isCorroborated = c.verificationStatus === "corroborated" || c.verificationStatus === "confirmed";

      const pinColor = isCritical
        ? "#EF4444" // Red
        : isHigh
        ? "#F97316" // Orange
        : isCorroborated
        ? "#10B981" // Green
        : "#3B82F6"; // Blue

      const badgeIcon = c.incidentType === "waterlogging" ? "🌊" : c.incidentType === "storm" ? "⚡" : "🌧️";

      const incidentDivIcon = L.divIcon({
        className: "custom-incident-pin",
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -100%);">
            <div style="
              background: ${pinColor};
              color: #FFFFFF;
              font-size: 11px;
              font-weight: 800;
              padding: 4px 8px;
              border-radius: 20px;
              border: 2px solid #FFFFFF;
              box-shadow: 0 4px 12px rgba(0,0,0,0.22);
              display: flex;
              align-items: center;
              gap: 4px;
              white-space: nowrap;
            ">
              <span>${badgeIcon}</span>
              <span>${c.reportsCount}x</span>
            </div>
            <div style="
              width: 0;
              height: 0;
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-top: 6px solid ${pinColor};
              margin-top: -1px;
            "></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([c.coordinates.lat, c.coordinates.lon], { icon: incidentDivIcon }).addTo(map);

      // Add spatial cluster influence circle (approx 450m radius)
      const circle = L.circle([c.coordinates.lat, c.coordinates.lon], {
        color: pinColor,
        fillColor: pinColor,
        fillOpacity: 0.12,
        radius: 450,
        weight: 1.5,
        dashArray: isCritical ? "4, 6" : undefined,
      }).addTo(map);

      marker.on("click", () => {
        setSelectedCluster(c);
        if (onSelectCluster) onSelectCluster(c);
      });

      markersRef.current.push(marker);
      markersRef.current.push(circle);
    });

    if (clusters.length > 0 && !userCoords) {
      map.setView([clusters[0].coordinates.lat, clusters[0].coordinates.lon], 13);
    }
  }, [clusters, userCoords, mapLoaded]);

  return (
    <div style={{ position: "relative", width: "100%", borderRadius: 20, overflow: "hidden", border: "1px solid #E2E8F0" }}>
      {/* Map Header Overlay */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          right: 12,
          zIndex: 500,
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(8px)",
          borderRadius: 14,
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          border: "1px solid rgba(226, 232, 240, 0.8)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
            Live Geospatial Cluster Map
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              background: "#EEF2FF",
              color: "#4338CA",
              padding: "2px 7px",
              borderRadius: 6,
            }}
          >
            {clusters.length} active zones
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, fontSize: 10, fontWeight: 700 }}>
          <span style={{ color: "#EF4444" }}>● Critical</span>
          <span style={{ color: "#10B981" }}>● Corroborated</span>
        </div>
      </div>

      {/* Leaflet container */}
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: 380,
          background: "#F8FAFC",
        }}
      />

      {/* Selected Cluster Preview Modal / Bar */}
      {selectedCluster && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            right: 12,
            zIndex: 500,
            background: "#FFFFFF",
            borderRadius: 14,
            padding: "10px 14px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            border: "1px solid #CBD5E1",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: selectedCluster.priority === "CRITICAL" ? "#FEE2E2" : "#DCFCE7",
                  color: selectedCluster.priority === "CRITICAL" ? "#991B1B" : "#166534",
                }}
              >
                {selectedCluster.priority}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {selectedCluster.title}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {selectedCluster.approximateLocation} • {selectedCluster.reportsCount} citizen reports
            </div>
          </div>

          <button
            onClick={() => setSelectedCluster(null)}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #E2E8F0",
              background: "#F8FAFC",
              color: "#64748B",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
