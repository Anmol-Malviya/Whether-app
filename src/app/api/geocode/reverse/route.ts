import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const latStr = searchParams.get("lat");
  const lonStr = searchParams.get("lon");

  if (!latStr || !lonStr) {
    return NextResponse.json({ error: "lat and lon parameters are required" }, { status: 400 });
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "Invalid lat or lon values" }, { status: 400 });
  }

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "WeatherMajorApp/1.0 (anmol@project.local)",
        "Accept-Language": "en,hi;q=0.8",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error(`Nominatim responded with status ${res.status}`);
    }

    const data = await res.json();
    const addr = data.address || {};

    // Build specific localized precision name
    // Priority: Point of interest / Building / Road / Sector / Colony / City
    const specificSpot = addr.building || addr.amenity || addr.shop || addr.office || addr.leisure || "";
    const road = addr.road || addr.pedestrian || addr.street || "";
    const neighborhood = addr.neighbourhood || addr.suburb || addr.residential || addr.subdivision || addr.quarter || "";
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.state_district || "Local Area";
    const state = addr.state || "";
    const postcode = addr.postcode || "";

    const parts: string[] = [];
    if (specificSpot) parts.push(specificSpot);
    if (road && !parts.includes(road)) parts.push(road);
    if (neighborhood && !parts.includes(neighborhood)) parts.push(neighborhood);
    if (city && !parts.includes(city)) parts.push(city);

    // If parts is too short, provide readable address
    let displayName = parts.slice(0, 3).join(", ");
    if (!displayName) {
      displayName = data.name || `${city}${state ? `, ${state}` : ""}`;
    }

    return NextResponse.json({
      success: true,
      displayName,
      fullAddress: data.display_name || displayName,
      details: {
        spot: specificSpot,
        road,
        neighborhood,
        city,
        state,
        postcode,
      },
      coordinates: {
        lat,
        lon,
      },
    });
  } catch (err: any) {
    console.error("[/api/geocode/reverse] Error:", err?.message || err);
    // Fallback gracefully
    return NextResponse.json({
      success: false,
      displayName: `Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
      coordinates: { lat, lon },
      error: "Reverse geocoding unavailable",
    });
  }
}
