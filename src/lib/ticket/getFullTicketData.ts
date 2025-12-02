/**
 * Server-side helper to fetch full ticket data
 * Used by server components to avoid HTTP overhead
 */

import { db } from "@/db";
import { users, categories } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  getCategorySchema,
  getSubcategoryById,
  getSubSubcategoryById,
  getCategoryById,
  getCategoryProfileFields
} from "@/lib/category/categories";
import { extractDynamicFields } from "@/lib/ticket/formatDynamicFields";

export async function getFullTicketData(ticketId: number, userId: string) {
  let debugStep = "start";
  try {
    // Validate inputs
    debugStep = "validate-inputs";
    if (!ticketId || !userId) {
      console.error('[getFullTicketData] Invalid inputs:', { ticketId, userId });
      return null;
    }

    // 1. Fetch ticket with creator and student info in ONE query
    debugStep = "fetch-ticket";
    const ticketRows = await db.execute(sql`
      SELECT
        t.id AS ticket_id,
        ts.value AS ticket_status,
        t.description AS ticket_description,
        t.location AS ticket_location,
        t.created_by AS ticket_created_by,
        t.category_id AS ticket_category_id,
        t.assigned_to AS ticket_assigned_to,
        t.metadata AS ticket_metadata,
        t.escalation_level AS ticket_escalation_level,
        t.created_at AS ticket_created_at,
        t.updated_at AS ticket_updated_at,
        t.resolution_due_at AS ticket_due_at,
        t.acknowledgement_due_at AS ticket_acknowledgement_due_at,
        u.full_name AS user_full_name,
        u.email AS user_email,
        s.roll_no AS student_roll_no,
        s.hostel_id AS student_hostel_id,
        h.name AS student_hostel_name,
        s.room_no AS student_room_no
      FROM tickets t
      LEFT JOIN ticket_statuses ts ON ts.id = t.status_id
      LEFT JOIN users u ON u.id = t.created_by
      LEFT JOIN students s ON s.user_id = t.created_by
      LEFT JOIN hostels h ON h.id = s.hostel_id
      WHERE t.id = ${ticketId}
      LIMIT 1
    `);
    const ticketData = ticketRows[0] as {
      ticket_id: number;
      ticket_status: string | null;
      ticket_description: string | null;
      ticket_location: string | null;
      ticket_created_by: string;
      ticket_category_id: number | null;
      ticket_assigned_to: string | null;
      ticket_metadata: unknown;
      ticket_escalation_level: number | null;
      ticket_created_at: Date | null;
      ticket_updated_at: Date | null;
      ticket_due_at: Date | null;
      ticket_acknowledgement_due_at: Date | null;
      user_full_name: string | null;
      user_email: string | null;
      student_roll_no: string | null;
      student_hostel_id: number | null;
      student_hostel_name: string | null;
      student_room_no: string | null;
    } | undefined;
    debugStep = "fetch-ticket:done";

    if (!ticketData) {
      return null;
    }

    // Build status display from constants
    let statusDisplay: { value: string; label: string; badge_color: string } | null = null;
    if (ticketData.ticket_status) {
      debugStep = "fetch-status-value";
      // Fetch status from database instead of using hardcoded constants
      const { getTicketStatusByValue } = await import("@/lib/status/getTicketStatuses");
      const statusValue = ticketData.ticket_status;
      if (statusValue) {
        const statusRecord = await getTicketStatusByValue(statusValue);
        if (statusRecord) {
          statusDisplay = {
            value: statusRecord.value.toLowerCase(),
            label: statusRecord.label || statusRecord.value,
            badge_color: statusRecord.badge_color || "default",
          };
        }
      }
    }

    if (!statusDisplay) {
      // Fallback if status not found in DB
      statusDisplay = {
        value: "open",
        label: "Open",
        badge_color: "default",
      };
    }

    // Ensure user owns this ticket
    if (ticketData.ticket_created_by !== userId) {
      return null;
    }

    // Parse metadata with error handling
    let metadata: Record<string, unknown> = {};
    try {
      metadata = (ticketData.ticket_metadata && typeof ticketData.ticket_metadata === 'object' && !Array.isArray(ticketData.ticket_metadata)) 
        ? (ticketData.ticket_metadata as Record<string, unknown>) 
        : {};
    } catch (error) {
      console.error('[getFullTicketData] Error parsing metadata:', error);
      // Continue with empty metadata
    }

    // 2-5. Fetch category-related data in parallel for performance
    const subcategoryId = typeof metadata?.subcategoryId === 'number' ? metadata.subcategoryId : null;
    const subSubcategoryId = typeof metadata?.subSubcategoryId === 'number' ? metadata.subSubcategoryId : null;
    
    debugStep = "fetch-related-data";
    const [
      category,
      categorySchema,
      profileFields,
      subcategory,
      subSubcategory
    ] = await Promise.all([
      // Fetch category with SLA info
      ticketData.ticket_category_id
        ? getCategoryById(ticketData.ticket_category_id)
        : Promise.resolve(null),
      // Fetch category schema (cached, optimized)
      ticketData.ticket_category_id
        ? getCategorySchema(ticketData.ticket_category_id)
        : Promise.resolve(null),
      // Fetch profile fields configuration
      ticketData.ticket_category_id
        ? getCategoryProfileFields(ticketData.ticket_category_id)
        : Promise.resolve([]),
      // Fetch subcategory if ID exists
      (subcategoryId && ticketData.ticket_category_id)
        ? getSubcategoryById(subcategoryId, ticketData.ticket_category_id)
        : Promise.resolve(null),
      // Fetch sub-subcategory if ID exists
      (subSubcategoryId && subcategoryId)
        ? getSubSubcategoryById(subSubcategoryId, subcategoryId)
        : Promise.resolve(null),
    ]);

    // 6-7. Fetch assigned staff and SPOC info in parallel
    debugStep = "fetch-staff-spoc";
    const [assignedStaffResult, spocResult] = await Promise.all([
      // Fetch assigned staff info (if assigned)
      ticketData.ticket_assigned_to
        ? db
            .select({
              user_full_name: users.full_name,
              user_email: users.email,
            })
            .from(users)
            .where(eq(users.id, ticketData.ticket_assigned_to))
            .limit(1)
        : Promise.resolve([]),
      // Fetch SPOC info (if category exists)
      ticketData.ticket_category_id
        ? (async () => {
            try {
              const [categoryData] = await db
                .select({ default_admin_id: categories.default_admin_id })
                .from(categories)
                .where(eq(categories.id, ticketData.ticket_category_id))
                .limit(1);

              if (categoryData?.default_admin_id) {
                const [spocData] = await db
                  .select({
                    user_full_name: users.full_name,
                    user_email: users.email,
                  })
                  .from(users)
                  .where(eq(users.id, categoryData.default_admin_id))
                  .limit(1);
                return spocData ? [spocData] : [];
              }
              return [];
            } catch (error) {
              console.warn("SPOC lookup failed:", error);
              return [];
            }
          })()
        : Promise.resolve([]),
    ]);

    const assignedStaff = assignedStaffResult.length > 0
      ? {
          name: assignedStaffResult[0].user_full_name || "Unknown",
          email: assignedStaffResult[0].user_email || null,
        }
      : null;

    const spoc = spocResult.length > 0
      ? {
          name: spocResult[0].user_full_name || "Unknown",
          email: spocResult[0].user_email || null,
        }
      : null;

    // 8. Extract dynamic fields using helper
    debugStep = "extract-dynamic-fields";
    const dynamicFields = categorySchema && typeof categorySchema === 'object' && !Array.isArray(categorySchema)
      ? extractDynamicFields(metadata, categorySchema as Record<string, unknown>)
      : [];

    // 9. Extract comments and normalize dates
    const comments = Array.isArray(metadata?.comments) ? metadata.comments : [];
    type Comment = {
      isInternal?: boolean;
      type?: string;
      [key: string]: unknown;
    };
    debugStep = "process-comments";
    const visibleComments = comments
      .filter((c: Comment) => !c?.isInternal && c?.type !== "super_admin_note")
      .map((c: Comment) => ({
        ...c,
        // Normalize created_at to Date object for consistent formatting
        created_at: c.created_at
          ? (c.created_at instanceof Date ? c.created_at : 
             typeof c.created_at === 'string' ? new Date(c.created_at) :
             typeof c.created_at === 'number' ? new Date(c.created_at) :
             new Date())
          : null,
      }));

    // 10. Build timeline
    debugStep = "build-timeline";
    const timeline = [
      {
        title: "Created",
        date: ticketData.ticket_created_at,
        color: "bg-primary/10",
        textColor: "text-primary",
        icon: "Calendar",
      },
      ticketData.ticket_acknowledgement_due_at && {
        title: "Acknowledged",
        date: ticketData.ticket_acknowledgement_due_at,
        color: "bg-green-100 dark:bg-green-900/30",
        textColor: "text-green-600 dark:text-green-400",
        icon: "CheckCircle2",
      },
      ticketData.ticket_updated_at && {
        title: "In Progress",
        date: ticketData.ticket_updated_at,
        color: "bg-blue-100 dark:bg-blue-900/30",
        textColor: "text-blue-600 dark:text-blue-400",
        icon: "Clock",
      },
      // Note: resolved_at doesn't exist in schema, using resolution_due_at as fallback
      ticketData.ticket_due_at && {
        title: "Resolved",
        date: ticketData.ticket_due_at,
        color: "bg-emerald-100 dark:bg-emerald-900/30",
        textColor: "text-emerald-600 dark:text-emerald-400",
        icon: "CheckCircle2",
      },
      (ticketData.ticket_escalation_level ?? 0) > 0 && {
        title: `Escalated (Level ${ticketData.ticket_escalation_level})`,
        date: ticketData.ticket_updated_at,
        color: "bg-red-100 dark:bg-red-900/30",
        textColor: "text-red-600 dark:text-red-400",
        icon: "AlertCircle",
      },
    ].filter(Boolean);

    // 11. Calculate SLA times
    const expectedAckTime = category?.sla_hours ? "1 hour" : null;
    const expectedResolutionTime = category?.sla_hours
      ? `${category.sla_hours} hours`
      : null;

    // Build the hydrated response
    debugStep = "build-response";
    return {
      ticket: {
        id: ticketData.ticket_id,
        status: statusDisplay,
        description: ticketData.ticket_description || null,
        location: ticketData.ticket_location || null,
        created_by: ticketData.ticket_created_by,
        category_id: ticketData.ticket_category_id || null,
        assigned_to: ticketData.ticket_assigned_to || null,
        metadata: (ticketData.ticket_metadata && typeof ticketData.ticket_metadata === 'object' && !Array.isArray(ticketData.ticket_metadata))
          ? ticketData.ticket_metadata
          : {},
        attachments: [], // Placeholder
        escalation_level: ticketData.ticket_escalation_level,
        created_at: ticketData.ticket_created_at,
        updated_at: ticketData.ticket_updated_at,
        resolved_at: null, // Field doesn't exist in schema
        reopened_at: null, // Field doesn't exist in schema
        due_at: ticketData.ticket_due_at,
        acknowledged_at: ticketData.ticket_acknowledgement_due_at ? new Date(ticketData.ticket_acknowledgement_due_at) : null,
        rating: null, // Field doesn't exist in schema
        feedback: null, // Field doesn't exist in schema
        tat_extended_count: null, // Field doesn't exist in schema
      },
      category: category ? {
        id: category.id,
        name: category.name,
        slug: category.slug,
        sla_hours: category.sla_hours,
      } : null,
      subcategory: subcategory ? {
        id: subcategory.id,
        name: subcategory.name,
        slug: subcategory.slug,
      } : null,
      subSubcategory: subSubcategory ? {
        id: subSubcategory.id,
        name: subSubcategory.name,
        slug: subSubcategory.slug,
      } : null,
      creator: {
        name: ticketData.user_full_name || null,
        email: ticketData.user_email || null,
      },
      student: {
        roll_no: ticketData.student_roll_no || null,
        hostel_id: ticketData.student_hostel_id || null,
        hostel_name: ticketData.student_hostel_name || null,
        room_no: ticketData.student_room_no || null,
      },
      assignedStaff: assignedStaff || null,
      spoc: spoc || null,
      profileFields: Array.isArray(profileFields) ? profileFields : [],
      dynamicFields: Array.isArray(dynamicFields) ? dynamicFields : [],
      comments: Array.isArray(visibleComments) ? visibleComments : [],
      timeline: Array.isArray(timeline) ? timeline : [],
      categorySchema: categorySchema || null,
      sla: {
        expectedAckTime,
        expectedResolutionTime,
      },
    };
  } catch (error) {
    console.error('[getFullTicketData] Error fetching ticket data (step:', debugStep, '):', error);
    if (error && typeof error === "object" && "stack" in error) {
      console.error("[getFullTicketData] stack:", (error as Error).stack);
    }
    return null;
  }
}
