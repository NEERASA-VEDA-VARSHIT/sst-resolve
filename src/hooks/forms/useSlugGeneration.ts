"use client";

import { useState, useCallback } from "react";
import { generateSlug, SlugSeparator } from "@/lib/utils/slug";

/**
 * Hook for managing slug generation with manual edit tracking
 * Replaces duplicate slug generation logic from CategoryDialog, SubcategoryDialog, and FieldDialog
 */
export function useSlugGeneration(separator: SlugSeparator = "-") {
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const handleNameChange = useCallback(
    (name: string, currentSlug: string, onUpdate: (slug: string) => void) => {
      const newSlug = slugManuallyEdited ? currentSlug : generateSlug(name, separator);
      onUpdate(newSlug);
    },
    [slugManuallyEdited, separator]
  );

  const handleSlugChange = useCallback(
    (slug: string, onUpdate: (slug: string) => void) => {
      setSlugManuallyEdited(true);
      onUpdate(slug);
    },
    []
  );

  const reset = useCallback(() => {
    setSlugManuallyEdited(false);
  }, []);

  const setManualEdit = useCallback((value: boolean) => {
    setSlugManuallyEdited(value);
  }, []);

  return {
    slugManuallyEdited,
    handleNameChange,
    handleSlugChange,
    reset,
    setManualEdit,
    generateSlug: (name: string) => generateSlug(name, separator),
  };
}
