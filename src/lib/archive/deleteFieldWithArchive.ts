// src/lib/deleteFieldWithArchive.ts
import { db } from "@/db";
import { deleted_category_fields, category_fields, field_options, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function archiveAndDeleteField(args: {
  fieldId: number;
  deletedBy: string; // user UUID
  deletionReason?: string;
}) {
  const { fieldId, deletedBy, deletionReason } = args;

  // 1. Fetch complete field data
  const [field] = await db
    .select()
    .from(category_fields)
    .where(eq(category_fields.id, fieldId))
    .limit(1);

  if (!field) {
    throw new Error("Field not found");
  }

  // 2. Fetch options if select field
  type FieldOption = {
    id: number;
    label: string;
    value: string;
    [key: string]: unknown;
  };
  let options: FieldOption[] = [];
  if (field.field_type === 'select') {
    options = await db
      .select()
      .from(field_options)
      .where(eq(field_options.field_id, fieldId));
  }

  // 3. Count how many tickets use this field
  // Check if field slug exists in ticket metadata
  // Use parameterized query to prevent SQL injection
  const ticketCountResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM tickets
    WHERE metadata->>${field.slug} IS NOT NULL
       OR metadata->'dynamic_fields'->>${field.slug} IS NOT NULL
  `);
  type TicketCountResult = { count?: string | number };
  const countValue = (ticketCountResult[0] as TicketCountResult)?.count;
  const ticketCount = parseInt(typeof countValue === 'number' ? String(countValue) : countValue || '0', 10);

  // 4. Get user UUID for deleted_by
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerk_id, deletedBy))
    .limit(1);

  if (!user) {
    throw new Error("User not found");
  }

  // 5. Archive ONLY if tickets are using it
  if (ticketCount > 0) {
    await db.insert(deleted_category_fields).values({
      original_field_id: fieldId,
      field_data: field as Record<string, unknown>,
      options_data: options.length > 0 ? (options as Array<Record<string, unknown>>) : null,
      deleted_by: user.id,
      deletion_reason: deletionReason || null,
      ticket_count: ticketCount,
    });
  }

  // 6. Hard DELETE (cascade will delete options)
  await db.delete(category_fields).where(eq(category_fields.id, fieldId));

  return {
    archived: ticketCount > 0,
    ticket_count: ticketCount,
    field_name: field.name,
  };
}

/**
 * Restore a deleted field from archive
 */
export async function restoreDeletedField(originalFieldId: number) {
  const [archived] = await db
    .select()
    .from(deleted_category_fields)
    .where(eq(deleted_category_fields.original_field_id, originalFieldId))
    .limit(1);

  if (!archived) {
    throw new Error("Archived field not found");
  }

  const fieldData = archived.field_data as Record<string, unknown>;
  const optionsData = (archived.options_data as Array<Record<string, unknown>>) || [];

  // Restore field (reuse original ID if possible)
  type FieldInsertData = {
    subcategory_id: number;
    name: string;
    slug: string;
    field_type: string;
    required: boolean;
    placeholder?: string | null;
    help_text?: string | null;
    validation_rules?: unknown;
    assigned_admin_id?: string | null;
    display_order: number;
    active: boolean;
    updated_at: Date;
  };
  const [restoredField] = await db
    .insert(category_fields)
    .values({
      ...(fieldData as unknown as FieldInsertData),
      active: true,
      updated_at: new Date(),
    })
    .returning();

  // Restore options if any
  if (optionsData && optionsData.length > 0) {
    await db.insert(field_options).values(
      optionsData.map(opt => ({
        field_id: restoredField.id,
        label: typeof opt.label === 'string' ? opt.label : String(opt.label || ''),
        value: typeof opt.value === 'string' ? opt.value : String(opt.value || ''),
        display_order: typeof opt.display_order === 'number' ? opt.display_order : 0,
        active: true,
      }))
    );
  }

  // Remove from archive
  await db
    .delete(deleted_category_fields)
    .where(eq(deleted_category_fields.original_field_id, originalFieldId));

  return restoredField;
}
