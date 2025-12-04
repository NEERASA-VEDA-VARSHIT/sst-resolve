import { TicketCard } from "@/components/layout/TicketCard";
import type { Ticket } from "@/db/types-only";

interface TicketListProps {
  tickets: Array<{
    id: number | null;
    title: string | null;
    description: string | null;
    location: string | null;
    status_id: number | null;
    status: string | null;
    category_id: number | null;
    subcategory_id: number | null;
    scope_id: number | null;
    created_by: string | null;
    assigned_to: string | null;
    escalation_level: number;
    acknowledgement_due_at: string | null;
    resolution_due_at: string | null;
    metadata: Record<string, unknown>;
    created_at: string | null;
    updated_at: string | null;
    category_name: string | null;
    creator_name: string | null;
    creator_email: string | null;
  }>;
}

export function TicketList({ tickets }: TicketListProps) {
  if (tickets.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
      {tickets.map((ticket) => (
        <TicketCard
          key={ticket.id}
          ticket={ticket as unknown as Ticket & {
            status?: string | null;
            category_name?: string | null;
            creator_name?: string | null;
            creator_email?: string | null;
          }}
        />
      ))}
    </div>
  );
}
