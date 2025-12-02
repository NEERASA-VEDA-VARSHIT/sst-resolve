/**
 * Server-side helper to fetch full ticket data for committee members
 * Similar to getFullTicketData but doesn't check ownership (access is checked separately)
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

export async function getCommitteeTicketData(ticketId: number) {
  try {
    // Validate inputs
    if (!ticketId) {
      console.error('[getCommitteeTicketData] Invalid ticketId:', ticketId);
      return null;
    }

    // 1. Fetch ticket with creator and student info in ONE query
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

    if (!ticketData) {
      return null;
    }

    // Build status display
    let statusDisplay: { value: string; label: string; badge_color: string } | null = null;
    if (ticketData.ticket_status) {
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
      statusDisplay = {
        value: "open",
        label: "Open",
        badge_color: "default",
      };
    }

    // Parse metadata
    let metadata: Record<string, unknown> = {};
    try {
      metadata = (ticketData.ticket_metadata && typeof ticketData.ticket_metadata === 'object' && !Array.isArray(ticketData.ticket_metadata)) 
        ? (ticketData.ticket_metadata as Record<string, unknown>) 
        : {};
    } catch (error) {
      console.error('[getCommitteeTicketData] Error parsing metadata:', error);
    }

    // 2-5. Fetch category-related data in parallel
    const subcategoryId = typeof metadata?.subcategoryId === 'number' ? metadata.subcategoryId : null;
    const subSubcategoryId = typeof metadata?.subSubcategoryId === 'number' ? metadata.subSubcategoryId : null;
    
    const [
      category,
      categorySchema,
      profileFields,
      subcategory,
      subSubcategory
    ] = await Promise.all([
      ticketData.ticket_category_id
        ? getCategoryById(ticketData.ticket_category_id)
        : Promise.resolve(null),
      ticketData.ticket_category_id
        ? getCategorySchema(ticketData.ticket_category_id)
        : Promise.resolve(null),
      ticketData.ticket_category_id
        ? getCategoryProfileFields(ticketData.ticket_category_id)
        : Promise.resolve([]),
      (subcategoryId && ticketData.ticket_category_id)
        ? getSubcategoryById(subcategoryId, ticketData.ticket_category_id)
        : Promise.resolve(null),
      (subSubcategoryId && subcategoryId)
        ? getSubSubcategoryById(subSubcategoryId, subcategoryId)
        : Promise.resolve(null),
    ]);

    // 6-7. Fetch assigned staff and SPOC info
    const [assignedStaffResult, spocResult] = await Promise.all([
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

    // 8. Extract dynamic fields
    const dynamicFields = categorySchema && typeof categorySchema === 'object' && !Array.isArray(categorySchema)
      ? extractDynamicFields(metadata, categorySchema as Record<string, unknown>)
      : [];

    // 9. Extract comments
    const comments = Array.isArray(metadata?.comments) ? metadata.comments : [];

    // Build ticket object
    const ticket = {
      id: ticketData.ticket_id,
      description: ticketData.ticket_description,
      location: ticketData.ticket_location,
      created_by: ticketData.ticket_created_by,
      assigned_to: ticketData.ticket_assigned_to,
      escalation_level: ticketData.ticket_escalation_level,
      resolution_due_at: ticketData.ticket_due_at,
      acknowledgement_due_at: ticketData.ticket_acknowledgement_due_at,
      created_at: ticketData.ticket_created_at,
      updated_at: ticketData.ticket_updated_at,
      metadata,
      status: statusDisplay,
      rating: (metadata.rating as number | null) || null,
    };

    const creator = ticketData.user_full_name || ticketData.user_email
      ? {
          name: ticketData.user_full_name || ticketData.user_email || "Unknown",
          email: ticketData.user_email || null,
        }
      : null;

    const student = ticketData.student_roll_no
      ? {
          roll_no: ticketData.student_roll_no,
          hostel_id: ticketData.student_hostel_id,
          hostel_name: ticketData.student_hostel_name,
          room_no: ticketData.student_room_no,
        }
      : null;

    return {
      ticket,
      category,
      subcategory,
      subSubcategory,
      creator,
      student,
      assignedStaff,
      spoc,
      profileFields,
      dynamicFields,
      comments,
    };
  } catch (error) {
    console.error('[getCommitteeTicketData] Error:', error);
    return null;
  }
}
