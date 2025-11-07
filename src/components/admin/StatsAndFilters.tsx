"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsAndFiltersProps {
  stats: {
    total: number;
    open: number;
    inProgress: number;
    acknowledged: number;
    closed: number;
    escalated: number;
  };
  activeStatus?: string;
  activeCategory?: string;
  activeTat?: string;
}

export function StatsAndFilters({ stats, activeStatus, activeCategory, activeTat }: StatsAndFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleFilter = (type: "status" | "category" | "tat" | "acknowledged" | "escalated", value: string) => {
    const params = new URLSearchParams();
    
    // Preserve all current params except status, category, tat, acknowledged, escalated
    searchParams.forEach((val, key) => {
      if (!["status", "category", "tat", "acknowledged", "escalated"].includes(key)) {
        params.set(key, val);
      }
    });
    
    // Handle special cases
    if (type === "acknowledged" || type === "escalated") {
      // Toggle these filters
      const currentValue = searchParams.get(type);
      if (currentValue === "true") {
        // Remove filter - don't add it to params
      } else {
        // Add filter
        params.set(type, "true");
        // Remove the other one if it exists
        if (type === "acknowledged") {
          // Don't add escalated
        } else {
          // Don't add acknowledged
        }
      }
    } else {
      // Toggle regular filters
      const currentValue = type === "status" ? activeStatus : type === "category" ? activeCategory : activeTat;
      if (currentValue === value) {
        // Remove filter - don't add it to params
      } else {
        // Set new filter
        params.set(type, value);
      }
    }
    
    // Also remove acknowledged/escalated if setting status/category/tat
    if (type !== "acknowledged" && type !== "escalated") {
      params.delete("acknowledged");
      params.delete("escalated");
    }
    
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const statCards = [
    {
      label: "Total",
      value: stats.total,
      icon: FileText,
      color: "text-muted-foreground",
      bgColor: "bg-muted/20",
      borderColor: "border-muted",
      onClick: () => {
        // Clear all filters
        router.push(pathname);
      },
      isActive: !activeStatus && !activeCategory && !activeTat && searchParams.get("acknowledged") !== "true" && searchParams.get("escalated") !== "true",
    },
    {
      label: "Open",
      value: stats.open,
      icon: AlertCircle,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50/50 dark:bg-blue-950/20",
      borderColor: "border-blue-200 dark:border-blue-900",
      onClick: () => handleFilter("status", "open"),
      isActive: activeStatus === "open",
    },
    {
      label: "In Progress",
      value: stats.inProgress,
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50/50 dark:bg-amber-950/20",
      borderColor: "border-amber-200 dark:border-amber-900",
      onClick: () => handleFilter("status", "in_progress"),
      isActive: activeStatus === "in_progress",
    },
    {
      label: "Acknowledged",
      value: stats.acknowledged,
      icon: CheckCircle2,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50/50 dark:bg-purple-950/20",
      borderColor: "border-purple-200 dark:border-purple-900",
      onClick: () => handleFilter("acknowledged", "true"),
      isActive: searchParams.get("acknowledged") === "true",
    },
    {
      label: "Closed",
      value: stats.closed,
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50/50 dark:bg-emerald-950/20",
      borderColor: "border-emerald-200 dark:border-emerald-900",
      onClick: () => handleFilter("status", "closed"),
      isActive: activeStatus === "closed",
    },
    {
      label: "Escalated",
      value: stats.escalated,
      icon: AlertCircle,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50/50 dark:bg-red-950/20",
      borderColor: "border-red-200 dark:border-red-900",
      onClick: () => handleFilter("escalated", "true"),
      isActive: searchParams.get("escalated") === "true",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className={cn(
                "border-2 cursor-pointer transition-all hover:shadow-lg hover:scale-105 group",
                stat.bgColor,
                stat.borderColor,
                stat.isActive && "ring-2 ring-primary ring-offset-2 shadow-md"
              )}
              onClick={stat.onClick}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Icon className={cn("w-4 h-4 transition-transform group-hover:scale-110", stat.color)} />
                  {stat.isActive && (
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{stat.label}</p>
                <p className={cn("text-2xl font-bold transition-colors", stat.color)}>{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

