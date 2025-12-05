"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Web Vitals Tracking Component
 * Reports Core Web Vitals metrics for performance monitoring
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    // Log in development
    if (process.env.NODE_ENV === "development") {
      console.log(metric);
    }

    // In production, send to analytics service
    if (process.env.NODE_ENV === "production") {
      // Send to Google Analytics if available
      if (typeof window !== "undefined" && (window as unknown as { gtag?: unknown }).gtag) {
        const gtag = (window as unknown as {
          gtag: (event: string, name: string, params: unknown) => void;
        }).gtag;
        gtag("event", metric.name, {
          value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
          metric_id: metric.id,
          metric_value: metric.value,
          metric_delta: metric.delta,
        });
      }

      // Send to Sentry if available
      if (typeof window !== "undefined") {
        // @ts-ignore Optional dependency; ignore missing types
        import("@sentry/nextjs")
          .then((Sentry) => {
            Sentry?.metrics?.distribution?.(metric.name, metric.value, {
              tags: {
                id: metric.id,
                name: metric.name,
              },
            });
          })
          .catch(() => {
            // Sentry not available
          });
      }
    }
  });

  return null;
}
