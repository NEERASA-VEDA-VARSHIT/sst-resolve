"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  AlertCircle,
  Clock,
  CheckCircle2,
  MessageSquare,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [, startTransition] = useTransition();

  /* -----------------------------------------------
      FILTER HANDLER (clean, easy to extend)
  ------------------------------------------------ */
  const handleFilter = (
    type: "status" | "escalated" | "clear",
    value?: string
  ) => {
    const params = new URLSearchParams();

    // Preserve all params except status and escalated
    searchParams.forEach((val, key) => {
      if (!["status", "escalated"].includes(key)) {
        params.set(key, val);
      }
    });

    if (type === "clear") {
      startTransition(() => {
        router.push(pathname);
      });
      return;
    }

    if (type === "escalated") {
      const current = searchParams.get("escalated");
      if (current === "true") {
        // Toggle off if already active
        params.delete("escalated");
      } else {
        // Toggle on and remove status filter (they're mutually exclusive)
        params.set("escalated", "true");
        params.delete("status");
      }
    }

    if (type === "status" && value) {
      const current = searchParams.get("status");
      if (current !== value) params.set("status", value);
      params.delete("escalated"); // remove escalated filter when selecting a status
    }

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
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
      onClick: () => handleFilter("clear"),
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
      onClick: () => handleFilter("status", "open"),
      isActive: searchParams.get("status") === "open",
    },
    {
      key: "inProgress",
      label: "In Progress",
      value: stats.inProgress,
      icon: Clock,
      color: "amber",
      onClick: () => handleFilter("status", "in_progress"),
      isActive: searchParams.get("status") === "in_progress",
    },
    {
      key: "awaitingStudent",
      label: "Awaiting Student Response",
      value: stats.awaitingStudent,
      icon: MessageSquare,
      color: "purple",
      onClick: () => handleFilter("status", "awaiting_student_response"),
      isActive:
        searchParams.get("status") === "awaiting_student_response",
    },
    {
      key: "reopened",
      label: "Reopened",
      value: stats.reopened ?? 0,
      icon: RotateCcw,
      color: "purple",
      onClick: () => handleFilter("status", "reopened"),
      isActive: searchParams.get("status") === "reopened",
    },
    {
      key: "resolved",
      label: "Resolved",
      value: stats.resolved,
      icon: CheckCircle2,
      color: "emerald",
      onClick: () => handleFilter("status", "resolved"),
      isActive: searchParams.get("status") === "resolved",
    },
    {
      key: "closed",
      label: "Closed",
      value: stats.closed ?? 0,
      icon: XCircle,
      color: "default",
      onClick: () => handleFilter("status", "closed"),
      isActive: searchParams.get("status") === "closed",
    },
    {
      key: "escalated",
      label: "Escalated",
      value: stats.escalated,
      icon: AlertCircle,
      color: "red",
      onClick: () => handleFilter("escalated"),
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

        return (
          <Card
            key={item.key}
            className={cn(
              "border-2 cursor-pointer transition-all hover:shadow-lg hover:scale-105 group",
              styles.card,
              item.isActive && "ring-2 ring-primary ring-offset-1 sm:ring-offset-2 shadow-md"
            )}
            onClick={item.onClick}
          >
            <CardContent className="p-3 sm:p-4">
              {/* Icon + active dot */}
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <Icon
                  className={cn(
                    "w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110",
                    styles.icon
                  )}
                />
                {item.isActive && (
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary animate-pulse" />
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
export default StatsCards;