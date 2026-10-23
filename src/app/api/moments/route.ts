import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Moment from "@/models/Moment";

const MAX_CAPTION_LENGTH = 280;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MOMENT_EXPIRY_MS = parseInt(process.env.MOMENT_EXPIRY_MINUTES ?? "60") * 60 * 1000;

// Rate limiting: simple in-memory (production: use Redis/Upstash)
const uploadCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_UPLOADS_PER_HOUR = 5;

function getRateLimitKey(request: NextRequest): string {
  return request.headers.get("x-forwarded-for") ?? "unknown";
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = uploadCounts.get(key);
  if (!entry || now > entry.resetAt) {
    uploadCounts.set(key, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (entry.count >= MAX_UPLOADS_PER_HOUR) return false;
  entry.count++;
  return true;
}

// GET /api/moments?location=indore
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const location = searchParams.get("location") ?? "indore";

  try {
    await connectToDatabase();
    const now = new Date();
    // If location is 'current-location', 'all', or empty/default, fetch all active moments.
    // Otherwise filter by location regex, or fallback to all moments if specific location has none.
    const filter: Record<string, unknown> = {
      expiresAt: { $gt: now }, // FR-026: strict expiry filtering
      moderationStatus: "approved",
    };

    if (location && location !== "current-location" && location !== "all") {
      filter.approximateLocation = { $regex: location, $options: "i" };
    }

    let moments = await Moment.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Fallback: If no moments found for the exact neighborhood/city filter, show recent community moments
    if (moments.length === 0 && filter.approximateLocation) {
      delete filter.approximateLocation;
      moments = await Moment.find(filter)
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
    }

    return Response.json({ moments, generatedAt: now.toISOString() });
  } catch (err) {
    console.error("[GET /api/moments] Error:", err);
    return Response.json({ error: "Failed to load moments" }, { status: 500 });
  }
}

// POST /api/moments — upload a new Moment
export async function POST(request: NextRequest) {
  const rateLimitKey = getRateLimitKey(request);
  if (!checkRateLimit(rateLimitKey)) {
    return Response.json(
      { error: "Upload rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const caption = (formData.get("caption") as string | null) ?? "";
    const location = (formData.get("location") as string | null) ?? "Indore (City Center)";
    const file = formData.get("image") as File | null;

    // Validation (FR-030)
    if (!file) {
      return Response.json({ error: "No image provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        { error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        { error: `File too large (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)` },
        { status: 400 }
      );
    }

    if (caption.length > MAX_CAPTION_LENGTH) {
      return Response.json(
        { error: `Caption too long (max ${MAX_CAPTION_LENGTH} characters)` },
        { status: 400 }
      );
    }

    // ── Upload to Cloudinary ──────────────────────────────────────────────
    const { v2: cloudinary } = await import("cloudinary");

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure:     true,
    });

    const buffer = await file.arrayBuffer();

    const uploadResult = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder:           "weatherpulse/moments",
            resource_type:    "image",
            transformation:   [{ width: 1280, crop: "limit", quality: "auto:good" }],
            tags:             ["moment", "weatherpulse"],
            // Strip EXIF GPS data before delivery (privacy)
            invalidate:       true,
          },
          (err, result) => {
            if (err || !result) return reject(err ?? new Error("Cloudinary upload failed"));
            resolve(result as { secure_url: string; public_id: string });
          }
        );
        stream.end(Buffer.from(buffer));
      }
    );

    const imageUrl = uploadResult.secure_url;


    const now = new Date();
    const expiresAt = new Date(now.getTime() + MOMENT_EXPIRY_MS);

    await connectToDatabase();
    const moment = await Moment.create({
      userId: "guest_user",
      userName: "Indori Observer",
      caption: caption.trim() || undefined,
      imageUrl,
      approximateLocation: location,
      createdAt: now,
      expiresAt,
      analysisStatus: "completed",
      analysisResult: {
        skyCondition: "unknown",
        detectedObjects: [],
        confidenceScore: 0,
      },
      moderationStatus: "approved",
    });

    return Response.json(
      {
        id: moment._id.toString(),
        message: "Moment uploaded successfully",
        expiresAt: expiresAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/moments] Error:", err);
    return Response.json({ error: "Failed to upload moment" }, { status: 500 });
  }
}
