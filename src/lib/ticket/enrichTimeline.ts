/**
 * Enrich timeline with TAT-related entries
 */

import type { TicketTimelineEntry } from "@/types/ticket";
import { buildTimeline } from "./buildTimeline";

interface TATMetadata {
  tatSetAt?: string | null;
  tatDate?: string | null;
}

interface StatusInfo {
  normalizedStatus: string;
  ticketProgress: number;
}

export function enrichTimelineWithTAT(
  baseTimeline: TicketTimelineEntry[],
  ticket: { metadata?: TATMetadata; [key: string]: unknown },
  statusInfo: StatusInfo
): TicketTimelineEntry[] {
  const timeline = [...baseTimeline];
  const metadata = ticket.metadata || {};
  const { normalizedStatus, ticketProgress } = statusInfo;

  // Add TAT set entry if TAT was set
  if (metadata.tatSetAt) {
    const tatSetDate = new Date(String(metadata.tatSetAt));
    if (!isNaN(tatSetDate.getTime())) {
      timeline.push({
        title: "TAT Set",
        icon: "Clock",
        date: tatSetDate,
        color: "bg-amber-100 dark:bg-amber-900/30",
        textColor: "text-amber-600 dark:text-amber-400",
      });
    }
  }

  // Add Overdue entry if TAT date has passed and ticket is not resolved
  if (metadata.tatDate) {
    const tatDateObj = new Date(String(metadata.tatDate));
    const now = new Date();
    const isResolved = normalizedStatus === "resolved" || normalizedStatus === "closed" || ticketProgress === 100;

    if (!isNaN(tatDateObj.getTime()) && tatDateObj.getTime() < now.getTime() && !isResolved) {
      timeline.push({
        title: "Overdue",
        icon: "AlertTriangle",
        date: tatDateObj,
        color: "bg-red-100 dark:bg-red-900/30",
        textColor: "text-red-600 dark:text-red-400",
      });
    }
  }

  // Sort timeline by date
  timeline.sort((a, b) => {
    if (!a.date || !b.date) return 0;
    return a.date.getTime() - b.date.getTime();
  });

  return timeline;
}
