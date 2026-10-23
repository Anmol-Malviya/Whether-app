import { v2 as cloudinary } from "cloudinary";

export function getCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

export function extractPublicId(imageUrl: string, imagePublicId?: string): string | null {
  if (imagePublicId && imagePublicId.trim().length > 0) {
    return imagePublicId;
  }
  if (!imageUrl) return null;

  try {
    const uploadIndex = imageUrl.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    let path = imageUrl.substring(uploadIndex + "/upload/".length);
    path = path.replace(/^v\d+\//, "");

    const lastDotIndex = path.lastIndexOf(".");
    if (lastDotIndex !== -1) {
      path = path.substring(0, lastDotIndex);
    }
    return decodeURIComponent(path);
  } catch (err) {
    console.error("[extractPublicId] Failed to parse public_id:", err);
    return null;
  }
}

export async function deleteFromCloudinary(imageUrl: string, imagePublicId?: string): Promise<boolean> {
  const publicId = extractPublicId(imageUrl, imagePublicId);
  if (!publicId) {
    console.warn("[deleteFromCloudinary] Could not find valid publicId for image:", imageUrl);
    return false;
  }

  const client = getCloudinary();
  try {
    const result = await client.uploader.destroy(publicId, { invalidate: true });
    console.log(`[deleteFromCloudinary] Destroyed ${publicId}:`, result);
    return result.result === "ok";
  } catch (err) {
    console.error(`[deleteFromCloudinary] Error destroying ${publicId}:`, err);
    return false;
  }
}

