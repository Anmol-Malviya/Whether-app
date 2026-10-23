"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface CameraCaptureProps {
  location?: string;
  coords?: { lat?: number; lon?: number; name?: string } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CameraCapture({
  coords,
  onClose,
  onSuccess,
}: CameraCaptureProps) {
  const [caption, setCaption] = useState("");
  const [liveLocationName, setLiveLocationName] = useState<string>(
    coords?.name || "Detecting live location..."
  );
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isStartingCamera, setIsStartingCamera] = useState(true);

  // Quality Enhancement States
  const [filterMode, setFilterMode] = useState<"natural" | "clear" | "vibrant">("clear");
  const [exposureLevel, setExposureLevel] = useState<number>(1.05); // default subtle boost for clarity

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // CSS Filter string according to selected filter mode and exposure
  const getFilterStyle = useCallback(() => {
    switch (filterMode) {
      case "clear":
        // Crisp, high-clarity daylight filter for webcams and phone cameras
        return `brightness(${exposureLevel * 102}%) contrast(108%) saturate(110%)`;
      case "vibrant":
        // Rich sky & cloud pop
        return `brightness(${exposureLevel * 100}%) contrast(112%) saturate(125%)`;
      case "natural":
      default:
        return `brightness(${exposureLevel * 100}%) contrast(100%) saturate(100%)`;
    }
  }, [filterMode, exposureLevel]);

  // Stop camera tracks cleanly
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Request & Start high-definition live camera stream
  const startCamera = useCallback(async (requestedFacing: "environment" | "user" = "environment") => {
    setError(null);
    setIsStartingCamera(true);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setIsStartingCamera(false);
      setError("Camera not supported or blocked by browser security (requires HTTPS or localhost).");
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Maximize camera sensor capability (Full HD 1080p, 60/30fps, autofocus)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: requestedFacing },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30, min: 24 },
        },
        audio: false,
      });

      streamRef.current = stream;

      // Apply advanced hardware constraints if the camera track supports them
      const track = stream.getVideoTracks()[0];
      if (track && "getCapabilities" in track) {
        try {
          const capabilities = (track as unknown as { getCapabilities: () => Record<string, unknown> }).getCapabilities();
          const advancedConstraints: Record<string, unknown> = {};

          if (capabilities.focusMode && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes("continuous")) {
            advancedConstraints.focusMode = "continuous";
          }
          if (capabilities.exposureMode && Array.isArray(capabilities.exposureMode) && capabilities.exposureMode.includes("continuous")) {
            advancedConstraints.exposureMode = "continuous";
          }
          if (capabilities.whiteBalanceMode && Array.isArray(capabilities.whiteBalanceMode) && capabilities.whiteBalanceMode.includes("continuous")) {
            advancedConstraints.whiteBalanceMode = "continuous";
          }

          if (Object.keys(advancedConstraints).length > 0) {
            await (track as unknown as { applyConstraints: (c: { advanced: unknown[] }) => Promise<void> }).applyConstraints({
              advanced: [advancedConstraints],
            });
          }
        } catch {
          // Hardware advanced constraints optional; fallback gracefully
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
    } catch (err: unknown) {
      console.warn("High-res camera request fallback:", err);
      // Fallback to standard request if sensor can't handle 1080p constraint
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: requestedFacing } },
          audio: false,
        });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play().catch(() => {});
        }
        setIsCameraActive(true);
      } catch (err2) {
        const errorObj = err2 as { name?: string };
        if (errorObj?.name === "NotAllowedError" || errorObj?.name === "PermissionDeniedError") {
          setError("Camera permission denied. Please allow camera access in your browser.");
        } else {
          setError("Could not access live camera. Please check camera permissions.");
        }
        setIsCameraActive(false);
      }
    } finally {
      setIsStartingCamera(false);
    }
  }, []);

  // Auto-fetch real-time GPS location
  const fetchLiveLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLiveLocationName(coords?.name || "Current Location");
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        let resolved = `Current Location (${lat.toFixed(2)}, ${lon.toFixed(2)})`;

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`,
            { headers: { "Accept-Language": "en" } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address;
            const area = addr?.suburb || addr?.neighbourhood || addr?.residential || addr?.quarter;
            const city = addr?.city || addr?.town || addr?.state_district || "Indore";
            resolved = area ? `${area}, ${city}` : city;
          }
        } catch {
          // fallback
        }

        setLiveLocationName(resolved);
        setIsDetectingLocation(false);
      },
      (geoErr) => {
        console.warn("Live location fetch failed:", geoErr);
        setLiveLocationName(coords?.name || "Indore (City Center)");
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [coords?.name]);

  // On mount: start camera immediately and fetch live GPS location
  useEffect(() => {
    startCamera("environment");
    fetchLiveLocation();

    return () => {
      stopCameraStream();
    };
  }, [startCamera, fetchLiveLocation, stopCameraStream]);

  // Flip camera between front & back
  const toggleFacingMode = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // High-Resolution Snapshot with image enhancements (unsharp contrast & clarity)
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    // Use full native sensor resolution
    const width = video.videoWidth || 1920;
    const height = video.videoHeight || 1080;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Apply high-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Apply the active live filter enhancement to the captured canvas
    ctx.filter = getFilterStyle();

    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Save as ultra-high quality JPEG (95% quality instead of standard low quality)
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const capturedFile = new File([blob], `weather-moment-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setFile(capturedFile);
        setPreview(URL.createObjectURL(blob));
        stopCameraStream();
      },
      "image/jpeg",
      0.96
    );
  };

  // Retake photo: reopen camera
  const handleRetake = () => {
    setFile(null);
    setPreview(null);
    startCamera(facingMode);
  };

  const handleClose = () => {
    stopCameraStream();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please capture a live photo first.");
      return;
    }
    setUploading(true);
    setError(null);

    const fd = new FormData();
    fd.append("image", file);
    fd.append("caption", caption.trim());
    fd.append("location", liveLocationName);

    try {
      const res = await fetch("/api/moments", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to share moment");
      setSuccess(true);
      setTimeout(onSuccess, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#FFFFFF",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.25)",
          maxHeight: "92vh",
          overflowY: "auto",
          paddingBottom: "env(safe-area-inset-bottom, 24px)",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, marginBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#E2ECF8" }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px 12px" }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#101828", letterSpacing: "-0.3px", margin: 0 }}>
              Live Weather Camera
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#667085" }}>
              HD live capture with automatic location
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            style={{
              background: "#F4F8FD",
              border: "none",
              borderRadius: "50%",
              width: 32,
              height: 32,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#475467",
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>

        {success ? (
          <div style={{ padding: "36px 20px 44px", textAlign: "center" }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2" style={{ marginBottom: 14 }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#101828", marginBottom: 6 }}>Live Moment Shared!</div>
            <div style={{ fontSize: 13, color: "#8A96AB" }}>Now visible to nearby users for 60 minutes.</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            
            {/* Live Location Auto-Badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#F4F8FD",
                border: "1px solid #DCE7F5",
                borderRadius: 12,
                padding: "9px 12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "#2165F5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#FFFFFF">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#667085", fontWeight: 600 }}>LIVE AUTO LOCATION</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#101828", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {isDetectingLocation ? "Detecting GPS location..." : liveLocationName}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchLiveLocation}
                disabled={isDetectingLocation}
                title="Refresh live location"
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 4,
                  cursor: isDetectingLocation ? "not-allowed" : "pointer",
                  color: "#2165F5",
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ animation: isDetectingLocation ? "spin 1s linear infinite" : "none" }}
                >
                  <path d="M23 4v6h-6" />
                  <path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
            </div>

            {/* Quality & Color Mode Controls (above camera viewfinder) */}
            {isCameraActive && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  padding: "6px 10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#475467", marginRight: 4 }}>
                    CLARITY:
                  </span>
                  {(["clear", "vibrant", "natural"] as const).map((m) => {
                    const isSelected = filterMode === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setFilterMode(m)}
                        style={{
                          background: isSelected ? "#2165F5" : "#FFFFFF",
                          color: isSelected ? "#FFFFFF" : "#475467",
                          border: isSelected ? "1px solid #2165F5" : "1px solid #D1D5DB",
                          borderRadius: 16,
                          padding: "3px 9px",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          textTransform: "capitalize",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {m === "clear" ? "✨ Clear HD" : m === "vibrant" ? "🌈 Vibrant" : "Natural"}
                      </button>
                    );
                  })}
                </div>

                {/* Brightness tweak button */}
                <button
                  type="button"
                  title="Adjust brightness/exposure"
                  onClick={() => {
                    setExposureLevel((prev) => (prev >= 1.2 ? 0.95 : prev + 0.08));
                  }}
                  style={{
                    background: exposureLevel > 1.05 ? "#EEF4FE" : "#FFFFFF",
                    border: "1px solid #D1D5DB",
                    borderRadius: 8,
                    padding: "3px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#2165F5",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  ☀️ {Math.round(exposureLevel * 100)}%
                </button>
              </div>
            )}

            {/* Live Camera Viewfinder or Captured Preview */}
            {preview ? (
              <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "#000", border: "1px solid #E2ECF8" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Captured HD frame" style={{ width: "100%", maxHeight: 290, objectFit: "cover", display: "block" }} />
                <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11.5, background: "rgba(0,0,0,0.65)", color: "#fff", padding: "4px 9px", borderRadius: 6, backdropFilter: "blur(4px)" }}>
                    ✓ HD Photo captured
                  </span>
                  <button
                    type="button"
                    onClick={handleRetake}
                    style={{
                      background: "rgba(0,0,0,0.75)",
                      border: "none",
                      borderRadius: 20,
                      padding: "7px 14px",
                      cursor: "pointer",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      backdropFilter: "blur(4px)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Retake Live
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  position: "relative",
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "#080E18",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 290,
                  boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)",
                }}
              >
                {/* Video element with hardware-accelerated filter & HD stream */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: 290,
                    objectFit: "cover",
                    display: isCameraActive ? "block" : "none",
                    transform: facingMode === "user" ? "scaleX(-1)" : "none",
                    filter: getFilterStyle(),
                    transition: "filter 0.15s ease",
                  }}
                />

                {/* HD Quality indicator badge */}
                {isCameraActive && (
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      left: 12,
                      background: "rgba(0,0,0,0.6)",
                      border: "1px solid rgba(255,255,255,0.25)",
                      borderRadius: 6,
                      padding: "2px 6px",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#4ADE80",
                      letterSpacing: "0.5px",
                      backdropFilter: "blur(4px)",
                      zIndex: 10,
                    }}
                  >
                    ● HD LIVE
                  </div>
                )}

                {/* Loading / Starting indicator */}
                {isStartingCamera && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "#fff" }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        border: "3px solid rgba(255,255,255,0.2)",
                        borderTopColor: "#2165F5",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    <span style={{ fontSize: 13, color: "#94A3B8" }}>Enhancing & starting HD camera...</span>
                  </div>
                )}

                {/* Camera Inactive / Permission denied fallback view */}
                {!isCameraActive && !isStartingCamera && (
                  <div style={{ padding: 24, textAlign: "center", color: "#fff" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "#EF4444" }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="1" y1="1" x2="23" y2="23" />
                        <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Camera Access Required</div>
                    <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 14 }}>
                      Please allow camera permission in browser to snap live photo.
                    </div>
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      style={{
                        background: "#2165F5",
                        border: "none",
                        color: "#fff",
                        padding: "8px 16px",
                        borderRadius: 20,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Allow & Start Camera
                    </button>
                  </div>
                )}

                {/* Live viewfinder controls */}
                {isCameraActive && (
                  <>
                    {/* Top right switch camera button */}
                    <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 8, zIndex: 10 }}>
                      <button
                        type="button"
                        onClick={toggleFacingMode}
                        title="Flip Camera"
                        style={{
                          background: "rgba(0,0,0,0.55)",
                          border: "1px solid rgba(255,255,255,0.25)",
                          borderRadius: "50%",
                          width: 38,
                          height: 38,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          cursor: "pointer",
                          backdropFilter: "blur(4px)",
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                        </svg>
                      </button>
                    </div>

                    {/* Bottom Snap Button */}
                    <div style={{ position: "absolute", bottom: 16, display: "flex", flexDirection: "column", alignItems: "center", width: "100%", zIndex: 10 }}>
                      <button
                        type="button"
                        onClick={capturePhoto}
                        aria-label="Capture photo"
                        style={{
                          width: 66,
                          height: 66,
                          borderRadius: "50%",
                          background: "#FFFFFF",
                          border: "4px solid rgba(255,255,255,0.45)",
                          outline: "2px solid #2165F5",
                          cursor: "pointer",
                          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                          transition: "transform 0.1s ease",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.92)"; }}
                        onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                      >
                        <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#2165F5" }} />
                      </button>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 6, fontWeight: 500, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
                        Tap to capture HD live
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Weather Note / Caption */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475467", display: "block", marginBottom: 6 }}>
                Weather Note <span style={{ fontWeight: 400, color: "#8A96AB" }}>(optional)</span>
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={280}
                rows={2}
                placeholder="What is the weather like right now? (clouds, rain, sunshine...)"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "1px solid #DCE7F5",
                  borderRadius: 10,
                  fontSize: 13,
                  fontFamily: "inherit",
                  color: "#101828",
                  background: "#F8FBFF",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ fontSize: 11, color: "#8A96AB", textAlign: "right", marginTop: 3 }}>
                {caption.length}/280
              </div>
            </div>

            {error && (
              <div
                style={{
                  fontSize: 12,
                  color: "#DC2626",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: 10,
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={uploading || !file}
              style={{
                width: "100%",
                padding: "13px",
                background: uploading || !file ? "#CBD5E1" : "#2165F5",
                border: "none",
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 700,
                color: "#FFFFFF",
                cursor: uploading || !file ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                transition: "background 0.15s",
                boxShadow: uploading || !file ? "none" : "0 4px 14px rgba(33, 101, 245, 0.35)",
              }}
            >
              {uploading ? "Sharing Live Moment…" : "Share Live Moment"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
