"use client";

import { useState, useRef } from "react";

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

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export default function CameraCapture({ location, onClose, onSuccess }: CameraCaptureProps) {
  const [caption, setCaption] = useState("");
  const [neighborhood, setNeighborhood] = useState(NEIGHBORHOODS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(f.type)) {
      setError("Use JPG, PNG, WebP, or GIF.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("Max file size is 5 MB.");
      return;
    }
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError("Select an image first."); return; }
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
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#FFFFFF",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.12)",
          maxHeight: "90vh",
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
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#101828", letterSpacing: "-0.3px" }}>
            Share a Moment
          </h2>
          <button
            onClick={onClose}
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
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" style={{ marginBottom: 14 }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#101828", marginBottom: 6 }}>Moment shared!</div>
            <div style={{ fontSize: 13, color: "#8A96AB" }}>Visible for 60 minutes. Redirecting…</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Privacy note */}
            <div style={{ fontSize: 11.5, color: "#8A96AB", background: "#F4F8FD", border: "1px solid #DCE7F5", borderRadius: 10, padding: "8px 12px" }}>
              GPS metadata is stripped. Only neighborhood shown. Photos expire in 60 min.
            </div>

            {/* Image area */}
            {preview ? (
              <div style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="preview" style={{ width: "100%", maxHeight: 220, objectFit: "cover" }} />
                <button
                  type="button"
                  onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                  style={{
                    position: "absolute", top: 8, right: 8,
                    background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%",
                    width: 28, height: 28, cursor: "pointer", color: "#fff", fontSize: 18,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >×</button>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: "1.5px dashed #C8D9EC",
                  borderRadius: 14,
                  padding: "32px 16px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                  background: "#F8FBFF",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#2165F5"; e.currentTarget.style.background = "#EEF4FE"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#C8D9EC"; e.currentTarget.style.background = "#F8FBFF"; }}
              >
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, color: "#8A96AB" }}>
                  <UploadIcon />
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#475467", marginBottom: 3 }}>Tap to select photo</div>
                <div style={{ fontSize: 11, color: "#8A96AB" }}>JPG, PNG, WebP or GIF · Max 5 MB</div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={handleFile} />

            {/* Location */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475467", display: "block", marginBottom: 6 }}>
                Approximate Location
              </label>
              <select
                value={neighborhood}
                onChange={e => setNeighborhood(e.target.value)}
                style={{
                  width: "100%", padding: "9px 12px",
                  border: "1px solid #DCE7F5", borderRadius: 10,
                  fontSize: 13, fontFamily: "inherit", color: "#101828",
                  background: "#F8FBFF", outline: "none", boxSizing: "border-box",
                }}
              >
                {NEIGHBORHOODS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            {/* Caption */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475467", display: "block", marginBottom: 6 }}>
                Caption <span style={{ fontWeight: 400, color: "#8A96AB" }}>(optional)</span>
              </label>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                maxLength={280}
                rows={2}
                placeholder="Describe the weather…"
                style={{
                  width: "100%", padding: "9px 12px",
                  border: "1px solid #DCE7F5", borderRadius: 10,
                  fontSize: 13, fontFamily: "inherit", color: "#101828",
                  background: "#F8FBFF", outline: "none", resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ fontSize: 11, color: "#8A96AB", textAlign: "right", marginTop: 3 }}>{caption.length}/280</div>
            </div>

            {error && (
              <div style={{ fontSize: 12, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || !file}
              style={{
                width: "100%", padding: "13px",
                background: uploading || !file ? "#CBD5E1" : "#2165F5",
                border: "none", borderRadius: 14,
                fontSize: 15, fontWeight: 700, color: "#FFFFFF",
                cursor: uploading || !file ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                transition: "background 0.15s",
              }}
            >
              {uploading ? "Uploading…" : "Share Moment"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
