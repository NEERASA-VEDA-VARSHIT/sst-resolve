import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { uploadImage } from "@/lib/integration/cloudinary";

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
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
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
      return NextResponse.json(
        { error: "Invalid file extension" },
        { status: 400 }
      );
    }

    // -----------------------------
    // Validate MIME type
    // -----------------------------
    if (!UPLOAD_CONFIG.allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPG, PNG, WebP" },
        { status: 400 }
      );
    }

    // -----------------------------
    // Validate size
    // -----------------------------
    if (file.size > UPLOAD_CONFIG.maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
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
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
