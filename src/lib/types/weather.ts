// Core weather types for WeatherPulse
// Shared across provider adapters, scoring service, and API responses

export interface NormalizedWeatherData {
  provider: string;
  providerDisplayName: string;
  locationId: string;
  locationName: string;
  lat: number;
  lon: number;
  observedAt: string | null; // ISO string or null if unavailable
  fetchedAt: string;
  temperature: number | null; // °C
  feelsLike: number | null; // °C
  humidity: number | null; // 0–100 %
  windSpeed: number | null; // km/h
  windDirection: number | null; // degrees
  precipitation: number | null; // mm/h
  conditionCode: string; // normalized: clear, cloudy, rainy, foggy, stormy, snow, partly-cloudy
  conditionDescription: string;
  weatherIcon: string;
  providerStatus: "ok" | "partial" | "error" | "timeout" | "disabled";
  errorMessage?: string;
  rawData?: unknown;
}

export interface WeatherAggregation {
  locationId: string;
  locationName: string;
  lat: number;
  lon: number;
  generatedAt: string;
  validUntil: string;
  summary: {
    temperature: number | null;
    feelsLike: number | null;
    humidity: number | null;
    windSpeed: number | null;
    windDirection: number | null;
    precipitation: number | null;
    conditionCode: string;
    conditionDescription: string;
    weatherIcon: string;
  };
  confidenceScore: number | null; // 0–100
  confidenceBreakdown: {
    agreementScore: number;
    freshnessScore: number;
    availabilityScore: number;
  };
  confidenceLabel: string;
  disagreementFlags: string[];
  providers: NormalizedWeatherData[];
  stale: boolean;
}

export interface WeatherLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

export type ConditionCode =
  | "clear"
  | "partly-cloudy"
  | "cloudy"
  | "rainy"
  | "stormy"
  | "foggy"
  | "snow"
  | "unknown";

export const CONDITION_ICONS: Record<ConditionCode, string> = {
  clear: "☀️",
  "partly-cloudy": "⛅",
  cloudy: "☁️",
  rainy: "🌧️",
  stormy: "⛈️",
  foggy: "🌫️",
  snow: "❄️",
  unknown: "🌡️",
};
