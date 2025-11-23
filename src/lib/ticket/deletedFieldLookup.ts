// src/lib/tickets/deletedFieldLookup.ts
import { db } from "@/db";
import { deleted_category_fields, category_fields, field_options } from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";

export interface FieldDefinition {
  id: number;
  name: string;
  slug: string;
  field_type: string;
  required: boolean;
  placeholder: string | null;
  help_text: string | null;
  display_order: number;
  options?: Array<{
    id: number;
    label: string;
    value: string;
    display_order: number;
  }>;
}

/**
 * Get field definitions by IDs
 * Checks both active fields AND deleted field archive
 * This is the key function that makes old tickets work after field deletion
 */
export async function getFieldDefinitionsByIds(
  fieldIds: number[]
): Promise<FieldDefinition[]> {
  if (fieldIds.length === 0) return [];

  // 1. Get active fields
  const activeFields = await db
    .select()
    .from(category_fields)
    .where(inArray(category_fields.id, fieldIds));

  // Get options for active select fields
  const activeFieldsWithOptions = await Promise.all(
    activeFields.map(async (field) => {
      if (field.field_type === 'select') {
        const options = await db
          .select()
          .from(field_options)
          .where(
            and(
              eq(field_options.field_id, field.id),
              eq(field_options.active, true)
            )
          )
          .orderBy(field_options.display_order);
        return { ...field, options };
      }
      return { ...field, options: [] };
    })
  );

  const activeFieldIds = new Set(activeFields.map(f => f.id));
  const missingIds = fieldIds.filter(id => !activeFieldIds.has(id));

  const results: FieldDefinition[] = activeFieldsWithOptions as FieldDefinition[];

  // 2. Get deleted fields for missing IDs
  if (missingIds.length > 0) {
    const deletedFields = await db
      .select()
      .from(deleted_category_fields)
      .where(inArray(deleted_category_fields.original_field_id, missingIds));

    for (const deletedField of deletedFields) {
      const fieldData = deletedField.field_data as Record<string, unknown>;
      const optionsData = (deletedField.options_data as Array<Record<string, unknown>>) || [];
      type FieldOption = { id: number; label: string; value: string; display_order: number };
      const typedOptions: FieldOption[] = optionsData.map((opt, idx) => ({
        id: idx,
        label: typeof opt.label === 'string' ? opt.label : String(opt.label || ''),
        value: typeof opt.value === 'string' ? opt.value : String(opt.value || ''),
        display_order: typeof opt.display_order === 'number' ? opt.display_order : idx,
      }));
      results.push({
        ...(fieldData as unknown as FieldDefinition),
        id: deletedField.original_field_id,
        options: typedOptions,
      });
    }
  }

  // Sort by display_order
  return results.sort((a, b) => a.display_order - b.display_order);
}

/**
 * Get field definitions for a subcategory
 * Only returns ACTIVE fields (for new ticket forms)
 */
export async function getActiveFieldsForSubcategory(
  subcategoryId: number
): Promise<FieldDefinition[]> {
  const fields = await db
    .select()
    .from(category_fields)
    .where(
      and(
        eq(category_fields.subcategory_id, subcategoryId),
        eq(category_fields.active, true)
      )
    )
    .orderBy(category_fields.display_order);

  const fieldsWithOptions = await Promise.all(
    fields.map(async (field) => {
      if (field.field_type === 'select') {
        const options = await db
          .select()
          .from(field_options)
          .where(
            and(
              eq(field_options.field_id, field.id),
              eq(field_options.active, true)
            )
          )
          .orderBy(field_options.display_order);
        return { ...field, options };
      }
      return { ...field, options: [] };
    })
  );

  return fieldsWithOptions as FieldDefinition[];
}
