import { z } from "zod";

/**
 * Ticket Status Enum
 */
export const TicketStatus = z.enum([
  "open",
  "in_progress",
  "awaiting_student_response",
  "closed",
  "resolved",
]);

/**
 * Ticket Category Enum
 */
export const TicketCategory = z.enum(["Hostel", "College"]);

/**
 * Comment Type Enum
 */
export const CommentType = z.enum([
  "student_visible",
  "internal_note",
  "super_admin_note",
]);

/**
 * Create Ticket Schema
 */
export const CreateTicketSchema = z.object({
  userNumber: z.string().min(1, "User number is required"),
  category: TicketCategory,
  subcategory: z.string().min(1, "Subcategory is required"),
  description: z.string().optional(),
  location: z.string().optional(),
  details: z.record(z.any()).optional(),
});

/**
 * Update Ticket Schema
 */
export const UpdateTicketSchema = z.object({
  status: TicketStatus.optional(),
  assignedTo: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
});

/**
 * Add Comment Schema
 */
export const AddCommentSchema = z.object({
  comment: z.string().min(1, "Comment is required"),
  isAdmin: z.boolean().optional().default(false),
  commentType: CommentType.optional().default("student_visible"),
});

/**
 * Set TAT Schema
 */
export const SetTATSchema = z.object({
  tat: z.string().min(1, "TAT is required"),
  markInProgress: z.boolean().optional().default(true),
});

/**
 * Rate Ticket Schema
 */
export const RateTicketSchema = z.object({
  rating: z.number().int().min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
});

/**
 * Reassign Ticket Schema
 */
export const ReassignTicketSchema = z.object({
  assignedTo: z.string().min(1, "Assigned to is required"),
});

/**
 * Bulk Close Tickets Schema
 */
export const BulkCloseTicketsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "At least one ticket id is required"),
  comment: z.string().optional(),
  status: TicketStatus.optional(),
});

/**
 * Ticket Details Schema (for JSON details field)
 */
export const TicketDetailsSchema = z.object({
  comments: z.array(z.object({
    text: z.string(),
    author: z.string(),
    createdAt: z.string(),
    source: z.string().optional(),
    type: CommentType.optional(),
    isInternal: z.boolean().optional(),
  })).optional(),
  tat: z.string().optional(),
  tatDate: z.string().optional(),
  tatSetBy: z.string().optional(),
  tatSetAt: z.string().optional(),
  tatExtendedAt: z.string().optional(),
  slackMessageTs: z.string().optional(),
  originalEmailMessageId: z.string().optional(),
  originalEmailSubject: z.string().optional(),
});

/**
 * Ticket Filter Schema
 */
export const TicketFilterSchema = z.object({
  category: TicketCategory.optional(),
  subcategory: z.string().optional(),
  location: z.string().optional(),
  status: TicketStatus.optional(),
  tat: z.enum(["has", "none", "due", "upcoming", "today"]).optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
  userNumber: z.string().optional(),
  sort: z.enum(["newest", "oldest"]).optional().default("newest"),
});

// Type exports
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>;
export type AddCommentInput = z.infer<typeof AddCommentSchema>;
export type SetTATInput = z.infer<typeof SetTATSchema>;
export type RateTicketInput = z.infer<typeof RateTicketSchema>;
export type ReassignTicketInput = z.infer<typeof ReassignTicketSchema>;
export type BulkCloseTicketsInput = z.infer<typeof BulkCloseTicketsSchema>;
export type TicketDetails = z.infer<typeof TicketDetailsSchema>;
export type TicketFilterInput = z.infer<typeof TicketFilterSchema>;
export type TicketStatus = z.infer<typeof TicketStatus>;
export type TicketCategory = z.infer<typeof TicketCategory>;
export type CommentType = z.infer<typeof CommentType>;

