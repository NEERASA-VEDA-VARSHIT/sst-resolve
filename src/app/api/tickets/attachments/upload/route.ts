import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { uploadImage } from "@/lib/integration/cloudinary";
import { apiErrors } from "@/lib/api-error";
import { logger } from "@/lib/logger";

/**
 * ============================================
 * /api/tickets/attachments/upload
 * ============================================
 * 
 * POST → Upload Image
 *   - Auth: Required
 *   - Upload image to Cloudinary
 *   - Max size: 10MB
 *   - Formats: JPEG, PNG, WebP
 *   - Returns: 200 OK with { url, publicId }
 * ============================================
 */

const UPLOAD_CONFIG = {
  maxSize: 10 * 1024 * 1024, // 10 MB
  allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  allowedExtensions: ["jpg", "jpeg", "png", "webp"],
  folder: "tickets",
};

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
    if (!userId) {
      return apiErrors.unauthorized();
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiErrors.badRequest("No file provided");
    }

    // -----------------------------
    // File name sanitization
    // -----------------------------
    const originalName = file.name || "upload";
    const safeName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const ext = safeName.split(".").pop()?.toLowerCase();

    // -----------------------------
    // Validate extension
    // -----------------------------
    if (!ext || !UPLOAD_CONFIG.allowedExtensions.includes(ext)) {
      return apiErrors.validationError(
        "Invalid file extension",
        { allowed: UPLOAD_CONFIG.allowedExtensions }
      );
    }

    // -----------------------------
    // Validate MIME type
    // -----------------------------
    if (!UPLOAD_CONFIG.allowedTypes.includes(file.type)) {
      return apiErrors.validationError(
        "Invalid file type. Allowed: JPG, PNG, WebP",
        { allowed: UPLOAD_CONFIG.allowedTypes }
      );
    }

    // -----------------------------
    // Validate size
    // -----------------------------
    if (file.size > UPLOAD_CONFIG.maxSize) {
      return apiErrors.validationError(
        "File size exceeds 10MB limit",
        { maxSize: `${UPLOAD_CONFIG.maxSize / (1024 * 1024)}MB`, actualSize: `${(file.size / (1024 * 1024)).toFixed(2)}MB` }
      );
    }

    // -----------------------------
    // Convert File → Buffer
    // -----------------------------
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // -----------------------------
    // Upload to Cloudinary
    // -----------------------------
    const result = await uploadImage(buffer, UPLOAD_CONFIG.folder);

    return NextResponse.json({
      success: true,
      publicId: result.public_id,
      url: result.secure_url,
      originalName: safeName,
    });
  } catch (error) {
    logger.error("Image upload failed", error, { userId });
    return apiErrors.internalError("Failed to upload image", error);
  }
}
