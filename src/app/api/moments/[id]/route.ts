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

  // Real, verified server-side authentication check:
  // Client-supplied headers like 'x-user-id' or 'x-user-role' cannot be trusted as identity or privilege proof.
  // We check for a cryptographically verified internal authorization token or Bearer secret (e.g. CRON_SECRET or ADMIN_API_KEY)
  const authHeader = request.headers.get("authorization");
  const adminSecret = process.env.ADMIN_API_KEY || process.env.CRON_SECRET;
  const isVerifiedAdmin = Boolean(adminSecret && authHeader === `Bearer ${adminSecret}`);

  // When no verified admin secret matches, and full user session/JWT authentication is not yet integrated,
  // untrusted requests must be rejected to prevent unauthorized deletion.
  if (!isVerifiedAdmin) {
    return Response.json(
      {
        error: "Unauthorized: Secure server-side authentication is required to delete moments.",
      },
      { status: 401 }
    );
  }

  try {
    await connectToDatabase();
    const moment = await Moment.findById(id);

    if (!moment) {
      return Response.json({ error: "Moment not found" }, { status: 404 });
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
