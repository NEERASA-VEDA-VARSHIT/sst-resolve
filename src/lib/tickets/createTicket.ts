// lib/tickets/createTicket.ts
import { db, tickets, users, staff, outbox, categories, subcategories } from "@/db";
import { eq, and } from "drizzle-orm";
import { TicketCreateInput } from "@/lib/validation/ticket";
import { getOrCreateUser } from "@/lib/user-sync";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { findSPOCForTicket } from "@/lib/tickets/assignSpoc";

/**
 * createTicket - core domain function
 * - Performs validations and DB inserts inside a transaction
 * - Creates an outbox event (ticket.created) for workers to process notifications
 *
 * Returns the inserted ticket record (as returned by DB).
 */

function sanitizeText(input?: string | null) {
  if (!input) return input;
  // Very lightweight sanitization: strip <script> tags and control chars.
  // If you need richer HTML sanitation, use DOMPurify on server or a trusted lib.
  return input.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").trim();
}

export async function createTicket(args: {
  clerkId: string; // Clerk user id
  payload: TicketCreateInput;
}) {
  const { clerkId, payload } = args;

  // Ensure user exists in our DB (returns local user record)
  const dbUser = await getOrCreateUser(clerkId);
  if (!dbUser) throw new Error("User not found in local DB after sync");

  // Role check (single source of truth)
  const role = await getUserRoleFromDB(clerkId);
  if (!role) throw new Error("User role unknown");
  // only allow student/committee per PRD
  if (role !== "student" && role !== "committee") {
    throw new Error("Only students and committee members can create tickets");
  }

  // Update user profile if profile data is provided
  if (payload.profile && Object.keys(payload.profile).length > 0) {
    // For students, update both users and students tables
    if (role === "student") {
      // Update users table for personal info
      const userUpdates: any = {};
      if (payload.profile.name) userUpdates.full_name = payload.profile.name;
      if (payload.profile.email) userUpdates.email = payload.profile.email;
      if (payload.profile.phone) userUpdates.phone = payload.profile.phone;
      
      if (Object.keys(userUpdates).length > 0) {
        await db
          .update(users)
          .set(userUpdates)
          .where(eq(users.id, dbUser.id));
      }
      
      // Update students table for student-specific info
      const { students } = await import("@/db/schema");
      const studentUpdates: any = {};
      
      if (payload.profile.rollNo) studentUpdates.roll_no = payload.profile.rollNo;
      if (payload.profile.roomNumber) studentUpdates.room_no = payload.profile.roomNumber;
      if (payload.profile.batchYear) {
        const year = parseInt(payload.profile.batchYear);
        if (!isNaN(year)) studentUpdates.batch_year = year;
      }
      
      // For hostel, we need to look up the hostel ID by name
      // For now, let's skip hostel and class section updates to avoid complexity
      // These would require looking up foreign key IDs from master tables
      
      if (Object.keys(studentUpdates).length > 0) {
        await db
          .update(students)
          .set(studentUpdates)
          .where(eq(students.user_id, dbUser.id));
      }
    }
  }

  // Resolve category (prefer ID)
  let categoryRecord;
  if (payload.categoryId) {
    const [c] = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.id, payload.categoryId))
      .limit(1);
    categoryRecord = c;
  } else if (payload.category) {
    const [c] = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.name, payload.category))
      .limit(1);
    categoryRecord = c;
  }

  if (!categoryRecord) {
    throw new Error("Category not found");
  }

  // Subcategory resolution (optional)
  let subcategoryRecord;
  if (payload.subcategoryId) {
    const [s] = await db
      .select({ id: subcategories.id, name: subcategories.name })
      .from(subcategories)
      .where(and(eq(subcategories.id, payload.subcategoryId), eq(subcategories.category_id, categoryRecord.id)))
      .limit(1);
    subcategoryRecord = s;
  } else if (payload.subcategory) {
    const [s] = await db
      .select({ id: subcategories.id, name: subcategories.name })
      .from(subcategories)
      .where(and(eq(subcategories.name, payload.subcategory), eq(subcategories.category_id, categoryRecord.id)))
      .limit(1);
    subcategoryRecord = s;
  }

  // Build metadata object (store both ids and names)
  let metadata: Record<string, any> = {};
  if (subcategoryRecord) {
    metadata.subcategory = subcategoryRecord.name;
    metadata.subcategoryId = subcategoryRecord.id;
  } else if (payload.subcategory || payload.subcategoryId) {
    metadata.subcategory = payload.subcategory || null;
    metadata.subcategoryId = payload.subcategoryId || null;
  }

  // Merge details (payload.details may be stringified JSON from client)
  let detailsObj: any = {};
  if (payload.details) {
    if (typeof payload.details === "string") {
      try {
        detailsObj = JSON.parse(payload.details);
      } catch {
        detailsObj = { raw: payload.details };
      }
    } else {
      detailsObj = payload.details;
    }
  }

  // NEW: Store field IDs for future lookup (snapshot-on-delete approach)
  let usedFieldIds: number[] = [];
  let dynamicFields: Record<string, { field_id: number; value: any }> = {};
  
  if (subcategoryRecord?.id && detailsObj) {
    // Fetch current active fields to map slugs to IDs
    const { category_fields } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    
    const activeFields = await db
      .select({ id: category_fields.id, slug: category_fields.slug })
      .from(category_fields)
      .where(eq(category_fields.subcategory_id, subcategoryRecord.id));

    const fieldMap = new Map(activeFields.map(f => [f.slug, f.id]));
    
    // Store field IDs with their values
    for (const [slug, value] of Object.entries(detailsObj)) {
      const fieldId = fieldMap.get(slug);
      if (fieldId && value !== null && value !== undefined && value !== '') {
        usedFieldIds.push(fieldId);
        dynamicFields[slug] = { field_id: fieldId, value };
      }
    }
  }

  metadata = {
    ...metadata,
    ...detailsObj, // Keep backward compatibility
    dynamic_fields: dynamicFields, // NEW: Field IDs with values
    used_field_ids: usedFieldIds, // NEW: Quick lookup array
    images: payload.images || [],
    extra: payload.extra || undefined,
  };

  // Determine assignment (SPOC or super admin)
  let assignedStaffId: number | null = null;

  if (categoryRecord.name === "Committee" || categoryRecord.name === "Others") {
    // find super admin staff id
    const { findSuperAdminClerkId } = await import("@/lib/db-helpers");
    const superClerk = await findSuperAdminClerkId();
    if (superClerk) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerk_id, superClerk)).limit(1);
      if (u) {
        const [st] = await db.select({ id: staff.id }).from(staff).where(eq(staff.user_id, u.id)).limit(1);
        assignedStaffId = st?.id || null;
      }
    }
  } else {
    // find SPOC via helper
    const clerkAssigned = await findSPOCForTicket(
      categoryRecord.name,
      payload.location || null,
      categoryRecord.id,
      metadata.subcategoryId || null,
      Object.keys(detailsObj || {})
    );
    if (clerkAssigned) {
      // map clerkId to local staff.id
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerk_id, clerkAssigned)).limit(1);
      if (u) {
        const [st] = await db.select({ id: staff.id }).from(staff).where(eq(staff.user_id, u.id)).limit(1);
        assignedStaffId = st?.id || null;
      }
    }
  }

  // Sanitize description
  const safeDescription = sanitizeText(payload.description || null);

  // Process attachments from images array
  let attachments: Array<{ url: string; type: string }> | null = null;
  if (payload.images && payload.images.length > 0) {
    attachments = payload.images.map(url => ({
      url: url,
      type: 'image'
    }));
  }

  // Use a DB transaction to ensure ticket + outbox consistency
  const result = await db.transaction(async (tx) => {
    const insertValues: any = {
      created_by: dbUser.id,
      category_id: categoryRecord.id,
      description: safeDescription,
      location: payload.location || null,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      attachments: attachments,
    };
    if (assignedStaffId) insertValues.assigned_to = assignedStaffId;

    // Insert ticket
    const [newTicket] = await tx.insert(tickets).values(insertValues).returning();

    // Create outbox event for notifications (decoupled)
    await tx.insert(outbox).values({
      event_type: "ticket.created",
      payload: {
        ticket_id: newTicket.id,
        created_by_clerk: clerkId,
        category: categoryRecord.name,
      },
      attempts: 0,
    });

    return newTicket;
  });

  return result;
}
