import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, tickets } from "@/db";
import { BulkCloseTicketsSchema } from "@/schema/ticket.schema";

export async function POST(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (sessionClaims as any)?.metadata?.role;
    const isAdmin = role === "admin" || role === "super_admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = BulkCloseTicketsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.errors }, { status: 400 });
    }

    const { ids, comment, status } = parsed.data;
    const targetStatus = status || "closed";

    // Fetch the tickets to modify
    const rows = await db.select().from(tickets).where(inArray(tickets.id, ids));
    if (rows.length === 0) {
      return NextResponse.json({ error: "No tickets found for the provided ids" }, { status: 404 });
    }

    // Update details with optional bulk-close comment and set status
    const now = new Date();
    for (const row of rows) {
      let details: any = {};
      try {
        details = row.details ? JSON.parse(row.details) : {};
      } catch {}

      if (comment) {
        const comments = Array.isArray(details.comments) ? details.comments : [];
        comments.push({
          text: comment,
          author: "Admin",
          createdAt: now.toISOString(),
          type: "internal_note",
          isInternal: true,
          source: "bulk_action",
        });
        details.comments = comments;
      }

      const updateData: any = {
        status: targetStatus,
        updatedAt: now,
        details: JSON.stringify(details),
      };

      // Only set ratingRequired for closed/resolved
      if (targetStatus === "closed" || targetStatus === "resolved") {
        updateData.ratingRequired = "true";
      }

      await db
        .update(tickets)
        .set(updateData)
        .where(eq(tickets.id, row.id));
    }

    return NextResponse.json({ success: true, updated: rows.map((r) => r.id) });
  } catch (error) {
    console.error("Error bulk closing tickets:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


