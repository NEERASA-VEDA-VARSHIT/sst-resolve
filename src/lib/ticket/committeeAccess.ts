/**
 * Check if a committee member can access a ticket
 */

import { db, tickets, ticket_committee_tags, committees, ticket_groups, categories } from "@/db";
import { eq, inArray, and } from "drizzle-orm";

export async function canCommitteeAccessTicket(ticketId: number, userId: string): Promise<boolean> {
  // Get committee IDs this user is the head of
  const committeeRecords = await db
    .select({ id: committees.id })
    .from(committees)
    .where(eq(committees.head_id, userId));

  const committeeIds = committeeRecords.map(c => c.id);

  // Fetch ticket to check category and created_by
  const [ticket] = await db
    .select({
      created_by: tickets.created_by,
      category_id: tickets.category_id,
      group_id: tickets.group_id,
      category_name: categories.name,
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) {
    return false;
  }

  // Check if ticket is created by this committee member
  if (ticket.created_by === userId && ticket.category_name === "Committee") {
    return true;
  }

  // Check if ticket is tagged to any of the user's committees
  if (committeeIds.length > 0) {
    // Check direct tags
    const tagRecords = await db
      .select()
      .from(ticket_committee_tags)
      .where(
        and(
          eq(ticket_committee_tags.ticket_id, ticketId),
          inArray(ticket_committee_tags.committee_id, committeeIds)
        )
      )
      .limit(1);

    if (tagRecords.length > 0) {
      return true;
    }

    // Check if ticket is in a group assigned to their committee
    if (ticket.group_id) {
      const [group] = await db
        .select({ committee_id: ticket_groups.committee_id })
        .from(ticket_groups)
        .where(eq(ticket_groups.id, ticket.group_id))
        .limit(1);

      if (group?.committee_id && committeeIds.includes(group.committee_id)) {
        return true;
      }
    }
  }

  return false;
}
