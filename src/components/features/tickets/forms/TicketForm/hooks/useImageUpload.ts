"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { logger } from "@/lib/logger";

export function useImageUpload() {
  const [imagesUploading, setImagesUploading] = useState(false);

  const uploadImage = useCallback(async (file: File): Promise<string> => {
    setImagesUploading(true);
    try {
      const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!allowed.includes(file.type)) throw new Error("Only JPEG/PNG/WebP images allowed");
      const max = 10 * 1024 * 1024;
      if (file.size > max) throw new Error("Image exceeds 10MB");

      const fd = new FormData();
      fd.append("file", file);
      const response = await api.post<{ url: string }>("/api/tickets/attachments/upload", fd);
      toast.success("Image uploaded");
      return response.data.url;
    } catch (err: unknown) {
      logger.error("Upload failed", err, { component: "useImageUpload", fileName: file.name });
      const errorMessage = err instanceof Error ? err.message : "Image upload failed";
      toast.error(errorMessage);
      throw err;
    } finally {
      setImagesUploading(false);
    }
  }, []);

  return { uploadImage, imagesUploading };
}
