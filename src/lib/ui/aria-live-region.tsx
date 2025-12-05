/**
 * ARIA Live Region Component
 * 
 * Provides accessible announcements for screen readers
 * Announces loading states, success messages, and errors
 */

"use client";

import { useEffect, useState } from "react";

interface AriaLiveRegionProps {
  loading?: boolean;
  loadingMessage?: string;
  success?: boolean;
  successMessage?: string;
  error?: boolean;
  errorMessage?: string;
  dataCount?: number;
  dataLabel?: string;
}

export function AriaLiveRegion({
  loading,
  loadingMessage,
  success,
  successMessage,
  error,
  errorMessage,
  dataCount,
  dataLabel,
}: AriaLiveRegionProps) {
  const [announcement, setAnnouncement] = useState<string>("");

  useEffect(() => {
    if (loading && loadingMessage) {
      setAnnouncement(loadingMessage);
    } else if (success && successMessage) {
      setAnnouncement(successMessage);
    } else if (error && errorMessage) {
      setAnnouncement(errorMessage);
    } else if (dataCount !== undefined && dataLabel) {
      setAnnouncement(`Loaded ${dataCount} ${dataLabel}`);
    } else {
      setAnnouncement("");
    }
  }, [loading, loadingMessage, success, successMessage, error, errorMessage, dataCount, dataLabel]);

  if (!announcement) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}

/**
 * Hook for managing ARIA live announcements
 */
export function useAriaLive() {
  const [announcement, setAnnouncement] = useState<string>("");

  const announce = (message: string) => {
    setAnnouncement(message);
    // Clear after announcement to allow re-announcing the same message
    setTimeout(() => setAnnouncement(""), 100);
  };

  return {
    announcement,
    announce,
    AriaLiveRegion: () => (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    ),
  };
}
