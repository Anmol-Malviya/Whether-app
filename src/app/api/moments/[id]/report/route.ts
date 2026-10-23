import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Moment from "@/models/Moment";

// POST /api/moments/[id]/report (FR-032)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const reason = (body as { reason?: string }).reason ?? "Inappropriate content";

    await connectToDatabase();
    const moment = await Moment.findOne({
      _id: id,
      expiresAt: { $gt: new Date() },
    });

    if (!moment) {
      return Response.json({ error: "Moment not found or expired" }, { status: 404 });
    }

    moment.reportsCount = (moment.reportsCount ?? 0) + 1;
    if (moment.reportsCount >= 3) {
      moment.moderationStatus = "reported";
    }
    await moment.save();

    console.log(`[Report] Moment ${id} reported. Reason: ${reason}. Count: ${moment.reportsCount}`);
    return Response.json({ message: "Report submitted. Thank you." });
  } catch (err) {
    console.error("[POST /api/moments/[id]/report] Error:", err);
    return Response.json({ error: "Failed to submit report" }, { status: 500 });
  }
}
