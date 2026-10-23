import { NextRequest } from "next/server";
import { aggregateWeather } from "@/lib/aggregator";

// Simple in-memory cache (10 min TTL per location)
const cache = new Map<string, { data: ReturnType<typeof aggregateWeather> extends Promise<infer T> ? T : never; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const location = searchParams.get("location") ?? "indore";
  const latStr = searchParams.get("lat");
  const lonStr = searchParams.get("lon");
  const name = searchParams.get("name") ?? undefined;

  const lat = latStr ? parseFloat(latStr) : undefined;
  const lon = lonStr ? parseFloat(lonStr) : undefined;

  const cacheKey = lat && lon ? `${lat.toFixed(3)},${lon.toFixed(3)}` : location.toLowerCase();

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return Response.json({ ...cached.data, stale: false, fromCache: true });
  }

  try {
    const data = await aggregateWeather(location, lat, lon, name);
    cache.set(cacheKey, { data, ts: Date.now() });
    return Response.json(data);
  } catch (err) {
    console.error("[/api/weather/current] Error:", err);
    // Return stale if available (NFR-007)
    if (cached) {
      return Response.json({ ...cached.data, stale: true, fromCache: true }, { status: 200 });
    }
    return Response.json({ error: "Failed to fetch weather data" }, { status: 503 });
  }
}
