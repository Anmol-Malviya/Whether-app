"use client";

import { useState, useRef } from "react";

interface UploadMomentProps {
  location: string;
  onSuccess: () => void;
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)" }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

const NEIGHBORHOODS = [
  "Indore (City Center)", "Vijay Nagar", "Palasia", "Rajwada Area",
  "Geeta Bhawan", "Rau", "Khajrana", "LIG Colony", "Bhawarkuan", "Indore (General Area)",
];

export default function UploadMoment({ onSuccess }: UploadMomentProps) {
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
      setError("Unsupported type. Use JPG, PNG, WebP, or GIF.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("File too large — max 5 MB.");
      return;
    }
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError("Please select an image first."); return; }
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
      setTimeout(onSuccess, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null); setPreview(null); setCaption(""); setError(null); setSuccess(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (success) {
    return (
      <div className="card" style={{ padding: 48, textAlign: "center", marginTop: 24 }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" style={{ marginBottom: 14 }}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Moment shared</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Your photo will be visible for 60 minutes. Redirecting…
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
        Share a Moment
      </h2>

      {/* Privacy note */}
      <div className="alert alert-info" style={{ marginBottom: 20, fontSize: 12 }}>
        GPS metadata is stripped before publishing. Only an approximate neighborhood is shown.
        Photos expire and are deleted after <strong>60 minutes</strong>.
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Image */}
        <div className="card" style={{ padding: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 10 }}>
            Photo <span style={{ color: "var(--red)" }}>*</span>
          </label>

          {preview ? (
            <div style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Preview"
                style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}
              />
              <button
                type="button"
                onClick={reset}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "rgba(0,0,0,0.55)",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  cursor: "pointer",
                  color: "#fff",
                  fontSize: 16,
                  lineHeight: "28px",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: "1.5px dashed var(--border-strong)",
                borderRadius: "var(--radius)",
                padding: "36px 24px",
                textAlign: "center",
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--accent-light)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                <UploadIcon />
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500, marginBottom: 4 }}>
                Click to select photo
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                JPG, PNG, WebP or GIF · Max 5 MB
              </div>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: "none" }}
            onChange={handleFile}
            id="moment-image-input"
          />
        </div>

        {/* Location */}
        <div className="card" style={{ padding: 18 }}>
          <label htmlFor="moment-location" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
            Approximate Location
          </label>
          <select
            id="moment-location"
            value={neighborhood}
            onChange={e => setNeighborhood(e.target.value)}
            className="input"
          >
            {NEIGHBORHOODS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
            Neighborhood-level only — exact location is never shared.
          </div>
        </div>

        {/* Caption */}
        <div className="card" style={{ padding: 18 }}>
          <label htmlFor="moment-caption" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
            Caption <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span>
          </label>
          <textarea
            id="moment-caption"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="Describe what you're seeing…"
            className="input"
            style={{ resize: "vertical", minHeight: 72 }}
          />
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, textAlign: "right" }}>
            {caption.length} / 280
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ fontSize: 13 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={uploading || !file}
          style={{ justifyContent: "center", padding: "11px", fontSize: 14, width: "100%" }}
          id="upload-moment-submit"
        >
          {uploading ? "Uploading…" : "Share Moment"}
        </button>

        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
          AI analysis of photos is automated and may be inaccurate.
        </div>
      </form>
    </div>
  );
}
