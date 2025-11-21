/**
 * Server-side helper to fetch full ticket data
 * Used by server components to avoid HTTP overhead
 */

import { db } from "@/db";
import {
  tickets,
  users,
  students,
  categories,
  hostels,
  ticket_statuses
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  getCategorySchema,
  getSubcategoryById,
  getSubSubcategoryById,
  getCategoryById,
  getCategoryProfileFields
} from "@/lib/categories";
import { extractDynamicFields } from "@/lib/ticket/formatDynamicFields";

export async function getFullTicketData(ticketId: number, userId: string) {
  try {
    // Validate inputs
    if (!ticketId || !userId) {
      console.error('[getFullTicketData] Invalid inputs:', { ticketId, userId });
      return null;
    }

    // 1. Fetch ticket with creator and student info in ONE query
    const [ticketData] = await db
      .select({
        // Ticket fields
        ticket_id: tickets.id,
        ticket_status_value: ticket_statuses.value,
        ticket_status_label: ticket_statuses.label,
        ticket_status_badge_color: ticket_statuses.badge_color,
        ticket_description: tickets.description,
        ticket_location: tickets.location,
        ticket_created_by: tickets.created_by,
        ticket_category_id: tickets.category_id,
        ticket_assigned_to: tickets.assigned_to,
        ticket_metadata: tickets.metadata,
        // ticket_attachments: tickets.attachments, // Removed as it's not in schema
        ticket_escalation_level: tickets.escalation_level,
        ticket_created_at: tickets.created_at,
        ticket_updated_at: tickets.updated_at,
        ticket_resolved_at: tickets.resolved_at,
        ticket_due_at: tickets.resolution_due_at,
        ticket_acknowledged_at: tickets.acknowledged_at,
        ticket_rating: tickets.rating,
        ticket_feedback: tickets.feedback,
        ticket_tat_extended_count: tickets.tat_extended_count,
        // User fields
        user_first_name: users.first_name,
        user_last_name: users.last_name,
        user_email: users.email,
        // Student fields
        student_roll_no: students.roll_no,
        student_hostel_id: students.hostel_id,
        student_hostel_name: hostels.name,
        student_room_no: students.room_no,
      })
      .from(tickets)
      .leftJoin(users, eq(users.id, tickets.created_by))
      .leftJoin(students, eq(students.user_id, tickets.created_by))
      .leftJoin(hostels, eq(hostels.id, students.hostel_id))
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticketData) {
      return null;
    }

    // Ensure user owns this ticket
    if (ticketData.ticket_created_by !== userId) {
      return null;
    }

    // Parse metadata with error handling
    let metadata: any = {};
    try {
      metadata = (ticketData.ticket_metadata as any) || {};
    } catch (error) {
      console.error('[getFullTicketData] Error parsing metadata:', error);
      // Continue with empty metadata
    }

    // 2. Fetch category with SLA info
    const category = ticketData.ticket_category_id
      ? await getCategoryById(ticketData.ticket_category_id)
      : null;

    // 3. Fetch category schema (cached, optimized)
    const categorySchema = ticketData.ticket_category_id
      ? await getCategorySchema(ticketData.ticket_category_id)
      : null;

    // 4. Derive subcategory and sub-subcategory from IDs ONLY (authoritative)
    let subcategory = null;
    let subSubcategory = null;

    if (metadata?.subcategoryId && ticketData.ticket_category_id) {
      subcategory = await getSubcategoryById(
        metadata.subcategoryId,
        ticketData.ticket_category_id
      );
    }

    if (metadata?.subSubcategoryId && metadata?.subcategoryId) {
      subSubcategory = await getSubSubcategoryById(
        metadata.subSubcategoryId,
        metadata.subcategoryId
      );
    }

    // 5. Fetch profile fields configuration
    const profileFields = ticketData.ticket_category_id
      ? await getCategoryProfileFields(ticketData.ticket_category_id)
      : [];

    // 6. Fetch assigned staff info (if assigned)
    let assignedStaff = null;
    if (ticketData.ticket_assigned_to) {
      const [staffData] = await db
        .select({
          user_first_name: users.first_name,
          user_last_name: users.last_name,
          user_email: users.email,
        })
        .from(users)
        .where(eq(users.id, ticketData.ticket_assigned_to))
        .limit(1);

      if (staffData) {
        assignedStaff = {
          name: [staffData.user_first_name, staffData.user_last_name].filter(Boolean).join(' ').trim() || "Unknown",
          email: staffData.user_email || null,
        };
      }
    }

    // 7. Fetch SPOC info (if exists)
    let spoc = null;
    if (ticketData.ticket_category_id) {
      try {
        // Check if default_admin_id column exists (it should per schema)
        const [categoryData] = await db
          .select({ default_admin_id: categories.default_admin_id })
          .from(categories)
          .where(eq(categories.id, ticketData.ticket_category_id))
          .limit(1);

        if (categoryData?.default_admin_id) {
          const [spocData] = await db
            .select({
              user_first_name: users.first_name,
              user_last_name: users.last_name,
              user_email: users.email,
            })
            .from(users)
            .where(eq(users.id, categoryData.default_admin_id))
            .limit(1);

          if (spocData) {
            spoc = {
              name: [spocData.user_first_name, spocData.user_last_name].filter(Boolean).join(' ').trim() || "Unknown",
              email: spocData.user_email || null,
            };
          }
        }
      } catch (error) {
        console.warn("SPOC lookup failed:", error);
      }
    }

    // 8. Extract dynamic fields using helper
    const dynamicFields = extractDynamicFields(metadata, categorySchema);

    // 9. Extract comments and normalize dates
    const comments = Array.isArray(metadata?.comments) ? metadata.comments : [];
    type Comment = {
      isInternal?: boolean;
      type?: string;
      [key: string]: unknown;
    };
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
    const timeline = [
      {
        title: "Created",
        date: ticketData.ticket_created_at,
        color: "bg-primary/10",
        textColor: "text-primary",
        icon: "Calendar",
      },
      ticketData.ticket_acknowledged_at && {
        title: "Acknowledged",
        date: ticketData.ticket_acknowledged_at,
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
      ticketData.ticket_resolved_at && {
        title: "Resolved",
        date: ticketData.ticket_resolved_at,
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
    return {
      ticket: {
        id: ticketData.ticket_id,
        status: ticketData.ticket_status_value ? {
          value: ticketData.ticket_status_value,
          label: ticketData.ticket_status_label || ticketData.ticket_status_value,
          badge_color: ticketData.ticket_status_badge_color,
        } : null,
        description: ticketData.ticket_description,
        location: ticketData.ticket_location,
        created_by: ticketData.ticket_created_by,
        category_id: ticketData.ticket_category_id,
        assigned_to: ticketData.ticket_assigned_to,
        metadata: ticketData.ticket_metadata,
        attachments: [], // Placeholder
        escalation_level: ticketData.ticket_escalation_level,
        created_at: ticketData.ticket_created_at,
        updated_at: ticketData.ticket_updated_at,
        resolved_at: ticketData.ticket_resolved_at,
        due_at: ticketData.ticket_due_at,
        acknowledged_at: ticketData.ticket_acknowledged_at,
        rating: ticketData.ticket_rating,
        feedback: ticketData.ticket_feedback,
        tat_extended_count: ticketData.ticket_tat_extended_count,
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
        name: [ticketData.user_first_name, ticketData.user_last_name].filter(Boolean).join(' ').trim(),
        email: ticketData.user_email,
      },
      student: {
        roll_no: ticketData.student_roll_no,
        hostel_id: ticketData.student_hostel_id,
        hostel_name: ticketData.student_hostel_name,
        room_no: ticketData.student_room_no,
      },
      assignedStaff,
      spoc,
      profileFields,
      dynamicFields,
      comments: visibleComments,
      timeline,
      categorySchema,
      sla: {
        expectedAckTime,
        expectedResolutionTime,
      },
    };
  } catch (error) {
    console.error('[getFullTicketData] Error fetching ticket data:', error);
    return null;
  }
}
