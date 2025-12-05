import { FileText } from "lucide-react";

interface SuperAdminDashboardHeaderProps {
  unassignedCount: number;
  actualCount: number;
  pagination: {
    page: number;
    totalPages: number;
  };
  title?: string;
  description?: string;
}

export function SuperAdminDashboardHeader({ 
  unassignedCount, 
  actualCount, 
  pagination,
  title = "Super Admin Dashboard",
  description = "Manage unassigned tickets, escalations, and system-wide operations"
}: SuperAdminDashboardHeaderProps) {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          {title}
        </h1>
        <p className="text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="flex justify-between items-center pt-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <FileText className="w-6 h-6" />
          Unassigned Tickets & Escalations
          {unassignedCount > 0 && (
            <span className="ml-2 px-2 py-1 text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
              {unassignedCount} unassigned
            </span>
          )}
        </h2>
        <p className="text-sm text-muted-foreground">
          {actualCount} {actualCount === 1 ? 'ticket' : 'tickets'} on this page
          {pagination.totalPages > 1 && (
            <span className="ml-2">
              (Page {pagination.page} of {pagination.totalPages})
            </span>
          )}
        </p>
      </div>
    </>
  );
}
