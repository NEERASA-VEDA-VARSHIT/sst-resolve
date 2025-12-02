/**
 * Reusable TicketStatusBadge component
 * Works with tickets.status field (string) or status display object
 */

import { Badge } from "@/components/ui/badge";
import { cn, formatStatus, normalizeStatusForComparison } from "@/lib/utils";

interface TicketStatusBadgeProps {
  // Accept status object (from buildStatusDisplay) or status value string
  status?: {
    value: string;
    label: string;
    badge_color: string | null;
  } | null;
  // Legacy: Accept string value directly (for backward compatibility)
  statusValue?: string | null;
  className?: string;
}

export function TicketStatusBadge({
  status,
  statusValue,
  className = ""
}: TicketStatusBadgeProps) {
  const normalizedValue = normalizeStatusForComparison(status?.value || statusValue);
  // Use status object if provided, otherwise fall back to formatted value
  const label = status?.label || formatStatus(normalizedValue || statusValue || "Unknown");
  const badgeColor = status?.badge_color || null;

  // Map badge_color from database to Badge variant and custom colors
  // Match STATUS_STYLES from TicketCard for consistency across dashboard and detail page
  const getVariantAndColor = (color: string | null, statusValue?: string) => {
    const normalizedColor = color?.toLowerCase().trim() || "";
    const normalizedStatus = statusValue ? normalizeStatusForComparison(statusValue) : "";
    
    // Priority 1: Check status value first (match dashboard STATUS_STYLES exactly)
    if (normalizedStatus === "in_progress" || normalizedStatus.includes("in_progress")) {
      return { variant: "outline" as const, customClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800" };
    }
    if (normalizedStatus === "resolved" || normalizedStatus === "closed" || normalizedStatus.includes("resolved") || normalizedStatus.includes("closed")) {
      return { variant: "outline" as const, customClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" };
    }
    if (normalizedStatus === "open" || normalizedStatus.includes("open")) {
      return { variant: "outline" as const, customClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800" };
    }
    if (normalizedStatus === "reopened" || normalizedStatus.includes("reopened")) {
      return { variant: "outline" as const, customClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800" };
    }
    if (normalizedStatus.includes("awaiting") || normalizedStatus.includes("pending") || normalizedStatus.includes("awaiting_student")) {
      return { variant: "outline" as const, customClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800" };
    }
    if (normalizedStatus.includes("escalated") || normalizedStatus.includes("urgent")) {
      return { variant: "outline" as const, customClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800" };
    }
    if (normalizedStatus === "forwarded" || normalizedStatus.includes("forwarded")) {
      return { variant: "outline" as const, customClass: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800" };
    }
    
    // Priority 2: Custom color mappings from badge_color field (match dashboard colors)
    if (normalizedColor.includes("blue") || normalizedColor === "info") {
      return { variant: "outline" as const, customClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800" };
    }
    if (normalizedColor.includes("green") || normalizedColor === "success" || normalizedColor.includes("emerald")) {
      return { variant: "outline" as const, customClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" };
    }
    if (normalizedColor.includes("yellow") || normalizedColor.includes("warning") || normalizedColor.includes("amber")) {
      return { variant: "outline" as const, customClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800" };
    }
    if (normalizedColor.includes("red") || normalizedColor === "error") {
      return { variant: "outline" as const, customClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800" };
    }
    if (normalizedColor.includes("purple") || normalizedColor.includes("violet")) {
      return { variant: "outline" as const, customClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800" };
    }
    if (normalizedColor.includes("indigo")) {
      return { variant: "outline" as const, customClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800" };
    }
    if (normalizedColor.includes("cyan") || normalizedColor.includes("teal")) {
      return { variant: "outline" as const, customClass: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800" };
    }
    
    // Priority 3: Standard Badge variants (only if no custom colors matched)
    if (normalizedColor === "default") {
      return { variant: "default" as const, customClass: "" };
    }
    if (normalizedColor === "secondary") {
      return { variant: "secondary" as const, customClass: "" };
    }
    if (normalizedColor === "destructive") {
      return { variant: "destructive" as const, customClass: "" };
    }
    if (normalizedColor === "outline") {
      return { variant: "outline" as const, customClass: "" };
    }
    
    // Final fallback
    return { variant: "outline" as const, customClass: "" };
  };

  const { variant, customClass } = getVariantAndColor(badgeColor, status?.value || statusValue || undefined);

  return (
    <Badge
      variant={variant}
      className={cn("text-sm px-3 py-1.5 font-semibold", customClass, className)}
    >
      {label}
    </Badge>
  );
}
