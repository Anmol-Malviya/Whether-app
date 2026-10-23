// Aggregation and Confidence Scoring Service
// Implements FR-008 through FR-015, NFR-005
// Score weights: 40% agreement, 30% freshness, 30% availability

import { NormalizedWeatherData, WeatherAggregation, ConditionCode } from "@/lib/types/weather";
import { fetchOpenMeteo } from "@/lib/providers/open-meteo";
import { fetchWeatherApi } from "@/lib/providers/weatherapi";
import { fetchOpenWeather } from "@/lib/providers/openweather";

const SUPPORTED_LOCATIONS: Record<string, { lat: number; lon: number; name: string }> = {
  indore: { lat: 22.7196, lon: 75.8577, name: "Indore, Madhya Pradesh" },
  bhopal: { lat: 23.2599, lon: 77.4126, name: "Bhopal, Madhya Pradesh" },
  mumbai: { lat: 19.0760, lon: 72.8777, name: "Mumbai, Maharashtra" },
  delhi: { lat: 28.6139, lon: 77.2090, name: "New Delhi, Delhi" },
  bengaluru: { lat: 12.9716, lon: 77.5946, name: "Bengaluru, Karnataka" },
  pune: { lat: 18.5204, lon: 73.8567, name: "Pune, Maharashtra" },
  jaipur: { lat: 26.9124, lon: 75.7873, name: "Jaipur, Rajasthan" },
  ahmedabad: { lat: 23.0225, lon: 72.5714, name: "Ahmedabad, Gujarat" },
  kolkata: { lat: 22.5726, lon: 88.3639, name: "Kolkata, West Bengal" },
  hyderabad: { lat: 17.3850, lon: 78.4867, name: "Hyderabad, Telangana" },
  ujjain: { lat: 23.1765, lon: 75.7885, name: "Ujjain, Madhya Pradesh" },
  gwaliar: { lat: 26.2183, lon: 78.1828, name: "Gwalior, Madhya Pradesh" },
  jabalpur: { lat: 23.1815, lon: 79.9864, name: "Jabalpur, Madhya Pradesh" },
};

export function resolveLocation(locationId: string, customLat?: number, customLon?: number, customName?: string) {
  if (customLat !== undefined && customLon !== undefined && !isNaN(customLat) && !isNaN(customLon)) {
    return {
      lat: customLat,
      lon: customLon,
      name: customName || `Location (${customLat.toFixed(2)}, ${customLon.toFixed(2)})`,
      id: locationId.toLowerCase() || "custom",
    };
  }

  // Check if locationId is in coord format: "lat,lon" or "lat,lon:Name"
  if (locationId.includes(",")) {
    const [coordsPart, namePart] = locationId.split(":");
    const [latStr, lonStr] = coordsPart.split(",");
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    if (!isNaN(lat) && !isNaN(lon)) {
      return {
        lat,
        lon,
        name: namePart ? decodeURIComponent(namePart) : `Current Location (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
        id: "current-location",
      };
    }
  }

  const cleanId = locationId.toLowerCase().trim();
  const loc = SUPPORTED_LOCATIONS[cleanId] ?? {
    lat: parseFloat(process.env.DEFAULT_LOCATION_LAT ?? "22.7196"),
    lon: parseFloat(process.env.DEFAULT_LOCATION_LON ?? "75.8577"),
    name: process.env.DEFAULT_LOCATION_NAME ?? "Indore, Madhya Pradesh",
  };
  return { ...loc, id: cleanId };
}

// ─── Scoring helpers ───────────────────────────────────────────────────────────

function calcAgreementScore(providers: NormalizedWeatherData[]): number {
  const ok = providers.filter((p) => p.providerStatus === "ok" || p.providerStatus === "partial");
  if (ok.length < 2) return ok.length === 1 ? 50 : 0;

  const temps = ok.map((p) => p.temperature).filter((t): t is number => t !== null);
  if (temps.length < 2) return 50;

  const maxDiff = Math.max(...temps) - Math.min(...temps);
  // Score decreases as temp spread increases; >5°C diff → 0
  const tempScore = Math.max(0, 100 - maxDiff * 20);

  // Condition agreement
  const conditions = ok.map((p) => p.conditionCode);
  const dominantCondition = conditions[0];
  const agreingCount = conditions.filter((c) => isSimilarCondition(c, dominantCondition)).length;
  const conditionScore = (agreingCount / conditions.length) * 100;

  return Math.round((tempScore * 0.6 + conditionScore * 0.4));
}

function isSimilarCondition(a: string, b: string): boolean {
  if (a === b) return true;
  const wetConds = new Set(["rainy", "stormy"]);
  const dryConds = new Set(["clear", "partly-cloudy", "cloudy"]);
  if (wetConds.has(a) && wetConds.has(b)) return true;
  if (dryConds.has(a) && dryConds.has(b)) return true;
  return false;
}

function calcFreshnessScore(providers: NormalizedWeatherData[]): number {
  const now = Date.now();
  const ok = providers.filter((p) => p.providerStatus === "ok" && p.observedAt);
  if (ok.length === 0) return 0;

  const scores = ok.map((p) => {
    const ageMs = now - new Date(p.observedAt!).getTime();
    const ageMin = ageMs / 60000;
    // Full score if < 10 min, decays to 0 at 60 min
    return Math.max(0, Math.min(100, 100 - (ageMin / 60) * 100));
  });

  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function calcAvailabilityScore(providers: NormalizedWeatherData[]): number {
  if (providers.length === 0) return 0;
  const okCount = providers.filter(
    (p) => p.providerStatus === "ok" || p.providerStatus === "partial"
  ).length;
  return Math.round((okCount / providers.length) * 100);
}

function getDisagreementFlags(providers: NormalizedWeatherData[]): string[] {
  const flags: string[] = [];
  const ok = providers.filter((p) => p.providerStatus === "ok" || p.providerStatus === "partial");
  if (ok.length < 2) return flags;

  const temps = ok.map((p) => p.temperature).filter((t): t is number => t !== null);
  if (temps.length >= 2 && Math.max(...temps) - Math.min(...temps) > 3) {
    flags.push(
      `Temperature differs by ${(Math.max(...temps) - Math.min(...temps)).toFixed(1)}°C across sources`
    );
  }

  const conditions = ok.map((p) => p.conditionCode);
  const unique = new Set(conditions);
  if (unique.size > 1) {
    flags.push(`Condition disagreement: ${[...unique].join(", ")}`);
  }

  return flags;
}

function computeConsensus(providers: NormalizedWeatherData[]): WeatherAggregation["summary"] {
  const ok = providers.filter((p) => p.providerStatus === "ok" || p.providerStatus === "partial");

  const avg = <T extends number>(vals: (T | null)[]): T | null => {
    const valid = vals.filter((v): v is T => v !== null);
    return valid.length > 0 ? (valid.reduce((a, b) => a + b, 0) / valid.length) as T : null;
  };

  const temperature = avg(ok.map((p) => p.temperature));
  const feelsLike = avg(ok.map((p) => p.feelsLike));
  const humidity = avg(ok.map((p) => p.humidity));
  const windSpeed = avg(ok.map((p) => p.windSpeed));
  const windDirection = avg(ok.map((p) => p.windDirection));
  const precipitation = avg(ok.map((p) => p.precipitation));

  // Pick modal condition
  const condCounts: Record<string, number> = {};
  for (const p of ok) condCounts[p.conditionCode] = (condCounts[p.conditionCode] ?? 0) + 1;
  const conditionCode = (Object.entries(condCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "unknown") as ConditionCode;

  const matchingProvider = ok.find((p) => p.conditionCode === conditionCode);
  const conditionDescription = matchingProvider?.conditionDescription ?? conditionCode;
  const weatherIcon = matchingProvider?.weatherIcon ?? "🌡️";

  return {
    temperature: temperature !== null ? Math.round(temperature * 10) / 10 : null,
    feelsLike: feelsLike !== null ? Math.round(feelsLike * 10) / 10 : null,
    humidity: humidity !== null ? Math.round(humidity) : null,
    windSpeed: windSpeed !== null ? Math.round(windSpeed * 10) / 10 : null,
    windDirection: windDirection !== null ? Math.round(windDirection) : null,
    precipitation: precipitation !== null ? Math.round(precipitation * 10) / 10 : null,
    conditionCode,
    conditionDescription,
    weatherIcon,
  };
}

function confidenceLabel(score: number | null): string {
  if (score === null) return "Unavailable";
  if (score >= 80) return "High Confidence";
  if (score >= 60) return "Moderate Confidence";
  if (score >= 40) return "Low Confidence";
  return "Very Low Confidence";
}

// ─── Main aggregation entry point ─────────────────────────────────────────────

export async function aggregateWeather(
  locationId: string,
  lat?: number,
  lon?: number,
  name?: string
): Promise<WeatherAggregation> {
  const loc = resolveLocation(locationId, lat, lon, name);
  const generatedAt = new Date().toISOString();
  const validUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min cache

  // Fetch all providers in parallel; individual errors are caught inside adapters (FR-004)
  const [openMeteo, weatherApi, openWeather] = await Promise.all([
    fetchOpenMeteo(loc.lat, loc.lon, loc.id, loc.name),
    fetchWeatherApi(loc.lat, loc.lon, loc.id, loc.name),
    fetchOpenWeather(loc.lat, loc.lon, loc.id, loc.name),
  ]);

  const providers = [openMeteo, weatherApi, openWeather];
  const okProviders = providers.filter(
    (p) => p.providerStatus === "ok" || p.providerStatus === "partial"
  );

  // FR-013: insufficient data state
  if (okProviders.length === 0) {
    return {
      locationId: loc.id,
      locationName: loc.name,
      lat: loc.lat,
      lon: loc.lon,
      generatedAt,
      validUntil,
      summary: {
        temperature: null, feelsLike: null, humidity: null,
        windSpeed: null, windDirection: null, precipitation: null,
        conditionCode: "unknown", conditionDescription: "No data available",
        weatherIcon: "🌡️",
      },
      confidenceScore: null,
      confidenceBreakdown: { agreementScore: 0, freshnessScore: 0, availabilityScore: 0 },
      confidenceLabel: "Unavailable",
      disagreementFlags: ["All providers failed or are unavailable"],
      providers,
      stale: false,
    };
  }

  const agreementScore = calcAgreementScore(providers);
  const freshnessScore = calcFreshnessScore(providers);
  const availabilityScore = calcAvailabilityScore(providers);

  // Weighted score: 40% agreement, 30% freshness, 30% availability (FR-010)
  const confidenceScore = Math.round(
    agreementScore * 0.4 + freshnessScore * 0.3 + availabilityScore * 0.3
  );

  return {
    locationId: loc.id,
    locationName: loc.name,
    lat: loc.lat,
    lon: loc.lon,
    generatedAt,
    validUntil,
    summary: computeConsensus(providers),
    confidenceScore,
    confidenceBreakdown: { agreementScore, freshnessScore, availabilityScore },
    confidenceLabel: confidenceLabel(confidenceScore),
    disagreementFlags: getDisagreementFlags(providers),
    providers,
    stale: false,
  };
}
