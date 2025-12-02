import { z } from "zod";

/**
 * Minimal ticket form schema used by UI when present.
 * Currently only exported through src/schema/index.ts.
 */

export const ticketFormSchema = z.any();

export type TicketFormData = z.infer<typeof ticketFormSchema>;

export function validateDynamicField(value: unknown): boolean {
  // Placeholder: always treat dynamic fields as valid.
  // Reference the value to avoid unused-parameter warnings.
  void value;
  return true;
}

export function validateProfileField(value: unknown): boolean {
  // Placeholder: always treat profile fields as valid.
  void value;
  return true;
}
