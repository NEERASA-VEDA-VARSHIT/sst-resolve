import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets } from "@/db";
import { eq } from "drizzle-orm";
import { sendEmail, getTATSetEmail, getStudentEmail } from "@/lib/email";
import { SetTATSchema } from "@/schema/ticket.schema";
import { calculateTATDate } from "@/utils";

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId, sessionClaims } = await auth();
		
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Check if user is admin
		const role = sessionClaims?.metadata?.role;
		if (role !== "admin" && role !== "super_admin") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { id } = await params;
		const body = await request.json();
		
		// Validate input using Zod schema
		const validationResult = SetTATSchema.safeParse(body);
		if (!validationResult.success) {
			return NextResponse.json(
				{ error: "Validation failed", details: validationResult.error.errors },
				{ status: 400 }
			);
		}
		
		const { tat, markInProgress } = validationResult.data;

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

		// Parse existing details and get original email Message-ID and subject BEFORE updating
		let details: any = {};
		let originalMessageId: string | undefined;
		let originalSubject: string | undefined;
		if (ticket.details) {
			try {
				details = JSON.parse(ticket.details);
				originalMessageId = details.originalEmailMessageId;
				originalSubject = details.originalEmailSubject;
				if (originalMessageId) {
					console.log(`   🔗 Found original Message-ID for threading: ${originalMessageId}`);
				} else {
					console.warn(`   ⚠️ No originalEmailMessageId in ticket details for ticket #${ticketId}`);
				}
				if (originalSubject) {
					console.log(`   📝 Found original subject: ${originalSubject}`);
				}
			} catch (e) {
				console.error("Error parsing details:", e);
			}
		}

		// Parse TAT text and calculate date
		const tatText = tat.trim();
		const tatDate = calculateTATDate(tatText);

		// Set TAT (support both setting and extending)
		const isExtension = details.tat ? true : false;
		details.tat = tatText;
		details.tatDate = tatDate.toISOString();
		details.tatSetAt = new Date().toISOString();
		details.tatSetBy = "Admin"; // You can get admin name from userId if needed
		if (isExtension) {
			details.tatExtendedAt = new Date().toISOString();
		}

		// Update ticket with TAT and optionally mark as in_progress
		// Also assign ticket to the admin taking action
		const updateData: any = { 
			details: JSON.stringify(details),
			assignedTo: userId // Assign ticket to the admin taking action
		};
		if (markInProgress) {
			updateData.status = "in_progress";
		}

		await db
			.update(tickets)
			.set(updateData)
			.where(eq(tickets.id, ticketId));

		// Send email notification to student
		try {
			const studentEmail = await getStudentEmail(ticket.userNumber);
			if (studentEmail) {
				// Use the originalMessageId we retrieved before the update
				const emailTemplate = getTATSetEmail(
					ticket.id,
					tatText,
					tatDate.toISOString(),
					ticket.category,
					isExtension,
					markInProgress // Include markInProgress flag in email
				);
				const emailResult = await sendEmail({
					to: studentEmail,
					subject: emailTemplate.subject,
					html: emailTemplate.html,
					ticketId: ticket.id,
					threadMessageId: originalMessageId,
					originalSubject: originalSubject,
				});
				
				if (!emailResult) {
					console.error(`❌ Failed to send TAT email to ${studentEmail} for ticket #${ticket.id}`);
				} else {
					console.log(`✅ TAT email sent to ${studentEmail} for ticket #${ticket.id}${originalMessageId ? ' (threaded)' : ''}`);
				}
			}
		} catch (emailError) {
			console.error("Error sending TAT email:", emailError);
			// Don't fail the request if email fails
		}

		// Post TAT update to Slack as threaded reply (async, don't await)
		(async () => {
			try {
				if (ticket.category === "Hostel" || ticket.category === "College" || ticket.category === "Committee") {
					const slackMessageTs = details.slackMessageTs;
					
					if (slackMessageTs) {
						const tatMessage = isExtension
							? `⏱️ *TAT Extended*\n\nTurnaround Time updated to: *${tatText}*\nTarget Date: ${new Date(tatDate).toLocaleDateString()}`
							: markInProgress
							? `⏱️ *TAT Set & Ticket In Progress*\n\nTurnaround Time: *${tatText}*\nTarget Date: ${new Date(tatDate).toLocaleDateString()}`
							: `⏱️ *TAT Updated*\n\nTurnaround Time: *${tatText}*\nTarget Date: ${new Date(tatDate).toLocaleDateString()}`;

						const { slackConfig } = await import("@/conf/config");
						const key = `${ticket.category}${ticket.subcategory ? ":" + ticket.subcategory : ""}`;
						const ccUserIds = (slackConfig.ccMap[key] || slackConfig.ccMap[ticket.category] || slackConfig.defaultCc);
						const channelOverride: string | undefined = typeof details.slackChannel === "string" ? details.slackChannel : undefined;
						
						if (channelOverride) {
							const { postThreadReplyToChannel } = await import("@/lib/slack");
							await postThreadReplyToChannel(channelOverride, slackMessageTs, tatMessage, ccUserIds);
						} else {
							const { postThreadReply } = await import("@/lib/slack");
							await postThreadReply(
								ticket.category as "Hostel" | "College" | "Committee",
								slackMessageTs,
								tatMessage,
								ccUserIds
							);
						}
						console.log(`✅ Posted TAT update to Slack thread for ticket #${ticket.id}`);
					} else {
						console.warn(`⚠️ No slackMessageTs found for ticket #${ticket.id} - Slack thread not posted`);
					}
				}
			} catch (slackError: any) {
				console.error(`❌ Error posting TAT update to Slack thread for ticket #${ticket.id}:`, {
					message: slackError.message,
					code: slackError.code,
					data: slackError.data,
				});
				// Don't fail the request if Slack posting fails
			}
		})();

		return NextResponse.json({ success: true, message: markInProgress ? "TAT set and ticket marked in progress" : "TAT set" });
	} catch (error) {
		console.error("Error setting TAT:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

