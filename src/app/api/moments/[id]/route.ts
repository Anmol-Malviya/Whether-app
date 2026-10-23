import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Moment from "@/models/Moment";

// GET /api/moments/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await connectToDatabase();
    const moment = await Moment.findOne({
      _id: id,
      expiresAt: { $gt: new Date() }, // FR-026
      moderationStatus: "approved",
    }).lean();

    if (!moment) {
      return Response.json({ error: "Moment not found or expired" }, { status: 404 });
    }

    return Response.json(moment);
  } catch (err) {
    console.error("[GET /api/moments/[id]] Error:", err);
    return Response.json({ error: "Failed to get moment" }, { status: 500 });
  }
}

// DELETE /api/moments/[id] — owner or admin only (FR-033)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // TODO: Verify session/auth token here when auth is added
  // For now, allow deletion for demo purposes
  const userId = request.headers.get("x-user-id") ?? "guest_user";

  try {
    await connectToDatabase();
    const moment = await Moment.findById(id);

    if (!moment) {
      return Response.json({ error: "Moment not found" }, { status: 404 });
    }

    // FR-033: Only owner can delete (admin bypass via header for demo)
    const isAdmin = request.headers.get("x-user-role") === "admin";
    if (moment.userId !== userId && !isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (moment.imageUrl) {
      const { deleteFromCloudinary } = await import("@/lib/cloudinary");
      await deleteFromCloudinary(moment.imageUrl, moment.imagePublicId);
    }

    await Moment.deleteOne({ _id: id });
    return Response.json({ message: "Moment deleted successfully" });
  } catch (err) {
    console.error("[DELETE /api/moments/[id]] Error:", err);
    return Response.json({ error: "Failed to delete moment" }, { status: 500 });
  }
}
