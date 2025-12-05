/**
 * View Model Builder for Student Ticket Detail Page
 * 
 * This function orchestrates all business logic and data transformations
 * needed to render the student ticket detail page.
 * 
 * Responsibilities:
 * - Fetch ticket data
 * - Parse metadata
 * - Build status display
 * - Calculate progress
 * - Calculate TAT info
 * - Build timeline
 * - Resolve profile fields
 * - Normalize comments
 * - Normalize dynamic fields
 * 
 * Returns a fully prepared view model ready for UI rendering.
 */

import { getFullTicketData } from "./getFullTicketData";
import { getCachedTicketStatuses } from "@/lib/cache/cached-queries";
import { parseTicketMetadata, extractImagesFromMetadata } from "../validation/parseTicketMetadata";
import { resolveProfileFields } from "../validation/profileFieldResolver";
import { buildTimeline } from "../formatting/buildTimeline";
import { enrichTimelineWithTAT } from "../formatting/enrichTimeline";
import { calculateTATInfo } from "../utils/calculateTAT";
import { normalizeStatusForComparison } from "@/lib/utils";
import { buildProgressMap } from "@/lib/status/getTicketStatuses";
import type {
  TicketStatusDisplay,
  TicketComment,
  TicketTimelineEntry,
  ResolvedProfileField,
  TATInfo,
} from "@/types/ticket";

export interface StudentTicketViewModel {
  // Ticket data
  ticket: {
    id: number;
    description: string | null;
    location: string | null;
    status: { value: string; label: string; badge_color: string | null } | null;
    escalation_level: number | null;
    rating: number | null;
    created_at: Date | null;
    updated_at: Date | null;
    resolution_due_at: Date | null;
    acknowledged_at: Date | null;
    resolved_at: Date | null;
    reopened_at: Date | null;
    closed_at: Date | null;
  };
  
  // Category info
  category: { id: number; name: string; slug?: string } | null;
  subcategory: { id: number; name: string; slug?: string } | null;
  
  // Status & Progress
  statusDisplay: TicketStatusDisplay | null;
  normalizedStatus: string;
  ticketProgress: number;
  
  // TAT Info
  tatInfo: TATInfo;
  
  // Timeline
  timelineEntries: TicketTimelineEntry[];
  
  // Comments
  normalizedComments: TicketComment[];
  
  // Profile Fields
  resolvedProfileFields: ResolvedProfileField[];
  
  // Dynamic Fields
  normalizedDynamicFields: Array<{
    key: string;
    name: string;
    label: string;
    type: string;
    value: string | string[];
  }>;
  
  // Images
  images: string[];
  
  // Assigned Staff
  assignedStaff: { name: string; email: string | null } | null;
}

/**
 * Get fully prepared view model for student ticket detail page
 */
export async function getStudentTicketViewModel(
  ticketId: number,
  userId: string
): Promise<StudentTicketViewModel | null> {
  // 1. Fetch ticket data and statuses in parallel
  const [data, ticketStatuses] = await Promise.all([
    getFullTicketData(ticketId, userId),
    getCachedTicketStatuses(),
  ]);

  if (!data || data.ticket.created_by !== userId) {
    return null;
  }

  const {
    ticket,
    category,
    subcategory,
    creator,
    student,
    assignedStaff,
    profileFields,
    dynamicFields,
    comments,
  } = data;

  // 2. Parse metadata
  const metadata = parseTicketMetadata(ticket.metadata);
  const images = extractImagesFromMetadata(metadata);

  // 3. Build status display
  const statusValue = ticket.status?.value || null;
  const normalizedStatus = normalizeStatusForComparison(statusValue);
  const statusDisplay: TicketStatusDisplay | null = ticket.status
    ? {
        value: ticket.status.value,
        label: ticket.status.label,
        badge_color: ticket.status.badge_color,
      }
    : null;

  // 4. Calculate progress
  const progressMap = buildProgressMap(ticketStatuses);
  const ticketProgress = progressMap[normalizedStatus] || 0;

  // 5. Extract date fields from metadata
  const acknowledged_at = extractDateFromMetadata(
    metadata.acknowledged_at,
    ticket.acknowledged_at
  );
  const resolved_at = extractDateFromMetadata(metadata.resolved_at, ticket.resolved_at);
  const closed_at = extractDateFromMetadata(metadata.closed_at, null);
  const reopened_at = extractDateFromMetadata(metadata.reopened_at, ticket.reopened_at);
  const resolution_due_at = ticket.due_at ? (ticket.due_at instanceof Date ? ticket.due_at : new Date(ticket.due_at)) : null;

  // 6. Calculate TAT info
  const tatInfo: TATInfo = calculateTATInfo(ticket, { normalizedStatus, ticketProgress });

  // 7. Build timeline
  const ticketForTimeline = {
    ...ticket,
    acknowledged_at,
    resolved_at,
    reopened_at,
  };
  const baseTimeline = buildTimeline(ticketForTimeline, normalizedStatus);
  const timelineEntries: TicketTimelineEntry[] = enrichTimelineWithTAT(
    baseTimeline,
    ticket,
    { normalizedStatus, ticketProgress }
  );

  // 8. Resolve profile fields
  const resolvedProfileFields: ResolvedProfileField[] = resolveProfileFields(
    profileFields,
    metadata,
    student
      ? {
          hostel_id: student.hostel_id,
          hostel_name: student.hostel_name,
          room_no: student.room_no,
        }
      : undefined,
    creator ? { name: creator.name, email: creator.email } : undefined
  );

  // 9. Normalize comments
  const normalizedComments: TicketComment[] = normalizeComments(comments || []);

  // 10. Normalize dynamic fields
  const normalizedDynamicFields = dynamicFields.map((f) => {
    let normalizedValue: string | string[] = "";
    if (Array.isArray(f.value)) {
      normalizedValue = f.value.map((v) => String(v));
    } else if (f.value !== null && f.value !== undefined) {
      normalizedValue = String(f.value);
    }
    return {
      key: f.key,
      name: f.label || f.key,
      label: f.label || f.key,
      type: f.fieldType || "text",
      value: normalizedValue,
    };
  });

  // 11. Return fully prepared view model
  return {
    ticket: {
      id: ticket.id,
      description: ticket.description,
      location: ticket.location,
      status: ticket.status,
      escalation_level: ticket.escalation_level,
      rating: metadata.rating as number | null || null,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      resolution_due_at,
      acknowledged_at,
      resolved_at,
      reopened_at,
      closed_at,
    },
    category,
    subcategory,
    statusDisplay,
    normalizedStatus,
    ticketProgress,
    tatInfo,
    timelineEntries,
    normalizedComments,
    resolvedProfileFields,
    normalizedDynamicFields,
    images,
    assignedStaff: assignedStaff || null,
  };
}

/**
 * Helper: Extract date from metadata or fallback to ticket date
 */
function extractDateFromMetadata(
  metadataDate: unknown,
  fallbackDate: Date | string | null
): Date | null {
  if (metadataDate) {
    if (typeof metadataDate === "string") {
      const date = new Date(metadataDate);
      return isNaN(date.getTime()) ? null : date;
    }
    if (metadataDate instanceof Date) {
      return metadataDate;
    }
  }
  if (fallbackDate) {
    if (typeof fallbackDate === "string") {
      const date = new Date(fallbackDate);
      return isNaN(date.getTime()) ? null : date;
    }
    if (fallbackDate instanceof Date) {
      return fallbackDate;
    }
  }
  return null;
}

/**
 * Helper: Normalize comments for UI consumption
 */
function normalizeComments(comments: unknown[]): TicketComment[] {
  return comments.map((c: unknown) => {
    const comment = c as Record<string, unknown>;
    const createdAtValue = comment.createdAt || comment.created_at;
    let normalizedCreatedAt: string | Date | null = null;
    
    if (createdAtValue) {
      if (typeof createdAtValue === "string") {
        normalizedCreatedAt = createdAtValue;
      } else if (createdAtValue instanceof Date) {
        normalizedCreatedAt = createdAtValue;
      } else if (
        createdAtValue &&
        typeof createdAtValue === "object" &&
        "toISOString" in createdAtValue
      ) {
        normalizedCreatedAt = new Date(
          (createdAtValue as { toISOString: () => string }).toISOString()
        );
      }
    }
    
    return {
      text: typeof comment.text === "string" ? comment.text : "",
      author: typeof comment.author === "string" ? comment.author : undefined,
      createdAt: normalizedCreatedAt,
      created_at: normalizedCreatedAt,
      source: typeof comment.source === "string" ? comment.source : undefined,
      type: typeof comment.type === "string" ? comment.type : undefined,
      isInternal:
        typeof comment.isInternal === "boolean" ? comment.isInternal : undefined,
    };
  });
}
