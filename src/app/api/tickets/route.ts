import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets } from "@/db";
import { desc, eq, and } from "drizzle-orm";
import { postToSlackChannel } from "@/lib/slack";
import { sendEmail, getTicketCreatedEmail, getStudentEmail } from "@/lib/email";
// Avoid static import to prevent HMR/interop issues with zod in certain environments

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allTickets = await db.select().from(tickets).orderBy(desc(tickets.createdAt));

    return NextResponse.json(allTickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Students and committee members can create tickets
    const role = (sessionClaims as any)?.metadata?.role || "student";
    if (role !== "student" && role !== "committee") {
      return NextResponse.json({ error: "Only students and committee members can create tickets" }, { status: 403 });
    }

    const body = await request.json();
    
    // Lightweight validation (temporary fallback to avoid zod HMR issues)
    const { userNumber, category, subcategory, description, location, details } = body || {};
    
    // Allow Committee category for committee role
    if (!category || (category !== "Hostel" && category !== "College" && category !== "Committee")) {
      return NextResponse.json({ error: "Invalid or missing category" }, { status: 400 });
    }
    
    // Committee tickets must have Committee category
    if (role === "committee" && category !== "Committee") {
      return NextResponse.json({ error: "Committee members can only create Committee category tickets" }, { status: 400 });
    }
    
    // Students cannot create Committee tickets
    if (role === "student" && category === "Committee") {
      return NextResponse.json({ error: "Students cannot create Committee category tickets" }, { status: 400 });
    }
    if (!subcategory || typeof subcategory !== "string" || subcategory.trim().length === 0) {
      return NextResponse.json({ error: "Subcategory is required" }, { status: 400 });
    }

    // Check if user has any tickets requiring rating (only for students)
    if (role === "student") {
      const userNumberFromClaims = sessionClaims?.metadata?.userNumber as string | undefined;
      const actualUserNumber = userNumber || userNumberFromClaims;
      
      if (actualUserNumber) {
        const ticketsRequiringRating = await db
          .select()
          .from(tickets)
          .where(
            and(
              eq(tickets.userNumber, actualUserNumber),
              eq(tickets.ratingRequired, "true"),
              eq(tickets.rating, null)
            )
          );
        
        if (ticketsRequiringRating.length > 0) {
          return NextResponse.json({ 
            error: "You have closed tickets that require rating. Please rate them before creating a new ticket.",
            ticketsRequiringRating: ticketsRequiringRating.map(t => t.id),
          }, { status: 400 });
        }
      }
    }

    // Parse existing details if provided
    let ticketDetails: any = details ? (typeof details === 'string' ? JSON.parse(details) : details) : {};

    // For committee tickets, assign to super admin
    // For other tickets, auto-assign to SPOC based on category and location
    let assignedUserId: string | null = null;
    
    if (category === "Committee") {
      // Find super admin user ID
      try {
        const { clerkClient } = await import("@clerk/nextjs/server");
        const client = await clerkClient();
        const userList = await client.users.getUserList();
        const superAdmin = userList.data.find(
          (user) => (user.publicMetadata as any)?.role === "super_admin"
        );
        assignedUserId = superAdmin?.id || null;
      } catch (error) {
        console.error("Error finding super admin:", error);
        assignedUserId = null;
      }
    } else {
      // Auto-assign to SPOC for Hostel/College tickets
      const { findSPOCForTicket } = await import("@/lib/spoc-assignment");
      assignedUserId = await findSPOCForTicket(category, location || null);
    }

    // For committee, use userId as userNumber if not provided
    const actualUserNumber = role === "committee" && !userNumber ? userId : userNumber;

    const [newTicket] = await db
      .insert(tickets)
      .values({
        userNumber: actualUserNumber,
        category,
        subcategory: subcategory || null,
        description: description || null,
        location: location || null,
        assignedTo: assignedUserId, // Auto-assign to super admin for committee, SPOC for others
        details: Object.keys(ticketDetails).length > 0 ? JSON.stringify(ticketDetails) : null,
      })
      .returning();

    // Return immediately - send notifications asynchronously
    const response = NextResponse.json(newTicket, { status: 201 });

    // Send Slack and email notifications asynchronously (fire and forget)
    if (newTicket.category === "Hostel" || newTicket.category === "College" || newTicket.category === "Committee") {
      // Run notifications in background without blocking the response
      (async () => {
        try {
          const header = "🆕 New Ticket Raised (via Web)";
          const body = [
            `*Ticket ID:* #${newTicket.id}`,
            `Category: ${newTicket.category}${newTicket.subcategory ? " → " + newTicket.subcategory : ""}`,
            newTicket.location ? `Location: ${newTicket.location}` : undefined,
            `User: ${newTicket.userNumber}`,
            newTicket.description ? `Description: ${newTicket.description}` : undefined,
            `Status: Open`,
          ]
            .filter(Boolean)
            .join("\n");
          
          const { slackConfig } = await import("@/conf/config");
          const key = `${newTicket.category}${newTicket.subcategory ? ":" + newTicket.subcategory : ""}`;
          const ccUserIds = (slackConfig.ccMap[key] || slackConfig.ccMap[newTicket.category] || slackConfig.defaultCc);
          // Choose channel: specific hostel channel if available, else category default
          const hostelChannels: Record<string, string> = (slackConfig.channels as any).hostels || {};
          const channelOverride = newTicket.category === "Hostel" && newTicket.location && hostelChannels[newTicket.location]
            ? hostelChannels[newTicket.location]
            : undefined;
          const messageTs = await postToSlackChannel(
            newTicket.category as "Hostel" | "College" | "Committee",
            `${header}\n${body}`,
            newTicket.id,
            ccUserIds,
            channelOverride
          );

          // Store Slack message timestamp in ticket details
          if (messageTs) {
            const updatedDetails = { ...ticketDetails, slackMessageTs: messageTs };
            // Store the channel used so future thread replies always target the same channel
            const { slackConfig } = await import("@/conf/config");
            updatedDetails.slackChannel = channelOverride
              ? channelOverride
              : (newTicket.category === "Hostel" 
                  ? slackConfig.channels.hostel 
                  : newTicket.category === "College"
                  ? slackConfig.channels.college
                  : slackConfig.channels.committee);
            await db
              .update(tickets)
              .set({ details: JSON.stringify(updatedDetails) })
              .where(eq(tickets.id, newTicket.id));
            ticketDetails.slackMessageTs = messageTs;
            ticketDetails.slackChannel = updatedDetails.slackChannel;
          }

          // Send email notification to student
          const studentEmail = await getStudentEmail(newTicket.userNumber);
          if (studentEmail) {
            console.log(`📧 Sending email to ${studentEmail} for ticket #${newTicket.id}`);
            const emailTemplate = getTicketCreatedEmail(
              newTicket.id,
              newTicket.category,
              newTicket.subcategory || "",
              newTicket.description || undefined
            );
            const emailResult = await sendEmail({
              to: studentEmail,
              subject: emailTemplate.subject,
              html: emailTemplate.html,
              ticketId: newTicket.id,
            });
            
            if (emailResult && emailResult.messageId) {
              // Store the original Message-ID and subject in ticket details for email threading
              const finalDetails = {
                ...ticketDetails,
                originalEmailMessageId: emailResult.messageId,
                originalEmailSubject: emailTemplate.subject,
              };
              await db
                .update(tickets)
                .set({ details: JSON.stringify(finalDetails) })
                .where(eq(tickets.id, newTicket.id));
              console.log(`✅ Email sent and Message-ID/subject stored for ticket #${newTicket.id}`);
            } else {
              console.error(`❌ Failed to send email to ${studentEmail} for ticket #${newTicket.id}`);
            }
          } else {
            console.log(`⚠️ No email found for user number: ${newTicket.userNumber} - email not sent`);
          }
        } catch (error) {
          console.error("❌ Error in background notification tasks:", error);
          // Don't fail the request if notifications fail
        }
      })();
    }

    return response;
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

