"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  User,
  Clock,
  AlertTriangle,
  FileText,
} from "lucide-react";

import type { Ticket } from "@/db/types-only";
import type { TicketMetadata } from "@/db/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TicketCardProps {
  ticket: Ticket & {
    status?: string | null;
    category_name?: string | null;
    creator_name?: string | null;
    creator_email?: string | null;
  };
  basePath?: string;
  disableLink?: boolean;
}

/* ---------------------------------------------------
   Helpers
---------------------------------------------------- */

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  REOPENED:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
  IN_PROGRESS:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  AWAITING_STUDENT:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  ESCALATED:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  RESOLVED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
};

const formatStatus = (status?: string | { value: string; label: string; badge_color: string | null } | null) => {
  if (!status) return "Unknown";
  if (typeof status === "string") {
    return status.replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }
  return status.label || status.value || "Unknown";
};

const getStatusValue = (status?: string | { value: string; label: string; badge_color: string | null } | null): string => {
  if (!status) return "";
  if (typeof status === "string") return status;
  return status.value || "";
};

function computeTatInfo(date?: Date | null) {
  if (!date) return { overdue: false, label: null };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diff = (tatDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  const diffDays = Math.round(diff);

  if (diffDays < 0) return { overdue: true, label: `${Math.abs(diffDays)} days overdue` };
  if (diffDays === 0) return { overdue: false, label: "Due today" };
  if (diffDays === 1) return { overdue: false, label: "Due tomorrow" };
  if (diffDays <= 7) return { overdue: false, label: `Due in ${diffDays} days` };

  return {
    overdue: false,
    label: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  };
}

/* ---------------------------------------------------
   Component
---------------------------------------------------- */

function TicketCardComponent({ ticket, basePath = "/student/dashboard", disableLink = false }: TicketCardProps) {
  // Memoize metadata parsing
  const metadata = useMemo(() => (ticket.metadata as TicketMetadata) ?? {}, [ticket.metadata]);

  // Memoize TAT calculation
  const { tatDate, overdue, tatLabel } = useMemo(() => {
    const ticketWithExtras = ticket as typeof ticket & { due_at?: Date | null };
    const date = ticketWithExtras.due_at || ticket.resolution_due_at || (metadata?.tatDate ? new Date(metadata.tatDate) : null);
    const info = computeTatInfo(date);
    return { tatDate: date, overdue: info.overdue, tatLabel: info.label };
  }, [ticket, metadata?.tatDate]);

  // Memoize comment count
  const commentCount = useMemo(() => {
    return Array.isArray(metadata?.comments) ? metadata.comments.length : 0;
  }, [metadata?.comments]);

  // Memoize escalation status
  const isEscalated = useMemo(() => (ticket.escalation_level ?? 0) > 0, [ticket.escalation_level]);

  // Memoize status value
  const statusValue = useMemo(() => getStatusValue(ticket.status), [ticket.status]);
  
  // Memoize formatted status
  const formattedStatus = useMemo(() => formatStatus(ticket.status), [ticket.status]);

  // Memoize created date string
  const createdDateStr = useMemo(() => {
    return ticket.created_at?.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [ticket.created_at]);

  // Memoize creator name
  const creatorDisplayName = useMemo(() => {
    return ticket.creator_name || ticket.creator_email || "Unknown";
  }, [ticket.creator_name, ticket.creator_email]);

  const card = (
    <Card
        className={cn(
          "relative overflow-hidden h-full border transition-all duration-300 cursor-pointer group",
          "hover:shadow-xl hover:shadow-primary/10 hover:border-primary/50 hover:-translate-y-1 hover:scale-[1.02] hover:z-10",
          "bg-background hover:bg-accent/30",
          isEscalated &&
          "border-red-300 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10 hover:border-red-400 dark:hover:border-red-700 hover:bg-red-50/50 dark:hover:bg-red-950/20"
        )}
      >
        {/* Gradient overlay */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br transition-all duration-300 pointer-events-none",
            isEscalated
              ? "from-red-500/5 via-red-500/3 to-transparent group-hover:from-red-500/10 group-hover:via-red-500/5"
              : "from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:via-primary/3 group-hover:to-primary/0"
          )}
        />

        {/* Top accent (for escalated or overdue TAT) */}
        {(overdue || isEscalated) && (
          <div
            className={cn(
              "absolute top-0 left-0 right-0 h-1 opacity-80",
              isEscalated
                ? "bg-gradient-to-r from-red-600 via-red-500 to-red-400"
                : "bg-gradient-to-r from-red-500 via-orange-500 to-transparent opacity-60"
            )}
          />
        )}

        <CardHeader className="pb-3 relative z-10 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="space-y-2 sm:space-y-2.5 flex-1 min-w-0">
              {/* ID + Status */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <CardTitle className="text-base sm:text-lg font-bold group-hover:text-primary transition-colors">
                  #{ticket.id}
                </CardTitle>

                {!isEscalated && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] sm:text-xs font-semibold border transition-all",
                      STATUS_STYLES[statusValue] || "bg-muted text-foreground",
                      "group-hover:scale-105 group-hover:shadow-sm"
                    )}
                  >
                    {formattedStatus}
                  </Badge>
                )}

                {isEscalated && (
                  <Badge
                    variant="destructive"
                    className="text-[10px] sm:text-xs font-semibold gap-1 sm:gap-1.5 group-hover:scale-105 transition-transform shadow-sm"
                  >
                    <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3 group-hover:animate-pulse" />
                    <span className="hidden sm:inline">Escalated {ticket.escalation_level}x</span>
                    <span className="sm:hidden">Esc. {ticket.escalation_level}x</span>
                  </Badge>
                )}
              </div>

              {/* Category & Subcategories */}
              <div className="flex flex-wrap gap-1 sm:gap-1.5 mt-1">
                <Badge
                  variant="outline"
                  className="text-[10px] sm:text-xs font-medium border-muted-foreground/30 group-hover:border-primary/40 transition-colors bg-muted/50"
                >
                  {ticket.category_name || "Unknown"}
                </Badge>

                {metadata.subcategory && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] sm:text-xs font-medium bg-primary/5 text-primary/80 border-primary/10"
                  >
                    {metadata.subcategory}
                  </Badge>
                )}

                {/* Note: subSubcategory is not in TicketMetadata type, removed for now */}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-3 sm:space-y-4 relative z-10 p-4 sm:p-6 pt-0">
          {/* Description */}
          <p className="text-xs sm:text-sm text-foreground/90 line-clamp-2 sm:line-clamp-3 leading-relaxed group-hover:text-foreground transition-colors">
            {ticket.description || "No description provided"}
          </p>

          {/* Metadata */}
          <div className="flex flex-col gap-2 sm:gap-2.5 pt-2 sm:pt-3 border-t border-border/50 group-hover:border-primary/30 transition-colors">
            {/* User + Location */}
            <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs">
              <div className="flex items-center gap-1 sm:gap-1.5 text-muted-foreground min-w-0 flex-1">
                <div className="p-0.5 sm:p-1 rounded-md bg-muted/50 group-hover:bg-primary/10 transition-colors flex-shrink-0">
                  <User className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </div>
                <span className="font-semibold truncate">
                  {creatorDisplayName}
                </span>
              </div>

              {ticket.location && (
                <div className="flex items-center gap-1 sm:gap-1.5 text-muted-foreground flex-shrink-0">
                  <div className="p-0.5 sm:p-1 rounded-md bg-muted/50 group-hover:bg-primary/10 transition-colors">
                    <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </div>
                  <span className="font-medium truncate max-w-[80px] sm:max-w-[120px]">{ticket.location}</span>
                </div>
              )}
            </div>

            {/* Created At + TAT */}
            <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs">
              <div className="flex items-center gap-1 sm:gap-1.5 text-muted-foreground min-w-0">
                <div className="p-0.5 sm:p-1 rounded-md bg-muted/50 group-hover:bg-primary/10 flex-shrink-0">
                  <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </div>
                <span className="font-medium truncate">
                  {createdDateStr}
                </span>
              </div>

              {tatDate && tatLabel && (
                <div
                  className={cn(
                    "flex items-center gap-1 sm:gap-1.5 font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs transition-all flex-shrink-0",
                    overdue
                      ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
                    "group-hover:scale-105"
                  )}
                >
                  <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="whitespace-nowrap">{tatLabel}</span>
                </div>
              )}
            </div>

            {/* Comments */}
            {commentCount > 0 && (
              <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">
                <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span>
                  {commentCount} {commentCount === 1 ? "comment" : "comments"}
                </span>
              </div>
            )}
          </div>
        </CardContent>
    </Card>
  );

  if (disableLink) {
    return card;
  }

  return <Link href={`${basePath}/ticket/${ticket.id}`}>{card}</Link>;
}

// Memoize the component to prevent unnecessary re-renders
export const TicketCard = memo(TicketCardComponent, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.ticket.id === nextProps.ticket.id &&
    prevProps.ticket.status === nextProps.ticket.status &&
    prevProps.ticket.escalation_level === nextProps.ticket.escalation_level &&
    prevProps.ticket.resolution_due_at?.getTime() === nextProps.ticket.resolution_due_at?.getTime() &&
    prevProps.ticket.updated_at?.getTime() === nextProps.ticket.updated_at?.getTime() &&
    prevProps.basePath === nextProps.basePath &&
    prevProps.disableLink === nextProps.disableLink
  );
});

TicketCard.displayName = "TicketCard";

export default TicketCard;