/**
 * ============================================
 * /api/tickets/[id]/full
 * ============================================
 * 
 * GET → Get Fully Hydrated Ticket
 *   - Auth: Required
 *   - Returns complete ticket with all related data in ONE response
 *   - Optimized to reduce DB queries (from 17+ to ~5-7 queries)
 *   - Includes:
 *     • Ticket details
 *     • Creator (student) info with profile fields
 *     • Assigned staff info
 *     • Category/subcategory names
 *     • All comments with author details
 *     • Activity timeline
 *     • Committee tags
 *   - Use Case: Ticket detail pages requiring all data at once
 *   - Returns: 200 OK with fully hydrated ticket object
 * ============================================
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  tickets,
  users,
  students,
  ticket_statuses,
  categories,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import {
  getCategorySchema,
  getSubcategoryById,
  getCategoryById,
  getCategoryProfileFields
} from "@/lib/category/categories";
import { extractDynamicFields } from "@/lib/ticket/formatting/formatDynamicFields";

export async function GET(
  _request: unknown,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const ticketId = Number(id);

    if (!Number.isFinite(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    // Get user_id from database
    const dbUser = await getOrCreateUser(userId);
    if (!dbUser) {
      return NextResponse.json({ error: "User account not found" }, { status: 404 });
    }

    // 1. Fetch ticket with creator and student info in ONE query
    const [ticketData] = await db
      .select({
        // Ticket fields
        ticket_id: tickets.id,
        ticket_status_id: tickets.status_id,
        ticket_status: ticket_statuses.value,
        ticket_description: tickets.description,
        ticket_location: tickets.location,
        ticket_created_by: tickets.created_by,
        ticket_category_id: tickets.category_id,
        ticket_assigned_to: tickets.assigned_to,
        ticket_metadata: tickets.metadata,
        ticket_escalation_level: tickets.escalation_level,
        ticket_created_at: tickets.created_at,
        ticket_updated_at: tickets.updated_at,
        ticket_due_at: tickets.resolution_due_at,
        // User fields
        user_full_name: users.full_name,
        user_email: users.email,
        // Student fields
        student_hostel_id: students.hostel_id,
        student_room_no: students.room_no,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .leftJoin(users, eq(users.id, tickets.created_by))
      .leftJoin(students, eq(students.user_id, tickets.created_by))
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticketData) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Ensure user owns this ticket
    if (ticketData.ticket_created_by !== dbUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    type TicketMetadata = {
      comments?: Array<{ [key: string]: unknown }>;
      [key: string]: unknown;
    };
    const metadata = (ticketData.ticket_metadata as TicketMetadata) || {};

    // 2. Fetch category with SLA info
    const category = ticketData.ticket_category_id
      ? await getCategoryById(ticketData.ticket_category_id)
      : null;

    // 3. Fetch category schema (cached, optimized)
    const categorySchema = ticketData.ticket_category_id
      ? await getCategorySchema(ticketData.ticket_category_id)
      : null;

    // 4. Derive subcategory and sub-subcategory from IDs (authoritative)
    let subcategory = null;
    const subcategoryId = typeof metadata?.subcategoryId === 'number' ? metadata.subcategoryId : null;
    
    if (subcategoryId && ticketData.ticket_category_id) {
      subcategory = await getSubcategoryById(
        subcategoryId,
        ticketData.ticket_category_id
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
          user_full_name: users.full_name,
          user_email: users.email,
        })
        .from(users)
        .where(eq(users.id, ticketData.ticket_assigned_to))
        .limit(1);

      if (staffData) {
        const staffName = staffData.user_full_name?.trim() || "Unknown";
        assignedStaff = {
          name: staffName,
          email: staffData.user_email || null,
        };
      }
    }

    // 7. Fetch SPOC info (if exists)
    let spoc = null;
    if (ticketData.ticket_category_id) {
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

          if (spocData) {
            const spocName = spocData.user_full_name?.trim() || "Unknown";
            spoc = {
              name: spocName,
              email: spocData.user_email || null,
            };
          }
        }
      } catch (error) {
        console.warn("SPOC lookup failed:", error);
      }
    }

    // 8. Extract dynamic fields using helper
    const dynamicFields = categorySchema && typeof categorySchema === 'object' && !Array.isArray(categorySchema)
      ? extractDynamicFields(metadata, categorySchema as Record<string, unknown>)
      : [];

    // 9. Extract resolved_at, acknowledged_at from metadata
    const resolvedAt = metadata.resolved_at ? new Date(metadata.resolved_at as string) : null;
    const acknowledgedAt = metadata.acknowledged_at ? new Date(metadata.acknowledged_at as string) : null;

    // Extract comments
    type Comment = { isInternal?: boolean; type?: string };
    const comments = Array.isArray(metadata?.comments) ? metadata.comments : [];
    const visibleComments = comments.filter(
      (c: Comment) => !c?.isInternal && c?.type !== "super_admin_note"
    );

    // 10. Build timeline
    const timeline = [
      {
        title: "Created",
        date: ticketData.ticket_created_at,
        color: "bg-primary/10",
        textColor: "text-primary",
        icon: "Calendar",
      },
      acknowledgedAt && {
        title: "Acknowledged",
        date: acknowledgedAt,
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
      resolvedAt && {
        title: "Resolved",
        date: resolvedAt,
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
    const response = {
      ticket: {
        id: ticketData.ticket_id,
        status: ticketData.ticket_status,
        description: ticketData.ticket_description,
        location: ticketData.ticket_location,
        created_by: ticketData.ticket_created_by,
        category_id: ticketData.ticket_category_id,
        assigned_to: ticketData.ticket_assigned_to,
        metadata: ticketData.ticket_metadata,
        escalation_level: ticketData.ticket_escalation_level,
        created_at: ticketData.ticket_created_at,
        updated_at: ticketData.ticket_updated_at,
        resolved_at: resolvedAt,
        due_at: ticketData.ticket_due_at,
        acknowledged_at: acknowledgedAt,
        rating: metadata.rating as number | null || null,
        feedback: metadata.feedback as string | null || null,
        tat_extended_count: (metadata.tatExtensions as unknown[])?.length || 0,
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
      creator: {
        name: ticketData.user_full_name?.trim() || null,
        email: ticketData.user_email,
      },
      student: {
        hostel_id: ticketData.student_hostel_id,
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

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching full ticket data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
