// lib/tickets/createTicket.ts
import { db, tickets, users, outbox, categories, subcategories, sub_subcategories } from "@/db";
import { eq, and } from "drizzle-orm";
import { TicketCreateInput } from "@/lib/validation/ticket";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
// findSPOCForTicket is imported dynamically from spoc-assignment.ts
import { TICKET_STATUS } from "@/conf/constants";
import { getStatusIdByValue } from "@/lib/status/getTicketStatuses";

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

  // Edge case: Check if student is deactivated (students only)
  // We treat users whose external_id has been prefixed with DELETED_ (via Clerk webhook)
  // as deactivated and prevent new ticket creation.
  if (role === "student") {
    if (typeof dbUser.external_id === "string" && dbUser.external_id.startsWith("DELETED_")) {
      throw new Error(
        "Your account has been deactivated. Please contact support to reactivate your account."
      );
    }
  }

  // Prepare profile updates (will be applied inside transaction)
  let profileUpdateNeeded = false;
  const userUpdates: Record<string, unknown> = {};
  const studentUpdates: Record<string, unknown> = {};

  if (payload.profile && typeof payload.profile === 'object' && !Array.isArray(payload.profile) && Object.keys(payload.profile).length > 0) {
    // For students, update both users and students tables
    if (role === "student") {
      // Update users table for personal info
      if (payload.profile.name) {
        // Store full name directly
        userUpdates.full_name = String(payload.profile.name).trim() || null;
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
      // Parallelize hostel and class section lookups if both are needed
      const profileLookups = [];
      
      if (payload.profile.hostel) {
        const { hostels } = await import("@/db/schema");
        const hostelName = String(payload.profile.hostel).trim();
        profileLookups.push(
          db
            .select({ id: hostels.id })
            .from(hostels)
            .where(eq(hostels.name, hostelName))
            .limit(1)
            .then(([record]) => {
              if (record) {
                studentUpdates.hostel_id = record.id;
                profileUpdateNeeded = true;
              }
            })
        );
      }
      
      if (payload.profile.classSection) {
        const { class_sections } = await import("@/db/schema");
        const sectionName = String(payload.profile.classSection).trim();
        profileLookups.push(
          db
            .select({ id: class_sections.id })
            .from(class_sections)
            .where(eq(class_sections.name, sectionName))
            .limit(1)
            .then(([record]) => {
              if (record) {
                studentUpdates.class_section_id = record.id;
                profileUpdateNeeded = true;
              }
            })
        );
      }
      
      // Wait for all profile lookups in parallel
      if (profileLookups.length > 0) {
        await Promise.all(profileLookups);
      }
    }
  }

  // Resolve category and subcategory in parallel where possible
  let categoryRecord;
  let categoryQuery;
  
  if (payload.categoryId) {
    categoryQuery = db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.id, payload.categoryId))
      .limit(1);
  } else if (payload.category) {
    categoryQuery = db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.name, payload.category))
      .limit(1);
  }

  // Execute category query
  if (categoryQuery) {
    const [c] = await categoryQuery;
    categoryRecord = c;
  }

  if (!categoryRecord) {
    throw new Error("Category not found");
  }

  // Validate category is active
  const { categories: categoriesSchema } = await import("@/db/schema");
  const [categoryWithActive] = await db
    .select({ is_active: categoriesSchema.is_active })
    .from(categoriesSchema)
    .where(eq(categoriesSchema.id, categoryRecord.id))
    .limit(1);
  
  if (!categoryWithActive?.is_active) {
    throw new Error("Category is inactive and cannot be used for ticket creation");
  }

  // Subcategory resolution (optional) - can't parallelize as it depends on categoryRecord
  // Edge case: Validate subcategory belongs to category and is active
  let subcategoryRecord: { id: number; name: string } | undefined;
  if (payload.subcategoryId) {
    const [s] = await db
      .select({ id: subcategories.id, name: subcategories.name, is_active: subcategories.is_active })
      .from(subcategories)
      .where(and(eq(subcategories.id, payload.subcategoryId), eq(subcategories.category_id, categoryRecord.id)))
      .limit(1);
    if (s && s.is_active) {
      subcategoryRecord = { id: s.id, name: s.name };
    } else if (s && !s.is_active) {
      throw new Error("Subcategory is inactive and cannot be used for ticket creation");
    } else if (!s && payload.subcategoryId) {
      // Edge case: Subcategory ID provided but doesn't exist or doesn't belong to category
      throw new Error("Subcategory not found or does not belong to the selected category");
    }
  } else if (payload.subcategory) {
    const [s] = await db
      .select({ id: subcategories.id, name: subcategories.name, is_active: subcategories.is_active })
      .from(subcategories)
      .where(and(eq(subcategories.name, payload.subcategory), eq(subcategories.category_id, categoryRecord.id)))
      .limit(1);
    if (s && s.is_active) {
      subcategoryRecord = { id: s.id, name: s.name };
    } else if (s && !s.is_active) {
      throw new Error("Subcategory is inactive and cannot be used for ticket creation");
    } else if (!s && payload.subcategory) {
      // Edge case: Subcategory name provided but doesn't exist or doesn't belong to category
      throw new Error("Subcategory not found or does not belong to the selected category");
    }
  }

  // Sub-subcategory resolution (optional) - depends on subcategoryRecord
  // Edge case: Validate sub-subcategory belongs to subcategory and is active
  let subSubcategoryRecord: { id: number; name: string } | undefined;
  if (payload.subSubcategoryId && subcategoryRecord) {
    const [ss] = await db
      .select({ id: sub_subcategories.id, name: sub_subcategories.name, is_active: sub_subcategories.is_active })
      .from(sub_subcategories)
      .where(and(eq(sub_subcategories.id, payload.subSubcategoryId), eq(sub_subcategories.subcategory_id, subcategoryRecord.id)))
      .limit(1);
    if (ss && ss.is_active) {
      subSubcategoryRecord = { id: ss.id, name: ss.name };
    } else if (ss && !ss.is_active) {
      throw new Error("Sub-subcategory is inactive and cannot be used for ticket creation");
    } else if (!ss && payload.subSubcategoryId) {
      // Edge case: Sub-subcategory ID provided but doesn't exist or doesn't belong to subcategory
      throw new Error("Sub-subcategory not found or does not belong to the selected subcategory");
    }
  } else if (payload.subSubcategory && subcategoryRecord) {
    const [ss] = await db
      .select({ id: sub_subcategories.id, name: sub_subcategories.name, is_active: sub_subcategories.is_active })
      .from(sub_subcategories)
      .where(and(eq(sub_subcategories.name, payload.subSubcategory), eq(sub_subcategories.subcategory_id, subcategoryRecord.id)))
      .limit(1);
    if (ss && ss.is_active) {
      subSubcategoryRecord = { id: ss.id, name: ss.name };
    } else if (ss && !ss.is_active) {
      throw new Error("Sub-subcategory is inactive and cannot be used for ticket creation");
    } else if (!ss && payload.subSubcategory) {
      // Edge case: Sub-subcategory name provided but doesn't exist or doesn't belong to subcategory
      throw new Error("Sub-subcategory not found or does not belong to the selected subcategory");
    }
  }

  // Build metadata object (store both ids and names)
  let metadata: Record<string, unknown> = {};
  if (subcategoryRecord) {
    metadata.subcategory = subcategoryRecord.name;
    metadata.subcategoryId = subcategoryRecord.id;
  } else if (payload.subcategory || payload.subcategoryId) {
    metadata.subcategory = payload.subcategory || null;
    metadata.subcategoryId = payload.subcategoryId || null;
  }
  
  if (subSubcategoryRecord) {
    metadata.subSubcategory = subSubcategoryRecord.name;
    metadata.subSubcategoryId = subSubcategoryRecord.id;
  } else if (payload.subSubcategory || payload.subSubcategoryId) {
    metadata.subSubcategory = payload.subSubcategory || null;
    metadata.subSubcategoryId = payload.subSubcategoryId || null;
  }

  // Merge details (payload.details may be stringified JSON from client)
  type DetailsObject = {
    [key: string]: unknown;
  };
  let detailsObj: DetailsObject = {};
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
  const usedFieldIds: number[] = [];
  const dynamicFields: Record<string, { field_id: number; value: unknown }> = {};

  if (subcategoryRecord?.id && detailsObj) {
    // Fetch current active fields to map slugs to IDs
    const { category_fields } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

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

  // Edge case: Validate metadata size (PostgreSQL JSONB limit is ~1GB, but we'll enforce a reasonable limit)
  // This prevents extremely large metadata from causing performance issues
  const METADATA_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB limit
  try {
    const metadataJson = JSON.stringify(metadata);
    const metadataSize = Buffer.byteLength(metadataJson, 'utf8');
    if (metadataSize > METADATA_SIZE_LIMIT) {
      const { logCriticalError } = await import("@/lib/monitoring/alerts");
      logCriticalError(
        "Ticket metadata exceeds size limit",
        new Error(`Metadata size ${metadataSize} bytes exceeds limit of ${METADATA_SIZE_LIMIT} bytes`),
        { categoryId: categoryRecord.id, metadataSize, limit: METADATA_SIZE_LIMIT }
      );
      throw new Error("Ticket data is too large. Please reduce the number of images or details and try again.");
    }
  } catch (sizeCheckError) {
    // If JSON.stringify fails, metadata is invalid
    if (sizeCheckError instanceof Error && sizeCheckError.message.includes("too large")) {
      throw sizeCheckError;
    }
    // Otherwise, it's a serialization error - log and throw
    console.error("[createTicket] Error validating metadata size:", sizeCheckError);
    throw new Error("Invalid ticket data format. Please try again.");
  }

  // Determine assignment (SPOC or super admin)
  // Pre-fetch super admin user ID in parallel with SPOC lookup for faster fallback
  let assignedUserId: string | null = null;
  const { findSuperAdminClerkId } = await import("@/lib/db-helpers");
  
  // Start fetching super admin in parallel (we'll need it either way)
  const superAdminPromise = findSuperAdminClerkId().then(async (superClerk) => {
    if (superClerk) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.external_id, superClerk)).limit(1);
      return u?.id || null;
    }
    return null;
  });

  if (categoryRecord.name === "Committee" || categoryRecord.name === "Others") {
    // Use super admin directly
    assignedUserId = await superAdminPromise;
  } else {
    // find SPOC via helper (uses the full assignment hierarchy)
    const { findSPOCForTicket } = await import("@/lib/assignment/spoc-assignment");
    // Safety check: ensure detailsObj is valid before calling Object.keys
    const fieldSlugs = detailsObj && typeof detailsObj === 'object' && !Array.isArray(detailsObj)
      ? Object.keys(detailsObj)
      : [];
    
    // Run SPOC lookup and super admin lookup in parallel
    const [clerkAssigned, superAdminId] = await Promise.all([
      findSPOCForTicket(
        categoryRecord.name,
        payload.location || null,
        categoryRecord.id,
        (typeof metadata.subcategoryId === 'number' ? metadata.subcategoryId : null),
        fieldSlugs
      ),
      superAdminPromise,
    ]);
    
    if (clerkAssigned) {
      // map clerkId to local users.id
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.external_id, clerkAssigned)).limit(1);
      if (u) {
        assignedUserId = u.id;
      }
    }
    
    // Fallback: If no assignment found, assign to superadmin
    if (!assignedUserId && superAdminId) {
      assignedUserId = superAdminId;
      console.log(`[createTicket] No assignment found, defaulting to superadmin for ticket in category: ${categoryRecord.name}`);
    }
  }

  // Final fallback if still no assignment
    if (!assignedUserId) {
      assignedUserId = await superAdminPromise;
      if (!assignedUserId) {
        const { logCriticalError } = await import("@/lib/monitoring/alerts");
        logCriticalError(
          "No super admin found during ticket creation",
          new Error("System has no super admin - tickets cannot be assigned"),
          { category: categoryRecord.name, categoryId: categoryRecord.id }
        );
        // Ticket will be created without assignment - this should be monitored and alerted
      }
    }

  // Sanitize description
  const safeDescription = sanitizeText(payload.description || null);
  
  // Edge case: Validate description length (enforce at DB level, not just client)
  const DESCRIPTION_MAX_LENGTH = 20000; // Match validation schema
  if (safeDescription && safeDescription.length > DESCRIPTION_MAX_LENGTH) {
    throw new Error(`Description exceeds maximum length of ${DESCRIPTION_MAX_LENGTH} characters. Please shorten your description.`);
  }

  // Get status_id for OPEN status
  let statusId = await getStatusIdByValue(TICKET_STATUS.OPEN);
    if (!statusId) {
      // CRITICAL: Status not found - this should never happen in production
      // Log error and try to find any active status as fallback
      const { logCriticalError } = await import("@/lib/monitoring/alerts");
      logCriticalError(
        "OPEN status not found in database",
        new Error(`Status "${TICKET_STATUS.OPEN}" not found in ticket_statuses table`),
        { category: categoryRecord.name, categoryId: categoryRecord.id }
      );
      
      const { ticket_statuses } = await import("@/db/schema");
      const [fallbackStatus] = await db
        .select({ id: ticket_statuses.id })
        .from(ticket_statuses)
        .where(eq(ticket_statuses.is_active, true))
        .limit(1);
      if (!fallbackStatus) {
        throw new Error(`No active ticket status found in database. System configuration error.`);
      }
      console.warn(`[createTicket] Using fallback status ID ${fallbackStatus.id} instead of "${TICKET_STATUS.OPEN}"`);
      statusId = fallbackStatus.id; // Use fallback status but this should be investigated
    }

  // Process attachments from images array
  // Edge case: Validate image URLs are valid before storing
  let attachments: Array<{ url: string; type: string }> | null = null;
  if (payload.images && payload.images.length > 0) {
    // Validate each image URL is a valid string and looks like a URL
    const validImageUrls = payload.images.filter((url): url is string => {
      if (typeof url !== 'string' || url.trim().length === 0) {
        console.warn(`[createTicket] Invalid image URL skipped: ${url}`);
        return false;
      }
      // Basic URL validation (starts with http/https or is a Cloudinary URL)
      const trimmedUrl = url.trim();
      if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('cloudinary://')) {
        return true;
      }
      console.warn(`[createTicket] Image URL doesn't look valid: ${trimmedUrl}`);
      return false;
    });

    if (validImageUrls.length !== payload.images.length) {
      console.warn(`[createTicket] Some image URLs were invalid. Valid: ${validImageUrls.length}, Total: ${payload.images.length}`);
    }

    if (validImageUrls.length > 0) {
      attachments = validImageUrls.map(url => ({
        url: url.trim(),
        type: 'image'
      }));
    }
  }

  // Use a DB transaction to ensure ticket + outbox + profile updates consistency
  // Wrap in try-catch to handle transaction errors gracefully
  let result;
  try {
    result = await db.transaction(async (tx) => {
    // Edge case: Re-validate category exists and is active right before transaction
    // This prevents race condition where category is deleted between form submission and ticket creation
    const [revalidatedCategory] = await tx
      .select({ id: categories.id, name: categories.name, is_active: categories.is_active })
      .from(categories)
      .where(eq(categories.id, categoryRecord.id))
      .limit(1);
    
    if (!revalidatedCategory) {
      throw new Error("Category was deleted. Please refresh the page and select a different category.");
    }
    
    if (!revalidatedCategory.is_active) {
      throw new Error("Category was deactivated. Please refresh the page and select a different category.");
    }
    
    // Edge case: Re-validate subcategory if provided
    if (subcategoryRecord) {
      const [revalidatedSubcategory] = await tx
        .select({ id: subcategories.id, is_active: subcategories.is_active })
        .from(subcategories)
        .where(and(
          eq(subcategories.id, subcategoryRecord.id),
          eq(subcategories.category_id, categoryRecord.id)
        ))
        .limit(1);
      
      if (!revalidatedSubcategory) {
        throw new Error("Subcategory was deleted. Please refresh the page and select a different subcategory.");
      }
      
      if (!revalidatedSubcategory.is_active) {
        throw new Error("Subcategory was deactivated. Please refresh the page and select a different subcategory.");
      }
    }
    
    // Edge case: Re-validate sub-subcategory if provided
    if (subSubcategoryRecord && subcategoryRecord) {
      const [revalidatedSubSubcategory] = await tx
        .select({ id: sub_subcategories.id, is_active: sub_subcategories.is_active })
        .from(sub_subcategories)
        .where(and(
          eq(sub_subcategories.id, subSubcategoryRecord.id),
          eq(sub_subcategories.subcategory_id, subcategoryRecord.id)
        ))
        .limit(1);
      
      if (!revalidatedSubSubcategory) {
        throw new Error("Sub-subcategory was deleted. Please refresh the page and select a different sub-subcategory.");
      }
      
      if (!revalidatedSubSubcategory.is_active) {
        throw new Error("Sub-subcategory was deactivated. Please refresh the page and select a different sub-subcategory.");
      }
    }
    
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

    const insertValues = {
      created_by: dbUser.id,
      category_id: categoryRecord.id,
      status_id: statusId,
      description: safeDescription,
      location: payload.location || null,
      metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) && Object.keys(metadata).length > 0 ? metadata : null,
      attachments: attachments,
      ...(subcategoryRecord?.id ? { subcategory_id: subcategoryRecord.id } : {}),
      ...(subSubcategoryRecord?.id ? { sub_subcategory_id: subSubcategoryRecord.id } : {}),
      ...(assignedUserId ? { assigned_to: assignedUserId } : {}),
    };

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

      console.log(`[createTicket] ✅ Created ticket #${newTicket.id} and outbox event for notifications`);
      return newTicket;
    });
  } catch (transactionError) {
    // Handle transaction errors (deadlocks, timeouts, constraint violations)
    console.error(`[createTicket] Transaction failed:`, transactionError);
    
    // Check for specific error types
    if (transactionError instanceof Error) {
      // Deadlock or timeout - could retry, but for now just throw
      if (transactionError.message.includes('deadlock') || transactionError.message.includes('timeout')) {
        throw new Error("Database operation timed out. Please try again.");
      }
      // Foreign key violation - data integrity issue
      if (transactionError.message.includes('foreign key') || 'code' in transactionError && transactionError.code === '23503') {
        throw new Error("Invalid reference. One of the selected categories or admins no longer exists.");
      }
      // Unique constraint violation - duplicate
      if (transactionError.message.includes('unique') || 'code' in transactionError && transactionError.code === '23505') {
        throw new Error("A ticket with this information already exists. Please check and try again.");
      }
    }
    
    // Re-throw with original error for logging
    throw transactionError;
  }

  if (!result) {
    throw new Error("Ticket creation failed - no result returned from transaction");
  }

  console.log(`[createTicket] ✅ Transaction completed for ticket #${result.id}`);
  return result;
}
