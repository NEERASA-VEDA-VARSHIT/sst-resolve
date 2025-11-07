import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets } from "@/db";
import { eq } from "drizzle-orm";
import { postThreadReply } from "@/lib/slack";
import { sendEmail, getCommentAddedEmail, getStudentEmail } from "@/lib/email";
import { AddCommentSchema } from "@/schema/ticket.schema";

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
		const body = await request.json();
		
		// Validate input using Zod schema
		const validationResult = AddCommentSchema.safeParse(body);
		if (!validationResult.success) {
			return NextResponse.json(
				{ error: "Validation failed", details: validationResult.error.errors },
				{ status: 400 }
			);
		}
		
		const { comment, isAdmin, commentType } = validationResult.data;
		
		// Get user role for proper author name
		const role = sessionClaims?.metadata?.role;
		const isSuperAdmin = role === "super_admin";
		const isAdminUser = isAdmin || role === "admin" || role === "super_admin";
		const authorName = isAdminUser 
			? (isSuperAdmin && commentType === "super_admin_note" ? "Super Admin" : "Admin")
			: "Student";

		if (!comment || typeof comment !== "string" || comment.trim().length === 0) {
			return NextResponse.json(
				{ error: "Comment is required" },
				{ status: 400 }
			);
		}

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

		// Check if student can reply (only when status is "awaiting_student_response")
		if (!isAdminUser && ticket.status !== "awaiting_student_response") {
			return NextResponse.json(
				{ error: "You can only reply when the admin has asked a question. Current status: " + ticket.status },
				{ status: 403 }
			);
		}

		// Add comment with type
		if (!details.comments) {
			details.comments = [];
		}
		details.comments.push({
			text: comment.trim(),
			author: authorName,
			createdAt: new Date().toISOString(),
			source: isAdminUser ? "admin_dashboard" : "website",
			type: commentType, // "student_visible" | "internal_note" | "super_admin_note"
			isInternal: commentType === "internal_note" || commentType === "super_admin_note",
		});

		// If student replies, change status back to "in_progress"
		if (!isAdminUser && ticket.status === "awaiting_student_response") {
			// Update status to in_progress when student replies
			await db
				.update(tickets)
				.set({ 
					details: JSON.stringify(details),
					status: "in_progress",
					updatedAt: new Date(),
				})
				.where(eq(tickets.id, ticketId));
		} else {
			// Just update details for admin comments
			await db
				.update(tickets)
				.set({ 
					details: JSON.stringify(details),
					updatedAt: new Date(),
				})
				.where(eq(tickets.id, ticketId));
		}

		// Assign ticket to admin if admin is adding comment
		if (isAdminUser) {
			await db
				.update(tickets)
				.set({ assignedTo: userId })
				.where(eq(tickets.id, ticketId));
		}

		// Send Slack notification for comments (admin or student, only for student-visible comments)
		if (commentType === "student_visible" && (ticket.category === "Hostel" || ticket.category === "College" || ticket.category === "Committee")) {
			// Get Slack message timestamp from ticket details
			const slackMessageTs = details.slackMessageTs;
			
			if (slackMessageTs) {
				try {
					// Post as threaded reply, prefer stored channel
					const commentText = isAdminUser 
						? `💬 *Admin Comment:*\n${comment.trim()}`
						: `👤 *Student Comment:*\n${comment.trim()}`;
					const { slackConfig } = await import("@/conf/config");
					const key = `${ticket.category}${ticket.subcategory ? ":" + ticket.subcategory : ""}`;
					const ccUserIds = (slackConfig.ccMap[key] || slackConfig.ccMap[ticket.category] || slackConfig.defaultCc);
					const channelOverride: string | undefined = typeof details.slackChannel === "string" ? details.slackChannel : undefined;
					if (channelOverride) {
						const { postThreadReplyToChannel } = await import("@/lib/slack");
						await postThreadReplyToChannel(channelOverride, slackMessageTs, commentText, ccUserIds);
					} else {
						await postThreadReply(
							ticket.category as "Hostel" | "College" | "Committee",
							slackMessageTs,
							commentText,
							ccUserIds
						);
					}
					console.log(`✅ Posted ${isAdminUser ? 'admin' : 'student'} comment to Slack thread for ticket #${ticketId}`);
				} catch (slackError) {
					console.error(`❌ Error posting ${isAdminUser ? 'admin' : 'student'} comment to Slack for ticket #${ticketId}:`, slackError);
					// Don't fail the request if Slack posting fails
				}
			} else {
				console.warn(`⚠️ No slackMessageTs found for ticket #${ticketId} - Slack comment not posted`);
			}
		}

		// Send email notification to student for student-visible admin comments
		if (isAdminUser && commentType === "student_visible") {
			try {
				const studentEmail = await getStudentEmail(ticket.userNumber);
				if (studentEmail) {
					const emailTemplate = getCommentAddedEmail(
						ticket.id,
						comment.trim(),
						authorName,
						ticket.category
					);
					// Use the originalMessageId and originalSubject we retrieved before the update
					const emailResult = await sendEmail({
						to: studentEmail,
						subject: emailTemplate.subject,
						html: emailTemplate.html,
						ticketId: ticket.id,
						threadMessageId: originalMessageId,
						originalSubject: originalSubject,
					});
					
					if (!emailResult) {
						console.error(`❌ Failed to send comment email to ${studentEmail} for ticket #${ticket.id}`);
					} else {
						console.log(`✅ Comment email sent to ${studentEmail} for ticket #${ticket.id}${originalMessageId ? ' (threaded)' : ''}`);
					}
				}
			} catch (emailError) {
				console.error("Error sending comment email:", emailError);
				// Don't fail the request if email fails
			}
		}

		return NextResponse.json({ success: true, message: "Comment added" });
	} catch (error) {
		console.error("Error adding comment:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

