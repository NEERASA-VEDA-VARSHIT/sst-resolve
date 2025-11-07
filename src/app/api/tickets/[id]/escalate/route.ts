import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets } from "@/db";
import { eq } from "drizzle-orm";
import { postThreadReply } from "@/lib/slack";
import { sendEmail, getEscalationEmail, getStudentEmail } from "@/lib/email";

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId, sessionClaims } = await auth();
		
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;
		const ticketId = parseInt(id);
		
		if (isNaN(ticketId)) {
			return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
		}

		// Get current ticket
		const [ticket] = await db
			.select()
			.from(tickets)
			.where(eq(tickets.id, ticketId))
			.limit(1);

		if (!ticket) {
			return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
		}

		// Only admins can manually escalate tickets
		// Students cannot escalate manually - escalation happens automatically via TAT violations
		const role = (sessionClaims as any)?.metadata?.role;
		const isAdmin = role === "admin" || role === "super_admin";
		
		if (!isAdmin) {
			return NextResponse.json({ 
				error: "Students cannot manually escalate tickets. Escalation happens automatically when TAT is violated." 
			}, { status: 403 });
		}

		// Check if ticket is already resolved/closed
		if (ticket.status === "closed" || ticket.status === "resolved") {
			return NextResponse.json({ error: "Cannot escalate closed or resolved tickets" }, { status: 400 });
		}

		// Get escalation reason from request body (for admin manual escalation)
		let reason = isAdmin ? "Escalated by admin" : "Escalated by student";
		try {
			const body = await request.json();
			if (body.reason) {
				reason = body.reason;
			}
		} catch (e) {
			// Request body might be empty, use default reason
		}

		// Get admin name if admin is escalating
		let adminName = "";
		if (isAdmin) {
			try {
				const { clerkClient } = await import("@clerk/nextjs/server");
				const client = await clerkClient();
				const user = await client.users.getUser(userId);
				adminName = user.firstName && user.lastName 
					? `${user.firstName} ${user.lastName}`
					: user.emailAddresses[0]?.emailAddress || "Admin";
			} catch (e) {
				console.error("Error fetching admin name:", e);
				adminName = "Admin";
			}
		}

		// Parse existing details
		let details: any = {};
		let originalMessageId: string | undefined;
		let originalSubject: string | undefined;
		if (ticket.details) {
			try {
				details = JSON.parse(ticket.details);
				originalMessageId = details.originalEmailMessageId;
				originalSubject = details.originalEmailSubject;
			} catch (e) {
				console.error("Error parsing details:", e);
			}
		}

		// Increment escalation count
		const currentEscalationCount = parseInt(ticket.escalationCount || "0", 10);
		const newEscalationCount = currentEscalationCount + 1;

		// Get next escalation target based on category/location-specific rules
		const { getNextEscalationTarget } = await import("@/lib/escalation");
		const nextTarget = await getNextEscalationTarget(
			ticket.category || "College",
			ticket.location || null,
			currentEscalationCount
		);

		// Determine who to escalate to
		let escalatedTo: string;
		let assignedTo: string | null = null;

		if (nextTarget) {
			// Assign to next escalation target
			assignedTo = nextTarget.clerkUserId;
			escalatedTo = `level_${nextTarget.level}`;
		} else {
			// No more escalation targets, escalate to super admin
			escalatedTo = newEscalationCount >= 2 ? "super_admin_urgent" : "super_admin";
		}

		// Update ticket
		const updateData: any = {
			escalationCount: newEscalationCount.toString(),
			escalatedAt: new Date(),
			escalatedTo: escalatedTo,
			updatedAt: new Date(),
		};

		// If we have a next escalation target, assign the ticket to them
		if (assignedTo) {
			updateData.assignedTo = assignedTo;
		}

		await db
			.update(tickets)
			.set(updateData)
			.where(eq(tickets.id, ticketId));

		// Send Slack notification
		if (ticket.category === "Hostel" || ticket.category === "College") {
			const slackMessageTs = details.slackMessageTs;
			if (slackMessageTs) {
				try {
					const escalatedBy = isAdmin ? adminName : "the student";
					const escalationText = `🚨 *MANUAL ESCALATION #${newEscalationCount}*\nTicket #${ticketId} has been escalated by ${escalatedBy}.\n${reason ? `Reason: ${reason}\n` : ""}Escalation count: ${newEscalationCount}\nEscalated to: ${escalatedTo === "super_admin_urgent" ? "Super Admin (URGENT)" : "Super Admin"}`;
					
					const { slackConfig } = await import("@/conf/config");
					const ccUserIds =
						slackConfig.ccMap[
							`${ticket.category}${ticket.subcategory ? ":" + ticket.subcategory : ""}`
						] ||
						slackConfig.ccMap[ticket.category] ||
						slackConfig.defaultCc;

					const channelOverride = details.slackChannel;
					if (channelOverride) {
						const { postThreadReplyToChannel } = await import("@/lib/slack");
						await postThreadReplyToChannel(
							channelOverride,
							slackMessageTs,
							escalationText,
							ccUserIds
						);
					} else {
						await postThreadReply(
							ticket.category as "Hostel" | "College",
							slackMessageTs,
							escalationText,
							ccUserIds
						);
					}
					console.log(`✅ Posted escalation to Slack thread for ticket #${ticketId}`);
				} catch (slackError) {
					console.error(`❌ Error posting escalation to Slack for ticket #${ticketId}:`, slackError);
				}
			}
		}

		// Send email notification
		try {
			const studentEmail = await getStudentEmail(ticket.userNumber);
			if (studentEmail) {
				const emailTemplate = getEscalationEmail(
					ticket.id,
					ticket.category,
					newEscalationCount
				);
				await sendEmail({
					to: studentEmail,
					subject: emailTemplate.subject,
					html: emailTemplate.html,
					ticketId: ticket.id,
					threadMessageId: originalMessageId,
					originalSubject: originalSubject,
				});
				console.log(`✅ Escalation email sent to ${studentEmail} for ticket #${ticket.id}`);
			}
		} catch (emailError) {
			console.error("Error sending escalation email:", emailError);
		}

		return NextResponse.json({ 
			success: true, 
			message: "Ticket escalated successfully",
			escalationCount: newEscalationCount,
		});
	} catch (error) {
		console.error("Error escalating ticket:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

