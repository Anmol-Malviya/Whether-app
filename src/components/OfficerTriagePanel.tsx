"use client";

import { useState, useEffect, useCallback } from "react";
import IncidentMap from "./IncidentMap";

export interface IncidentCluster {
  id: string;
  incidentType: "waterlogging" | "heavy_rain" | "storm" | "cloudy" | "normal";
  title: string;
  approximateLocation: string;
  coordinates: { lat: number; lon: number };
  reportsCount: number;
  firstReportedAt: string;
  lastReportedAt: string;
  confidenceScore: number;
  verificationStatus: "unverified" | "corroborated" | "confirmed" | "stale_or_duplicate";
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  macroWeatherMatch: boolean;
  representativeImageUrl: string;
  mediaUrls: string[];
  captions: string[];
  momentIds: string[];
  aiSummary?: string;
  warnings?: string[];
}

interface TriageStats {
  totalRawReports: number;
  clusteredIncidents: number;
  criticalAlerts: number;
  corroborated: number;
  staleOrDuplicatesFlagged: number;
  macroWeatherSync: string;
}

interface OfficerTriagePanelProps {
  location: string;
  coords?: { lat?: number; lon?: number; name?: string } | null;
  onRefresh?: () => void;
}

export default function OfficerTriagePanel({ location, coords }: OfficerTriagePanelProps) {
  const [clusters, setClusters] = useState<IncidentCluster[]>([]);
  const [stats, setStats] = useState<TriageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<"all" | "critical" | "corroborated" | "stale">("all");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [broadcastAlert, setBroadcastAlert] = useState<{ active: boolean; message?: string }>({ active: false });

  // Export incident dossier for municipal coordination
  const exportDossierJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        location,
        coordinates: coords,
        stats,
        incidents: clusters,
      }, null, 2)
    );
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `WeatherPulse_Incident_Dossier_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const fetchTriageData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/incidents/triage?location=${encodeURIComponent(location)}`);
      const data = await res.json();
      if (data.success) {
        setClusters(data.clusters || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error("Failed to load triage feed:", err);
    } finally {
      setLoading(false);
    }
  }, [location]);

  useEffect(() => {
    fetchTriageData();
    const interval = setInterval(fetchTriageData, 20000); // 20s live polling
    return () => clearInterval(interval);
  }, [fetchTriageData]);

  const handleAction = async (cluster: IncidentCluster, action: "confirm" | "flag_stale" | "dismiss") => {
    try {
      setActionInProgress(cluster.id);
      const res = await fetch("/api/incidents/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ momentIds: cluster.momentIds, action }),
      });
      if (res.ok) {
        await fetchTriageData();
      }
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const filteredClusters = clusters.filter((c) => {
    if (filterTab === "critical") return c.priority === "CRITICAL" || c.priority === "HIGH";
    if (filterTab === "corroborated") return c.verificationStatus === "corroborated" || c.verificationStatus === "confirmed";
    if (filterTab === "stale") return c.verificationStatus === "stale_or_duplicate";
    return true;
  });

  return (
    <div style={{ width: "100%", padding: "16px 0 40px" }}>
      {/* Officer Header Card */}
      <div
        style={{
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          borderRadius: 20,
          padding: "18px 18px 16px",
          color: "#FFFFFF",
          boxShadow: "0 8px 24px rgba(15,23,42,0.18)",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22C55E",
                boxShadow: "0 0 8px #22C55E",
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "#94A3B8" }}>
              Incident Intelligence Desk
            </span>
          </div>
          <button
            onClick={fetchTriageData}
            disabled={loading}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#FFFFFF",
              padding: "4px 10px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {loading ? "Refreshing..." : "Sync Live"}
          </button>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px", letterSpacing: -0.3 }}>
          Crowdsourced Triage & Verification
        </h2>
        <p style={{ fontSize: 12, color: "#94A3B8", margin: 0, lineHeight: 1.4 }}>
          Spatial-temporal clustering of community reports cross-referenced with radar and weather APIs.
        </p>

        {/* Live Metrics Grid */}
        {stats && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              marginTop: 14,
              paddingTop: 14,
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div style={{ background: "rgba(255,255,255,0.06)", padding: "8px 10px", borderRadius: 12 }}>
              <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>Raw Posts</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#38BDF8" }}>{stats.totalRawReports}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.06)", padding: "8px 10px", borderRadius: 12 }}>
              <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>Incidents</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#FCD34D" }}>{stats.clusteredIncidents}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.06)", padding: "8px 10px", borderRadius: 12 }}>
              <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>Critical</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: stats.criticalAlerts > 0 ? "#F87171" : "#4ADE80" }}>
                {stats.criticalAlerts}
              </div>
            </div>
          </div>
        )}
      </div>

        {/* Filter Tabs & View Mode Switcher */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              gap: 4,
              background: "#F1F5F9",
              padding: 3,
              borderRadius: 12,
            }}
          >
            {(
              [
                { id: "all", label: `All (${clusters.length})` },
                { id: "critical", label: "Critical" },
                { id: "corroborated", label: "Corroborated" },
                { id: "stale", label: "Stale" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setFilterTab(t.id)}
                style={{
                  flex: 1,
                  padding: "6px 2px",
                  fontSize: 10.5,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: filterTab === t.id ? "#FFFFFF" : "transparent",
                  color: filterTab === t.id ? "#0F172A" : "#64748B",
                  boxShadow: filterTab === t.id ? "0 2px 5px rgba(0,0,0,0.06)" : "none",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* List vs Map Switcher */}
          <div style={{ display: "flex", background: "#F1F5F9", padding: 3, borderRadius: 12, gap: 2 }}>
            <button
              onClick={() => setViewMode("list")}
              title="List View"
              style={{
                padding: "6px 9px",
                borderRadius: 8,
                border: "none",
                background: viewMode === "list" ? "#FFFFFF" : "transparent",
                color: viewMode === "list" ? "#2165F5" : "#64748B",
                cursor: "pointer",
                boxShadow: viewMode === "list" ? "0 2px 5px rgba(0,0,0,0.06)" : "none",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
            <button
              onClick={() => setViewMode("map")}
              title="Geospatial Map View"
              style={{
                padding: "6px 9px",
                borderRadius: 8,
                border: "none",
                background: viewMode === "map" ? "#FFFFFF" : "transparent",
                color: viewMode === "map" ? "#2165F5" : "#64748B",
                cursor: "pointer",
                boxShadow: viewMode === "map" ? "0 2px 5px rgba(0,0,0,0.06)" : "none",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                <line x1="8" y1="2" x2="8" y2="18"></line>
                <line x1="16" y1="6" x2="16" y2="22"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Operational Toolbar (Export & Broadcast) */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button
            onClick={exportDossierJSON}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: 10,
              padding: "7px 10px",
              fontSize: 11,
              fontWeight: 700,
              color: "#334155",
              cursor: "pointer",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export Dossier
          </button>

          <button
            onClick={() => setBroadcastAlert({
              active: true,
              message: `WeatherPulse Flash Alert: Severe waterlogging & localized inundation confirmed across ${location.toUpperCase()}. Caution advised on arterial routes.`,
            })}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: broadcastAlert.active ? "#FEF2F2" : "#FFF7ED",
              border: broadcastAlert.active ? "1px solid #FCA5A5" : "1px solid #FED7AA",
              borderRadius: 10,
              padding: "7px 10px",
              fontSize: 11,
              fontWeight: 700,
              color: broadcastAlert.active ? "#DC2626" : "#C2410C",
              cursor: "pointer",
            }}
          >
            <span>📢</span>
            {broadcastAlert.active ? "Alert Broadcasting" : "Broadcast Advisory"}
          </button>
        </div>

        {/* Flash Advisory Banner if active */}
        {broadcastAlert.active && (
          <div
            style={{
              background: "#FEF2F2",
              border: "1px solid #F87171",
              borderRadius: 12,
              padding: "10px 14px",
              marginBottom: 16,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 8,
              boxShadow: "0 4px 12px rgba(239, 68, 68, 0.12)",
            }}
          >
            <div style={{ fontSize: 11.5, color: "#991B1B", lineHeight: 1.4 }}>
              <strong>🚨 Public Advisory Broadcasted:</strong> {broadcastAlert.message}
            </div>
            <button
              onClick={() => setBroadcastAlert({ active: false })}
              style={{
                background: "none",
                border: "none",
                color: "#991B1B",
                fontWeight: 700,
                cursor: "pointer",
                padding: 0,
                fontSize: 12,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Map View Mode */}
        {viewMode === "map" && (
          <div style={{ marginBottom: 16 }}>
            <IncidentMap clusters={filteredClusters} userCoords={coords} />
          </div>
        )}

        {/* Clusters List (Shown if list mode) */}
        {viewMode === "list" && (
          loading && clusters.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748B", fontSize: 13 }}>
              Analyzing crowd reports and clustering active incidents...
            </div>
          ) : filteredClusters.length === 0 ? (
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: 16,
            padding: "36px 20px",
            textAlign: "center",
            border: "1px dashed #CBD5E1",
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>🛡️</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", marginBottom: 4 }}>
            No Matching Incidents
          </div>
          <div style={{ fontSize: 12, color: "#64748B" }}>
            No unhandled weather or waterlogging incidents found in this filter category.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filteredClusters.map((cluster) => {
            const isCritical = cluster.priority === "CRITICAL";
            const isCorroborated = cluster.verificationStatus === "corroborated" || cluster.verificationStatus === "confirmed";
            const isStale = cluster.verificationStatus === "stale_or_duplicate";

            return (
              <div
                key={cluster.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: 18,
                  overflow: "hidden",
                  border: isCritical
                    ? "1.5px solid #FCA5A5"
                    : isCorroborated
                    ? "1.5px solid #86EFAC"
                    : isStale
                    ? "1.5px solid #FDE68A"
                    : "1px solid #E2E8F0",
                  boxShadow: isCritical
                    ? "0 4px 16px rgba(239, 68, 68, 0.08)"
                    : "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                {/* Header status bar */}
                <div
                  style={{
                    padding: "10px 14px",
                    background: isCritical
                      ? "#FEF2F2"
                      : isCorroborated
                      ? "#F0FDF4"
                      : isStale
                      ? "#FFFBEB"
                      : "#F8FAFC",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                        background: isCritical ? "#EF4444" : isCorroborated ? "#16A34A" : isStale ? "#D97706" : "#64748B",
                        color: "#FFFFFF",
                      }}
                    >
                      {cluster.priority}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#334155" }}>
                      {cluster.reportsCount} {cluster.reportsCount === 1 ? "Report" : "Corroborated Reports"}
                    </span>
                  </div>

                  {/* Confidence Score Pill */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 800,
                      color: cluster.confidenceScore >= 75 ? "#16A34A" : cluster.confidenceScore >= 50 ? "#D97706" : "#EF4444",
                    }}
                  >
                    <span>{cluster.confidenceScore}% Confidence</span>
                  </div>
                </div>

                {/* Content Body */}
                <div style={{ padding: "14px" }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    {/* Media thumbnail */}
                    <div
                      style={{
                        width: 76,
                        height: 76,
                        borderRadius: 12,
                        overflow: "hidden",
                        background: "#F1F5F9",
                        flexShrink: 0,
                        position: "relative",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cluster.representativeImageUrl}
                        alt="Evidence"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      {cluster.mediaUrls.length > 1 && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: 4,
                            right: 4,
                            background: "rgba(0,0,0,0.7)",
                            color: "#FFFFFF",
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "2px 5px",
                            borderRadius: 6,
                          }}
                        >
                          +{cluster.mediaUrls.length - 1}
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#0F172A",
                          margin: "0 0 4px",
                          lineHeight: 1.3,
                        }}
                      >
                        {cluster.title}
                      </h3>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#64748B",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          marginBottom: 6,
                        }}
                      >
                        <span>📍 {cluster.approximateLocation}</span>
                      </div>
                      {cluster.aiSummary ? (
                        <div
                          style={{
                            background: "linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)",
                            border: "1px solid #BFDBFE",
                            borderRadius: 8,
                            padding: "6px 8px",
                            fontSize: 11,
                            color: "#1E3A8A",
                            lineHeight: 1.35,
                            marginTop: 4,
                          }}
                        >
                          <span style={{ fontWeight: 700, color: "#2563EB" }}>⚡ Groq AI: </span>
                          {cluster.aiSummary}
                        </div>
                      ) : cluster.captions.length > 0 ? (
                        <p
                          style={{
                            fontSize: 12,
                            color: "#334155",
                            margin: 0,
                            fontStyle: "italic",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          &ldquo;{cluster.captions[0]}&rdquo;
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Automated Intelligence Insights */}
                  {cluster.warnings && cluster.warnings.length > 0 && (
                    <div
                      style={{
                        marginTop: 12,
                        background: "#F8FAFC",
                        borderRadius: 10,
                        padding: "8px 10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      {cluster.warnings.map((w, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: 11,
                            color: "#475569",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span style={{ color: "#3B82F6" }}>ℹ️</span>
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Officer Actions Bar */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: "1px solid #F1F5F9",
                    }}
                  >
                    <button
                      onClick={() => handleAction(cluster, "confirm")}
                      disabled={actionInProgress === cluster.id || cluster.verificationStatus === "confirmed"}
                      style={{
                        flex: 1,
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "none",
                        background: cluster.verificationStatus === "confirmed" ? "#DCFCE7" : "#16A34A",
                        color: cluster.verificationStatus === "confirmed" ? "#166534" : "#FFFFFF",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {cluster.verificationStatus === "confirmed" ? "✓ Verified" : "Verify & Escalate"}
                    </button>

                    <button
                      onClick={() => handleAction(cluster, "flag_stale")}
                      disabled={actionInProgress === cluster.id}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #FDE68A",
                        background: "#FFFBEB",
                        color: "#B45309",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Flag Stale
                    </button>

                    <button
                      onClick={() => handleAction(cluster, "dismiss")}
                      disabled={actionInProgress === cluster.id}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #E2E8F0",
                        background: "#FFFFFF",
                        color: "#64748B",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )
      )}
    </div>
  );
}
