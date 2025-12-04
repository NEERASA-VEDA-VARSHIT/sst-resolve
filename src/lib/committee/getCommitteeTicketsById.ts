/**
 * Get all tickets for a specific committee (by committee ID)
 * Combines created tickets and tagged tickets
 * Used by superadmin to view tickets for any committee
 */

import { db, committees, tickets, categories, ticket_statuses, ticket_committee_tags, ticket_groups, users } from "@/db";
import { desc, eq, inArray } from "drizzle-orm";
import { mapTicketRecord } from "@/lib/ticket/mapTicketRecord";

export async function getCommitteeTicketsById(committeeId: number) {
  // Get committee with head_id
  const [committee] = await db
    .select({
      id: committees.id,
      head_id: committees.head_id,
    })
    .from(committees)
    .where(eq(committees.id, committeeId))
    .limit(1);

  if (!committee || !committee.head_id) {
    return [];
  }

  // Fetch both created and tagged tickets in parallel
  const [createdTicketRows, taggedTicketIds] = await Promise.all([
    // Get tickets created by committee head with "Committee" category
    db
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
      .where(eq(tickets.created_by, committee.head_id))
      .orderBy(desc(tickets.created_at)),
    
    // Get tickets tagged to this committee
    db
      .select({ ticket_id: ticket_committee_tags.ticket_id })
      .from(ticket_committee_tags)
      .where(eq(ticket_committee_tags.committee_id, committeeId)),
  ]);

  // Filter created tickets by "Committee" category
  const createdTickets = createdTicketRows
    .filter(t => (t.category_name || "").toLowerCase() === "committee" && t.created_by !== null)
    .map(mapTicketRecord);

  // Get tickets from groups assigned to this committee
  const groupRecords = await db
    .select({ id: ticket_groups.id })
    .from(ticket_groups)
    .where(eq(ticket_groups.committee_id, committeeId));

  const groupIds = groupRecords.map(g => g.id);
  const groupTicketIds: number[] = [];
  if (groupIds.length > 0) {
    const groupTickets = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(inArray(tickets.group_id, groupIds));
    groupTicketIds.push(...groupTickets.map(t => t.id));
  }

  // Combine directly tagged tickets and group tickets
  const allTaggedTicketIds = [
    ...taggedTicketIds.map(t => t.ticket_id),
    ...groupTicketIds
  ];

  // Remove duplicates
  const uniqueTaggedTicketIds = Array.from(new Set(allTaggedTicketIds));

  // Fetch full ticket data for tagged tickets
  const taggedTickets = uniqueTaggedTicketIds.length > 0 ? await db
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
      creator_full_name: users.full_name,
      creator_email: users.email,
    })
    .from(tickets)
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .leftJoin(users, eq(tickets.created_by, users.id))
    .where(inArray(tickets.id, uniqueTaggedTicketIds))
    .orderBy(desc(tickets.created_at))
    .then(rows => rows
      .filter(row => row.created_by !== null)
      .map(mapTicketRecord)
    ) : [];

  // Combine and deduplicate by ticket ID
  const ticketMap = new Map<number, typeof createdTickets[0]>();
  
  createdTickets.forEach(ticket => {
    ticketMap.set(ticket.id, ticket);
  });
  
  taggedTickets.forEach(ticket => {
    if (!ticketMap.has(ticket.id)) {
      ticketMap.set(ticket.id, ticket);
    }
  });

  // Return as array, sorted by created_at (most recent first)
  return Array.from(ticketMap.values()).sort((a, b) => {
    const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bDate - aDate;
  });
}
