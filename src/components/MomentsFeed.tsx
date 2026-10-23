"use client";

import { useState, useEffect, useCallback } from "react";

interface Moment {
  _id: string;
  userName: string;
  caption?: string;
  imageUrl: string;
  approximateLocation: string;
  createdAt: string;
  expiresAt: string;
  analysisResult?: {
    skyCondition?: string;
    visiblePrecipitation?: boolean;
  };
}

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function FlagIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  );
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) { setText("Expired"); return; }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setText(`${m}m ${s}s`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const expiringSoon = new Date(expiresAt).getTime() - Date.now() < 5 * 60 * 1000;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        color: expiringSoon ? "var(--red)" : "var(--text-muted)",
      }}
    >
      <ClockIcon /> {text}
    </span>
  );
}

function MomentCard({ moment, onReport }: { moment: Moment; onReport: (id: string) => void }) {
  const [reported, setReported] = useState(false);

  const handleReport = async () => {
    if (reported) return;
    try {
      const res = await fetch(`/api/moments/${moment._id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Inappropriate content" }),
      });
      if (res.ok) { setReported(true); onReport(moment._id); }
    } catch { /* silent */ }
  };

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Image */}
      <div style={{ width: "100%", aspectRatio: "4/3", background: "var(--bg)", overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={moment.imageUrl}
          alt={moment.caption ?? "Weather photo"}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px" }}>
        {moment.caption && (
          <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, marginBottom: 10, fontStyle: "italic" }}>
            &ldquo;{moment.caption}&rdquo;
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
              {moment.userName}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)" }}>
              <PinIcon /> {moment.approximateLocation}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {new Date(moment.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
            <Countdown expiresAt={moment.expiresAt} />
            <button
              onClick={handleReport}
              disabled={reported}
              style={{
                background: "none",
                border: "none",
                cursor: reported ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: reported ? "var(--red)" : "var(--text-muted)",
                padding: "2px 0",
                fontFamily: "inherit",
              }}
            >
              <FlagIcon /> {reported ? "Reported" : "Report"}
            </button>
          </div>
        </div>

        {/* AI analysis disclosure */}
        {moment.analysisResult?.skyCondition && moment.analysisResult.skyCondition !== "unknown" && (
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              color: "var(--text-muted)",
              padding: "6px 10px",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 6,
            }}
          >
            Auto-analysis (may be inaccurate): {moment.analysisResult.skyCondition}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MomentsFeed({ location }: { location: string }) {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/moments?location=${location}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMoments(data.moments ?? []);
    } catch {
      setError("Could not load moments.");
    } finally {
      setLoading(false);
    }
  }, [location]);

  useEffect(() => {
    fetch_();
    const t = setInterval(fetch_, 60_000);
    return () => clearInterval(t);
  }, [fetch_]);

  const handleReport = (id: string) => setMoments(prev => prev.filter(m => m._id !== id));

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
          Community Moments
        </h2>
        <button className="btn btn-ghost" onClick={fetch_} style={{ padding: "4px 12px", fontSize: 12 }}>
          Refresh
        </button>
      </div>

      <div
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          marginBottom: 14,
          padding: "9px 14px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
        }}
      >
        Weather photos for <strong style={{ color: "var(--text-secondary)" }}>{location}</strong> · Approximate location only · Auto-expires after 60 min
      </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 260 }} />)}
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          {error}{" "}
          <button className="btn btn-ghost" onClick={fetch_} style={{ marginLeft: 8, padding: "3px 10px", fontSize: 12 }}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && moments.length === 0 && (
        <div
          className="card"
          style={{ padding: 48, textAlign: "center" }}
        >
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
            No moments yet for this location.<br />Be the first to share a weather photo.
          </div>
        </div>
      )}

      {!loading && !error && moments.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {moments.map(m => <MomentCard key={m._id} moment={m} onReport={handleReport} />)}
        </div>
      )}
    </div>
  );
}
