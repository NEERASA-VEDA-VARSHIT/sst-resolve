/**
 * EXAMPLE: Using drizzle-zod for category_fields table
 * 
 * This demonstrates handling tables with many optional columns
 * and adding stricter business rules on top of DB defaults
 */

import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { category_fields } from "@/db/schema";

// Base schema from Drizzle table
// Note: Fields with defaults in DB become optional in Zod
const baseCategoryFieldSchema = createInsertSchema(category_fields);

/**
 * Create Category Field Schema
 * 
 * Extends base schema with stricter business rules:
 * - name: min 2 chars (stricter than DB varchar(140))
 * - slug: min 2 chars + slug format validation
 * - Other fields inherit from base (optional if DB has defaults)
 */
export const CreateCategoryFieldSchema = baseCategoryFieldSchema.extend({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(140, "Name must not exceed 140 characters"),
  
  slug: z.string()
    .min(2, "Slug must be at least 2 characters")
    .max(140, "Slug must not exceed 140 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  
  // field_type is required in DB, but we can add enum validation
  field_type: z.enum([
    "text",
    "select",
    "date",
    "number",
    "boolean",
    "upload",
    "textarea"
  ]),
  
  // validation_rules is JSONB in DB - add structure validation
  validation_rules: z.record(z.string(), z.any()).optional(),
});

/**
 * Update Category Field Schema
 * 
 * Partial update - all fields optional
 */
export const UpdateCategoryFieldSchema = baseCategoryFieldSchema
  .partial()
  .extend({
    // Still enforce stricter rules when field is provided
    name: z.string()
      .min(2)
      .max(140)
      .optional(),
    
    slug: z.string()
      .min(2)
      .max(140)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
  });

// Type exports
export type CreateCategoryFieldInput = z.infer<typeof CreateCategoryFieldSchema>;
export type UpdateCategoryFieldInput = z.infer<typeof UpdateCategoryFieldSchema>;

