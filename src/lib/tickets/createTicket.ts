// lib/tickets/createTicket.ts
import { db, tickets, users, outbox, categories, subcategories } from "@/db";
import { eq, and } from "drizzle-orm";
import { TicketCreateInput } from "@/lib/validation/ticket";
import { getOrCreateUser } from "@/lib/user-sync";
import { getUserRoleFromDB } from "@/lib/db-roles";
// findSPOCForTicket is imported dynamically from spoc-assignment.ts
import { getStatusIdByValue } from "@/lib/status-helpers";

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

  // Prepare profile updates (will be applied inside transaction)
  let profileUpdateNeeded = false;
  const userUpdates: any = {};
  const studentUpdates: any = {};

  if (payload.profile && typeof payload.profile === 'object' && !Array.isArray(payload.profile) && Object.keys(payload.profile).length > 0) {
    // For students, update both users and students tables
    if (role === "student") {
      // Update users table for personal info
      if (payload.profile.name) {
        // Split name into first_name and last_name
        const nameParts = String(payload.profile.name).trim().split(' ');
        userUpdates.first_name = nameParts[0] || null;
        userUpdates.last_name = nameParts.slice(1).join(' ').trim() || null;
        profileUpdateNeeded = true;
      }
      if (payload.profile.email) {
        userUpdates.email = String(payload.profile.email).trim();
        profileUpdateNeeded = true;
      }
      if (payload.profile.phone) {
        userUpdates.phone = String(payload.profile.phone).trim();
        profileUpdateNeeded = true;
      }

      // Update students table for student-specific info
      if (payload.profile.rollNo) {
        studentUpdates.roll_no = String(payload.profile.rollNo).trim();
        profileUpdateNeeded = true;
      }
      if (payload.profile.roomNumber) {
        studentUpdates.room_no = String(payload.profile.roomNumber).trim();
        profileUpdateNeeded = true;
      }
      if (payload.profile.hostel) {
        // Resolve hostel name to hostel_id
        const { hostels } = await import("@/db/schema");
        const hostelName = String(payload.profile.hostel).trim();
        const [hostelRecord] = await db
          .select({ id: hostels.id })
          .from(hostels)
          .where(eq(hostels.name, hostelName))
          .limit(1);
        if (hostelRecord) {
          studentUpdates.hostel_id = hostelRecord.id;
          profileUpdateNeeded = true;
        }
      }
      if (payload.profile.batchYear) {
        const year = parseInt(String(payload.profile.batchYear));
        if (!isNaN(year)) {
          studentUpdates.batch_year = year;
          profileUpdateNeeded = true;
        }
      }
      if (payload.profile.classSection) {
        // Resolve class section name to class_section_id
        const { class_sections } = await import("@/db/schema");
        const sectionName = String(payload.profile.classSection).trim();
        const [sectionRecord] = await db
          .select({ id: class_sections.id })
          .from(class_sections)
          .where(eq(class_sections.name, sectionName))
          .limit(1);
        if (sectionRecord) {
          studentUpdates.class_section_id = sectionRecord.id;
          profileUpdateNeeded = true;
        }
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
    // Safety check: ensure detailsObj is an object before calling Object.entries
    if (detailsObj && typeof detailsObj === 'object' && !Array.isArray(detailsObj)) {
      for (const [slug, value] of Object.entries(detailsObj)) {
        const fieldId = fieldMap.get(slug);
        if (fieldId && value !== null && value !== undefined && value !== '') {
          usedFieldIds.push(fieldId);
          dynamicFields[slug] = { field_id: fieldId, value };
        }
      }
    }
  }

  metadata = {
    ...metadata,
    // Keep backward compatibility - only spread if detailsObj is a valid object
    ...(detailsObj && typeof detailsObj === 'object' && !Array.isArray(detailsObj) ? detailsObj : {}),
    dynamic_fields: dynamicFields, // NEW: Field IDs with values
    used_field_ids: usedFieldIds, // NEW: Quick lookup array
    images: payload.images || [],
    extra: payload.extra || undefined,
  };

  // Determine assignment (SPOC or super admin)
  let assignedUserId: string | null = null;

  if (categoryRecord.name === "Committee" || categoryRecord.name === "Others") {
    // find super admin user id
    const { findSuperAdminClerkId } = await import("@/lib/db-helpers");
    const superClerk = await findSuperAdminClerkId();
    if (superClerk) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerk_id, superClerk)).limit(1);
      if (u) {
        assignedUserId = u.id;
      }
    }
  } else {
    // find SPOC via helper (uses the full assignment hierarchy)
    const { findSPOCForTicket } = await import("@/lib/spoc-assignment");
    // Safety check: ensure detailsObj is valid before calling Object.keys
    const fieldSlugs = detailsObj && typeof detailsObj === 'object' && !Array.isArray(detailsObj)
      ? Object.keys(detailsObj)
      : [];
    const clerkAssigned = await findSPOCForTicket(
      categoryRecord.name,
      payload.location || null,
      categoryRecord.id,
      metadata.subcategoryId || null,
      fieldSlugs
    );
    if (clerkAssigned) {
      // map clerkId to local users.id
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerk_id, clerkAssigned)).limit(1);
      if (u) {
        assignedUserId = u.id;
      }
    }
  }

  // Fallback: If no assignment found, assign to superadmin
  if (!assignedUserId) {
    const { findSuperAdminClerkId } = await import("@/lib/db-helpers");
    const superClerk = await findSuperAdminClerkId();
    if (superClerk) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerk_id, superClerk)).limit(1);
      if (u) {
        assignedUserId = u.id;
        console.log(`[createTicket] No assignment found, defaulting to superadmin for ticket in category: ${categoryRecord.name}`);
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

  // Get the default OPEN status ID
  const openStatusId = await getStatusIdByValue("OPEN");
  if (!openStatusId) {
    throw new Error("OPEN status not found in ticket_statuses table. Please seed the statuses.");
  }

  // Use a DB transaction to ensure ticket + outbox + profile updates consistency
  const result = await db.transaction(async (tx) => {
    // Update user profile if needed (inside transaction for atomicity)
    if (profileUpdateNeeded) {
      if (Object.keys(userUpdates).length > 0) {
        userUpdates.updated_at = new Date();
        await tx
          .update(users)
          .set(userUpdates)
          .where(eq(users.id, dbUser.id));
      }

      if (Object.keys(studentUpdates).length > 0) {
        const { students } = await import("@/db/schema");
        studentUpdates.updated_at = new Date();
        await tx
          .update(students)
          .set(studentUpdates)
          .where(eq(students.user_id, dbUser.id));
      }
    }

    const insertValues: any = {
      created_by: dbUser.id,
      category_id: categoryRecord.id,
      status_id: openStatusId, // Set the status_id to OPEN
      description: safeDescription,
      location: payload.location || null,
      metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) && Object.keys(metadata).length > 0 ? metadata : null,
      attachments: attachments,
    };
    if (assignedUserId) insertValues.assigned_to = assignedUserId;

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
