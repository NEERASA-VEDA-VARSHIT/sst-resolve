/**
 * Build timeline entries from ticket data
 * Factory function for creating timeline in a testable, reusable way
 */

type TimelineEntry = {
  title: string;
  icon: string;
  date: Date | null;
  color: string;
  textColor: string;
};

type TicketData = {
  created_at: Date | null;
  acknowledged_at: Date | string | null;
  updated_at: Date | null;
  resolved_at: Date | string | null;
  reopened_at: Date | string | null;
  escalation_level: number | null;
  status: string | { value: string; label: string; badge_color: string | null } | null;
};

export function buildTimeline(ticket: TicketData, normalizedStatus: string): TimelineEntry[] {
  // Helper to normalize dates - ensures all dates are Date objects, not strings
  const normalizeDate = (date: Date | string | null): Date | null => {
    if (!date) return null;
    return date instanceof Date ? date : new Date(date);
  };

  const entries: TimelineEntry[] = [
    {
      title: "Created",
      icon: "Calendar",
      date: normalizeDate(ticket.created_at),
      color: "bg-primary/10",
      textColor: "text-primary",
    },
  ];

  // Add acknowledged entry if exists
  if (ticket.acknowledged_at) {
    entries.push({
      title: "Acknowledged",
      icon: "CheckCircle2",
      date: normalizeDate(ticket.acknowledged_at),
      color: "bg-green-100 dark:bg-green-900/30",
      textColor: "text-green-600 dark:text-green-400",
    });
  }

  // Add in progress entry if applicable
  if (normalizedStatus === "in_progress" && ticket.updated_at) {
    entries.push({
      title: "In Progress",
      icon: "Clock",
      date: normalizeDate(ticket.updated_at),
      color: "bg-blue-100 dark:bg-blue-900/30",
      textColor: "text-blue-600 dark:text-blue-400",
    });
  }

  // Add awaiting student response entry if applicable
  if ((normalizedStatus === "awaiting_student_response" || normalizedStatus === "awaiting_student" || normalizedStatus.includes("awaiting")) && ticket.updated_at) {
    entries.push({
      title: "Awaiting Student Response",
      icon: "MessageSquare",
      date: normalizeDate(ticket.updated_at),
      color: "bg-purple-100 dark:bg-purple-900/30",
      textColor: "text-purple-600 dark:text-purple-400",
    });
  }

  // Add resolved entry if exists
  if (ticket.resolved_at) {
    entries.push({
      title: "Resolved",
      icon: "CheckCircle2",
      date: normalizeDate(ticket.resolved_at),
      color: "bg-emerald-100 dark:bg-emerald-900/30",
      textColor: "text-emerald-600 dark:text-emerald-400",
    });
  }

  // Add reopened entry if status is reopened
  // Use reopened_at if available, otherwise use updated_at when status changed to reopened
  if (normalizedStatus === "reopened" || normalizedStatus.includes("reopened")) {
    const reopenedDate = ticket.reopened_at || ticket.updated_at;
    if (reopenedDate) {
      entries.push({
        title: "Reopened",
        icon: "RotateCw",
        date: normalizeDate(reopenedDate),
        color: "bg-indigo-100 dark:bg-indigo-900/30",
        textColor: "text-indigo-600 dark:text-indigo-400",
      });
    }
  }

  // Add escalation entry if escalated
  if ((ticket.escalation_level ?? 0) > 0 && ticket.updated_at) {
    entries.push({
      title: `Escalated (Level ${ticket.escalation_level})`,
      icon: "AlertCircle",
      date: normalizeDate(ticket.updated_at),
      color: "bg-red-100 dark:bg-red-900/30",
      textColor: "text-red-600 dark:text-red-400",
    });
  }

  // Filter out entries without dates
  return entries.filter(entry => entry.date !== null);
}
