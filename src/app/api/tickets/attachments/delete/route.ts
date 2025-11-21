import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import { deleteImage } from "@/lib/cloudinary"; // must exist in your lib

/**
 * ============================================
 * /api/tickets/attachments/delete
 * ============================================
 * 
 * DELETE → Delete Attachment
 *   - Auth: Required (Admin+)
 *   - Remove image from Cloudinary
 *   - Body: { "publicId": string }
 *   - Returns: 200 OK with success message
 * ============================================
 */

export async function DELETE(request: NextRequest) {
  try {
    // ----------------------
    // AUTH
    // ----------------------
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const localUser = await getOrCreateUser(userId);
    const body = await request.json().catch(() => null);

    if (!body || !body.ticketId || !body.publicId) {
      return NextResponse.json(
        { error: "ticketId and publicId are required" },
        { status: 400 }
      );
    }

    const ticketId = Number(body.ticketId);
    const publicId = String(body.publicId);

    if (isNaN(ticketId) || !publicId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // ----------------------
    // FETCH TICKET
    // ----------------------
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket)
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    // ----------------------
    // PERMISSIONS
    // ----------------------

    // Student → only allowed if they own the ticket
    const role = await getUserRoleFromDB(userId);
    if (role === "student") {
      if (ticket.created_by !== localUser.id) {
        return NextResponse.json(
          { error: "You can only delete attachments from your own tickets" },
          { status: 403 }
        );
      }
    }

    // Admins → can delete from any ticket

    // ----------------------
    // DELETE IMAGE FROM CLOUDINARY
    // ----------------------
    try {
      await deleteImage(publicId); // must exist in your cloudinary lib
    } catch (err) {
      console.error("Cloudinary deletion failed:", err);
      return NextResponse.json(
        { error: "Failed to delete image from Cloudinary" },
        { status: 500 }
      );
    }

    // ----------------------
    // NOTE:
    // We do NOT modify ticket.metadata here.
    // The frontend or another endpoint should update ticket metadata.
    // ----------------------

    return NextResponse.json({
      success: true,
      message: "Attachment deleted successfully",
      publicId,
    });
  } catch (err) {
    console.error("Attachment delete error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
