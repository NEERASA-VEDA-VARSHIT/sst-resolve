"use client";

import { useEffect, useState, useTransition, useRef, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadHandlersRef = useRef<{ handleLoad: () => void; handleDOMContentLoaded: () => void } | null>(null);

  // Function to complete the progress bar (memoized)
  const completeProgress = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }
    setProgress(100);
    // Wait a bit before hiding to show completion
    setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
    }, 300);
  }, []);

  // Function to start progress immediately (memoized to prevent recreation)
  const startProgress = useCallback(() => {
    // Clear any existing intervals
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
    }

    setIsLoading(true);
    setProgress(10); // Start at 10% immediately

    // Simulate gradual progress up to 70%
    let currentProgress = 10;
    progressIntervalRef.current = setInterval(() => {
      // Slow down as we approach 70%
      const increment = currentProgress < 50 ? 8 : 3;
      currentProgress = Math.min(currentProgress + increment, 70);
      setProgress(currentProgress);
    }, 150);

    // Check if page is already loaded
    const checkPageReady = () => {
      // Check multiple indicators that page is ready
      const isReady = 
        document.readyState === 'complete' &&
        document.body &&
        !document.body.classList.contains('loading');
      
      return isReady;
    };

    // If already ready, complete quickly
    if (checkPageReady()) {
      // Small delay to ensure React has rendered
      setTimeout(completeProgress, 200);
      return;
    }

    // Listen for page load events
    const handleLoad = () => {
      // Wait a bit for React to finish rendering
      setTimeout(completeProgress, 100);
    };

    const handleDOMContentLoaded = () => {
      // Page structure is ready, but images/styles might still be loading
      setProgress(80);
    };

    // Store handlers for cleanup
    loadHandlersRef.current = { handleLoad, handleDOMContentLoaded };

    // Multiple ways to detect page readiness
    window.addEventListener('load', handleLoad);
    document.addEventListener('DOMContentLoaded', handleDOMContentLoaded);

    // Also check periodically (for SPAs where load event might not fire)
    checkIntervalRef.current = setInterval(() => {
      if (checkPageReady()) {
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
        handleLoad();
      }
    }, 100);

    // Fallback timeout (max 8 seconds) - in case something goes wrong
    fallbackTimeoutRef.current = setTimeout(() => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      completeProgress();
    }, 8000);
  }, [completeProgress]);

  // Start progress when pathname or searchParams change
  useEffect(() => {
    startProgress();

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
      if (loadHandlersRef.current) {
        window.removeEventListener('load', loadHandlersRef.current.handleLoad);
        document.removeEventListener('DOMContentLoaded', loadHandlersRef.current.handleDOMContentLoaded);
        loadHandlersRef.current = null;
      }
    };
  }, [pathname, searchParams, startProgress]);

  // Detect link clicks to show progress bar immediately
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Find the closest anchor tag (Next.js Link renders as <a>)
      const anchor = target.closest('a');
      
      if (anchor) {
        const href = anchor.getAttribute('href');
        // Only handle internal links (starting with /) and not external links or anchors
        if (href && href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/#')) {
          // Extract pathname from href (remove query params and hash)
          const hrefPath = href.split('?')[0].split('#')[0];
          const currentPath = pathname;
          
          // Check if it's a different route
          if (hrefPath !== currentPath) {
            // Start progress immediately on click (before navigation)
            startProgress();
          }
        }
      }
      
      // Also check for buttons with navigation (like router.push)
      // Check if target or parent has data-navigation attribute
      const navElement = target.closest('[data-navigation]');
      if (navElement) {
        startProgress();
      }
    };

    // Add click listener to document (capture phase to catch early)
    document.addEventListener('click', handleLinkClick, true);

    return () => {
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, [pathname, searchParams, startProgress]);

  // Use React's useTransition to detect navigation state
  useEffect(() => {
    startTransition(() => {
      // This will be pending during navigation
    });
  }, [pathname, searchParams, startTransition]);

  // Show progress bar if loading or pending
  if (!isLoading && !isPending) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-0.5 sm:h-1 bg-transparent pointer-events-none">
      {/* Main progress bar with gradient */}
      <div
        className="h-full bg-gradient-to-r from-primary via-primary/90 to-primary transition-all duration-150 ease-out shadow-lg shadow-primary/50 relative overflow-hidden"
        style={{ width: `${progress}%` }}
      >
        {/* Animated shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
      </div>
      {/* Glow effect for better visibility on all devices */}
      <div
        className="absolute top-0 left-0 h-full bg-primary/20 blur-sm transition-all duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

