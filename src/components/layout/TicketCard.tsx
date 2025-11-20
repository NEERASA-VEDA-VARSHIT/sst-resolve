import Link from "next/link";
import {
  Calendar,
  MapPin,
  User,
  Clock,
  AlertTriangle,
  FileText,
} from "lucide-react";

import type { tickets } from "@/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Ticket = typeof tickets.$inferSelect;

interface TicketCardProps {
  ticket: Ticket & {
    category_name?: string | null;
    creator_name?: string | null;
    creator_email?: string | null;
  };
  basePath?: string;
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

const formatStatus = (status?: string) =>
  status ? status.replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "Unknown";

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

export function TicketCard({ ticket, basePath = "/student/dashboard" }: TicketCardProps) {
  const metadata = (ticket.metadata as any) ?? {};

  // TAT calculation
  const tatDate = ticket.due_at || (metadata?.tatDate ? new Date(metadata.tatDate) : null);
  const { overdue, label: tatLabel } = computeTatInfo(tatDate);

  // Comment count (if present in metadata)
  const commentCount = Array.isArray(metadata?.comments) ? metadata.comments.length : 0;

  const isEscalated = (ticket.escalation_level ?? 0) > 0;

  return (
    <Link href={`${basePath}/ticket/${ticket.id}`}>
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

        <CardHeader className="pb-3 relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2.5 flex-1 min-w-0">
              {/* ID + Status */}
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">
                  #{ticket.id}
                </CardTitle>

                {!isEscalated && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-semibold border transition-all",
                      STATUS_STYLES[ticket.status ?? ""] || "bg-muted text-foreground",
                      "group-hover:scale-105 group-hover:shadow-sm"
                    )}
                  >
                    {formatStatus(ticket.status)}
                  </Badge>
                )}

                {isEscalated && (
                  <Badge
                    variant="destructive"
                    className="text-xs font-semibold gap-1.5 group-hover:scale-105 transition-transform shadow-sm"
                  >
                    <AlertTriangle className="w-3 h-3 group-hover:animate-pulse" />
                    Escalated {ticket.escalation_level}x
                  </Badge>
                )}
              </div>

              {/* Category & Subcategories */}
              <div className="flex flex-wrap gap-1.5 mt-1">
                <Badge
                  variant="outline"
                  className="text-xs font-medium border-muted-foreground/30 group-hover:border-primary/40 transition-colors bg-muted/50"
                >
                  {ticket.category_name || "Unknown"}
                </Badge>

                {metadata.subcategory && (
                  <Badge
                    variant="secondary"
                    className="text-xs font-medium bg-primary/5 text-primary/80 border-primary/10"
                  >
                    {metadata.subcategory}
                  </Badge>
                )}

                {metadata.subSubcategory && (
                  <Badge
                    variant="secondary"
                    className="text-xs font-medium bg-primary/5 text-primary/80 border-primary/10"
                  >
                    {metadata.subSubcategory}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-4 relative z-10">
          {/* Description */}
          <p className="text-sm text-foreground/90 line-clamp-2 leading-relaxed group-hover:text-foreground transition-colors">
            {ticket.description || "No description provided"}
          </p>

          {/* Metadata */}
          <div className="flex flex-col gap-2.5 pt-3 border-t border-border/50 group-hover:border-primary/30 transition-colors">
            {/* User + Location */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <div className="p-1 rounded-md bg-muted/50 group-hover:bg-primary/10 transition-colors">
                  <User className="w-3 h-3" />
                </div>
                <span className="font-semibold">
                  {ticket.creator_name || ticket.creator_email || "Unknown"}
                </span>
              </div>

              {ticket.location && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <div className="p-1 rounded-md bg-muted/50 group-hover:bg-primary/10 transition-colors">
                    <MapPin className="w-3 h-3" />
                  </div>
                  <span className="font-medium truncate max-w-[120px]">{ticket.location}</span>
                </div>
              )}
            </div>

            {/* Created At + TAT */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <div className="p-1 rounded-md bg-muted/50 group-hover:bg-primary/10">
                  <Calendar className="w-3 h-3" />
                </div>
                <span className="font-medium">
                  {ticket.created_at?.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              {tatDate && tatLabel && (
                <div
                  className={cn(
                    "flex items-center gap-1.5 font-semibold px-2 py-1 rounded-md text-xs transition-all",
                    overdue
                      ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
                    "group-hover:scale-105"
                  )}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {tatLabel}
                </div>
              )}
            </div>

            {/* Comments */}
            {commentCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">
                <FileText className="w-3 h-3" />
                <span>
                  {commentCount} {commentCount === 1 ? "comment" : "comments"}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default TicketCard;