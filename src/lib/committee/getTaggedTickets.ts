/**
 * Get tickets tagged to committees (via committee tags + groups)
 */

import { db, tickets, ticket_committee_tags, committees, categories, ticket_statuses, ticket_groups } from "@/db";
import { desc, eq, inArray } from "drizzle-orm";
import { mapTicketRecord } from "@/lib/ticket/mapTicketRecord";

export async function getTaggedTickets(userId: string) {
  // Get committee IDs this user is the head of (using head_id)
  const committeeRecords = await db
    .select({ id: committees.id })
    .from(committees)
    .where(eq(committees.head_id, userId));

  const committeeIds = committeeRecords.map(c => c.id);

  if (committeeIds.length === 0) {
    return [];
  }

  // Get tickets directly tagged to committees
  const tagRecords = await db
    .select({ ticket_id: ticket_committee_tags.ticket_id })
    .from(ticket_committee_tags)
    .where(inArray(ticket_committee_tags.committee_id, committeeIds));

  // Get tickets from groups assigned to committees
  const groupRecords = await db
    .select({ id: ticket_groups.id })
    .from(ticket_groups)
    .where(inArray(ticket_groups.committee_id, committeeIds));

  const groupIds = groupRecords.map(g => g.id);

  // Get ticket IDs from groups
  const groupTicketIds: number[] = [];
  if (groupIds.length > 0) {
    const groupTickets = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(inArray(tickets.group_id, groupIds));
    groupTicketIds.push(...groupTickets.map(t => t.id));
  }

  // Combine directly tagged tickets and group tickets
  const taggedTicketIds = [
    ...tagRecords.map(t => t.ticket_id),
    ...groupTicketIds
  ];

  // Remove duplicates
  const uniqueTaggedTicketIds = Array.from(new Set(taggedTicketIds));

  if (uniqueTaggedTicketIds.length === 0) {
    return [];
  }

  // Fetch full ticket data
  const taggedTicketRows = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      location: tickets.location,
      status_id: tickets.status_id,
      status_value: ticket_statuses.value,
      category_id: tickets.category_id,
      subcategory_id: tickets.subcategory_id,
      sub_subcategory_id: tickets.sub_subcategory_id,
      created_by: tickets.created_by,
      assigned_to: tickets.assigned_to,
      group_id: tickets.group_id,
      escalation_level: tickets.escalation_level,
      acknowledgement_due_at: tickets.acknowledgement_due_at,
      resolution_due_at: tickets.resolution_due_at,
      metadata: tickets.metadata,
      created_at: tickets.created_at,
      updated_at: tickets.updated_at,
      category_name: categories.name,
    })
    .from(tickets)
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .where(inArray(tickets.id, uniqueTaggedTicketIds))
    .orderBy(desc(tickets.created_at));

  // Filter out rows with null created_by before mapping
  return taggedTicketRows
    .filter(row => row.created_by !== null)
    .map(mapTicketRecord);
}
