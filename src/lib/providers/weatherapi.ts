// WeatherAPI.com provider adapter
// Docs: https://www.weatherapi.com/docs/
// Requires WEATHERAPI_KEY env variable

import { NormalizedWeatherData, ConditionCode } from "@/lib/types/weather";

function mapWeatherApiCode(code: number, isDay: number): { code: ConditionCode; description: string } {
  // WeatherAPI condition codes reference
  if (code === 1000) return { code: isDay ? "clear" : "clear", description: "Clear / Sunny" };
  if ([1003, 1006].includes(code)) return { code: "partly-cloudy", description: "Partly cloudy" };
  if ([1009].includes(code)) return { code: "cloudy", description: "Overcast" };
  if ([1030, 1135, 1147].includes(code)) return { code: "foggy", description: "Fog / Mist" };
  if ([1063, 1066, 1072, 1150, 1153, 1168, 1171].includes(code)) return { code: "rainy", description: "Drizzle" };
  if ([1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243, 1246].includes(code))
    return { code: "rainy", description: "Rain" };
  if ([1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264].includes(code))
    return { code: "snow", description: "Snow / Sleet" };
  if ([1273, 1276, 1279, 1282].includes(code)) return { code: "stormy", description: "Thunderstorm" };
  return { code: "unknown", description: `Code ${code}` };
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

export async function fetchWeatherApi(
  lat: number,
  lon: number,
  locationId: string,
  locationName: string
): Promise<NormalizedWeatherData> {
  const fetchedAt = new Date().toISOString();
  const apiKey = process.env.WEATHERAPI_KEY;
  const enabled = process.env.ENABLE_PROVIDER_WEATHERAPI !== "false";

  if (!enabled || !apiKey) {
    return {
      provider: "weatherapi",
      providerDisplayName: "WeatherAPI",
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
      conditionDescription: !enabled ? "Provider disabled" : "API key not configured",
      weatherIcon: "🌡️",
      providerStatus: !enabled ? "disabled" : "error",
      errorMessage: !enabled ? "Provider disabled" : "WEATHERAPI_KEY not configured",
    };
  }

  const query = `${lat},${lon}`;
  const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${query}&aqi=no`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`WeatherAPI HTTP ${res.status}`);
    }

    const data = await res.json();
    const cur = data.current;
    const cond = mapWeatherApiCode(cur.condition?.code ?? 1000, cur.is_day ?? 1);

    return {
      provider: "weatherapi",
      providerDisplayName: "WeatherAPI",
      locationId,
      locationName,
      lat,
      lon,
      observedAt: cur.last_updated ?? null,
      fetchedAt,
      temperature: cur.temp_c ?? null,
      feelsLike: cur.feelslike_c ?? null,
      humidity: cur.humidity ?? null,
      windSpeed: cur.wind_kph ?? null,
      windDirection: cur.wind_degree ?? null,
      precipitation: cur.precip_mm ?? null,
      conditionCode: cond.code,
      conditionDescription: cond.description,
      weatherIcon: conditionToIcon(cond.code),
      providerStatus: "ok",
      rawData: data,
    };
  } catch (err: unknown) {
    clearTimeout(timeout);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    console.error(`[WeatherAPI] Error:`, err instanceof Error ? err.message : err);
    return {
      provider: "weatherapi",
      providerDisplayName: "WeatherAPI",
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
