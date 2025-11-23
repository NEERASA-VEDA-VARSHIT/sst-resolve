"use client";

import { useState, useMemo, memo } from "react";
import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
}

function ImageLightboxComponent({ images, initialIndex = 0 }: ImageLightboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Memoize filtered images
  const validImages = useMemo(() => 
    images.filter((img): img is string => typeof img === 'string' && img.trim().length > 0),
    [images]
  );

  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setIsOpen(true);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % validImages.length);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
  };

  return (
    <>
      {/* Thumbnail Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {validImages.map((imageUrl: string, index: number) => (
          <button
            key={`${imageUrl}-${index}`}
            onClick={() => openLightbox(index)}
            className="relative group aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <Image
              src={imageUrl}
              alt={`Attachment ${index + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 33vw"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium transition-opacity">
                View Full Size
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-7xl w-full h-[90vh] p-0 overflow-hidden">
          <div className="relative w-full h-full flex items-center justify-center bg-black/95">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-6 h-6" />
            </Button>

            {/* Navigation Buttons */}
            {validImages.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 z-10 text-white hover:bg-white/20"
                  onClick={goToPrevious}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 z-10 text-white hover:bg-white/20"
                  onClick={goToNext}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </Button>
              </>
            )}

            {/* Image Display */}
            {validImages[currentIndex] && (
              <div className="relative w-full h-full">
                <Image
                  src={validImages[currentIndex]}
                  alt={`Attachment ${currentIndex + 1}`}
                  fill
                  className="object-contain"
                  sizes="90vw"
                  priority={currentIndex === 0}
                />
              </div>
            )}

            {/* Image Counter */}
            {validImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm">
                {currentIndex + 1} / {validImages.length}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Memoize component to prevent unnecessary re-renders
export const ImageLightbox = memo(ImageLightboxComponent);
