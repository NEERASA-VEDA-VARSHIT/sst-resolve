import { TicketListSkeleton } from "@/components/dashboard/DashboardSkeleton";

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Escalated Tickets</h1>
        <p className="text-muted-foreground">Tickets that require immediate attention</p>
      </div>
      <TicketListSkeleton />
    </div>
  );
}

