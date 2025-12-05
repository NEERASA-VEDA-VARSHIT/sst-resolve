"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  AlertCircle,
  Clock,
  CheckCircle2,
  MessageSquare,
  RotateCcw,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Stats {
  total: number;
  open: number;
  inProgress: number;
  awaitingStudent: number;
  reopened?: number;
  resolved: number;
  closed?: number;
  escalated: number;
}

interface StatsCardsProps {
  stats: Stats;
}

/* -------------------------------------------------------
   COLOR MAPS (centralized style control)
-------------------------------------------------------- */

const COLOR_STYLES = {
  default: {
    card: "bg-muted/20 border-muted",
    icon: "text-muted-foreground",
    text: "",
  },
  blue: {
    card:
      "border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20",
    icon: "text-blue-600 dark:text-blue-400",
    text: "text-blue-600 dark:text-blue-400",
  },
  amber: {
    card:
      "border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20",
    icon: "text-amber-600 dark:text-amber-400",
    text: "text-amber-600 dark:text-amber-400",
  },
  purple: {
    card:
      "border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20",
    icon: "text-purple-600 dark:text-purple-400",
    text: "text-purple-600 dark:text-purple-400",
  },
  emerald: {
    card:
      "border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20",
    icon: "text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  red: {
    card:
      "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20",
    icon: "text-red-600 dark:text-red-400",
    text: "text-red-600 dark:text-red-400",
  },
};

/* -------------------------------------------------------
   Component
-------------------------------------------------------- */

export function StatsCards({ stats }: StatsCardsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  /* -----------------------------------------------
      FILTER HANDLER (clean, easy to extend)
  ------------------------------------------------ */
  const handleFilter = (
    type: "status" | "escalated" | "clear",
    value?: string,
    itemKey?: string
  ) => {
    // Set loading state for the clicked card
    if (itemKey) {
      setLoadingKey(itemKey);
    }

    const params = new URLSearchParams();

    // Preserve all params except status and escalated
    searchParams.forEach((val, key) => {
      if (!["status", "escalated"].includes(key)) {
        params.set(key, val);
      }
    });

    let filterLabel = "";
    let toastMessage = "";

    if (type === "clear") {
      filterLabel = "All tickets";
      toastMessage = "Showing all tickets";
      toast.loading("Clearing filter...", { id: "filter-action" });
      startTransition(() => {
        router.push(pathname);
        setTimeout(() => {
          toast.success(toastMessage, {
            id: "filter-action",
            description: "Filter cleared successfully",
          });
          setLoadingKey(null);
        }, 100);
      });
      return;
    }

    if (type === "escalated") {
      const current = searchParams.get("escalated");
      if (current === "true") {
        // Toggle off if already active
        params.delete("escalated");
        filterLabel = "All tickets";
        toastMessage = "Escalated filter removed";
      } else {
        // Toggle on and remove status filter (they're mutually exclusive)
        params.set("escalated", "true");
        params.delete("status");
        filterLabel = "Escalated tickets";
        toastMessage = "Filtering escalated tickets";
      }
    }

    if (type === "status" && value) {
      const current = searchParams.get("status");
      if (current !== value) {
        params.set("status", value);
        params.delete("escalated"); // remove escalated filter when selecting a status
        
        // Map status values to readable labels
        const statusLabels: Record<string, string> = {
          open: "Open tickets",
          in_progress: "In Progress tickets",
          awaiting_student_response: "Awaiting Student Response tickets",
          reopened: "Reopened tickets",
          resolved: "Resolved tickets",
          closed: "Closed tickets",
        };
        filterLabel = statusLabels[value] || "Filtered tickets";
        toastMessage = `Filtering ${statusLabels[value] || value}`;
      } else {
        // Already active, don't do anything
        setLoadingKey(null);
        return;
      }
    }

    const query = params.toString();
    if (toastMessage) {
      toast.loading("Applying filter...", { id: "filter-action" });
    }
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
      setTimeout(() => {
        if (toastMessage) {
          toast.success(toastMessage, {
            id: "filter-action",
            description: `Showing ${filterLabel.toLowerCase()}`,
          });
        }
        setLoadingKey(null);
      }, 100);
    });
  };

  /* -----------------------------------------------
      ITEMS (concise and clean structure)
  ------------------------------------------------ */
  const statItems = [
    {
      key: "total",
      label: "Total",
      value: stats.total,
      icon: FileText,
      color: "default",
      onClick: () => handleFilter("clear", undefined, "total"),
      isActive:
        !searchParams.get("status") &&
        searchParams.get("escalated") !== "true",
      alwaysShow: true,
    },
    {
      key: "open",
      label: "Open",
      value: stats.open,
      icon: AlertCircle,
      color: "blue",
      onClick: () => handleFilter("status", "open", "open"),
      isActive: searchParams.get("status") === "open",
    },
    {
      key: "inProgress",
      label: "In Progress",
      value: stats.inProgress,
      icon: Clock,
      color: "amber",
      onClick: () => handleFilter("status", "in_progress", "inProgress"),
      isActive: searchParams.get("status") === "in_progress",
    },
    {
      key: "awaitingStudent",
      label: "Awaiting Student Response",
      value: stats.awaitingStudent,
      icon: MessageSquare,
      color: "purple",
      onClick: () => handleFilter("status", "awaiting_student_response", "awaitingStudent"),
      isActive:
        searchParams.get("status") === "awaiting_student_response",
    },
    {
      key: "reopened",
      label: "Reopened",
      value: stats.reopened ?? 0,
      icon: RotateCcw,
      color: "purple",
      onClick: () => handleFilter("status", "reopened", "reopened"),
      isActive: searchParams.get("status") === "reopened",
    },
    {
      key: "resolved",
      label: "Resolved",
      value: stats.resolved,
      icon: CheckCircle2,
      color: "emerald",
      onClick: () => handleFilter("status", "resolved", "resolved"),
      isActive: searchParams.get("status") === "resolved",
    },
    {
      key: "closed",
      label: "Closed",
      value: stats.closed ?? 0,
      icon: XCircle,
      color: "default",
      onClick: () => handleFilter("status", "closed", "closed"),
      isActive: searchParams.get("status") === "closed",
    },
    {
      key: "escalated",
      label: "Escalated",
      value: stats.escalated,
      icon: AlertCircle,
      color: "red",
      onClick: () => handleFilter("escalated", undefined, "escalated"),
      isActive: searchParams.get("escalated") === "true",
    },
  ].filter((item) => item.alwaysShow || item.value > 0);

  if (statItems.length === 0) return null;

  /* -----------------------------------------------
      RENDER
  ------------------------------------------------ */
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
      {statItems.map((item) => {
        const Icon = item.icon;
        const styles = COLOR_STYLES[item.color as keyof typeof COLOR_STYLES];
        const isLoading = isPending && loadingKey === item.key;
        const isDisabled = isPending && loadingKey !== item.key;

        return (
          <Card
            key={item.key}
            className={cn(
              "border-2 cursor-pointer transition-all hover:shadow-lg hover:scale-105 group relative",
              styles.card,
              item.isActive && "ring-2 ring-primary ring-offset-1 sm:ring-offset-2 shadow-md",
              isLoading && "opacity-75 cursor-wait",
              isDisabled && "opacity-50 cursor-not-allowed"
            )}
            onClick={isPending ? undefined : item.onClick}
          >
            <CardContent className="p-3 sm:p-4">
              {/* Icon + active dot / loading spinner */}
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                {isLoading ? (
                  <Loader2 className={cn(
                    "w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin",
                    styles.icon
                  )} />
                ) : (
                  <Icon
                    className={cn(
                      "w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110",
                      styles.icon
                    )}
                  />
                )}
                {item.isActive && !isLoading && (
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary animate-pulse" />
                )}
                {isLoading && (
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary" />
                )}
              </div>

              {/* Label */}
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-0.5 sm:mb-1 line-clamp-1">
                {item.label}
              </p>

              {/* Value */}
              <p className={cn("text-lg sm:text-xl lg:text-2xl font-bold", styles.text)}>
                {item.value ?? 0}
              </p>

              {/* Loading overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] rounded-lg flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
export default StatsCards;