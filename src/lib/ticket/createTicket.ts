// lib/tickets/createTicket.ts
import { db, tickets, users, outbox, categories, subcategories, sub_subcategories } from "@/db";
import { eq, and } from "drizzle-orm";
import { TicketCreateInput } from "@/lib/validation/ticket";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
// findSPOCForTicket is imported dynamically from spoc-assignment.ts
import { TICKET_STATUS } from "@/conf/constants";
import { findSuperAdminClerkId } from "@/lib/db-helpers";
import { getCachedTicketStatuses } from "@/lib/cache/cached-queries";

const SUPER_ADMIN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cachedSuperAdmin: { value: string | null; expiresAt: number } | null = null;
let inflightSuperAdminPromise: Promise<string | null> | null = null;

async function getCachedStatusId(statusValue: string): Promise<number | null> {
  // Use cached ticket statuses for better performance (request-scoped deduplication)
  const ticketStatuses = await getCachedTicketStatuses();
  const status = ticketStatuses.find(s => s.value.toLowerCase() === statusValue.toLowerCase());
  return status?.id || null;
}

async function getCachedSuperAdminUserId(): Promise<string | null> {
  const now = Date.now();
  if (cachedSuperAdmin && cachedSuperAdmin.expiresAt > now) {
    return cachedSuperAdmin.value;
  }

  if (inflightSuperAdminPromise) {
    return inflightSuperAdminPromise;
  }

  inflightSuperAdminPromise = (async () => {
    try {
      const superClerkId = await findSuperAdminClerkId();
      let localUserId: string | null = null;

      if (superClerkId) {
        const [u] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.external_id, superClerkId))
          .limit(1);
        localUserId = u?.id ?? null;
      }

      cachedSuperAdmin = {
        value: localUserId,
        expiresAt: Date.now() + SUPER_ADMIN_CACHE_TTL,
      };

      return localUserId;
    } catch (error) {
      console.error("[createTicket] Failed to resolve super admin user id:", error);
      cachedSuperAdmin = {
        value: null,
        expiresAt: Date.now() + 30_000, // retry soon if there was an error
      };
      return null;
    } finally {
      inflightSuperAdminPromise = null;
    }
  })();

  return inflightSuperAdminPromise;
}

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

  // Use cached functions for better performance (request-scoped deduplication)
  // Parallelize user lookup and role lookup for better performance
  const { getCachedUser } = await import("@/lib/cache/cached-queries");
  const [dbUser, role] = await Promise.all([
    getCachedUser(clerkId),
    getUserRoleFromDB(clerkId),
  ]);
  
  if (!dbUser) throw new Error("User not found in local DB after sync");
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

  // Resolve category with active check in single query (optimized)
  // If subcategoryId is provided, we can fetch both category and subcategory in parallel
  
  // Start category lookup (include default_admin_id to avoid redundant query later)
  const categoryPromise = payload.categoryId
    ? db
        .select({ 
          id: categories.id, 
          name: categories.name,
          is_active: categories.is_active,
          default_admin_id: categories.default_admin_id
        })
      .from(categories)
      .where(eq(categories.id, payload.categoryId))
        .limit(1)
        .then(([c]) => c)
    : payload.category
    ? db
        .select({ 
          id: categories.id, 
          name: categories.name,
          is_active: categories.is_active,
          default_admin_id: categories.default_admin_id
        })
      .from(categories)
      .where(eq(categories.name, payload.category))
        .limit(1)
        .then(([c]) => c)
    : Promise.resolve(undefined);

  // Start subcategory lookup early if we have subcategoryId (can run in parallel with category)
  const subcategoryPromise = payload.subcategoryId
    ? categoryPromise.then(async (cat) => {
        if (!cat || !payload.subcategoryId) return undefined;
        const [s] = await db
          .select({ id: subcategories.id, name: subcategories.name, is_active: subcategories.is_active })
          .from(subcategories)
          .where(and(eq(subcategories.id, payload.subcategoryId), eq(subcategories.category_id, cat.id)))
      .limit(1);
        if (s && s.is_active) {
          return { id: s.id, name: s.name };
        } else if (s && !s.is_active) {
          throw new Error("Subcategory is inactive and cannot be used for ticket creation");
        } else if (!s) {
          throw new Error("Subcategory not found or does not belong to the selected category");
        }
        return undefined;
      })
    : Promise.resolve(undefined);

  // Wait for category lookup
  const categoryRecord = await categoryPromise;
  if (!categoryRecord) {
    throw new Error("Category not found");
  }
  if (!categoryRecord.is_active) {
    throw new Error("Category is inactive and cannot be used for ticket creation");
  }

  // Wait for subcategory if it was started early, otherwise do sequential lookup
  let subcategoryRecord: { id: number; name: string } | undefined;
  if (payload.subcategoryId) {
    subcategoryRecord = await subcategoryPromise;
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
    } else if (!s) {
      throw new Error("Subcategory not found or does not belong to the selected category");
    }
  }

  // Sub-subcategory resolution (optional) - depends on subcategoryRecord
  // Start this lookup early to parallelize with field lookup
  const subSubcategoryPromise = subcategoryPromise.then(async (subcat) => {
    if (!subcat) return undefined;
    
    if (payload.subSubcategoryId) {
    const [ss] = await db
      .select({ id: sub_subcategories.id, name: sub_subcategories.name, is_active: sub_subcategories.is_active })
      .from(sub_subcategories)
        .where(and(eq(sub_subcategories.id, payload.subSubcategoryId), eq(sub_subcategories.subcategory_id, subcat.id)))
      .limit(1);
    if (ss && ss.is_active) {
        return { id: ss.id, name: ss.name };
    } else if (ss && !ss.is_active) {
      throw new Error("Sub-subcategory is inactive and cannot be used for ticket creation");
      } else if (!ss) {
      throw new Error("Sub-subcategory not found or does not belong to the selected subcategory");
    }
    } else if (payload.subSubcategory) {
    const [ss] = await db
      .select({ id: sub_subcategories.id, name: sub_subcategories.name, is_active: sub_subcategories.is_active })
      .from(sub_subcategories)
        .where(and(eq(sub_subcategories.name, payload.subSubcategory), eq(sub_subcategories.subcategory_id, subcat.id)))
      .limit(1);
    if (ss && ss.is_active) {
        return { id: ss.id, name: ss.name };
    } else if (ss && !ss.is_active) {
      throw new Error("Sub-subcategory is inactive and cannot be used for ticket creation");
      } else if (!ss) {
      throw new Error("Sub-subcategory not found or does not belong to the selected subcategory");
    }
  }
    return undefined;
  });

  // Merge details (payload.details may be stringified JSON from client)
  // Parse this early so fieldLookupPromise can use it
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
  // Start field lookup early to parallelize with sub-subcategory lookup
  const usedFieldIds: number[] = [];
  const dynamicFields: Record<string, { field_id: number; value: unknown }> = {};

  // Start field lookup promise early (will be awaited later if needed)
  // This can run in parallel with sub-subcategory lookup since they're independent
  const fieldLookupPromise = (async () => {
    // Wait for subcategory to be resolved first
    const subcat = await subcategoryPromise;
    if (subcat?.id && detailsObj) {
    // Fetch current active fields to map slugs to IDs
    const { category_fields } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const activeFields = await db
      .select({ id: category_fields.id, slug: category_fields.slug })
      .from(category_fields)
        .where(eq(category_fields.subcategory_id, subcat.id));

    const fieldMap = new Map(activeFields.map(f => [f.slug, f.id]));

    // Store field IDs with their values (optimized: only store non-empty values)
    // Safety check: ensure detailsObj is an object before calling Object.entries
    if (detailsObj && typeof detailsObj === 'object' && !Array.isArray(detailsObj)) {
      for (const [slug, value] of Object.entries(detailsObj)) {
        const fieldId = fieldMap.get(slug);
        // Only store fields with actual values (skip empty strings, null, undefined, empty arrays)
        if (fieldId && value !== null && value !== undefined && value !== '') {
          // Skip empty arrays and objects
          if (Array.isArray(value) && value.length === 0) continue;
          if (typeof value === 'object' && Object.keys(value).length === 0) continue;
          
          usedFieldIds.push(fieldId);
          dynamicFields[slug] = { field_id: fieldId, value };
        }
      }
    }
  }
  })();
  
  // Wait for subcategory, sub-subcategory, and field lookups in parallel
  const [finalSubcategory, finalSubSubcategory] = await Promise.all([
    subcategoryPromise,
    subSubcategoryPromise,
    fieldLookupPromise, // Field lookup runs in parallel
  ]);
  
  // Update records if we got them from promises
  if (finalSubcategory) {
    subcategoryRecord = finalSubcategory;
  }
  const subSubcategoryRecord = finalSubSubcategory;

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

  // Merge with detailsObj and add dynamic fields
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
  // Validate synchronously (fast operation, no need to parallelize)
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

  // Determine assignment (SPOC or super admin) - optimized parallel lookups
  // Run metadata size check, status lookup, and assignment logic in parallel
  let assignedUserId: string | null = null;
  
  // Get status_id for OPEN status (start early to parallelize with other operations)
  const statusIdPromise = (async () => {
    const cachedStatusId = await getCachedStatusId(TICKET_STATUS.OPEN);
    if (typeof cachedStatusId === "number") {
      return cachedStatusId;
    }

    // CRITICAL: Status not found - this should never happen in production
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
    return fallbackStatus.id;
  })();
  
  // Start fetching super admin early (we'll need it either way)
  const superAdminPromise = getCachedSuperAdminUserId();

  // Run assignment logic in parallel with status lookup
  const [statusId, assignmentResult] = await Promise.all([
    statusIdPromise,
    (async () => {
  if (categoryRecord.name === "Committee" || categoryRecord.name === "Others") {
    // Use super admin directly
        return await superAdminPromise;
  } else {
    // find SPOC via helper (uses the full assignment hierarchy)
    // Pass category default_admin_id to avoid redundant query in SPOC assignment
    const { findSPOCForTicket } = await import("@/lib/assignment/spoc-assignment");
    // Safety check: ensure detailsObj is valid before calling Object.keys
    const fieldSlugs = detailsObj && typeof detailsObj === 'object' && !Array.isArray(detailsObj)
      ? Object.keys(detailsObj)
      : [];
    
    // Run SPOC lookup and super admin lookup in parallel
    // Pass category default_admin_id from categoryRecord to avoid redundant query
    const [clerkAssigned, superAdminId] = await Promise.all([
      findSPOCForTicket(
        categoryRecord.name,
        payload.location || null,
        categoryRecord.id,
        (typeof metadata.subcategoryId === 'number' ? metadata.subcategoryId : null),
        fieldSlugs,
        categoryRecord.default_admin_id || null // Pass to avoid redundant query
      ),
      superAdminPromise,
    ]);
    
    if (clerkAssigned) {
      // map clerkId to local users.id
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.external_id, clerkAssigned)).limit(1);
      if (u) {
            return u.id;
      }
    }
    
    // Fallback: If no assignment found, assign to superadmin
        if (superAdminId) {
      console.log(`[createTicket] No assignment found, defaulting to superadmin for ticket in category: ${categoryRecord.name}`);
          return superAdminId;
    }
        return null;
  }
    })()
  ]);

  assignedUserId = assignmentResult;

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
    // Optimized: Re-validate category hierarchy in parallel (single query per level)
    // This prevents race condition where category is deleted between form submission and ticket creation
    // Note: We already validated these earlier, but this is a final safety check inside the transaction
    const validationPromises: Promise<unknown>[] = [
      tx
      .select({ id: categories.id, is_active: categories.is_active })
      .from(categories)
      .where(eq(categories.id, categoryRecord.id))
        .limit(1)
        .then(([c]) => {
          if (!c) throw new Error("Category was deleted. Please refresh the page and select a different category.");
          if (!c.is_active) throw new Error("Category was deactivated. Please refresh the page and select a different category.");
          return c;
        })
    ];

    if (subcategoryRecord) {
      validationPromises.push(
        tx
        .select({ id: subcategories.id, is_active: subcategories.is_active })
        .from(subcategories)
        .where(and(
          eq(subcategories.id, subcategoryRecord.id),
          eq(subcategories.category_id, categoryRecord.id)
        ))
          .limit(1)
          .then(([s]) => {
            if (!s) throw new Error("Subcategory was deleted. Please refresh the page and select a different subcategory.");
            if (!s.is_active) throw new Error("Subcategory was deactivated. Please refresh the page and select a different subcategory.");
            return s;
          })
      );
    }

    if (subSubcategoryRecord && subcategoryRecord) {
      validationPromises.push(
        tx
        .select({ id: sub_subcategories.id, is_active: sub_subcategories.is_active })
        .from(sub_subcategories)
        .where(and(
          eq(sub_subcategories.id, subSubcategoryRecord.id),
          eq(sub_subcategories.subcategory_id, subcategoryRecord.id)
        ))
          .limit(1)
          .then(([ss]) => {
            if (!ss) throw new Error("Sub-subcategory was deleted. Please refresh the page and select a different sub-subcategory.");
            if (!ss.is_active) throw new Error("Sub-subcategory was deactivated. Please refresh the page and select a different sub-subcategory.");
            return ss;
          })
      );
    }

    // Execute all validations in parallel (optimized: only select needed fields)
    await Promise.all(validationPromises);
    
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
