/**
 * Get tickets created by a committee head
 */

import { db, tickets, categories, ticket_statuses } from "@/db";
import { desc, eq } from "drizzle-orm";
import { mapTicketRecord } from "@/lib/ticket/data/mapTicketRecord";

export async function getCreatedTickets(userId: string) {
  const ticketRows = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      location: tickets.location,
      status_id: tickets.status_id,
      status_value: ticket_statuses.value,
      category_id: tickets.category_id,
      subcategory_id: tickets.subcategory_id,
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
    .where(eq(tickets.created_by, userId))
    .orderBy(desc(tickets.created_at));

  // Filter by category name = "Committee" and created_by not null, then transform for TicketCard
  return ticketRows
    .filter(t => (t.category_name || "").toLowerCase() === "committee" && t.created_by !== null)
    .map(mapTicketRecord);
}
