/**
 * Central export for all Zod validation schemas
 */

// Ticket schemas
export * from "./ticket.schema";
export {
  CreateTicketSchema,
  UpdateTicketSchema,
  AddCommentSchema,
  SetTATSchema,
  RateTicketSchema,
  ReassignTicketSchema,
  TicketFilterSchema,
  TicketDetailsSchema,
} from "./ticket.schema";

// Student schemas
export * from "./student.schema";
export {
  UpdateStudentMobileSchema,
  UpdateStudentProfileSchema, // DEPRECATED - kept for backward compatibility
  LinkUserNumberSchema, // DEPRECATED - kept for backward compatibility
} from "./student.schema";

