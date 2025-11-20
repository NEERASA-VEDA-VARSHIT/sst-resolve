// lib/validation/ticket.ts
import { z } from "zod";

/**
 * Ticket creation payload validation.
 * - Use this both in route and in any client-side form builder (inferred types).
 * - Keep shape strict: prefer IDs when possible.
 */

export const TicketCreateSchema = z.object({
  // Allow either categoryId (preferred) or category (name). At least one is required.
  categoryId: z.union([
    z.number().int().positive(),
    z.null(),
    z.undefined(),
    z.literal("")
  ]).transform(v => v === null || v === undefined || v === "" ? undefined : v).optional(),
  category: z.string().trim().min(1).optional(),

  subcategoryId: z.union([
    z.number().int().positive(),
    z.null(),
    z.undefined(),
    z.literal("")
  ]).transform(v => v === null || v === undefined || v === "" ? undefined : v).optional(),
  subcategory: z.string().trim().min(1).optional(),

  // Free text description, optional but recommended
  description: z.string().max(20_000).optional(),

  // Optional structured details; allow object or JSON string
  details: z.union([z.string(), z.record(z.string(), z.any())]).optional(),

  // Location string (e.g., "Boys Hostel 3", "Library")
  location: z.string().max(500).optional(),

  // Optional sub-subcategory fields / custom metadata
  subSubcategoryId: z.union([
    z.number().int().positive(),
    z.null(),
    z.undefined(),
    z.literal("")
  ]).transform(v => v === null || v === undefined || v === "" ? undefined : v).optional(),
  subSubcategory: z.string().trim().min(1).optional(),

  // Images: array of publicIds or storage keys already uploaded
  images: z.array(z.string().min(1)).optional(),

  // Any extra client-side fields (validated later by field slugs if needed)
  extra: z.record(z.string(), z.any()).optional(),

  // Profile data for user profile updates during ticket creation
  profile: z.record(z.string(), z.any()).optional(),
});

// Type helper
export type TicketCreateInput = z.infer<typeof TicketCreateSchema>;
