// OpenWeatherMap provider adapter
// Docs: https://openweathermap.org/current
// Requires OPENWEATHER_KEY env variable

import { NormalizedWeatherData, ConditionCode } from "@/lib/types/weather";

function mapOwmId(id: number): { code: ConditionCode; description: string } {
  if (id >= 200 && id < 300) return { code: "stormy", description: "Thunderstorm" };
  if (id >= 300 && id < 400) return { code: "rainy", description: "Drizzle" };
  if (id >= 500 && id < 600) return { code: "rainy", description: "Rain" };
  if (id >= 600 && id < 700) return { code: "snow", description: "Snow" };
  if (id >= 700 && id < 800) {
    if (id === 741) return { code: "foggy", description: "Fog" };
    return { code: "foggy", description: "Atmospheric condition" };
  }
  if (id === 800) return { code: "clear", description: "Clear sky" };
  if (id === 801 || id === 802) return { code: "partly-cloudy", description: "Partly cloudy" };
  if (id === 803 || id === 804) return { code: "cloudy", description: "Cloudy" };
  return { code: "unknown", description: `OWM ${id}` };
}

function conditionToIcon(code: ConditionCode): string {
  const icons: Record<ConditionCode, string> = {
    clear: "☀️", "partly-cloudy": "⛅", cloudy: "☁️", rainy: "🌧️",
    stormy: "⛈️", foggy: "🌫️", snow: "❄️", unknown: "🌡️",
  };
  return icons[code] ?? "🌡️";
}

export async function fetchOpenWeather(
  lat: number,
  lon: number,
  locationId: string,
  locationName: string
): Promise<NormalizedWeatherData> {
  const fetchedAt = new Date().toISOString();
  const apiKey = process.env.OPENWEATHER_KEY;
  const enabled = process.env.ENABLE_PROVIDER_OPENWEATHER !== "false";

  if (!enabled || !apiKey) {
    const simulated = simulateOwmData(lat, lon);
    return {
      provider: "openweathermap",
      providerDisplayName: "OpenWeatherMap",
      locationId,
      locationName,
      lat,
      lon,
      observedAt: new Date().toISOString(),
      fetchedAt,
      ...simulated,
      providerStatus: !enabled ? "disabled" : "partial",
      errorMessage: !enabled ? "Provider disabled" : "No API key configured — using estimated data",
    };
  }

  const url =
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}` +
    `&appid=${apiKey}&units=metric`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`OpenWeatherMap HTTP ${res.status}`);
    }

    const data = await res.json();
    const weather = data.weather?.[0];
    const main = data.main;
    const wind = data.wind;
    const rain = data.rain;
    const cond = mapOwmId(weather?.id ?? 800);

    return {
      provider: "openweathermap",
      providerDisplayName: "OpenWeatherMap",
      locationId,
      locationName,
      lat,
      lon,
      observedAt: data.dt ? new Date(data.dt * 1000).toISOString() : null,
      fetchedAt,
      temperature: main?.temp ?? null,
      feelsLike: main?.feels_like ?? null,
      humidity: main?.humidity ?? null,
      windSpeed: wind?.speed != null ? wind.speed * 3.6 : null, // m/s → km/h
      windDirection: wind?.deg ?? null,
      precipitation: rain?.["1h"] ?? 0,
      conditionCode: cond.code,
      conditionDescription: weather?.description ?? cond.description,
      weatherIcon: conditionToIcon(cond.code),
      providerStatus: "ok",
      rawData: data,
    };
  } catch (err: unknown) {
    clearTimeout(timeout);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    console.error(`[OpenWeatherMap] Error:`, err instanceof Error ? err.message : err);
    return {
      provider: "openweathermap",
      providerDisplayName: "OpenWeatherMap",
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

function simulateOwmData(lat: number, lon: number) {
  const seed = (lat * 73 + lon * 17) % 25;
  const conditions: ConditionCode[] = ["clear", "partly-cloudy", "cloudy", "rainy", "cloudy"];
  const conditionCode = conditions[Math.floor(seed / 5) % conditions.length];
  const icons: Record<ConditionCode, string> = {
    clear: "☀️", "partly-cloudy": "⛅", cloudy: "☁️", rainy: "🌧️",
    stormy: "⛈️", foggy: "🌫️", snow: "❄️", unknown: "🌡️",
  };
  return {
    temperature: 26 + Math.round(seed * 0.6),
    feelsLike: 29 + Math.round(seed * 0.5),
    humidity: 55 + Math.round(seed * 1.2),
    windSpeed: 8 + Math.round(seed * 0.8),
    windDirection: (seed * 15) % 360,
    precipitation: conditionCode === "rainy" ? 1.8 : 0,
    conditionCode,
    conditionDescription: conditionCode.replace("-", " "),
    weatherIcon: icons[conditionCode],
  };
}
