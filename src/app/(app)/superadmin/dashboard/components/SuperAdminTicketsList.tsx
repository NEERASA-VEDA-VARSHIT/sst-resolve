import { Card, CardContent } from "@/components/ui/card";
import { TicketCard } from "@/components/layout/TicketCard";
import { FileText } from "lucide-react";
import type { Ticket } from "@/db/types-only";
import { PaginationControls } from "@/components/dashboard/PaginationControls";

interface TicketRow {
  id: number;
  title: string | null;
  description: string | null;
  location: string | null;
  status: string | null;
  status_id: number | null;
  category_id: number | null;
  subcategory_id: number | null;
  created_by: string | null;
  assigned_to: string | null;
  group_id: number | null;
  escalation_level: number | null;
  acknowledgement_due_at: Date | null;
  resolution_due_at: Date | null;
  metadata: unknown;
  created_at: Date | null;
  updated_at: Date | null;
  category_name: string | null;
  creator_name: string | null;
  creator_email: string | null;
}

interface SuperAdminTicketsListProps {
  tickets: TicketRow[];
  unassignedCount: number;
  pagination: {
    page: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    totalCount: number;
    startIndex: number;
    endIndex: number;
    actualCount: number;
  };
  basePath?: string;
}

export function SuperAdminTicketsList({ tickets, unassignedCount, pagination, basePath = "/superadmin/dashboard" }: SuperAdminTicketsListProps) {
  if (tickets.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-semibold mb-1">No tickets found</p>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Unassigned tickets and escalations will appear here. Use the filters above to search for specific tickets.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={{
              ...ticket,
              scope_id: null,
              created_at: ticket.created_at || new Date(),
              updated_at: ticket.updated_at || new Date(),
            } as unknown as Ticket & { status?: string | null; category_name?: string | null; creator_name?: string | null; creator_email?: string | null }}
            basePath={basePath}
          />
        ))}
      </div>

      <PaginationControls
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        hasNext={pagination.hasNextPage}
        hasPrev={pagination.hasPrevPage}
        totalCount={pagination.totalCount}
        startIndex={pagination.startIndex}
        endIndex={pagination.endIndex}
        baseUrl={basePath}
      />
    </>
  );
}
