// import { NextRequest, NextResponse } from "next/server";
// import { auth } from "@clerk/nextjs/server";
// import { db } from "@/db";
// import { tickets, staff, categories, users } from "@/db/schema";
// import { eq } from "drizzle-orm";
// import { postThreadReply } from "@/lib/slack";
// import { sendEmail, getCommentAddedEmail } from "@/lib/email";
// import { AddCommentSchema } from "@/schema/ticket.schema";
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
// 		const isSuperAdmin = role === "super_admin";
// 		const isAdminUser = role === "admin" || role === "super_admin";

// 		const { id } = await params;
// 		const body = await request.json();
		
// 		// Validate input using Zod schema
// 		const validationResult = AddCommentSchema.safeParse(body);
// 		if (!validationResult.success) {
// 			return NextResponse.json(
// 				{ error: "Validation failed", details: validationResult.error.errors },
// 				{ status: 400 }
// 			);
// 		}
		
// 		const { comment, isAdmin, commentType } = validationResult.data;
		
// 		// Use role from database for proper author name
// 		const authorName = isAdminUser 
// 			? (isSuperAdmin && commentType === "super_admin_note" ? "Super Admin" : "Admin")
// 			: "Student";

// 		if (!comment || typeof comment !== "string" || comment.trim().length === 0) {
// 			return NextResponse.json(
// 				{ error: "Comment is required" },
// 				{ status: 400 }
// 			);
// 		}

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
// 				metadata: tickets.metadata,
// 			})
// 			.from(tickets)
// 			.where(eq(tickets.id, ticketId))
// 			.limit(1);

// 		if (!ticket) {
// 			return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
// 		}

// 		// Get category name
// 		let categoryName = "Ticket";
// 		if (ticket.category_id) {
// 			const [category] = await db
// 				.select({ name: categories.name })
// 				.from(categories)
// 				.where(eq(categories.id, ticket.category_id))
// 				.limit(1);
// 			categoryName = category?.name || "Ticket";
// 		}

// 		// Parse existing metadata and get original email Message-ID and subject BEFORE updating
// 		let metadata: any = ticket.metadata || {};
// 		let originalMessageId: string | undefined;
// 		let originalSubject: string | undefined;
// 		if (metadata.originalEmailMessageId) {
// 			originalMessageId = metadata.originalEmailMessageId;
// 			console.log(`   🔗 Found original Message-ID for threading: ${originalMessageId}`);
// 		} else {
// 			console.warn(`   ⚠️ No originalEmailMessageId in ticket metadata for ticket #${ticketId}`);
// 		}
// 		if (metadata.originalEmailSubject) {
// 			originalSubject = metadata.originalEmailSubject;
// 			console.log(`   📝 Found original subject: ${originalSubject}`);
// 		}

// 		// Check if student can reply (only when status is "awaiting_student_response")
// 		const normalizedStatus = ticket.status?.toLowerCase() || "";
// 		if (!isAdminUser && normalizedStatus !== "awaiting_student_response" && ticket.status !== "AWAITING_STUDENT") {
// 			return NextResponse.json(
// 				{ error: "You can only reply when the admin has asked a question. Current status: " + ticket.status },
// 				{ status: 403 }
// 			);
// 		}

// 		// Add comment with type
// 		if (!metadata.comments) {
// 			metadata.comments = [];
// 		}
// 		metadata.comments.push({
// 			text: comment.trim(),
// 			author: authorName,
// 			createdAt: new Date().toISOString(),
// 			source: isAdminUser ? "admin_dashboard" : "website",
// 			type: commentType, // "student_visible" | "internal_note" | "super_admin_note"
// 			isInternal: commentType === "internal_note" || commentType === "super_admin_note",
// 		});

// 		// Prepare update data
// 		const updateData: any = {
// 			metadata: metadata,
// 			updated_at: new Date(),
// 		};

// 		// If student replies, change status back to "IN_PROGRESS"
// 		if (!isAdminUser && (ticket.status === "AWAITING_STUDENT" || normalizedStatus === "awaiting_student_response")) {
// 			updateData.status = "IN_PROGRESS";
// 		}

// 		// Assign ticket to admin if admin is adding comment
// 		if (isAdminUser) {
// 			const dbUser = await getOrCreateUser(userId);
// 			const [adminStaff] = await db
// 				.select({ id: staff.id })
// 				.from(staff)
// 				.where(eq(staff.user_id, dbUser.id))
// 				.limit(1);
			
// 			if (adminStaff) {
// 				updateData.assigned_to = adminStaff.id;
// 			}
// 		}

// 		await db
// 			.update(tickets)
// 			.set(updateData)
// 			.where(eq(tickets.id, ticketId));

// 		// Send Slack notification for comments (admin or student, only for student-visible comments)
// 		if (commentType === "student_visible" && (categoryName === "Hostel" || categoryName === "College" || categoryName === "Committee")) {
// 			// Get Slack message timestamp from ticket metadata
// 			const slackMessageTs = metadata.slackMessageTs;
			
// 			if (slackMessageTs) {
// 				try {
// 					// Post as threaded reply, prefer stored channel
// 					const commentText = isAdminUser 
// 						? `💬 *Admin Comment:*\n${comment.trim()}`
// 						: `👤 *Student Comment:*\n${comment.trim()}`;
// 					const { slackConfig } = await import("@/conf/config");
// 					const subcategory = metadata.subcategory || "";
// 					const key = `${categoryName}${subcategory ? ":" + subcategory : ""}`;
// 					const ccUserIds = (slackConfig.ccMap[key] || slackConfig.ccMap[categoryName] || slackConfig.defaultCc);
// 					const channelOverride: string | undefined = typeof metadata.slackChannel === "string" ? metadata.slackChannel : undefined;
// 					if (channelOverride) {
// 						const { postThreadReplyToChannel } = await import("@/lib/slack");
// 						await postThreadReplyToChannel(channelOverride, slackMessageTs, commentText, ccUserIds);
// 					} else {
// 						await postThreadReply(
// 							categoryName as "Hostel" | "College" | "Committee",
// 							slackMessageTs,
// 							commentText,
// 							ccUserIds
// 						);
// 					}
// 					console.log(`✅ Posted ${isAdminUser ? 'admin' : 'student'} comment to Slack thread for ticket #${ticketId}`);
// 				} catch (slackError) {
// 					console.error(`❌ Error posting ${isAdminUser ? 'admin' : 'student'} comment to Slack for ticket #${ticketId}:`, slackError);
// 					// Don't fail the request if Slack posting fails
// 				}
// 			} else {
// 				console.warn(`⚠️ No slackMessageTs found for ticket #${ticketId} - Slack comment not posted`);
// 			}
// 		}

// 		// Send email notification to student for student-visible admin comments
// 		if (isAdminUser && commentType === "student_visible" && ticket.created_by) {
// 			try {
// 				// Get student email from users table using created_by
// 				const [creator] = await db
// 					.select({ email: users.email })
// 					.from(users)
// 					.where(eq(users.id, ticket.created_by))
// 					.limit(1);
				
// 				if (creator?.email) {
// 					const emailTemplate = getCommentAddedEmail(
// 						ticket.id,
// 						comment.trim(),
// 						authorName,
// 						categoryName
// 					);
// 					// Use the originalMessageId and originalSubject we retrieved before the update
// 					const emailResult = await sendEmail({
// 						to: creator.email,
// 						subject: emailTemplate.subject,
// 						html: emailTemplate.html,
// 						ticketId: ticket.id,
// 						threadMessageId: originalMessageId,
// 						originalSubject: originalSubject,
// 					});
					
// 					if (!emailResult) {
// 						console.error(`❌ Failed to send comment email to ${creator.email} for ticket #${ticket.id}`);
// 					} else {
// 						console.log(`✅ Comment email sent to ${creator.email} for ticket #${ticket.id}${originalMessageId ? ' (threaded)' : ''}`);
// 					}
// 				}
// 			} catch (emailError) {
// 				console.error("Error sending comment email:", emailError);
// 				// Don't fail the request if email fails
// 			}
// 		}

// 		return NextResponse.json({ success: true, message: "Comment added" });
// 	} catch (error) {
// 		console.error("Error adding comment:", error);
// 		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
// 	}
// }

/// src/app/api/tickets/[id]/comments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, users, outbox } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AddCommentSchema } from "@/schema/ticket.schema";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import { auth } from "@clerk/nextjs/server";

/**
 * ============================================
 * /api/tickets/[id]/comments
 * ============================================
 * 
 * POST → Add Comment
 *   - Auth: Required
 *   - Student comments: Public, visible to all
 *   - Admin comments: Can be public or internal
 *   - Committee internal notes: Only visible to committee + admins
 *   - Super Admin internal notes: Visible to all staff
 *   - Returns: 201 Created with comment object
 * 
 * GET → List All Comments
 *   - Auth: Required
 *   - Students: See only public comments
 *   - Staff: See public + internal notes
 *   - Returns: 200 OK with array of comments
 * ============================================
 */

// Utility – Get local DB user
async function getLocalUserId(clerkId: string) {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerk_id, clerkId))
    .limit(1);

  return row?.id ?? null;
}

// Utility – Load ticket
async function loadTicket(ticketId: number) {
  const [row] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);
  return row ?? null;
}

//
// ---------------------------------------------------------
// GET → return all comments
// ---------------------------------------------------------
//
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const ticketId = Number(params.id);
    if (isNaN(ticketId))
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });

    const role = await getUserRoleFromDB(userId);
    const ticket = await loadTicket(ticketId);

    if (!ticket)
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    // Student → only if they own the ticket
    if (role === "student") {
      const localId = await getLocalUserId(userId);
      if (!localId || ticket.created_by !== localId)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const metadata = (ticket.metadata as any) || {};
      const comments = (metadata.comments || []).filter(
        (c: any) => !c.isInternal
      );

      return NextResponse.json(comments, { status: 200 });
    }

    // Committee / Staff / Admin / Superadmin → all comments
    const metadata = (ticket.metadata as any) || {};
    const comments = metadata.comments || [];

    return NextResponse.json(comments, { status: 200 });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tickets/[id]/comments
 * - Validates input
 * - Checks permissions
 * - Appends comment to ticket.metadata.comments in a DB transaction
 * - Enqueues an outbox event ('ticket.comment.added') for notifications (Slack/email)
 *
 * NOTE: Worker must process outbox events to send Slack/email and update ticket metadata further if needed.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate payload
    const body = await request.json();
    const parsed = AddCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }
    const { comment, commentType } = parsed.data; // e.g. "student_visible" | "internal_note" | "super_admin_note"

    const ticketId = Number(params.id);
    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    // Ensure local user exists
    const localUser = await getOrCreateUser(userId);
    if (!localUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const role = await getUserRoleFromDB(userId);
    const isAdminUser = role === "admin" || role === "super_admin";
    const isCommittee = role === "committee";
    const isStudent = role === "student";

    // Load ticket
    const [ticket] = await db
      .select({
        id: tickets.id,
        metadata: tickets.metadata,
        created_by: tickets.created_by,
        status: tickets.status,
        category_id: tickets.category_id,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    // Permission rules
    if (isStudent) {
      if (!ticket.created_by || ticket.created_by !== localUser.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // students cannot add internal notes
      if (commentType !== "student_visible") {
        return NextResponse.json({ error: "Students cannot add internal notes" }, { status: 403 });
      }
    } else if (isCommittee) {
      // keep behavior: committee members should only add student-visible comments (internal notes are admin-only)
      if (commentType !== "student_visible") {
        return NextResponse.json({ error: "Committee members cannot add internal notes" }, { status: 403 });
      }
      // committee membership tagging check should be enforced separately if needed (worker/admin will handle)
    } else if (!isAdminUser) {
      // unknown/unsupported roles blocked
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build author name (prefer local user name if available)
    let author = localUser.name || localUser.email || "User";
    // For admin super_admin note type, we may label differently in the worker / UI

    // Create comment object
    const isInternal = commentType === "internal_note" || commentType === "super_admin_note";
    const commentObj = {
      text: comment.trim(),
      author,
      createdAt: new Date().toISOString(),
      source: isAdminUser ? "admin_dashboard" : "website",
      type: commentType,
      isInternal,
    };

    // Transaction: append comment to metadata.comments and insert outbox event
    const updated = await db.transaction(async (tx) => {
      // Reload metadata inside transaction to avoid race
      const [freshTicket] = await tx
        .select({ metadata: tickets.metadata })
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      const metadata: any = freshTicket?.metadata || {};
      if (!Array.isArray(metadata.comments)) metadata.comments = [];
      metadata.comments.push(commentObj);

      // Update ticket metadata (and update_at)
      await tx
        .update(tickets)
        .set({
          metadata,
          updated_at: new Date(),
          // optionally change status for student replies, e.g. set to IN_PROGRESS – worker or caller may handle
        })
        .where(eq(tickets.id, ticketId));

      // Enqueue outbox event for worker to send Slack/email/threaded replies
      await tx.insert(outbox).values({
        event_type: "ticket.comment.added",
        payload: {
          ticket_id: ticketId,
          comment: commentObj,
          added_by_clerk_id: userId,
          originalEmailMessageId: metadata.originalEmailMessageId || null,
          originalEmailSubject: metadata.originalEmailSubject || null,
          category_id: ticket.category_id || null,
        },
      });

      return commentObj;
    });

    return NextResponse.json({ success: true, comment: updated }, { status: 201 });
  } catch (error) {
    console.error("Error adding comment:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
