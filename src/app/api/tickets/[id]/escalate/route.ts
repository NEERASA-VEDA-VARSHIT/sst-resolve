// import { NextRequest, NextResponse } from "next/server";
// import { auth, clerkClient } from "@clerk/nextjs/server";
// import { db, tickets, users } from "@/db";
// import { eq } from "drizzle-orm";
// import { postThreadReply } from "@/lib/slack";
// import { sendEmail, getEscalationEmail, getStudentEmail } from "@/lib/email";
// import { TICKET_STATUS } from "@/conf/constants";
// import { getUserRoleFromDB } from "@/lib/db-roles";
// import { getOrCreateUser } from "@/lib/user-sync";

// export async function POST(
// 	request: NextRequest,
// 	{ params }: { params: Promise<{ id: string }> }
// ) {
// 	try {
// 		const { userId } = await auth();
		
// 		if (!userId) {
// 			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
// 		}

// 		// Ensure user exists in database
// 		await getOrCreateUser(userId);

// 		// Get role from database (single source of truth)
// 		const role = await getUserRoleFromDB(userId);
// 		const isAdmin = role === "admin" || role === "super_admin";
// 		const isStudent = role === "student";

// 		const { id } = await params;
// 		const ticketId = parseInt(id);
		
// 		if (isNaN(ticketId)) {
// 			return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
// 		}

// 		// Get current ticket with category and creator info
// 		const [ticket] = await db
// 			.select({
// 				id: tickets.id,
// 				status: tickets.status,
// 				created_by: tickets.created_by,
// 				category_id: tickets.category_id,
// 				category: tickets.category,
// 				subcategory: tickets.subcategory,
// 				location: tickets.location,
// 				metadata: tickets.metadata,
// 				description: tickets.description,
// 				details: tickets.details,
// 				escalation_level: tickets.escalation_level,
// 			})
// 			.from(tickets)
// 			.where(eq(tickets.id, ticketId))
// 			.limit(1);

// 		if (!ticket) {
// 			return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
// 		}

// 		// PRD v3.0: Students can escalate tickets manually (one-click escalation for overdue issues)
		
// 		// Check if student owns this ticket
// 		if (isStudent) {
// 			const currentUser = await getOrCreateUser(userId);
// 			if (!currentUser || !ticket.created_by || ticket.created_by !== currentUser.id) {
// 				return NextResponse.json({ 
// 					error: "You can only escalate your own tickets" 
// 				}, { status: 403 });
// 			}
// 		}

// 		// Check if ticket is already resolved/closed
// 		if (ticket.status === TICKET_STATUS.RESOLVED) {
// 			return NextResponse.json({ error: "Cannot escalate resolved tickets" }, { status: 400 });
// 		}

// 		// Get escalation reason from request body
// 		let reason = isAdmin ? "Escalated by admin" : isStudent ? "Escalated by student" : "Escalated";
// 		try {
// 			const body = await request.json();
// 			if (body.reason) {
// 				reason = body.reason;
// 			}
// 		} catch (e) {
// 			// Request body might be empty, use default reason
// 		}

// 		// Get admin name if admin is escalating
// 		let adminName = "";
// 		if (isAdmin) {
// 			try {
// 				const { clerkClient } = await import("@clerk/nextjs/server");
// 				const client = await clerkClient();
// 				const user = await client.users.getUser(userId);
// 				adminName = user.firstName && user.lastName 
// 					? `${user.firstName} ${user.lastName}`
// 					: user.emailAddresses[0]?.emailAddress || "Admin";
// 			} catch (e) {
// 				console.error("Error fetching admin name:", e);
// 				adminName = "Admin";
// 			}
// 		}

// 		// Parse existing details
// 		let details: any = {};
// 		let originalMessageId: string | undefined;
// 		let originalSubject: string | undefined;
// 		if (ticket.details) {
// 			try {
// 				details = JSON.parse(ticket.details);
// 				originalMessageId = details.originalEmailMessageId;
// 				originalSubject = details.originalEmailSubject;
// 			} catch (e) {
// 				console.error("Error parsing details:", e);
// 			}
// 		}

// 		// Increment escalation count
// 		const currentEscalationLevel = ticket.escalation_level || 0;
// 		const newEscalationLevel = currentEscalationLevel + 1;

// 		// Get next escalation target based on category/location-specific rules
// 		const { getNextEscalationTarget } = await import("@/lib/escalation");
// 		const nextTarget = await getNextEscalationTarget(
// 			ticket.category || "College",
// 			ticket.location || null,
// 			currentEscalationLevel
// 		);

// 		// Determine who to escalate to
// 		let escalatedTo: string;
// 		let assignedTo: string | null = null;

// 		if (nextTarget) {
// 			// Assign to next escalation target
// 			assignedTo = nextTarget.clerkUserId;
// 			escalatedTo = `level_${nextTarget.level}`;
// 		} else {
// 			// No more escalation targets, escalate to super admin
// 			escalatedTo = newEscalationLevel >= 2 ? "super_admin_urgent" : "super_admin";
// 		}

// 		// Update ticket
// 		// PRD v3.0: When ticket is escalated, status changes to "escalated"
// 		const updateData: any = {
// 			escalation_level: newEscalationLevel,
// 			last_escalation_at: new Date(),
// 			status: TICKET_STATUS.ESCALATED, // Set status to ESCALATED
// 			updated_at: new Date(),
// 		};

// 		// If we have a next escalation target, assign the ticket to them
// 		if (assignedTo) {
// 			updateData.assignedTo = assignedTo;
// 		}

// 		await db
// 			.update(tickets)
// 			.set(updateData)
// 			.where(eq(tickets.id, ticketId));

// 		// Send Slack notification
// 		if (ticket.category === "Hostel" || ticket.category === "College") {
// 			const slackMessageTs = details.slackMessageTs;
// 			if (slackMessageTs) {
// 				try {
// 					const escalatedBy = isAdmin ? adminName : "the student";
// 					const escalationText = `🚨 *MANUAL ESCALATION #${newEscalationLevel}*\nTicket #${ticketId} has been escalated by ${escalatedBy}.\n${reason ? `Reason: ${reason}\n` : ""}Escalation count: ${newEscalationLevel}\nEscalated to: ${escalatedTo === "super_admin_urgent" ? "Super Admin (URGENT)" : "Super Admin"}`;
					
// 					const { slackConfig } = await import("@/conf/config");
// 					const ccUserIds =
// 						slackConfig.ccMap[
// 							`${ticket.category}${ticket.subcategory ? ":" + ticket.subcategory : ""}`
// 						] ||
// 						slackConfig.ccMap[ticket.category] ||
// 						slackConfig.defaultCc;

// 					const channelOverride = details.slackChannel;
// 					if (channelOverride) {
// 						const { postThreadReplyToChannel } = await import("@/lib/slack");
// 						await postThreadReplyToChannel(
// 							channelOverride,
// 							slackMessageTs,
// 							escalationText,
// 							ccUserIds
// 						);
// 					} else {
// 						await postThreadReply(
// 							ticket.category as "Hostel" | "College",
// 							slackMessageTs,
// 							escalationText,
// 							ccUserIds
// 						);
// 					}
// 					console.log(`✅ Posted escalation to Slack thread for ticket #${ticketId}`);
// 				} catch (slackError) {
// 					console.error(`❌ Error posting escalation to Slack for ticket #${ticketId}:`, slackError);
// 				}
// 			}
// 		}

// 		// Get category name and creator email for notifications
// 		let categoryName = "Ticket";
// 		if (ticket.category_id) {
// 			const { categories } = await import("@/db");
// 			const [category] = await db
// 				.select({ name: categories.name })
// 				.from(categories)
// 				.where(eq(categories.id, ticket.category_id))
// 				.limit(1);
// 			categoryName = category?.name || "Ticket";
// 		}

// 		// Send email notification
// 		try {
// 			let studentEmail: string | null = null;
// 			if (ticket.created_by) {
// 				const [creator] = await db
// 					.select({ email: users.email })
// 					.from(users)
// 					.where(eq(users.id, ticket.created_by))
// 					.limit(1);
// 				studentEmail = creator?.email || null;
// 			}

// 			if (studentEmail) {
// 				const emailTemplate = getEscalationEmail(
// 					ticket.id,
// 					categoryName,
// 					newEscalationLevel
// 				);
// 				await sendEmail({
// 					to: studentEmail,
// 					subject: emailTemplate.subject,
// 					html: emailTemplate.html,
// 					ticketId: ticket.id,
// 					threadMessageId: originalMessageId,
// 				});
// 				console.log(`✅ Escalation email sent to ${studentEmail} for ticket #${ticket.id}`);
// 			}
// 		} catch (emailError) {
// 			console.error("Error sending escalation email:", emailError);
// 		}

// 		return NextResponse.json({ 
// 			success: true, 
// 			message: "Ticket escalated successfully",
// 			escalationCount: newEscalationLevel,
// 		});
// 	} catch (error) {
// 		console.error("Error escalating ticket:", error);
// 		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
// 	}
// }


import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, outbox } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import { TICKET_STATUS } from "@/conf/constants";

/**
 * ============================================
 * /api/tickets/[id]/escalate
 * ============================================
 * 
 * POST → Manual Escalation
 *   - Auth: Required
 *   - Permissions:
 *     • Student: Can escalate their own tickets
 *     • Admin: Can escalate any ticket
 *   - Behavior:
 *     • Increments escalation_level by 1
 *     • Updates escalated_at timestamp
 *     • Triggers worker notifications (email/Slack)
 *   - Returns: 200 OK with updated ticket
 * ============================================
 */
//  → DB transaction safe
//  → Creates an outbox event for workers (no Slack/email here)
// ---------------------------------------------------------------
//

// Body schema: optional reason
const EscalateSchema = z.object({
  reason: z.string().max(2000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // --------------------------------------------------
    // AUTH
    // --------------------------------------------------
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const localUser = await getOrCreateUser(userId);
    if (!localUser)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const role = await getUserRoleFromDB(userId);
    const isAdmin =
      role === "admin" || role === "super_admin";
    const isStudent = role === "student";

    // --------------------------------------------------
    // PARAMS
    // --------------------------------------------------
    const ticketId = Number(params.id);
    if (isNaN(ticketId))
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const parsed = EscalateSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      );

    const reason = parsed.data.reason || null;

    // --------------------------------------------------
    // LOAD TICKET
    // --------------------------------------------------
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket)
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    // --------------------------------------------------
    // PERMISSION RULES (PRD v3)
    // --------------------------------------------------

    // STUDENT → may escalate only their own unresolved tickets
    if (isStudent) {
      if (ticket.created_by !== localUser.id) {
        return NextResponse.json(
          { error: "You can only escalate your own tickets" },
          { status: 403 }
        );
      }

      if (ticket.status === TICKET_STATUS.RESOLVED) {
        return NextResponse.json(
          { error: "Cannot escalate a resolved ticket" },
          { status: 400 }
        );
      }
    }

    // COMMITTEE → cannot escalate
    if (role === "committee") {
      return NextResponse.json(
        { error: "Committee members cannot escalate tickets" },
        { status: 403 }
      );
    }

    // ADMINS → can escalate any ticket except already resolved
    if (isAdmin) {
      if (ticket.status === TICKET_STATUS.RESOLVED) {
        return NextResponse.json(
          { error: "Cannot escalate a resolved ticket" },
          { status: 400 }
        );
      }
    }

    // --------------------------------------------------
    // BUSINESS LOGIC
    // - Increase escalation_level
    // - Change status to ESCALATED
    // - Timestamp last_escalation_at
    // - Worker decides next escalation target (via outbox event)
    // --------------------------------------------------

    const newEscalationLevel = (ticket.escalation_level || 0) + 1;

    const updatedTicket = await db.transaction(async (tx) => {
      // Update ticket
      const [t] = await tx
        .update(tickets)
        .set({
          escalation_level: newEscalationLevel,
          status: TICKET_STATUS.ESCALATED,
          last_escalation_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(tickets.id, ticketId))
        .returning();

      if (!t) throw new Error("Failed to update ticket during escalation");

      // Insert outbox event to process notifications + escalation chain
      await tx.insert(outbox).values({
        event_type: "ticket.escalated.manual",
        payload: {
          ticket_id: ticketId,
          escalated_by_clerk_id: userId,
          escalated_by_role: role,
          previous_status: ticket.status,
          new_status: TICKET_STATUS.ESCALATED,
          new_escalation_level: newEscalationLevel,
          reason,
        },
      });

      return t;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Ticket escalated successfully",
        ticket: updatedTicket,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error escalating ticket:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
