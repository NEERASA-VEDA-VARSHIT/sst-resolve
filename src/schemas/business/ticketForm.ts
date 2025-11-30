import { z } from "zod";

/**
 * Minimal ticket form schema used by UI when present.
 * Currently only exported through src/schema/index.ts.
 */

export const ticketFormSchema = z.any();

export type TicketFormData = z.infer<typeof ticketFormSchema>;

export function validateDynamicField(_value: unknown): boolean {
  // Placeholder: always treat dynamic fields as valid.
  return true;
}

export function validateProfileField(_value: unknown): boolean {
  // Placeholder: always treat profile fields as valid.
  return true;
}
