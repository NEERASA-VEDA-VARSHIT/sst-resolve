import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets, ticket_groups, ticket_statuses, categories, ticket_committee_tags, committees } from "@/db";
import { eq, inArray, and } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import type { TicketMetadata } from "@/db/inferred-types";
import { calculateTATDate } from "@/utils";
import { TICKET_STATUS } from "@/conf/constants";
import { getStatusIdByValue } from "@/lib/status/getTicketStatuses";

/**
 * ============================================
 * /api/tickets/groups/[groupId]
 * ============================================
 * 
 * GET → Get Specific Ticket Group
 *   - Auth: Required (Admin only)
 *   - Fetch group with all associated tickets
 *   - Returns: 200 OK with group object including tickets array
 * 
 * PATCH → Update Ticket Group
 *   - Auth: Required (Admin only)
 *   - Update group name, description, or add/remove tickets
 *   - Body: { name: string, description: string, ticketIds: number[] }
 *   - Returns: 200 OK with updated group
 * 
 * DELETE → Delete Ticket Group
 *   - Auth: Required (Admin only)
 *   - Remove group (tickets remain, just ungroup them)
 *   - Returns: 200 OK with success message
 * ============================================
 */

// GET - Get a specific ticket group with its tickets
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);
    
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Only admins and super admins can view ticket groups" }, { status: 403 });
    }

    const { groupId } = await params;
    const groupIdNum = parseInt(groupId, 10);

    if (isNaN(groupIdNum)) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
    }

    const [group] = await db
      .select({
        id: ticket_groups.id,
        name: ticket_groups.name,
        description: ticket_groups.description,
        created_by: ticket_groups.created_by,
        committee_id: ticket_groups.committee_id,
        is_archived: ticket_groups.is_archived,
        created_at: ticket_groups.created_at,
        updated_at: ticket_groups.updated_at,
      })
      .from(ticket_groups)
      .where(eq(ticket_groups.id, groupIdNum))
      .limit(1);

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Fetch committee if group has one
    let committee = null;
    if (group.committee_id) {
      const [committeeRecord] = await db
        .select({
          id: committees.id,
          name: committees.name,
          description: committees.description,
        })
        .from(committees)
        .where(eq(committees.id, group.committee_id))
        .limit(1);
      
      if (committeeRecord) {
        committee = committeeRecord;
      }
    }

    const groupTickets = await db
      .select({
        id: tickets.id,
        status_id: tickets.status_id,
        status_value: ticket_statuses.value,
        category_id: tickets.category_id,
        category_name: categories.name,
        description: tickets.description,
        location: tickets.location,
        created_at: tickets.created_at,
        updated_at: tickets.updated_at,
        metadata: tickets.metadata,
        resolution_due_at: tickets.resolution_due_at,
      })
      .from(tickets)
      .leftJoin(categories, eq(tickets.category_id, categories.id))
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .where(eq(tickets.group_id, groupIdNum));

    // Safely serialize the response
    const serializedTickets = groupTickets.map(t => {
      try {
        return {
          id: typeof t.id === 'number' ? t.id : 0,
          status: typeof t.status_value === 'string' ? t.status_value : null,
          category_name: typeof t.category_name === 'string' ? t.category_name : null,
          description: typeof t.description === 'string' ? t.description : null,
          location: typeof t.location === 'string' ? t.location : null,
          created_at: t.created_at ? (typeof t.created_at === 'string' ? t.created_at : t.created_at instanceof Date ? t.created_at.toISOString() : new Date(t.created_at).toISOString()) : null,
          updated_at: t.updated_at ? (typeof t.updated_at === 'string' ? t.updated_at : t.updated_at instanceof Date ? t.updated_at.toISOString() : new Date(t.updated_at).toISOString()) : null,
          metadata: t.metadata && typeof t.metadata === 'object' ? (() => {
            try {
              return JSON.parse(JSON.stringify(t.metadata));
            } catch {
              return null;
            }
          })() : null,
          resolution_due_at: t.resolution_due_at ? (typeof t.resolution_due_at === 'string' ? t.resolution_due_at : t.resolution_due_at instanceof Date ? t.resolution_due_at.toISOString() : new Date(t.resolution_due_at).toISOString()) : null,
        };
      } catch (err) {
        console.error("Error serializing ticket:", t.id, err);
        return {
          id: typeof t.id === 'number' ? t.id : 0,
          status: null,
          category_name: null,
          description: null,
          location: null,
          created_at: null,
          updated_at: null,
          metadata: null,
          due_at: null,
          resolution_due_at: null,
        };
      }
    });

    const serializedCommittee = committee ? {
      id: typeof committee.id === 'number' ? committee.id : 0,
      name: typeof committee.name === 'string' ? committee.name : null,
      description: typeof committee.description === 'string' ? committee.description : null,
    } : null;

    return NextResponse.json({
      id: typeof group.id === 'number' ? group.id : 0,
      name: typeof group.name === 'string' ? group.name : null,
      description: typeof group.description === 'string' ? group.description : null,
      created_by: typeof group.created_by === 'string' ? group.created_by : null,
      committee_id: typeof group.committee_id === 'number' ? group.committee_id : null,
      is_archived: typeof group.is_archived === 'boolean' ? group.is_archived : false,
      created_at: group.created_at ? (typeof group.created_at === 'string' ? group.created_at : group.created_at instanceof Date ? group.created_at.toISOString() : new Date(group.created_at).toISOString()) : null,
      updated_at: group.updated_at ? (typeof group.updated_at === 'string' ? group.updated_at : group.updated_at instanceof Date ? group.updated_at.toISOString() : new Date(group.updated_at).toISOString()) : null,
      committee: serializedCommittee,
      tickets: serializedTickets,
      ticketCount: serializedTickets.length,
    });
  } catch (error) {
    console.error("Error fetching ticket group:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH - Update group (add/remove tickets or update group info)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);
    
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Only admins and super admins can update ticket groups" }, { status: 403 });
    }

    const { groupId } = await params;
    const groupIdNum = parseInt(groupId, 10);

    if (isNaN(groupIdNum)) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, addTicketIds, removeTicketIds, groupTAT, committee_id } = body;

    // Update group info if provided
    if (name || description !== undefined) {
      const updateData: Record<string, unknown> = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description || null;
      updateData.updated_at = new Date();

      await db
        .update(ticket_groups)
        .set(updateData)
        .where(eq(ticket_groups.id, groupIdNum));
    }

    // Add tickets to group
    if (addTicketIds && Array.isArray(addTicketIds) && addTicketIds.length > 0) {
      // First, check if the group already has tickets with a TAT
      const existingGroupTickets = await db
        .select({
          id: tickets.id,
          metadata: tickets.metadata,
        })
        .from(tickets)
        .where(eq(tickets.group_id, groupIdNum));

      let groupTAT: { tat: string; tatDate: string } | null = null;
      
      // Find the first ticket in the group with a TAT
      for (const existingTicket of existingGroupTickets) {
        if (existingTicket.metadata) {
          try {
            const metadata = typeof existingTicket.metadata === 'string'
              ? JSON.parse(existingTicket.metadata) as TicketMetadata
              : existingTicket.metadata as TicketMetadata;
            
            if (metadata.tat && metadata.tatDate) {
              groupTAT = {
                tat: metadata.tat,
                tatDate: metadata.tatDate,
              };
              break;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }

      // Get the newly added tickets with their current status
      const ticketsToUpdate = await db
        .select({
          id: tickets.id,
          status_id: tickets.status_id,
          status_value: ticket_statuses.value,
          metadata: tickets.metadata,
        })
        .from(tickets)
        .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
        .where(inArray(tickets.id, addTicketIds));

      // Get status_id for IN_PROGRESS
      const inProgressStatusId = await getStatusIdByValue(TICKET_STATUS.IN_PROGRESS);
      
      // Get admin user for assignment
      const dbUser = await getOrCreateUser(userId);

      // Get group's committee_id if it exists
      const [groupInfo] = await db
        .select({ committee_id: ticket_groups.committee_id })
        .from(ticket_groups)
        .where(eq(ticket_groups.id, groupIdNum))
        .limit(1);

      // Add tickets to group and mark open tickets as in_progress
      for (const ticket of ticketsToUpdate) {
        const isOpen = !ticket.status_value || ticket.status_value.toLowerCase() === TICKET_STATUS.OPEN.toLowerCase();
        
        const updateData: Record<string, unknown> = {
          group_id: groupIdNum,
          assigned_to: dbUser.id,
        };

        // Mark open tickets as in_progress
        if (isOpen && inProgressStatusId) {
          updateData.status_id = inProgressStatusId;
        }

        await db
          .update(tickets)
          .set(updateData)
          .where(eq(tickets.id, ticket.id));

        // If group has a committee, tag this ticket to that committee
        if (groupInfo?.committee_id) {
          // Check if tag already exists
          const [existingTag] = await db
            .select()
            .from(ticket_committee_tags)
            .where(
              and(
                eq(ticket_committee_tags.ticket_id, ticket.id),
                eq(ticket_committee_tags.committee_id, groupInfo.committee_id)
              )
            )
            .limit(1);

          if (!existingTag) {
            // Create new tag
            await db.insert(ticket_committee_tags).values({
              ticket_id: ticket.id,
              committee_id: groupInfo.committee_id,
              tagged_by: dbUser.id,
              reason: `Tagged via group assignment`,
            });
          }
        }
      }

      // If group has a TAT, apply it to all newly added tickets
      if (groupTAT) {
        // Re-fetch tickets with status after they've been added to group
        const ticketsWithStatus = await db
          .select({
            id: tickets.id,
            status_id: tickets.status_id,
            status_value: ticket_statuses.value,
            metadata: tickets.metadata,
          })
          .from(tickets)
          .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
          .where(inArray(tickets.id, addTicketIds));

        for (const ticket of ticketsWithStatus) {
          let metadata: TicketMetadata = {};
          
          if (ticket.metadata) {
            try {
              metadata = typeof ticket.metadata === 'string'
                ? JSON.parse(ticket.metadata) as TicketMetadata
                : ticket.metadata as TicketMetadata;
            } catch (e) {
              // If parse fails, start with empty metadata
              metadata = {};
            }
          }

          // Apply group TAT to this ticket
          metadata.tat = groupTAT.tat;
          metadata.tatDate = groupTAT.tatDate;
          metadata.tatSetAt = new Date().toISOString();
          metadata.tatSetBy = "System (Group Sync)";

          // Calculate resolution_due_at from tatDate
          const tatDateObj = new Date(groupTAT.tatDate);
          const updateData: Record<string, unknown> = {
            metadata: metadata as unknown,
          };
          
          if (!isNaN(tatDateObj.getTime())) {
            updateData.resolution_due_at = tatDateObj;
          }

          // Also mark as in_progress if it's open (check current status)
          const isOpen = !ticket.status_value || ticket.status_value.toLowerCase() === TICKET_STATUS.OPEN.toLowerCase();
          if (isOpen && inProgressStatusId) {
            updateData.status_id = inProgressStatusId;
            updateData.assigned_to = dbUser.id;
          }

          await db
            .update(tickets)
            .set(updateData)
            .where(eq(tickets.id, ticket.id));
        }
      } else {
        // Group doesn't have a TAT yet - check if any newly added ticket has a TAT
        // If so, apply it to all tickets in the group
        let newTicketTAT: { tat: string; tatDate: string } | null = null;
        
        for (const ticket of ticketsToUpdate) {
          if (ticket.metadata) {
            try {
              const metadata = typeof ticket.metadata === 'string'
                ? JSON.parse(ticket.metadata) as TicketMetadata
                : ticket.metadata as TicketMetadata;
              
              if (metadata.tat && metadata.tatDate) {
                newTicketTAT = {
                  tat: metadata.tat,
                  tatDate: metadata.tatDate,
                };
                break;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }

        // If a newly added ticket has a TAT, apply it to all tickets in the group
        if (newTicketTAT) {
          const allGroupTickets = await db
            .select({
              id: tickets.id,
              metadata: tickets.metadata,
            })
            .from(tickets)
            .where(eq(tickets.group_id, groupIdNum));

          const tatDateObj = new Date(newTicketTAT.tatDate);
          const isValidDate = !isNaN(tatDateObj.getTime());

          for (const groupTicket of allGroupTickets) {
            let metadata: TicketMetadata = {};
            
            if (groupTicket.metadata) {
              try {
                metadata = typeof groupTicket.metadata === 'string'
                  ? JSON.parse(groupTicket.metadata) as TicketMetadata
                  : groupTicket.metadata as TicketMetadata;
              } catch (e) {
                metadata = {};
              }
            }

            // Apply the TAT to this group ticket
            metadata.tat = newTicketTAT.tat;
            metadata.tatDate = newTicketTAT.tatDate;
            metadata.tatSetAt = new Date().toISOString();
            metadata.tatSetBy = "System (Group Sync)";

            if (isValidDate) {
              await db
                .update(tickets)
                .set({
                  metadata: metadata as unknown,
                  resolution_due_at: tatDateObj,
                })
                .where(eq(tickets.id, groupTicket.id));
            } else {
              await db
                .update(tickets)
                .set({
                  metadata: metadata as unknown,
                })
                .where(eq(tickets.id, groupTicket.id));
            }
          }
        }
      }
    }

    // Remove tickets from group
    if (removeTicketIds && Array.isArray(removeTicketIds) && removeTicketIds.length > 0) {
      await db
        .update(tickets)
        .set({ group_id: null })
        .where(inArray(tickets.id, removeTicketIds));
    }

    // Set TAT for all tickets in the group
    if (groupTAT && typeof groupTAT === 'string' && groupTAT.trim()) {
      const tatText = groupTAT.trim();
      const tatDate = calculateTATDate(tatText);
      const dbUser = await getOrCreateUser(userId);
      const inProgressStatusId = await getStatusIdByValue(TICKET_STATUS.IN_PROGRESS);

      // Get all tickets in the group
      const allGroupTickets = await db
        .select({
          id: tickets.id,
          status_id: tickets.status_id,
          status_value: ticket_statuses.value,
          metadata: tickets.metadata,
        })
        .from(tickets)
        .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
        .where(eq(tickets.group_id, groupIdNum));

      // Apply TAT to all tickets in the group
      for (const ticket of allGroupTickets) {
        let metadata: TicketMetadata = {};
        
        if (ticket.metadata) {
          try {
            metadata = typeof ticket.metadata === 'string'
              ? JSON.parse(ticket.metadata) as TicketMetadata
              : ticket.metadata as TicketMetadata;
          } catch (e) {
            metadata = {};
          }
        }

        // Track if this is an extension
        const wasExtension = !!metadata.tat;
        const previousTAT = metadata.tat || "";
        const previousTATDate = metadata.tatDate || "";

        // Set new TAT
        metadata.tat = tatText;
        metadata.tatDate = tatDate.toISOString();
        metadata.tatSetAt = new Date().toISOString();
        metadata.tatSetBy = "System (Group TAT)";

        // Track extension if applicable
        if (wasExtension) {
          metadata.tatExtensions = metadata.tatExtensions || [];
          metadata.tatExtensions.push({
            previousTAT: previousTAT,
            newTAT: tatText,
            previousTATDate: previousTATDate,
            newTATDate: tatDate.toISOString(),
            extendedAt: new Date().toISOString(),
            extendedBy: userId,
          });
        } else {
          metadata.tatExtensions = [];
        }

        // Update ticket
        const updateData: Record<string, unknown> = {
          metadata: metadata as unknown,
          resolution_due_at: tatDate,
          updated_at: new Date(),
          assigned_to: dbUser.id,
        };

        // Mark open tickets as in_progress
        const isOpen = !ticket.status_value || ticket.status_value.toLowerCase() === TICKET_STATUS.OPEN.toLowerCase();
        if (isOpen && inProgressStatusId) {
          updateData.status_id = inProgressStatusId;
        }

        await db
          .update(tickets)
          .set(updateData)
          .where(eq(tickets.id, ticket.id));
      }
    }

    // Fetch updated group
    const [updatedGroup] = await db
      .select({
        id: ticket_groups.id,
        name: ticket_groups.name,
        description: ticket_groups.description,
        created_by: ticket_groups.created_by,
        committee_id: ticket_groups.committee_id,
        is_archived: ticket_groups.is_archived,
        created_at: ticket_groups.created_at,
        updated_at: ticket_groups.updated_at,
      })
      .from(ticket_groups)
      .where(eq(ticket_groups.id, groupIdNum))
      .limit(1);

    // Fetch committee if group has one
    let committee = null;
    if (updatedGroup?.committee_id) {
      const [committeeRecord] = await db
        .select({
          id: committees.id,
          name: committees.name,
          description: committees.description,
        })
        .from(committees)
        .where(eq(committees.id, updatedGroup.committee_id))
        .limit(1);
      
      if (committeeRecord) {
        committee = committeeRecord;
      }
    }

    const groupTickets = await db
      .select({
        id: tickets.id,
        status_id: tickets.status_id,
        status_value: ticket_statuses.value,
        category_id: tickets.category_id,
        category_name: categories.name,
        description: tickets.description,
        location: tickets.location,
        created_at: tickets.created_at,
        updated_at: tickets.updated_at,
        metadata: tickets.metadata,
        resolution_due_at: tickets.resolution_due_at,
      })
      .from(tickets)
      .leftJoin(categories, eq(tickets.category_id, categories.id))
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .where(eq(tickets.group_id, groupIdNum));

    // Safely serialize the response
    const serializedTickets = groupTickets.map(t => {
      try {
        return {
          id: typeof t.id === 'number' ? t.id : 0,
          status: typeof t.status_value === 'string' ? t.status_value : null,
          category_name: typeof t.category_name === 'string' ? t.category_name : null,
          description: typeof t.description === 'string' ? t.description : null,
          location: typeof t.location === 'string' ? t.location : null,
          created_at: t.created_at ? (typeof t.created_at === 'string' ? t.created_at : t.created_at instanceof Date ? t.created_at.toISOString() : new Date(t.created_at).toISOString()) : null,
          updated_at: t.updated_at ? (typeof t.updated_at === 'string' ? t.updated_at : t.updated_at instanceof Date ? t.updated_at.toISOString() : new Date(t.updated_at).toISOString()) : null,
          metadata: t.metadata && typeof t.metadata === 'object' ? (() => {
            try {
              return JSON.parse(JSON.stringify(t.metadata));
            } catch {
              return null;
            }
          })() : null,
          resolution_due_at: t.resolution_due_at ? (typeof t.resolution_due_at === 'string' ? t.resolution_due_at : t.resolution_due_at instanceof Date ? t.resolution_due_at.toISOString() : new Date(t.resolution_due_at).toISOString()) : null,
        };
      } catch (err) {
        console.error("Error serializing ticket:", t.id, err);
        return {
          id: typeof t.id === 'number' ? t.id : 0,
          status: null,
          category_name: null,
          description: null,
          location: null,
          created_at: null,
          updated_at: null,
          metadata: null,
          due_at: null,
          resolution_due_at: null,
        };
      }
    });

    const serializedCommittee = committee ? {
      id: typeof committee.id === 'number' ? committee.id : 0,
      name: typeof committee.name === 'string' ? committee.name : null,
      description: typeof committee.description === 'string' ? committee.description : null,
    } : null;

    if (!updatedGroup) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: typeof updatedGroup.id === 'number' ? updatedGroup.id : 0,
      name: typeof updatedGroup.name === 'string' ? updatedGroup.name : null,
      description: typeof updatedGroup.description === 'string' ? updatedGroup.description : null,
      created_by: typeof updatedGroup.created_by === 'string' ? updatedGroup.created_by : null,
      committee_id: typeof updatedGroup.committee_id === 'number' ? updatedGroup.committee_id : null,
      is_archived: typeof updatedGroup.is_archived === 'boolean' ? updatedGroup.is_archived : false,
      created_at: updatedGroup.created_at ? (typeof updatedGroup.created_at === 'string' ? updatedGroup.created_at : updatedGroup.created_at instanceof Date ? updatedGroup.created_at.toISOString() : new Date(updatedGroup.created_at).toISOString()) : null,
      updated_at: updatedGroup.updated_at ? (typeof updatedGroup.updated_at === 'string' ? updatedGroup.updated_at : updatedGroup.updated_at instanceof Date ? updatedGroup.updated_at.toISOString() : new Date(updatedGroup.updated_at).toISOString()) : null,
      committee: serializedCommittee,
      tickets: serializedTickets,
      ticketCount: serializedTickets.length,
    });
  } catch (error) {
    console.error("Error updating ticket group:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE - Delete a ticket group (ungroups all tickets)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);
    
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Only admins and super admins can delete ticket groups" }, { status: 403 });
    }

    const { groupId } = await params;
    const groupIdNum = parseInt(groupId, 10);

    if (isNaN(groupIdNum)) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
    }

    // Remove group_id from all tickets in this group
    await db
      .update(tickets)
      .set({ group_id: null })
      .where(eq(tickets.group_id, groupIdNum));

    // Delete the group
    await db
      .delete(ticket_groups)
      .where(eq(ticket_groups.id, groupIdNum));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting ticket group:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

