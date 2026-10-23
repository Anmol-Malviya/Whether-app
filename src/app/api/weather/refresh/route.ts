import { NextRequest } from "next/server";
import { aggregateWeather } from "@/lib/aggregator";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const location = (body as { location?: string; lat?: number; lon?: number; name?: string }).location ?? "indore";
  const { lat, lon, name } = body as { lat?: number; lon?: number; name?: string };

  try {
    const data = await aggregateWeather(location, lat, lon, name);
    return Response.json(data);
  } catch (err) {
    console.error("[/api/weather/refresh] Error:", err);
    return Response.json({ error: "Failed to refresh weather data" }, { status: 503 });
  }
}
