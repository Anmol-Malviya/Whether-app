"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { WeatherAggregation } from "@/lib/types/weather";
import WeatherHero from "@/components/WeatherHero";
import SourceBreakdown from "@/components/SourceBreakdown";
import MomentsFeed from "@/components/MomentsFeed";
import UploadMoment from "@/components/UploadMoment";
import Navbar from "@/components/Navbar";
import CameraCapture from "@/components/CameraCapture";

export default function HomePage() {
  const [weather, setWeather] = useState<WeatherAggregation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "sources" | "moments" | "share">(
    "dashboard"
  );
  const [location, setLocation] = useState("indore");
  const [coords, setCoords] = useState<{ lat?: number; lon?: number; name?: string } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [fabPulse, setFabPulse] = useState(false);

  const locationRef = useRef(location);
  const coordsRef = useRef(coords);
  locationRef.current = location;
  coordsRef.current = coords;

  const fetchWeather = useCallback(
    async (
      targetLoc?: string,
      targetCoords?: { lat?: number; lon?: number; name?: string } | null,
      forceRefresh = false
    ) => {
      const locToUse = targetLoc ?? locationRef.current;
      const coordsToUse = targetCoords !== undefined ? targetCoords : coordsRef.current;

      try {
        if (forceRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        let endpoint = "";
        let options: RequestInit = { method: "GET" };

        if (coordsToUse?.lat && coordsToUse?.lon) {
          const params = new URLSearchParams({
            location: locToUse,
            lat: String(coordsToUse.lat),
            lon: String(coordsToUse.lon),
            ...(coordsToUse.name ? { name: coordsToUse.name } : {}),
          });
          endpoint = forceRefresh
            ? "/api/weather/refresh"
            : `/api/weather/current?${params.toString()}`;

          if (forceRefresh) {
            options = {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: locToUse,
                lat: coordsToUse.lat,
                lon: coordsToUse.lon,
                name: coordsToUse.name,
              }),
            };
          }
        } else {
          endpoint = forceRefresh
            ? "/api/weather/refresh"
            : `/api/weather/current?location=${encodeURIComponent(locToUse)}`;

          if (forceRefresh) {
            options = {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ location: locToUse }),
            };
          }
        }

        const res = await fetch(endpoint, options);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: WeatherAggregation = await res.json();
        setWeather(data);
      } catch (err) {
        console.error("Failed to fetch weather:", err);
        setError("Unable to load weather data. Please try refreshing.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  // Request current GPS location on first visit or user request
  const detectCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      fetchWeather("indore", null);
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const userLat = pos.coords.latitude;
        const userLon = pos.coords.longitude;
        const targetCoords = {
          lat: userLat,
          lon: userLon,
          name: `Current Location (${userLat.toFixed(2)}, ${userLon.toFixed(2)})`,
        };
        setCoords(targetCoords);
        setLocation("current-location");
        fetchWeather("current-location", targetCoords);
      },
      (err) => {
        console.warn("Geolocation permission denied or timed out:", err);
        setIsLocating(false);
        fetchWeather("indore", null);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, [fetchWeather]);

  // Run once on initial load
  useEffect(() => {
    detectCurrentLocation();
    const interval = setInterval(() => {
      fetchWeather();
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subtle pulse on FAB every 8 seconds to draw attention
  useEffect(() => {
    const id = setInterval(() => {
      setFabPulse(true);
      setTimeout(() => setFabPulse(false), 800);
    }, 8000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        locationName={weather?.locationName ?? "Indore, Madhya Pradesh"}
        isLocating={isLocating}
        onUseCurrentLocation={detectCurrentLocation}
        onSelectLocation={(selected) => {
          setLocation(selected.id);
          const targetCoords = selected.lat && selected.lon
            ? { lat: selected.lat, lon: selected.lon, name: selected.name }
            : undefined;
          setCoords(targetCoords ?? null);
          fetchWeather(selected.id, targetCoords ?? null);
        }}
      />

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 100px" }}>
        {activeTab === "dashboard" && (
          <div className="fade-up">
            <WeatherHero
              weather={weather}
              loading={loading}
              error={error}
              refreshing={refreshing}
              onRefresh={() => fetchWeather(location, coords, true)}
            />
          </div>
        )}

        {activeTab === "sources" && (
          <div className="fade-up">
            <SourceBreakdown weather={weather} loading={loading} />
          </div>
        )}

        {activeTab === "moments" && (
          <div className="fade-up">
            <MomentsFeed location={location} />
          </div>
        )}

        {activeTab === "share" && (
          <div className="fade-up">
            <UploadMoment
              location={location}
              onSuccess={() => setActiveTab("moments")}
            />
          </div>
        )}
      </main>

      {/* ── Floating Camera Button (bottom-right) ── */}
      {!showCamera && (
        <button
          id="fab-camera-btn"
          onClick={() => setShowCamera(true)}
          title="Capture & share a weather moment"
          style={{
            position: "fixed",
            bottom: 80,
            right: 20,
            zIndex: 200,
            width: 58,
            height: 58,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 20px rgba(37,99,235,0.45), 0 2px 8px rgba(0,0,0,0.15)",
            transform: fabPulse ? "scale(1.12)" : "scale(1)",
            transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s",
            color: "#fff",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 24px rgba(37,99,235,0.55), 0 3px 10px rgba(0,0,0,0.2)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(37,99,235,0.45), 0 2px 8px rgba(0,0,0,0.15)";
          }}
        >
          {/* Ripple ring */}
          <span style={{
            position: "absolute",
            inset: -4,
            borderRadius: "50%",
            border: "2px solid rgba(37,99,235,0.35)",
            animation: "fab-ring 2.5s ease-out infinite",
            pointerEvents: "none",
          }} />
          {/* Camera icon */}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
      )}

      {/* Camera Capture Overlay */}
      {showCamera && (
        <CameraCapture
          location={location}
          onClose={() => setShowCamera(false)}
          onSuccess={() => {
            setShowCamera(false);
            setActiveTab("moments");
          }}
        />
      )}

      <style>{`
        @keyframes fab-ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          70%  { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
