"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface CameraCaptureProps {
  location: string;
  onClose: () => void;
  onSuccess: () => void;
}

const NEIGHBORHOODS = [
  "Indore (City Center)", "Vijay Nagar", "Palasia", "Rajwada Area",
  "Geeta Bhawan", "Rau", "Khajrana", "LIG Colony", "Bhawarkuan", "Indore (General Area)",
];

// Real landmarks coordinates in Indore
const INDORE_LANDMARKS: { name: string; lat: number; lng: number }[] = [
  { name: "Vijay Nagar", lat: 22.7533, lng: 75.8937 },
  { name: "Palasia", lat: 22.7244, lng: 75.8839 },
  { name: "Geeta Bhawan", lat: 22.7180, lng: 75.8820 },
  { name: "Rajwada Area", lat: 22.7196, lng: 75.8577 },
  { name: "Bhawarkuan", lat: 22.6926, lng: 75.8676 },
  { name: "Khajrana", lat: 22.7297, lng: 75.9080 },
  { name: "LIG Colony", lat: 22.7380, lng: 75.8840 },
  { name: "Rau", lat: 22.6288, lng: 75.8052 },
];

function getNearestNeighborhood(lat: number, lng: number): string {
  let closest = "Indore (City Center)";
  let minDistance = Infinity;

  for (const landmark of INDORE_LANDMARKS) {
    const dLat = lat - landmark.lat;
    const dLng = lng - landmark.lng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = landmark.name;
    }
  }

  // If within ~15km radius of Indore
  return minDistance < 0.25 ? closest : "Indore (General Area)";
}

async function fetchAreaName(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data.address;
      const detected = addr?.suburb || addr?.neighbourhood || addr?.residential || addr?.quarter || addr?.city_district;
      if (detected) {
        // Match with known list if possible or use clean name
        const match = NEIGHBORHOODS.find(n => n.toLowerCase().includes(detected.toLowerCase()) || detected.toLowerCase().includes(n.toLowerCase()));
        if (match) return match;
        return detected;
      }
    }
  } catch {
    // Fallback to nearest landmark
  }
  return getNearestNeighborhood(lat, lng);
}

export default function CameraCapture({ onClose, onSuccess }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<"camera" | "preview" | "uploading" | "success">("camera");
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [neighborhood, setNeighborhood] = useState(NEIGHBORHOODS[0]);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "denied">("idle");
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err: unknown) => {
          // Ignore AbortError when play() is interrupted by quick re-render or stop
          if (err instanceof Error && err.name !== "AbortError") {
            console.warn("Video play interrupted:", err);
          }
        });
      }
    } catch {
      setCameraError("Camera access denied. Please allow camera permission.");
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [startCamera, facingMode]);

  useEffect(() => {
    if (!navigator.geolocation) { setGeoStatus("denied"); return; }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGeoCoords(coords);
        const resolvedName = await fetchAreaName(coords.lat, coords.lng);
        setNeighborhood(resolvedName);
        setGeoStatus("ok");
      },
      () => { setGeoStatus("denied"); },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
    );
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setCapturedBlob(blob);
      setCapturedUrl(URL.createObjectURL(blob));
      setPhase("preview");
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    }, "image/jpeg", 0.88);
  };

  const retake = () => {
    setCapturedBlob(null);
    setCapturedUrl(null);
    setPhase("camera");
    startCamera(facingMode);
  };

  const handleUpload = async () => {
    if (!capturedBlob) return;
    setPhase("uploading");
    setErrorMsg(null);
    const fd = new FormData();
    fd.append("image", capturedBlob, "moment.jpg");
    fd.append("caption", caption.trim());
    fd.append("location", neighborhood);
    if (geoCoords) {
      fd.append("lat", String(geoCoords.lat));
      fd.append("lng", String(geoCoords.lng));
    }
    try {
      const res = await fetch("/api/moments", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setPhase("success");
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed.");
      setPhase("preview");
    }
  };

  const flipCamera = () => setFacingMode(f => f === "environment" ? "user" : "environment");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.95)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
      id="camera-capture-overlay"
    >
      {/* Header */}
      <div style={{
        width: "100%",
        maxWidth: 480,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 18px",
        color: "#fff",
        flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          id="camera-close-btn"
          style={{
            background: "rgba(255,255,255,0.12)",
            border: "none",
            borderRadius: "50%",
            width: 38,
            height: 38,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#fff",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>
          {phase === "camera" ? "Capture Moment" : phase === "preview" ? "Preview" : phase === "uploading" ? "Uploading…" : "Shared!"}
        </span>
        <div style={{
          display: "flex", alignItems: "center", gap: 5, fontSize: 11,
          color: geoStatus === "ok" ? "#4ade80" : geoStatus === "denied" ? "#f87171" : "#fbbf24",
          background: "rgba(255,255,255,0.1)", borderRadius: 20, padding: "4px 10px",
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          {geoStatus === "loading" ? "Locating…" : geoStatus === "ok" ? "Live GPS" : "No GPS"}
        </div>
      </div>

      {/* Viewfinder */}
      <div style={{ flex: 1, width: "100%", maxWidth: 480, position: "relative", overflow: "hidden", background: "#000" }}>
        {phase === "camera" && (
          <>
            {cameraError ? (
              <div style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", color: "#fff", gap: 14, padding: 24, textAlign: "center",
              }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <line x1="3" y1="3" x2="21" y2="21" stroke="#f87171"/>
                </svg>
                <div style={{ fontSize: 14, color: "#f87171", fontWeight: 600 }}>{cameraError}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Allow camera access in your browser settings.</div>
              </div>
            ) : (
              <video ref={videoRef} autoPlay playsInline muted
                style={{ width: "100%", height: "100%", objectFit: "cover", transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
              />
            )}
            {!cameraError && (
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {[
                  { top: 20, left: 20 }, { top: 20, right: 20 },
                  { bottom: 20, left: 20 }, { bottom: 20, right: 20 },
                ].map((pos, i) => (
                  <div key={i} style={{
                    position: "absolute", width: 28, height: 28,
                    border: "2.5px solid rgba(255,255,255,0.65)", borderRadius: 3, ...pos,
                    borderRight: i % 2 === 0 ? "none" : undefined,
                    borderLeft: i % 2 === 1 ? "none" : undefined,
                    borderBottom: i < 2 ? "none" : undefined,
                    borderTop: i >= 2 ? "none" : undefined,
                  }} />
                ))}
              </div>
            )}
          </>
        )}

        {(phase === "preview" || phase === "uploading") && capturedUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capturedUrl} alt="Captured" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}

        {phase === "success" && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", gap: 12,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "rgba(74,222,128,0.15)", border: "2px solid #4ade80",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Moment Shared!</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Visible for 60 minutes</div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Bottom controls */}
      <div style={{
        width: "100%", maxWidth: 480,
        background: "rgba(10,10,10,0.9)", backdropFilter: "blur(10px)",
        padding: "16px 20px max(20px, env(safe-area-inset-bottom))",
        flexShrink: 0,
      }}>
        {phase === "camera" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={flipCamera} id="camera-flip-btn"
              style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "rgba(255,255,255,0.12)", border: "none",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
              }}
              title="Flip camera"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
            </button>

            {/* Shutter Button */}
            <button onClick={capture} id="camera-shutter-btn"
              disabled={!!cameraError}
              style={{
                width: 72, height: 72, borderRadius: "50%", background: "#fff",
                border: "4px solid rgba(255,255,255,0.25)", cursor: cameraError ? "not-allowed" : "pointer",
                opacity: cameraError ? 0.4 : 1,
                boxShadow: "0 0 0 3px rgba(255,255,255,0.15), 0 4px 20px rgba(0,0,0,0.5)",
                transition: "transform 0.1s",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.92)"; }}
              onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.92)"; }}
              onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
            >
              <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#fff", border: "2px solid #dde1e7" }} />
            </button>

            {/* Gallery Upload Option */}
            <label
              htmlFor="camera-gallery-input"
              id="camera-gallery-btn"
              style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "rgba(255,255,255,0.12)", border: "none",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
              }}
              title="Upload photo from files/gallery"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <input
                id="camera-gallery-input"
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setCapturedBlob(file);
                  setCapturedUrl(URL.createObjectURL(file));
                  setPhase("preview");
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach(t => t.stop());
                    streamRef.current = null;
                  }
                }}
              />
            </label>
          </div>
        )}

        {(phase === "preview" || phase === "uploading") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 12px",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill={geoStatus === "ok" ? "#4ade80" : "#fbbf24"}>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <select value={neighborhood} onChange={e => setNeighborhood(e.target.value)}
                id="camera-neighborhood-select"
                style={{
                  background: "transparent", border: "none", color: "#fff",
                  fontSize: 13, fontFamily: "inherit", flex: 1, outline: "none", cursor: "pointer",
                }}
              >
                {NEIGHBORHOODS.map(n => <option key={n} value={n} style={{ background: "#1f2937", color: "#fff" }}>{n}</option>)}
              </select>
            </div>

            <textarea value={caption} onChange={e => setCaption(e.target.value)}
              placeholder="Add a caption… (optional)" maxLength={280} rows={2}
              id="camera-caption-input"
              style={{
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit",
                padding: "10px 12px", resize: "none", outline: "none", width: "100%",
              }}
            />

            {errorMsg && (
              <div style={{ fontSize: 12, color: "#f87171", background: "rgba(248,113,113,0.1)", borderRadius: 8, padding: "8px 12px" }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={retake} id="camera-retake-btn"
                style={{
                  flex: 1, padding: "12px", borderRadius: 12,
                  background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff", fontSize: 14, fontWeight: 500, fontFamily: "inherit",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
                </svg>
                Retake
              </button>
              <button onClick={handleUpload} disabled={phase === "uploading"} id="camera-upload-btn"
                style={{
                  flex: 2, padding: "12px", borderRadius: 12,
                  background: phase === "uploading" ? "rgba(37,99,235,0.5)" : "#2563eb",
                  border: "none", color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                  cursor: phase === "uploading" ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: phase === "uploading" ? "none" : "0 4px 14px rgba(37,99,235,0.4)",
                  transition: "all 0.15s",
                }}
              >
                {phase === "uploading" ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "cam-spin 1s linear infinite" }}>
                      <path d="M21 12a9 9 0 1 1-9-9"/>
                    </svg>
                    Uploading…
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Share Moment
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes cam-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
