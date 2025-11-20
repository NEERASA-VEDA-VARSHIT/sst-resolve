import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets, users, staff, categories } from "@/db";
import { desc, eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { createTicket } from "@/lib/tickets/createTicket";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Use dynamic import to avoid circular dependency issues
    const { TicketCreateSchema } = await import("@/lib/validation/ticket");
    
    const parsed = TicketCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const ticket = await createTicket({
      clerkId: userId,
      payload: parsed.data,
    });

    // Process outbox events immediately for faster notifications
    // This ensures email and Slack notifications are sent right away
    // The cron job will still process any missed events as a backup
    try {
      const { processTicketCreated } = await import("@/workers/handlers/processTicketCreatedWorker");
      const { markOutboxSuccess, markOutboxFailure } = await import("@/workers/utils");
      const { db: dbInstance, outbox: outboxTable } = await import("@/db");
      const { eq, desc, and, isNull, sql } = await import("drizzle-orm");
      
      // Find the outbox event for this specific ticket using JSONB query
      const [outboxEvent] = await dbInstance
        .select()
        .from(outboxTable)
        .where(
          and(
            eq(outboxTable.event_type, "ticket.created"),
            isNull(outboxTable.processed_at),
            sql`${outboxTable.payload}->>'ticket_id' = ${ticket.id.toString()}`
          )
        )
        .orderBy(desc(outboxTable.created_at))
        .limit(1);
      
      if (outboxEvent) {
        // Process immediately (non-blocking to avoid delaying the response)
        processTicketCreated(outboxEvent.id, outboxEvent.payload as any)
          .then(() => markOutboxSuccess(outboxEvent.id))
          .catch((error) => {
            console.error("[Ticket API] Failed to process outbox immediately:", error);
            markOutboxFailure(outboxEvent.id, error instanceof Error ? error.message : "Unknown error");
          });
      }
    } catch (error) {
      // Log but don't fail the request if immediate processing fails
      console.warn("[Ticket API] Could not process outbox immediately, cron will handle it:", error);
    }

    return NextResponse.json(ticket, { status: 201 });

  } catch (error) {
    console.error("Ticket creation failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
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
        .where(eq(users.clerk_id, userId))
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
        .where(eq(users.clerk_id, userId))
        .limit(1);

      if (!userRow) return NextResponse.json([], { status: 200 });

      const [staffRow] = await db
        .select({ id: staff.id })
        .from(staff)
        .where(eq(staff.user_id, userRow.id))
        .limit(1);

      if (!staffRow) return NextResponse.json([], { status: 200 });

      results = await db
        .select()
        .from(tickets)
        .where(eq(tickets.assigned_to, staffRow.id))
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





// import { NextRequest, NextResponse } from "next/server";
// import { auth } from "@clerk/nextjs/server";
// import { db, tickets, categories, users, staff, subcategories } from "@/db";
// import { desc, eq, and, isNull } from "drizzle-orm";
// import { postToSlackChannel } from "@/lib/slack";
// import { sendEmail, getTicketCreatedEmail, getStudentEmail } from "@/lib/email";
// import { getUserRoleFromDB } from "@/lib/db-roles";
// import { getOrCreateUser } from "@/lib/user-sync";

// export async function GET(request: NextRequest) {
//   try {
//     const { userId } = await auth();
    
//     if (!userId) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const allTickets = await db.select().from(tickets).orderBy(desc(tickets.created_at));

//     return NextResponse.json(allTickets);
//   } catch (error) {
//     console.error("Error fetching tickets:", error);
//     return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
//   }
// }

// export async function POST(request: NextRequest) {
//   try {
//     const { userId, sessionClaims } = await auth();
    
//     if (!userId) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     // Ensure user exists in database
//     await getOrCreateUser(userId);

//     // Get role from database (single source of truth)
//     const role = await getUserRoleFromDB(userId);
    
//     // Students and committee members can create tickets
//     if (role !== "student" && role !== "committee") {
//       return NextResponse.json({ error: "Only students and committee members can create tickets" }, { status: 403 });
//     }

//   const body = await request.json();
//   const { category, categoryId, subcategory, subcategoryId, subSubcategory, subSubcategoryId, description, location, details } = body || {};
    
//     // Get user_id for ticket creator
//     const dbUser = await getOrCreateUser(userId);
    
//     // Handle deleted Clerk users
//     if (!dbUser) {
//       return NextResponse.json(
//         { error: "User account not found" },
//         { status: 404 }
//       );
//     }

//     // Parse existing details if provided
//     let ticketDetails: any = details ? (typeof details === 'string' ? JSON.parse(details) : details) : {};

//     // Validate categoryId is a valid number
//     // Handle both null/undefined and string/number inputs
//     let parsedCategoryId: number | null = null;
//     if (categoryId !== null && categoryId !== undefined && categoryId !== '') {
//       const parsed = parseInt(String(categoryId), 10);
//       if (isNaN(parsed) || parsed <= 0) {
//         return NextResponse.json({ 
//           error: `Invalid categoryId: ${categoryId}. Must be a positive number.` 
//         }, { status: 400 });
//       }
//       parsedCategoryId = parsed;
//     }

//     // Find category_id - prefer categoryId if provided, otherwise lookup by name
//     let categoryRecord;
//     if (parsedCategoryId) {
//       [categoryRecord] = await db
//         .select({ id: categories.id, name: categories.name })
//         .from(categories)
//         .where(eq(categories.id, parsedCategoryId))
//         .limit(1);
//     } else if (category && typeof category === 'string' && category.trim()) {
//       [categoryRecord] = await db
//         .select({ id: categories.id, name: categories.name })
//         .from(categories)
//         .where(eq(categories.name, category))
//         .limit(1);
//     }

//     // Require either categoryId or category to be provided
//     if (!parsedCategoryId && !category) {
//       return NextResponse.json({ 
//         error: `Either categoryId or category must be provided.` 
//       }, { status: 400 });
//     }

//     if (!categoryRecord) {
//       return NextResponse.json({ 
//         error: `Category not found. Please ensure the category exists in the system.` 
//       }, { status: 400 });
//     }

//     // Validate category permissions
//     const categoryName = categoryRecord.name;
//     // Allow valid categories: Hostel, College, Others (for students), Committee (for committee members)
//     if (categoryName !== "Hostel" && categoryName !== "College" && categoryName !== "Others" && categoryName !== "Committee") {
//       return NextResponse.json({ error: "Invalid category" }, { status: 400 });
//     }
    
//     // Committee tickets must have Committee category
//     if (role === "committee" && categoryName !== "Committee") {
//       return NextResponse.json({ error: "Committee members can only create Committee category tickets" }, { status: 400 });
//     }
    
//     // Students cannot create Committee tickets
//     if (role === "student" && categoryName === "Committee") {
//       return NextResponse.json({ error: "Students cannot create Committee category tickets" }, { status: 400 });
//     }

//     // Validate subcategory
//     // Accept either subcategoryId or subcategory name; do not require name when ID is provided
//     // Also allow missing subcategory entirely for categories without configured subcategories
//     // (the UI already enforces selection when required)

//     // Validate subcategoryId is a valid number if provided
//     // Handle both null/undefined and string/number inputs
//     let parsedSubcategoryId: number | null = null;
//     if (subcategoryId !== null && subcategoryId !== undefined && subcategoryId !== '') {
//       const parsed = parseInt(String(subcategoryId), 10);
//       if (isNaN(parsed) || parsed <= 0) {
//         return NextResponse.json({ 
//           error: `Invalid subcategoryId: ${subcategoryId}. Must be a positive number.` 
//         }, { status: 400 });
//       }
//       parsedSubcategoryId = parsed;
//     }

//     // Find subcategory_id - prefer subcategoryId if provided, otherwise lookup by name
//     // Only query if we have a valid categoryRecord
//     let subcategoryRecord: { id: number; name?: string } | undefined;
//     if (parsedSubcategoryId && categoryRecord) {
//       [subcategoryRecord] = await db
//         .select({ id: subcategories.id, name: subcategories.name })
//         .from(subcategories)
//         .where(
//           and(
//             eq(subcategories.id, parsedSubcategoryId),
//             eq(subcategories.category_id, categoryRecord.id)
//           )
//         )
//         .limit(1);
//     } else if (subcategory && typeof subcategory === 'string' && subcategory.trim() && categoryRecord) {
//       [subcategoryRecord] = await db
//         .select({ id: subcategories.id, name: subcategories.name })
//         .from(subcategories)
//         .where(
//           and(
//             eq(subcategories.name, subcategory),
//             eq(subcategories.category_id, categoryRecord.id),
//             eq(subcategories.active, true)
//           )
//         )
//         .limit(1);
//     }

//     // Extract field slugs from ticketDetails for field-level assignment
//     const fieldSlugs = ticketDetails ? Object.keys(ticketDetails).filter(key => 
//       key !== 'subcategory' && key !== 'subSubcategory' && key !== 'images' && key !== 'profile'
//     ) : [];

//     // Auto-assign tickets based on category:
//     // - Committee/Others → Super Admin (who will allocate to admin)
//     // - Hostel/College → SPOC (auto-assigned admin based on hierarchy: field > subcategory > category > escalation rules)
//     let assignedStaffId: number | null = null;
    
//     // Helper function to find super admin staff_id from database
//     const findSuperAdminStaffId = async (): Promise<number | null> => {
//       const { findSuperAdminClerkId } = await import("@/lib/db-helpers");
//       const superAdminClerkId = await findSuperAdminClerkId();
//       if (!superAdminClerkId) return null;
      
//       const [superAdminUser] = await db
//         .select({ id: users.id })
//         .from(users)
//         .where(eq(users.clerk_id, superAdminClerkId))
//         .limit(1);
      
//       if (!superAdminUser) return null;
      
//       const [superAdminStaff] = await db
//         .select({ id: staff.id })
//         .from(staff)
//         .where(eq(staff.user_id, superAdminUser.id))
//         .limit(1);
      
//       return superAdminStaff?.id || null;
//     };
    
//   if (categoryName === "Committee" || categoryName === "Others") {
//       // Assign to super admin for Committee and Others categories
//       // Super admin will then allocate these to appropriate admins
//       assignedStaffId = await findSuperAdminStaffId();
//     } else {
//       // Auto-assign to SPOC for Hostel/College tickets
//       // Follows hierarchy: field > subcategory > category > escalation rules
//       const { findSPOCForTicket } = await import("@/lib/spoc-assignment");
//       const assignedClerkId = await findSPOCForTicket(
//         categoryName, 
//         location || null,
//         categoryRecord.id,
//         subcategoryRecord?.id || null,
//         fieldSlugs.length > 0 ? fieldSlugs : undefined
//       );
      
//       if (assignedClerkId) {
//         // Get staff.id from clerk_id
//         const [assignedUser] = await db
//           .select({ id: users.id })
//           .from(users)
//           .where(eq(users.clerk_id, assignedClerkId))
//           .limit(1);
        
//         if (assignedUser) {
//           const [assignedStaff] = await db
//             .select({ id: staff.id })
//             .from(staff)
//             .where(eq(staff.user_id, assignedUser.id))
//             .limit(1);
          
//           assignedStaffId = assignedStaff?.id || null;
//         }
//       }
      
//       // If no SPOC found, leave unassigned (null) so super admin can see and allocate
//       // This happens for new categories or when no admin is assigned to that category/location
//       if (!assignedStaffId) {
//         console.log(`No SPOC found for ${categoryName}/${location}, leaving unassigned for super admin allocation`);
//         assignedStaffId = null;
//       }
//     }

//     // Store subcategory, sub-subcategory and details in metadata JSONB
//     // Store both IDs and names for forward compatibility
//     const metadata: any = {
//       subcategory: (subcategoryRecord?.name || subcategory || null),
//       subcategoryId: subcategoryRecord?.id || subcategoryId || null,
//       subSubcategory: subSubcategory || null,
//       subSubcategoryId: subSubcategoryId || null,
//       ...ticketDetails,
//     };

//     const insertValues: any = {
//       created_by: dbUser.id,
//       category_id: categoryRecord.id,
//       description: description || null,
//       location: location || null,
//       metadata: Object.keys(metadata).length > 0 ? metadata : null,
//     };
    
//     if (assignedStaffId) {
//       insertValues.assigned_to = assignedStaffId;
//     }
    
//     const [newTicket] = await db
//       .insert(tickets)
//       .values(insertValues)
//       .returning();

//     // Get user info for notifications
//     // Note: categoryName is already available from line 99 (categoryRecord.name)
//     const [creatorInfo] = await db
//       .select({ 
//         email: users.email,
//         name: users.name,
//         clerk_id: users.clerk_id 
//       })
//       .from(users)
//       .where(eq(users.id, dbUser.id))
//       .limit(1);

//     // Get subcategory name for notifications (from ID in metadata)
//     let subcategoryName = null;
//     if (metadata?.subcategoryId && categoryRecord) {
//       const { getSubcategoryById } = await import("@/lib/categories");
//       const subcat = await getSubcategoryById(metadata.subcategoryId, categoryRecord.id);
//       subcategoryName = subcat?.name || null;
//     }

//     // Return immediately - send notifications asynchronously
//     const response = NextResponse.json(newTicket, { status: 201 });

//     // Send Slack and email notifications asynchronously (fire and forget)
//     if (categoryName === "Hostel" || categoryName === "College" || categoryName === "Committee" || categoryName === "Others") {
//       // Run notifications in background without blocking the response
//       (async () => {
//         try {
//           const header = "🆕 New Ticket Raised (via Web)";
//           const contactProfile = (ticketDetails && typeof ticketDetails === 'object') ? (ticketDetails.profile || {}) : {};
//           const contactName = ticketDetails?.contactName || contactProfile?.name;
//           const contactPhone = ticketDetails?.contactPhone || contactProfile?.phone;
//           const contactEmail = ticketDetails?.contactEmail || contactProfile?.email;
//           const roomNumber = ticketDetails?.roomNumber || contactProfile?.roomNumber;
//           const batchYear = ticketDetails?.batchYear || contactProfile?.batchYear;
//           const classSection = ticketDetails?.classSection || contactProfile?.classSection;

//           const contactLines = [] as string[];
//           if (contactName) contactLines.push(`Name: ${contactName}`);
//           if (contactPhone) contactLines.push(`Phone: ${contactPhone}`);
//           if (contactEmail) contactLines.push(`Email: ${contactEmail}`);
//           if (categoryName === "Hostel" && roomNumber) {
//             contactLines.push(`Room: ${roomNumber}`);
//           }
//           if (categoryName === "College") {
//             if (batchYear) contactLines.push(`Batch: ${batchYear}`);
//             if (classSection) contactLines.push(`Class: ${classSection}`);
//           }
          
//           const body = [
//             `*Ticket ID:* #${newTicket.id}`,
//             `Category: ${categoryName}${subcategoryName ? " → " + subcategoryName : ""}`,
//             newTicket.location ? `Location: ${newTicket.location}` : undefined,
//             `User: ${creatorInfo?.name || creatorInfo?.email || "Unknown"}`,
//             contactLines.length > 0 ? `Contact: ${contactLines.join(" | ")}` : undefined,
//             newTicket.description ? `Description: ${newTicket.description}` : undefined,
//             `Status: Open`,
//           ]
//             .filter(Boolean)
//             .join("\n");
          
//           const { slackConfig } = await import("@/conf/config");
//           const key = `${categoryName}${subcategoryName ? ":" + subcategoryName : ""}`;
//           const ccUserIds = (slackConfig.ccMap[key] || slackConfig.ccMap[categoryName] || slackConfig.defaultCc);
//           // Choose channel: specific hostel channel if available, else category default
//           const hostelChannels: Record<string, string> = (slackConfig.channels as any).hostels || {};
//           const channelOverride = categoryName === "Hostel" && newTicket.location && hostelChannels[newTicket.location]
//             ? hostelChannels[newTicket.location]
//             : undefined;
//           const messageTs = await postToSlackChannel(
//             categoryName as "Hostel" | "College" | "Committee",
//             `${header}\n${body}`,
//             newTicket.id,
//             ccUserIds,
//             channelOverride
//           );

//           // Store Slack message timestamp in metadata
//           if (messageTs) {
//             const updatedMetadata = { 
//               ...metadata, 
//               slackMessageTs: messageTs,
//               slackChannel: channelOverride
//                 ? channelOverride
//                 : (categoryName === "Hostel" 
//                     ? slackConfig.channels.hostel 
//                     : categoryName === "College"
//                     ? slackConfig.channels.college
//                     : slackConfig.channels.committee)
//             };
//             await db
//               .update(tickets)
//               .set({ metadata: updatedMetadata })
//               .where(eq(tickets.id, newTicket.id));
//           }

//           // Send email notification to student
//           const studentEmail = contactEmail || creatorInfo?.email;
//           if (studentEmail) {
//             console.log(`📧 Sending email to ${studentEmail} for ticket #${newTicket.id}`);
//             const emailTemplate = getTicketCreatedEmail(
//               newTicket.id,
//               categoryName,
//               subcategoryName || "",
//               newTicket.description || undefined,
//               contactName || undefined,
//               contactPhone || undefined,
//               roomNumber || undefined,
//               batchYear || undefined,
//               classSection || undefined
//             );
//             const emailResult = await sendEmail({
//               to: studentEmail,
//               subject: emailTemplate.subject,
//               html: emailTemplate.html,
//               ticketId: newTicket.id,
//             });
            
//             if (emailResult && emailResult.messageId) {
//               // Store the original Message-ID and subject in metadata for email threading
//               const finalMetadata = {
//                 ...metadata,
//                 originalEmailMessageId: emailResult.messageId,
//                 originalEmailSubject: emailTemplate.subject,
//               };
//               await db
//                 .update(tickets)
//                 .set({ metadata: finalMetadata })
//                 .where(eq(tickets.id, newTicket.id));
//               console.log(`✅ Email sent and Message-ID/subject stored for ticket #${newTicket.id}`);
//             } else {
//               console.error(`❌ Failed to send email to ${studentEmail} for ticket #${newTicket.id}`);
//             }
//           } else {
//             console.log(`⚠️ No email found for user: ${creatorInfo?.email || creatorInfo?.name || "Unknown"} - email not sent`);
//           }
//         } catch (error) {
//           console.error("❌ Error in background notification tasks:", error);
//           // Don't fail the request if notifications fail
//         }
//       })();
//     }

//     return response;
//   } catch (error) {
//     console.error("Error creating ticket:", error);
//     return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
//   }
// }

