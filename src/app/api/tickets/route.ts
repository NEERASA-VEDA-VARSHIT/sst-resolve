import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets, users, categories } from "@/db";
import { desc, eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { createTicket } from "@/lib/ticket/createTicket";

/**
 * ============================================
 * /api/tickets
 * ============================================
 * 
 * POST → Create Ticket
 *   - Auth: Required (Student, Admin, Committee)
 *   - Creates new support ticket
 *   - Returns: 201 Created with ticket object
 * 
 * GET → List Tickets (role-based)
 *   - Student: Their tickets only
 *   - Admin: Assigned tickets + unassigned
 *   - Super Admin: All tickets
 *   - Committee: Committee-category tickets
 *   - Returns: 200 OK with paginated list
 * ============================================
 */

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" }, 
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("[Ticket API] Failed to parse request body:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Use dynamic import to avoid circular dependency issues
    const { TicketCreateSchema } = await import("@/lib/validation/ticket");
    
    const parsed = TicketCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create ticket with specific error handling
    let ticket;
    try {
      ticket = await createTicket({
        clerkId: userId,
        payload: parsed.data,
      });
    } catch (createError) {
      console.error("[Ticket API] createTicket failed:", createError);
      const errorMessage = createError instanceof Error 
        ? createError.message 
        : typeof createError === 'string' 
          ? createError 
          : "Failed to create ticket";
      
      // Return appropriate status code based on error type
      const statusCode = errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")
        ? 403
        : errorMessage.includes("not found") || errorMessage.includes("Invalid")
        ? 400
        : 500;
      
      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      );
    }

    // Notifications are handled asynchronously by the cron job (/api/cron/process-outbox)
    // This ensures the API response is fast and non-blocking
    // The outbox event was created in the transaction, and the cron will process it

    // Return minimal ticket data for faster response
    // Full ticket details can be fetched from /api/tickets/[id] if needed
    return NextResponse.json({ 
      id: ticket.id,
      ticket: {
        id: ticket.id,
        status_id: ticket.status_id,
        category_id: ticket.category_id,
        created_at: ticket.created_at,
      }
    }, { 
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error("Ticket creation failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { error: errorMessage },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getUserRoleFromDB(userId);

    // Query params: ?page=&limit=
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 20);
    const offset = (page - 1) * limit;

    let results: typeof tickets.$inferSelect[] = [];

    //
    // -------------------------------
    // STUDENT → only their tickets
    // -------------------------------
    //
    if (role === "student") {
      const [userRow] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.external_id, userId))
        .limit(1);

      if (!userRow) return NextResponse.json([], { status: 200 });

      results = await db
        .select()
        .from(tickets)
        .where(eq(tickets.created_by, userRow.id))
        .orderBy(desc(tickets.created_at))
        .limit(limit)
        .offset(offset);
    }

    //
    // -------------------------------
    // ADMIN / SENIOR_ADMIN → assigned tickets
    // -------------------------------
    //
    else if (role === "admin") {
      const [userRow] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.external_id, userId))
        .limit(1);

      if (!userRow) {
        return NextResponse.json([], { status: 200 });
      }

      results = await db
        .select()
        .from(tickets)
        .where(eq(tickets.assigned_to, userRow.id))
        .orderBy(desc(tickets.created_at))
        .limit(limit)
        .offset(offset);
    }

    //
    // -------------------------------
    // COMMITTEE → ONLY "Committee" category tickets
    // -------------------------------
    //
    else if (role === "committee") {
      const [committeeCategory] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.name, "Committee"))
        .limit(1);

      if (!committeeCategory) {
        results = [];
      } else {
        results = await db
          .select()
          .from(tickets)
          .where(eq(tickets.category_id, committeeCategory.id))
          .orderBy(desc(tickets.created_at))
          .limit(limit)
          .offset(offset);
      }
    }

    //
    // -------------------------------
    // SUPER_ADMIN → all tickets
    // -------------------------------
    //
    else if (role === "super_admin") {
      results = await db
        .select()
        .from(tickets)
        .orderBy(desc(tickets.created_at))
        .limit(limit)
        .offset(offset);
    }

    //
    // Unknown role
    //
    else {
      results = [];
    }

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error("Ticket fetch failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

