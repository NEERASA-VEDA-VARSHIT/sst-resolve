import { z } from "zod";
import { TICKET_STATUS } from "@/conf/constants";

/**
 * Ticket / workflow enums
 */

export const TicketStatus = z.enum([
  TICKET_STATUS.OPEN,
  TICKET_STATUS.IN_PROGRESS,
  TICKET_STATUS.AWAITING_STUDENT,
  TICKET_STATUS.REOPENED,
  TICKET_STATUS.ESCALATED,
  TICKET_STATUS.FORWARDED,
  TICKET_STATUS.RESOLVED,
] as [string, ...string[]]);

export const TicketWorkflowStatusSchema = TicketStatus;

export const TicketCategory = z.enum(["Hostel", "College", "Committee"] as [
  string,
  ...string[]
]);

export const CommentType = z.enum([
  "student_visible",
  "internal_note",
  "super_admin_note",
] as [string, ...string[]]);

/**
 * Comments
 */
export const AddCommentSchema = z.object({
  comment: z.string().trim().min(1, "Comment cannot be empty"),
  commentType: CommentType,
});

/**
 * TAT (Turnaround Time)
 */
export const SetTATSchema = z.object({
  tat: z.string().trim().min(1, "TAT is required"),
  markInProgress: z.boolean().optional(),
});

/**
 * Ticket status updates
 */
export const UpdateTicketStatusSchema = z.object({
  status: TicketStatus,
});

/**
 * Assignment schemas
 */
export const AssignTicketSchema = z.object({
  // Clerk user ID string, or null to unassign
  staffClerkId: z.string().min(1).nullable(),
});

export const ReassignTicketSchema = z.object({
  // Either a DB UUID / Clerk ID string, or the literal "unassigned"
  assigned_to: z.union([
    z.string().min(1),
    z.literal("unassigned"),
  ]),
});

/**
 * Bulk close tickets
 */
export const BulkCloseTicketsSchema = z.object({
  ticket_ids: z.array(z.number().int().positive()).min(1),
});

/**
 * Rating tickets
 */
export const RateTicketSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().trim().max(2000).optional(),
});

/**
 * Forward / escalate tickets
 * (Minimal shapes to satisfy current API usage.)
 */
export const ForwardTicketSchema = z.object({
  committee_id: z.number().int().positive(),
  reason: z.string().trim().max(2000).optional(),
});

export const EscalateTicketSchema = z.object({
  level: z.number().int().positive().optional(),
  reason: z.string().trim().max(2000).optional(),
});

/**
 * Placeholders for other business-level schemas used mainly on UI side.
 * These are intentionally broad but keep a stable API surface.
 */
export const CreateTicketSchema = z.any();
export const UpdateTicketSchema = z.any();
export const TicketDetailsSchema = z.any();
export const TicketFilterSchema = z.any();
export const TicketDbUpdateSchema = z.any();
