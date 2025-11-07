"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Stats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  escalated: number;
}

interface StatsCardsProps {
  stats: Stats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleFilter = (type: "status" | "escalated" | "clear", value?: string) => {
    const params = new URLSearchParams();
    
    // Preserve all current params except status, escalated
    searchParams.forEach((val, key) => {
      if (!["status", "escalated"].includes(key)) {
        params.set(key, val);
      }
    });
    
    if (type === "clear") {
      // Clear all filters
      router.push(pathname);
      return;
    }
    
    // Handle special cases
    if (type === "escalated") {
      // Toggle escalated filter
      const currentValue = searchParams.get("escalated");
      if (currentValue === "true") {
        // Remove filter - don't add it to params
      } else {
        // Add filter
        params.set("escalated", "true");
      }
    } else if (type === "status" && value) {
      // Toggle status filter
      const currentValue = searchParams.get("status");
      if (currentValue === value) {
        // Remove filter - don't add it to params
      } else {
        // Set new filter
        params.set("status", value);
      }
      // Remove escalated when setting status
      params.delete("escalated");
    }
    
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  };

  // Only show stats that are > 0 (except Total which always shows)
  const statItems = [
    { 
      key: "total" as const, 
      label: "Total", 
      value: stats.total, 
      icon: FileText, 
      color: "default", 
      alwaysShow: true,
      onClick: () => handleFilter("clear"),
      isActive: !searchParams.get("status") && searchParams.get("escalated") !== "true",
    },
    { 
      key: "open" as const, 
      label: "Open", 
      value: stats.open, 
      icon: AlertCircle, 
      color: "blue", 
      alwaysShow: false,
      onClick: () => handleFilter("status", "open"),
      isActive: searchParams.get("status") === "open",
    },
    { 
      key: "inProgress" as const, 
      label: "In Progress", 
      value: stats.inProgress, 
      icon: Clock, 
      color: "amber", 
      alwaysShow: false,
      onClick: () => handleFilter("status", "in_progress"),
      isActive: searchParams.get("status") === "in_progress",
    },
    { 
      key: "resolved" as const, 
      label: "Resolved", 
      value: stats.resolved, 
      icon: CheckCircle2, 
      color: "emerald", 
      alwaysShow: false,
      onClick: () => handleFilter("status", "resolved"),
      isActive: searchParams.get("status") === "resolved",
    },
    { 
      key: "escalated" as const, 
      label: "Escalated", 
      value: stats.escalated, 
      icon: AlertCircle, 
      color: "red", 
      alwaysShow: false,
      onClick: () => handleFilter("escalated"),
      isActive: searchParams.get("escalated") === "true",
    },
  ].filter(item => item.alwaysShow || item.value > 0);

  if (statItems.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {statItems.map((item) => {
        const Icon = item.icon;
        const isDefault = item.color === "default";

        const getCardClasses = () => {
          let baseClasses = "border-2 cursor-pointer transition-all hover:shadow-lg hover:scale-105 group";
          if (item.isActive) {
            baseClasses += " ring-2 ring-primary ring-offset-2 shadow-md";
          }
          
          if (isDefault) return baseClasses + " bg-muted/20 border-muted";
          switch (item.color) {
            case "blue":
              return baseClasses + " border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20";
            case "amber":
              return baseClasses + " border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20";
            case "purple":
              return baseClasses + " border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20";
            case "emerald":
              return baseClasses + " border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20";
            case "red":
              return baseClasses + " border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20";
            default:
              return baseClasses;
          }
        };

        const getIconClasses = () => {
          if (isDefault) return "text-muted-foreground";
          switch (item.color) {
            case "blue":
              return "text-blue-600 dark:text-blue-400";
            case "amber":
              return "text-amber-600 dark:text-amber-400";
            case "purple":
              return "text-purple-600 dark:text-purple-400";
            case "emerald":
              return "text-emerald-600 dark:text-emerald-400";
            case "red":
              return "text-red-600 dark:text-red-400";
            default:
              return "text-muted-foreground";
          }
        };

        const getTextClasses = () => {
          if (isDefault) return "";
          switch (item.color) {
            case "blue":
              return "text-blue-600 dark:text-blue-400";
            case "amber":
              return "text-amber-600 dark:text-amber-400";
            case "purple":
              return "text-purple-600 dark:text-purple-400";
            case "emerald":
              return "text-emerald-600 dark:text-emerald-400";
            case "red":
              return "text-red-600 dark:text-red-400";
            default:
              return "";
          }
        };

        return (
          <Card key={item.key} className={getCardClasses()} onClick={item.onClick}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon className={cn("w-4 h-4 transition-transform group-hover:scale-110", getIconClasses())} />
                {item.isActive && (
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </div>
              <p className="text-xs font-medium text-muted-foreground mb-1">{item.label}</p>
              <p className={cn("text-2xl font-bold transition-colors", getTextClasses())}>
                {item.value}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

