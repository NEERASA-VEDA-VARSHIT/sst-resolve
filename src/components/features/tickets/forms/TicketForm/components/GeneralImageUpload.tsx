"use client";

import { useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, ImageIcon, Loader2, Trash2 } from "lucide-react";

interface GeneralImageUploadProps {
  images: string[];
  uploading: boolean;
  onUpload: (files: FileList | null) => void;
  onRemove: (url: string) => void;
}

export function GeneralImageUpload({
  images,
  uploading,
  onUpload,
  onRemove,
}: GeneralImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-2 border-t pt-4">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Label htmlFor="general-images" className="text-sm sm:text-base font-semibold">
          Attachments
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Upload images to help explain your issue (jpg/png/webp). Max 10MB each. Optional.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <p className="text-xs sm:text-sm text-muted-foreground">
        Upload images to help explain your issue (jpg/png/webp). Max 10MB each.
      </p>

      <div className="flex gap-3 items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          multiple
          id="general-images"
          onChange={(e) => onUpload(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <ImageIcon className="mr-2 w-4 h-4" /> Upload Image
        </Button>
        {uploading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading...
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-3">
          {images.map((url) => (
            <div key={url} className="relative w-28 h-28 rounded overflow-hidden border group">
              <Image
                src={url}
                alt="attachment"
                fill
                sizes="112px"
                className="object-cover"
                style={{ objectFit: "cover" }}
              />
              <button
                type="button"
                aria-label="Remove"
                onClick={() => onRemove(url)}
                className="absolute top-1 right-1 bg-white/80 p-1 rounded hover:bg-white transition-colors z-10"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
