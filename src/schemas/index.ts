/**
 * Central export for all Zod validation schemas
 */

// Ticket schemas (business layer)
export {
  TicketStatus,
  TicketWorkflowStatusSchema,
  TicketCategory,
  CommentType,
  CreateTicketSchema,
  UpdateTicketSchema,
  AddCommentSchema,
  SetTATSchema,
  RateTicketSchema,
  ReassignTicketSchema,
  BulkCloseTicketsSchema,
  TicketDetailsSchema,
  TicketFilterSchema,
  TicketDbUpdateSchema,
  AssignTicketSchema,
  EscalateTicketSchema,
  ForwardTicketSchema,
  UpdateTicketStatusSchema,
} from "@/schemas/business/ticket";

// Student schemas (exported from new business layer)
export {
  UpdateStudentMobileSchema,
  UpdateStudentProfileSchema,
  UpdateStudentProfileFullSchema,
  AdminUpdateStudentSchema,
  BulkEditStudentsSchema,
} from "@/schemas/business/student";

// Ticket form schema (UI)
export {
  ticketFormSchema,
  validateDynamicField,
  validateProfileField,
} from "@/schemas/business/ticketForm";
export type { TicketFormData } from "@/schemas/business/ticketForm";

// Status schema
export type { TicketStatus as TicketStatusType } from "@/schemas/status";
