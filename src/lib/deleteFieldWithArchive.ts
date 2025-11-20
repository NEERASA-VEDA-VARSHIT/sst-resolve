// src/lib/deleteFieldWithArchive.ts
import { db } from "@/db";
import { deleted_category_fields, category_fields, field_options, tickets, users } from "@/db/schema";
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
  let options: any[] = [];
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
  const ticketCount = parseInt((ticketCountResult as any)[0]?.count || '0', 10);

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
      field_data: field as any,
      options_data: options.length > 0 ? (options as any) : null,
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

  const fieldData = archived.field_data as any;
  const optionsData = archived.options_data as any[];

  // Restore field (reuse original ID if possible)
  const [restoredField] = await db
    .insert(category_fields)
    .values({
      ...fieldData,
      active: true,
      updated_at: new Date(),
    })
    .returning();

  // Restore options if any
  if (optionsData && optionsData.length > 0) {
    await db.insert(field_options).values(
      optionsData.map(opt => ({
        field_id: restoredField.id,
        label: opt.label,
        value: opt.value,
        display_order: opt.display_order,
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
