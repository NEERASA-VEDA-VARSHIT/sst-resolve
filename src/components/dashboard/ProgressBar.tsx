"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Start loading when pathname or searchParams change
    setIsLoading(true);
    setProgress(10); // Start at 10% immediately

    // Simulate gradual progress up to 70%
    let currentProgress = 10;
    const progressInterval = setInterval(() => {
      // Slow down as we approach 70%
      const increment = currentProgress < 50 ? 8 : 3;
      currentProgress = Math.min(currentProgress + increment, 70);
      setProgress(currentProgress);
    }, 150);

    // Function to complete the progress bar
    const completeProgress = () => {
      clearInterval(progressInterval);
      setProgress(100);
      // Wait a bit before hiding to show completion
      setTimeout(() => {
        setIsLoading(false);
        setProgress(0);
      }, 300);
    };

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
      return () => clearInterval(progressInterval);
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

    // Multiple ways to detect page readiness
    window.addEventListener('load', handleLoad);
    document.addEventListener('DOMContentLoaded', handleDOMContentLoaded);

    // Also check periodically (for SPAs where load event might not fire)
    const checkInterval = setInterval(() => {
      if (checkPageReady()) {
        clearInterval(checkInterval);
        handleLoad();
      }
    }, 100);

    // Fallback timeout (max 8 seconds) - in case something goes wrong
    const fallbackTimeout = setTimeout(() => {
      clearInterval(progressInterval);
      clearInterval(checkInterval);
      completeProgress();
    }, 8000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(checkInterval);
      clearTimeout(fallbackTimeout);
      window.removeEventListener('load', handleLoad);
      document.removeEventListener('DOMContentLoaded', handleDOMContentLoaded);
    };
  }, [pathname, searchParams]);

  // Use React's useTransition to detect navigation state
  useEffect(() => {
    startTransition(() => {
      // This will be pending during navigation
    });
  }, [pathname, searchParams]);

  // Show progress bar if loading or pending
  if (!isLoading && !isPending) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-transparent pointer-events-none">
      <div
        className="h-full bg-primary transition-all duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

