/**
 * Incident Clustering & Verification Engine
 * Solves:
 * 1. Multiple reports of the same incident within proximity & time window (Spatial-temporal clustering)
 * 2. Cross-verification with macro weather station observations (Physical Plausibility)
 * 3. Old/stale image detection and deduplication
 * 4. Officer priority scoring & triage
 */

export interface IncidentCluster {
  id: string;
  incidentType: "waterlogging" | "heavy_rain" | "storm" | "cloudy" | "normal";
  title: string;
  approximateLocation: string;
  coordinates: { lat: number; lon: number };
  reportsCount: number;
  firstReportedAt: string;
  lastReportedAt: string;
  confidenceScore: number; // 0 - 100
  verificationStatus: "unverified" | "corroborated" | "confirmed" | "stale_or_duplicate";
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  macroWeatherMatch: boolean; // Does nearby station/radar confirm rain/storm?
  representativeImageUrl: string;
  mediaUrls: string[];
  captions: string[];
  momentIds: string[];
  aiSummary?: string;
  warnings?: string[];
}

export interface RawMomentReport {
  id: string;
  userName?: string;
  caption?: string;
  imageUrl: string;
  approximateLocation: string;
  coordinates?: { lat: number; lon: number };
  incidentType?: "waterlogging" | "heavy_rain" | "storm" | "cloudy" | "normal";
  createdAt: string | Date;
  expiresAt: string | Date;
  analysisResult?: {
    skyCondition?: string;
    detectedObjects?: string[];
    visiblePrecipitation?: boolean;
    ocrExtractedText?: string;
    confidenceScore?: number;
    isSuspectedStaleOrOld?: boolean;
    pHash?: string;
    aiSummary?: string;
    waterDepthEstimate?: string;
  };
  verificationStatus?: string;
}

// Haversine distance in meters
export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Infer incident type from caption, OCR, or vision tags
 */
export function inferIncidentType(
  caption: string = "",
  ocrText: string = "",
  detectedObjects: string[] = []
): "waterlogging" | "heavy_rain" | "storm" | "cloudy" | "normal" {
  const text = `${caption} ${ocrText} ${detectedObjects.join(" ")}`.toLowerCase();

  if (
    text.includes("waterlog") ||
    text.includes("water log") ||
    text.includes("flood") ||
    text.includes("submerged") ||
    text.includes("paani bhar") ||
    text.includes("jal jamav") ||
    text.includes("water-logging")
  ) {
    return "waterlogging";
  }

  if (
    text.includes("heavy rain") ||
    text.includes("downpour") ||
    text.includes("tez barish") ||
    text.includes("torrential") ||
    text.includes("pouring")
  ) {
    return "heavy_rain";
  }

  if (text.includes("storm") || text.includes("thunder") || text.includes("gale") || text.includes("cyclone") || text.includes("aandhi")) {
    return "storm";
  }

  if (text.includes("rain") || text.includes("barish") || text.includes("drizzle") || text.includes("boondabaandi")) {
    return "heavy_rain";
  }

  if (text.includes("cloud") || text.includes("badal") || text.includes("overcast")) {
    return "cloudy";
  }

  return "normal";
}

/**
 * Simple perceptual / string hash similarity check to identify identical photos re-shared
 */
export function isDuplicatePhoto(pHashA?: string, pHashB?: string): boolean {
  if (!pHashA || !pHashB) return false;
  return pHashA === pHashB;
}

/**
 * Spatial-temporal clustering algorithm
 * - Spatial radius: default 1200 meters
 * - Temporal window: default 45 minutes
 */
export function clusterAndVerifyMoments(
  moments: RawMomentReport[],
  macroRainActive: boolean = false,
  options = { maxDistanceMeters: 1200, maxTimeDiffMs: 45 * 60 * 1000 }
): IncidentCluster[] {
  const clusters: IncidentCluster[] = [];
  const assigned = new Set<string>();

  // Sort moments chronologically
  const sorted = [...moments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  for (let i = 0; i < sorted.length; i++) {
    const primary = sorted[i];
    if (assigned.has(primary.id)) continue;

    const pLat = primary.coordinates?.lat ?? 22.7196;
    const pLon = primary.coordinates?.lon ?? 75.8577;
    const pTime = new Date(primary.createdAt).getTime();
    const pType =
      primary.incidentType && primary.incidentType !== "normal"
        ? primary.incidentType
        : inferIncidentType(
            primary.caption,
            primary.analysisResult?.ocrExtractedText,
            primary.analysisResult?.detectedObjects
          );

    const clusterGroup: RawMomentReport[] = [primary];
    assigned.add(primary.id);

    // Look for nearby, concurrent reports of similar nature
    for (let j = i + 1; j < sorted.length; j++) {
      const candidate = sorted[j];
      if (assigned.has(candidate.id)) continue;

      const cLat = candidate.coordinates?.lat ?? 22.7196;
      const cLon = candidate.coordinates?.lon ?? 75.8577;
      const cTime = new Date(candidate.createdAt).getTime();
      const cType =
        candidate.incidentType && candidate.incidentType !== "normal"
          ? candidate.incidentType
          : inferIncidentType(
              candidate.caption,
              candidate.analysisResult?.ocrExtractedText,
              candidate.analysisResult?.detectedObjects
            );

      const distance = getDistanceInMeters(pLat, pLon, cLat, cLon);
      const timeDiff = Math.abs(pTime - cTime);

      // Match condition: within spatial threshold, within temporal window, compatible incident
      const sameType = pType === cType || (pType === "waterlogging" && cType === "heavy_rain") || (pType === "heavy_rain" && cType === "waterlogging");

      if (distance <= options.maxDistanceMeters && timeDiff <= options.maxTimeDiffMs && sameType) {
        clusterGroup.push(candidate);
        assigned.add(candidate.id);
      }
    }

    // Determine cluster characteristics
    const reportsCount = clusterGroup.length;
    const isStaleSuspected = clusterGroup.some((m) => m.analysisResult?.isSuspectedStaleOrOld);
    
    // Check for exact duplicate images inside cluster
    const seenHashes = new Set<string>();
    let duplicateImageFound = false;
    clusterGroup.forEach((m) => {
      const hash = m.analysisResult?.pHash || m.imageUrl;
      if (seenHashes.has(hash)) duplicateImageFound = true;
      else seenHashes.add(hash);
    });

    // Compute Confidence Score
    let confidence = 40; // baseline for single user observation
    if (reportsCount >= 2) confidence += 25; // corroborated by 2nd observer
    if (reportsCount >= 4) confidence += 15; // multi-crowd consensus
    if (macroRainActive) confidence += 20; // backed by official meteorological radar/API

    // Penalties
    if (isStaleSuspected) confidence -= 25;
    if (duplicateImageFound) confidence -= 10;
    confidence = Math.max(10, Math.min(99, confidence));

    // Determine Status
    let verificationStatus: IncidentCluster["verificationStatus"] = "unverified";
    if (isStaleSuspected || (reportsCount === 1 && duplicateImageFound)) {
      verificationStatus = "stale_or_duplicate";
    } else if (confidence >= 80) {
      verificationStatus = "confirmed";
    } else if (reportsCount >= 2) {
      verificationStatus = "corroborated";
    }

    // Determine Priority
    let priority: IncidentCluster["priority"] = "LOW";
    if (pType === "waterlogging" || pType === "storm") {
      priority = reportsCount >= 3 || confidence >= 75 ? "CRITICAL" : "HIGH";
    } else if (pType === "heavy_rain") {
      priority = reportsCount >= 2 ? "HIGH" : "MEDIUM";
    } else {
      priority = "LOW";
    }

    // Cluster Title
    let title = `${pType.replace("_", " ").toUpperCase()}: ${primary.approximateLocation}`;
    if (pType === "waterlogging") title = `Waterlogging & Inundation: ${primary.approximateLocation}`;
    if (pType === "heavy_rain") title = `Severe Downpour: ${primary.approximateLocation}`;

    const warnings: string[] = [];
    if (reportsCount > 1) {
      warnings.push(`Corroborated by ${reportsCount} independent live reports in this 1.2km zone`);
    }
    if (duplicateImageFound) {
      warnings.push(`Repeated photograph detected across reports`);
    }
    if (isStaleSuspected) {
      warnings.push(`Flagged: Media timestamp mismatch or potential archive photo`);
    }
    if (macroRainActive) {
      warnings.push(`Cross-validated with radar precipitation data`);
    }

    const clusterAiSummary = clusterGroup.find((m) => m.analysisResult?.aiSummary)?.analysisResult?.aiSummary;

    clusters.push({
      id: `cluster-${primary.id}`,
      incidentType: pType,
      title,
      approximateLocation: primary.approximateLocation,
      coordinates: { lat: pLat, lon: pLon },
      reportsCount,
      firstReportedAt: new Date(Math.min(...clusterGroup.map((m) => new Date(m.createdAt).getTime()))).toISOString(),
      lastReportedAt: new Date(Math.max(...clusterGroup.map((m) => new Date(m.createdAt).getTime()))).toISOString(),
      confidenceScore: confidence,
      verificationStatus,
      priority,
      macroWeatherMatch: macroRainActive,
      representativeImageUrl: primary.imageUrl,
      mediaUrls: clusterGroup.map((m) => m.imageUrl),
      captions: clusterGroup.map((m) => m.caption).filter(Boolean) as string[],
      momentIds: clusterGroup.map((m) => m.id),
      aiSummary: clusterAiSummary,
      warnings,
    });
  }

  // Sort clusters by Priority then Confidence
  const priorityWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  return clusters.sort((a, b) => {
    const diff = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (diff !== 0) return diff;
    return b.confidenceScore - a.confidenceScore;
  });
}
