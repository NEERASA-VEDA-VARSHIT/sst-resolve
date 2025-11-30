/**
 * Helper function to check if all tickets in a group are closed/resolved
 * and automatically archive the group if so.
 * 
 * @param groupId - The ID of the ticket group to check
 * @returns true if the group was archived, false otherwise
 */
import { db, tickets, ticket_groups, ticket_statuses } from "@/db";
import { eq } from "drizzle-orm";
import { getTicketStatuses } from "@/lib/status/getTicketStatuses";

export async function checkAndArchiveGroupIfAllTicketsClosed(groupId: number): Promise<boolean> {
  try {
    // Get the group
    const [group] = await db
      .select()
      .from(ticket_groups)
      .where(eq(ticket_groups.id, groupId))
      .limit(1);

    if (!group || group.is_archived) {
      return false; // Group doesn't exist or already archived
    }

    // Get all tickets in the group with their status
    const allGroupTickets = await db
      .select({
        id: tickets.id,
        status: ticket_statuses.value,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(ticket_statuses.id, tickets.status_id))
      .where(eq(tickets.group_id, groupId));

    // Get ticket statuses to check which are final
    const ticketStatuses = await getTicketStatuses();
    const finalStatusValues = new Set(
      ticketStatuses.filter(s => s.is_final).map(s => s.value)
    );

    // Check if all tickets have final status (closed/resolved)
    const allTicketsClosed = allGroupTickets.length > 0 && 
      allGroupTickets.every(ticket => {
        const status = ticket.status;
        return status && finalStatusValues.has(status);
      });

    if (allTicketsClosed) {
      // Archive the group
      await db
        .update(ticket_groups)
        .set({
          is_archived: true,
          updated_at: new Date(),
        })
        .where(eq(ticket_groups.id, groupId));

      console.log(`[GroupArchive] Group ${groupId} archived - all tickets are closed`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[GroupArchive] Error checking/archiving group ${groupId}:`, error);
    return false;
  }
}

