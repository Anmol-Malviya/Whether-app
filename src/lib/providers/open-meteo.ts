// Open-Meteo provider adapter (free, no API key needed)
// Docs: https://open-meteo.com/en/docs

import { NormalizedWeatherData, ConditionCode } from "@/lib/types/weather";

const WMO_CODE_MAP: Record<number, { code: ConditionCode; description: string }> = {
  0: { code: "clear", description: "Clear sky" },
  1: { code: "clear", description: "Mainly clear" },
  2: { code: "partly-cloudy", description: "Partly cloudy" },
  3: { code: "cloudy", description: "Overcast" },
  45: { code: "foggy", description: "Fog" },
  48: { code: "foggy", description: "Depositing rime fog" },
  51: { code: "rainy", description: "Light drizzle" },
  53: { code: "rainy", description: "Moderate drizzle" },
  55: { code: "rainy", description: "Dense drizzle" },
  61: { code: "rainy", description: "Slight rain" },
  63: { code: "rainy", description: "Moderate rain" },
  65: { code: "rainy", description: "Heavy rain" },
  71: { code: "snow", description: "Slight snowfall" },
  73: { code: "snow", description: "Moderate snowfall" },
  75: { code: "snow", description: "Heavy snowfall" },
  80: { code: "rainy", description: "Slight rain showers" },
  81: { code: "rainy", description: "Moderate rain showers" },
  82: { code: "rainy", description: "Violent rain showers" },
  95: { code: "stormy", description: "Thunderstorm" },
  96: { code: "stormy", description: "Thunderstorm with hail" },
  99: { code: "stormy", description: "Thunderstorm with heavy hail" },
};

function mapWmoCode(code: number): { code: ConditionCode; description: string } {
  return WMO_CODE_MAP[code] ?? { code: "unknown", description: `WMO code ${code}` };
}

function conditionToIcon(code: ConditionCode): string {
  const icons: Record<ConditionCode, string> = {
    clear: "☀️",
    "partly-cloudy": "⛅",
    cloudy: "☁️",
    rainy: "🌧️",
    stormy: "⛈️",
    foggy: "🌫️",
    snow: "❄️",
    unknown: "🌡️",
  };
  return icons[code] ?? "🌡️";
}

export async function fetchOpenMeteo(
  lat: number,
  lon: number,
  locationId: string,
  locationName: string
): Promise<NormalizedWeatherData> {
  const fetchedAt = new Date().toISOString();
  const enabled = process.env.ENABLE_PROVIDER_OPEN_METEO !== "false";

  if (!enabled) {
    return {
      provider: "open-meteo",
      providerDisplayName: "Open-Meteo",
      locationId,
      locationName,
      lat,
      lon,
      observedAt: null,
      fetchedAt,
      temperature: null,
      feelsLike: null,
      humidity: null,
      windSpeed: null,
      windDirection: null,
      precipitation: null,
      conditionCode: "unknown",
      conditionDescription: "Provider disabled",
      weatherIcon: "🌡️",
      providerStatus: "disabled",
    };
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,` +
    `weather_code,wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=Asia%2FKolkata`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }

    const data = await res.json();
    const cur = data.current;
    const cond = mapWmoCode(cur.weather_code ?? 0);

    return {
      provider: "open-meteo",
      providerDisplayName: "Open-Meteo",
      locationId,
      locationName,
      lat,
      lon,
      observedAt: cur.time ?? null,
      fetchedAt,
      temperature: cur.temperature_2m ?? null,
      feelsLike: cur.apparent_temperature ?? null,
      humidity: cur.relative_humidity_2m ?? null,
      windSpeed: cur.wind_speed_10m ?? null,
      windDirection: cur.wind_direction_10m ?? null,
      precipitation: cur.precipitation ?? null,
      conditionCode: cond.code,
      conditionDescription: cond.description,
      weatherIcon: conditionToIcon(cond.code),
      providerStatus: "ok",
      rawData: data,
    };
  } catch (err: unknown) {
    clearTimeout(timeout);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    console.error(`[Open-Meteo] Error:`, err instanceof Error ? err.message : err);
    return {
      provider: "open-meteo",
      providerDisplayName: "Open-Meteo",
      locationId,
      locationName,
      lat,
      lon,
      observedAt: null,
      fetchedAt,
      temperature: null,
      feelsLike: null,
      humidity: null,
      windSpeed: null,
      windDirection: null,
      precipitation: null,
      conditionCode: "unknown",
      conditionDescription: isTimeout ? "Request timed out" : "Error fetching data",
      weatherIcon: "🌡️",
      providerStatus: isTimeout ? "timeout" : "error",
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}
