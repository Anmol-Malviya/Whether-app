"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface CameraCaptureProps {
  location: string;
  onClose: () => void;
  onSuccess: () => void;
}

const NEIGHBORHOODS = [
  "Indore (City Center)", "Vijay Nagar", "Palasia", "Rajwada Area",
  "Geeta Bhawan", "Rau", "Khajrana", "LIG Colony", "Bhawarkuan",
  "Indore (General Area)", "Nearby Area",
];

export default function CameraCapture({ location, onClose, onSuccess }: CameraCaptureProps) {
  const [caption, setCaption] = useState("");
  const [neighborhood, setNeighborhood] = useState(NEIGHBORHOODS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraPermissionState, setCameraPermissionState] = useState<"prompt" | "granted" | "denied" | "unsupported">("prompt");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isStartingCamera, setIsStartingCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Stop camera stream safely
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

  // Request & Start Camera
  const startCamera = async (requestedFacing = facingMode) => {
    setError(null);
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraPermissionState("unsupported");
      setError("Camera is not supported on this browser or connection (requires HTTPS/localhost).");
      return;
    }

    try {
      setIsStartingCamera(true);
      stopCameraStream();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: requestedFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
      setCameraPermissionState("granted");
    } catch (err: unknown) {
      console.warn("Camera access denied or error:", err);
      const errorObj = err as { name?: string };
      if (errorObj?.name === "NotAllowedError" || errorObj?.name === "PermissionDeniedError") {
        setCameraPermissionState("denied");
        setError("Camera permission was denied. Please allow camera access in browser settings, or choose a photo from gallery.");
      } else {
        setError("Could not access camera. You can still upload a photo.");
      }
      setIsCameraActive(false);
    } finally {
      setIsStartingCamera(false);
    }
  };

  // Flip camera between front & back
  const toggleFacingMode = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Snap photo from viewfinder
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facingMode === "user") {
      // Mirror front camera
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const capturedFile = new File([blob], `weather-moment-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      setFile(capturedFile);
      setPreview(URL.createObjectURL(blob));
      stopCameraStream();
    }, "image/jpeg", 0.9);
  };

  // Cleanup camera stream when component unmounts
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Gallery file handler
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(f.type)) {
      setError("Please use JPG, PNG, WebP, or GIF.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("Max file size is 5 MB.");
      return;
    }
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    stopCameraStream();
  };

  const handleClose = () => {
    stopCameraStream();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please capture or select an image first.");
      return;
    }
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("image", file);
    fd.append("caption", caption.trim());
    fd.append("location", neighborhood);
    try {
      const res = await fetch("/api/moments", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setSuccess(true);
      setTimeout(onSuccess, 1600);
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
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
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
          boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px 14px" }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#101828", letterSpacing: "-0.3px", margin: 0 }}>
              Share Weather Moment
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#667085" }}>
              Live camera or upload from gallery
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
          <div style={{ padding: "32px 20px 40px", textAlign: "center" }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2" style={{ marginBottom: 14 }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#101828", marginBottom: 6 }}>Moment shared!</div>
            <div style={{ fontSize: 13, color: "#8A96AB" }}>Visible on weather feed for 60 minutes.</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Privacy note */}
            <div style={{ fontSize: 11.5, color: "#475467", background: "#F4F8FD", border: "1px solid #DCE7F5", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2165F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Photos expire in 60 min. Location is kept approximate for privacy.</span>
            </div>

            {/* Viewfinder / Preview / Camera Trigger Block */}
            {preview ? (
              <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "#000", border: "1px solid #E2ECF8" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="preview" style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }} />
                <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, background: "rgba(0,0,0,0.6)", color: "#fff", padding: "4px 8px", borderRadius: 6, backdropFilter: "blur(4px)" }}>
                    Photo ready
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    style={{
                      background: "rgba(0,0,0,0.65)",
                      border: "none",
                      borderRadius: 20,
                      padding: "6px 12px",
                      cursor: "pointer",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    Retake / Change
                  </button>
                </div>
              </div>
            ) : isCameraActive ? (
              /* Live Camera Viewfinder with permission granted */
              <div
                style={{
                  position: "relative",
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "#050B14",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 280,
                  boxShadow: "inset 0 0 30px rgba(0,0,0,0.6)",
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: 280,
                    objectFit: "cover",
                    transform: facingMode === "user" ? "scaleX(-1)" : "none",
                  }}
                />

                {/* Top overlay controls */}
                <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 8, zIndex: 10 }}>
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    title="Flip camera"
                    style={{
                      background: "rgba(0,0,0,0.5)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: "50%",
                      width: 36,
                      height: 36,
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
                  <button
                    type="button"
                    onClick={stopCameraStream}
                    title="Cancel camera"
                    style={{
                      background: "rgba(0,0,0,0.5)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: "50%",
                      width: 36,
                      height: 36,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      cursor: "pointer",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    ×
                  </button>
                </div>

                {/* Bottom Snap Button */}
                <div style={{ position: "absolute", bottom: 16, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", zIndex: 10 }}>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      background: "#FFFFFF",
                      border: "4px solid rgba(255,255,255,0.4)",
                      outline: "2px solid #2165F5",
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
                      transition: "transform 0.1s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.92)"; }}
                    onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#2165F5" }} />
                  </button>
                </div>
              </div>
            ) : (
              /* Choose Camera or Gallery Box */
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Primary Button: Open Camera with Live Permission Request */}
                <button
                  type="button"
                  onClick={() => startCamera("environment")}
                  disabled={isStartingCamera}
                  style={{
                    border: "1.5px solid #2165F5",
                    background: "linear-gradient(180deg, #F0F6FF 0%, #E3EFFF 100%)",
                    borderRadius: 14,
                    padding: "20px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: "50%",
                      background: "#2165F5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#FFFFFF",
                      flexShrink: 0,
                      boxShadow: "0 4px 12px rgba(33, 101, 245, 0.3)",
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F294A" }}>
                      {isStartingCamera ? "Starting Camera…" : "Open Camera"}
                    </div>
                    <div style={{ fontSize: 12, color: "#3B5A80", marginTop: 2 }}>
                      Asks permission to snap live sky & weather
                    </div>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2165F5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                {/* Secondary Button: Gallery or File selector */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: "1.5px dashed #C8D9EC",
                    borderRadius: 14,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    cursor: "pointer",
                    background: "#F8FBFF",
                    color: "#475467",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Choose from Gallery / Files
                </button>
              </div>
            )}

            {/* Hidden file input for file picker fallback */}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={handleFile}
            />

            {/* Location */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475467", display: "block", marginBottom: 6 }}>
                Approximate Location
              </label>
              <select
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
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
                  boxSizing: "border-box",
                }}
              >
                {NEIGHBORHOODS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            {/* Caption */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475467", display: "block", marginBottom: 6 }}>
                Caption <span style={{ fontWeight: 400, color: "#8A96AB" }}>(optional)</span>
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={280}
                rows={2}
                placeholder="Describe current sky condition, clouds, rain..."
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
              {uploading ? "Sharing Moment…" : "Share Moment"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
