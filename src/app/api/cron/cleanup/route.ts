import { NextRequest } from "next/server";
import { cleanupExpiredMoments } from "@/lib/cleanupExpiredMoments";

/**
 * GET or POST /api/cron/cleanup
 * Autonomous cron route to purge expired Moments (>60m TTL) from Cloudinary & MongoDB.
 * Can be triggered periodically by Vercel Cron, GitHub Actions, or local triggers.
 */
export async function GET(request: NextRequest) {
  return handleCleanup(request);
}

export async function POST(request: NextRequest) {
  return handleCleanup(request);
}

async function handleCleanup(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Protect cron in production if CRON_SECRET is configured
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const { searchParams } = request.nextUrl;
    const secretQuery = searchParams.get("secret");
    if (secretQuery !== cronSecret) {
      return Response.json({ error: "Unauthorized cron request" }, { status: 401 });
    }
  }

  try {
    const result = await cleanupExpiredMoments();
    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      purged: result.deletedCount,
      errors: result.errors,
      message: `Cleaned up ${result.deletedCount} expired moment(s) from storage & database.`,
    });
  } catch (error) {
    console.error("[CRON /api/cron/cleanup] Error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to run automated cleanup",
      },
      { status: 500 }
    );
  }
}
