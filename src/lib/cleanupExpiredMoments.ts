import { connectToDatabase } from "./db";
import Moment from "@/models/Moment";
import { deleteFromCloudinary } from "./cloudinary";

let isCleaningUp = false;
let lastCleanupTime = 0;
const CLEANUP_COOLDOWN_MS = 60 * 1000; // Run at most once per minute

/**
 * Automatically cleans up expired moments from both Cloudinary and MongoDB
 */
export async function cleanupExpiredMoments(): Promise<{ deletedCount: number; errors: number }> {
  const now = Date.now();
  if (isCleaningUp || (now - lastCleanupTime < CLEANUP_COOLDOWN_MS)) {
    return { deletedCount: 0, errors: 0 };
  }

  isCleaningUp = true;
  lastCleanupTime = now;

  let deletedCount = 0;
  let errors = 0;

  try {
    await connectToDatabase();
    const expiredMoments = await Moment.find({
      expiresAt: { $lte: new Date(now) },
    })
      .limit(50)
      .lean();

    if (!expiredMoments || expiredMoments.length === 0) {
      return { deletedCount: 0, errors: 0 };
    }

    console.log(`[Auto-Cleanup] Found ${expiredMoments.length} expired moment(s) to purge.`);

    for (const moment of expiredMoments) {
      try {
        if (moment.imageUrl) {
          await deleteFromCloudinary(moment.imageUrl, moment.imagePublicId);
        }
        await Moment.deleteOne({ _id: moment._id });
        deletedCount++;
      } catch (err) {
        console.error(`[Auto-Cleanup] Failed to delete moment ${moment._id}:`, err);
        errors++;
      }
    }

    console.log(`[Auto-Cleanup] Completed: ${deletedCount} deleted, ${errors} errors.`);
  } catch (err) {
    console.error("[Auto-Cleanup] Error during execution:", err);
  } finally {
    isCleaningUp = false;
  }

  return { deletedCount, errors };
}