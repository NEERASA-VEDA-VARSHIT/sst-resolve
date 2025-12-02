/**
 * Calculate TAT (Turnaround Time) information from ticket data
 */

import type { TATInfo } from "@/types/ticket";

interface TicketData {
  resolution_due_at?: Date | string | null;
  metadata?: {
    tat?: string;
    tatDate?: string;
    tatSetAt?: string;
    tatSetBy?: string;
    tatExtensions?: Array<Record<string, unknown>>;
  };
}

interface StatusInfo {
  normalizedStatus: string;
  ticketProgress: number;
}

export function calculateTATInfo(
  ticket: TicketData,
  statusInfo: StatusInfo
): TATInfo {
  const { normalizedStatus, ticketProgress } = statusInfo;
  const metadata = ticket.metadata || {};
  
  const isResolved = normalizedStatus === "resolved" || normalizedStatus === "closed" || ticketProgress === 100;
  const isReopened = normalizedStatus === "reopened" || normalizedStatus.includes("reopened");

  // If resolved or reopened, return early with minimal info
  if (isResolved || isReopened) {
    return {
      tat: metadata.tat ? String(metadata.tat) : null,
      tatDate: metadata.tatDate ? String(metadata.tatDate) : null,
      tatSetAt: metadata.tatSetAt ? String(metadata.tatSetAt) : null,
      tatSetBy: metadata.tatSetBy ? String(metadata.tatSetBy) : null,
      tatExtensions: Array.isArray(metadata.tatExtensions) ? metadata.tatExtensions : [],
      expectedResolution: null,
      isOverdue: false,
    };
  }

  // Calculate expected resolution time for active tickets
  // Priority: metadata.tatDate > resolution_due_at > metadata.tat (calculate) > default 48 hours
  let expectedResolution: string | null = null;
  let isOverdue = false;

  if (metadata.tatDate) {
    const tatDateObj = new Date(String(metadata.tatDate));
    if (!isNaN(tatDateObj.getTime())) {
      const now = new Date();
      const diffMs = tatDateObj.getTime() - now.getTime();
      const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
      if (diffHours > 0) {
        expectedResolution = diffHours < 24 
          ? `${diffHours} hour${diffHours !== 1 ? 's' : ''}` 
          : `${Math.ceil(diffHours / 24)} day${Math.ceil(diffHours / 24) !== 1 ? 's' : ''}`;
      } else {
        expectedResolution = "Overdue";
        isOverdue = true;
      }
    }
  } else if (ticket.resolution_due_at) {
    const dueDate = new Date(ticket.resolution_due_at);
    if (!isNaN(dueDate.getTime())) {
      const now = new Date();
      const diffMs = dueDate.getTime() - now.getTime();
      const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
      if (diffHours > 0) {
        expectedResolution = diffHours < 24 
          ? `${diffHours} hour${diffHours !== 1 ? 's' : ''}` 
          : `${Math.ceil(diffHours / 24)} day${Math.ceil(diffHours / 24) !== 1 ? 's' : ''}`;
      } else {
        expectedResolution = "Overdue";
        isOverdue = true;
      }
    }
  } else if (metadata.tat) {
    expectedResolution = String(metadata.tat);
  } else {
    expectedResolution = "48 hours";
  }

  return {
    tat: metadata.tat ? String(metadata.tat) : null,
    tatDate: metadata.tatDate ? String(metadata.tatDate) : null,
    tatSetAt: metadata.tatSetAt ? String(metadata.tatSetAt) : null,
    tatSetBy: metadata.tatSetBy ? String(metadata.tatSetBy) : null,
    tatExtensions: Array.isArray(metadata.tatExtensions) ? metadata.tatExtensions : [],
    expectedResolution,
    isOverdue,
  };
}
