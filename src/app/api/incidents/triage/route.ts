import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Moment from "@/models/Moment";
import { clusterAndVerifyMoments, RawMomentReport } from "@/lib/verificationEngine";
import { aggregateWeather } from "@/lib/aggregator";

// GET /api/incidents/triage?location=indore
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const location = searchParams.get("location") ?? "indore";

  try {
    await connectToDatabase();
    const now = new Date();

    // Fetch active moments (within TTL)
    const momentsDoc = await Moment.find({
      expiresAt: { $gt: now },
      moderationStatus: { $ne: "hidden" },
    })
      .sort({ createdAt: -1 })
      .limit(60)
      .lean();

    // Get macro weather data to check if rain/storm is officially recorded nearby
    let macroRainActive = false;
    try {
      const weatherData = await aggregateWeather(location);
      const cond = weatherData.summary.conditionCode;
      macroRainActive = cond === "rainy" || cond === "stormy" || (weatherData.summary.humidity ?? 0) > 85;
    } catch (wErr) {
      console.warn("[Triage] Weather provider check warning:", wErr);
    }

    // Map DB documents into RawMomentReport format
    const rawMoments: RawMomentReport[] = momentsDoc.map((m: any) => ({
      id: m._id.toString(),
      userName: m.userName,
      caption: m.caption,
      imageUrl: m.imageUrl,
      approximateLocation: m.approximateLocation,
      coordinates: m.coordinates || { lat: 22.7196, lon: 75.8577 },
      incidentType: m.incidentType,
      createdAt: m.createdAt,
      expiresAt: m.expiresAt,
      analysisResult: m.analysisResult,
      verificationStatus: m.verificationStatus,
    }));

    // Perform clustering, deduplication, and confidence scoring
    const clusters = clusterAndVerifyMoments(rawMoments, macroRainActive);

    // Summary statistics for the officer dashboard
    const stats = {
      totalRawReports: rawMoments.length,
      clusteredIncidents: clusters.length,
      criticalAlerts: clusters.filter((c) => c.priority === "CRITICAL").length,
      corroborated: clusters.filter((c) => c.verificationStatus === "corroborated" || c.verificationStatus === "confirmed").length,
      staleOrDuplicatesFlagged: clusters.filter((c) => c.verificationStatus === "stale_or_duplicate").length,
      macroWeatherSync: macroRainActive ? "Rain Detected by Stations" : "Dry / Clear in Official Models",
    };

    return Response.json({
      success: true,
      stats,
      clusters,
      rawMoments,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[GET /api/incidents/triage] Error:", error);
    return Response.json({ error: "Failed to generate triage stream" }, { status: 500 });
  }
}

// POST /api/incidents/triage/action — Officer verification actions (Confirm, Dismiss, Flag Duplicate)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { momentIds, action } = body;

    if (!momentIds || !Array.isArray(momentIds) || !action) {
      return Response.json({ error: "Invalid action payload" }, { status: 400 });
    }

    await connectToDatabase();

    if (action === "confirm") {
      await Moment.updateMany(
        { _id: { $in: momentIds } },
        { $set: { verificationStatus: "confirmed", moderationStatus: "approved" } }
      );
    } else if (action === "flag_stale") {
      await Moment.updateMany(
        { _id: { $in: momentIds } },
        { $set: { verificationStatus: "stale_or_duplicate", "analysisResult.isSuspectedStaleOrOld": true } }
      );
    } else if (action === "dismiss") {
      await Moment.updateMany(
        { _id: { $in: momentIds } },
        { $set: { moderationStatus: "hidden" } }
      );
    }

    return Response.json({ success: true, message: `Successfully updated ${momentIds.length} reports.` });
  } catch (error) {
    console.error("[POST /api/incidents/triage] Error:", error);
    return Response.json({ error: "Action could not be applied" }, { status: 500 });
  }
}
