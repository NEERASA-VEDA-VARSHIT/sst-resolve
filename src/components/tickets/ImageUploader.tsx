"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface ImageUploaderProps {
  images: string[];
  onUpload: (images: string[]) => void;
  onRemove: (imageUrl: string) => void;
  maxImages?: number;
  maxSizeMB?: number;
}

export function ImageUploader({
  images,
  onUpload,
  onRemove,
  maxImages = 5,
  maxSizeMB = 10,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check max images limit
    if (images.length >= maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    const file = files[0];

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Only JPEG, PNG, and WebP images are allowed.");
      return;
    }

    // Validate file size
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File size exceeds ${maxSizeMB}MB limit`);
      return;
    }

    try {
      setUploading(true);
      
      const payload = new FormData();
      payload.append("file", file);

      const response = await fetch("/api/upload/image", {
        method: "POST",
        body: payload,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(error.error || "Upload failed");
      }

      const data = await response.json();
      
      // Add new image to array
      onUpload([...images, data.url]);
      
      toast.success("Image uploaded successfully");
      
      // Clear input for re-upload
      e.target.value = "";
    } catch (error) {
      console.error("Image upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (imageUrl: string) => {
    onRemove(imageUrl);
    toast.success("Image removed");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="image-upload" className="text-base font-semibold">
          Attachments (Optional)
        </Label>
        <p className="text-sm text-muted-foreground">
          Upload images related to your issue (max {maxImages} images, {maxSizeMB}MB each)
        </p>
      </div>

      {/* Upload Button */}
      <div className="flex items-center gap-3">
        <Input
          id="image-upload"
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          disabled={uploading || images.length >= maxImages}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => document.getElementById("image-upload")?.click()}
          disabled={uploading || images.length >= maxImages}
          className="gap-2"
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload Image
            </>
          )}
        </Button>
        {images.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {images.length} / {maxImages} images
          </span>
        )}
      </div>

      {/* Uploaded Images Preview */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((imageUrl, index) => (
            <div
              key={index}
              className="relative group rounded-lg border overflow-hidden bg-muted/30 aspect-video"
            >
              <img
                src={imageUrl}
                alt={`Attachment ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemoveImage(imageUrl)}
                  className="gap-2"
                >
                  <X className="w-4 h-4" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-8 text-center">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No images uploaded yet
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Click &quot;Upload Image&quot; to add attachments
          </p>
        </div>
      )}
    </div>
  );
}
