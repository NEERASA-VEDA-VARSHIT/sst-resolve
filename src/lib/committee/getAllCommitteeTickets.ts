/**
 * Get all tickets accessible to a committee member
 * Combines created tickets and tagged tickets
 */

import { getCreatedTickets } from "./getCreatedTickets";
import { getTaggedTickets } from "./getTaggedTickets";

export async function getAllCommitteeTickets(userId: string) {
  // Fetch both created and tagged tickets in parallel
  const [createdTickets, taggedTickets] = await Promise.all([
    getCreatedTickets(userId),
    getTaggedTickets(userId),
  ]);

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
