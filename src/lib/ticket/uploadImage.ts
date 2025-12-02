/**
 * Centralized image upload utility
 * Handles file validation, upload, and error handling
 */

const UPLOAD_CONFIG = {
  maxSize: 10 * 1024 * 1024, // 10 MB
  allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"] as readonly string[],
  allowedExtensions: ["jpg", "jpeg", "png", "webp"] as readonly string[],
};

export interface UploadImageResult {
  success: true;
  url: string;
  publicId: string;
  originalName: string;
}

export interface UploadImageError {
  success: false;
  error: string;
}

export type UploadImageResponse = UploadImageResult | UploadImageError;

/**
 * Validate image file before upload
 */
export function validateImageFile(file: File): { valid: true } | { valid: false; error: string } {
  // Check file type
  if (!UPLOAD_CONFIG.allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${UPLOAD_CONFIG.allowedTypes.join(", ")}`,
    };
  }

  // Check file size
  if (file.size > UPLOAD_CONFIG.maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${UPLOAD_CONFIG.maxSize / (1024 * 1024)}MB limit`,
    };
  }

  // Check extension
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !UPLOAD_CONFIG.allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file extension. Allowed: ${UPLOAD_CONFIG.allowedExtensions.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Upload image file to server
 * Handles validation, upload, and response parsing with proper error handling
 */
export async function uploadImageFile(file: File): Promise<UploadImageResponse> {
  // Validate file
  const validation = validateImageFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    // Create FormData
    const formData = new FormData();
    formData.append("file", file);

    // Upload to server
    const response = await fetch("/api/tickets/attachments/upload", {
      method: "POST",
      body: formData,
    });

    // Check response status
    if (!response.ok) {
      // Check content-type before parsing JSON
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          const errorData = await response.json();
          return {
            success: false,
            error: errorData.error || `Upload failed: ${response.status}`,
          };
        } catch {
          // JSON parse failed, use status text
          return {
            success: false,
            error: `Upload failed: ${response.status} ${response.statusText}`,
          };
        }
      } else {
        // Non-JSON response (likely HTML error page)
        return {
          success: false,
          error: `Upload failed: ${response.status} ${response.statusText}`,
        };
      }
    }

    // Parse successful response
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return {
        success: false,
        error: "Server returned non-JSON response",
      };
    }

    const data = await response.json();
    
    if (!data.url || !data.publicId) {
      return {
        success: false,
        error: "Invalid response format from server",
      };
    }

    return {
      success: true,
      url: data.url,
      publicId: data.publicId,
      originalName: data.originalName || file.name,
    };
  } catch (error) {
    console.error("[uploadImageFile] Upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}
