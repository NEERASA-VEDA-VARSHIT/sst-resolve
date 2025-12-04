import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function DashboardHeader() {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          My Tickets
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
          Manage and track all your support tickets
        </p>
      </div>
      <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
        <Link href="/student/dashboard/ticket/new" className="flex-1 sm:flex-initial">
          <Button className="w-full sm:w-auto shadow-md hover:shadow-lg transition-shadow text-sm sm:text-base">
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">New Ticket</span>
            <span className="sm:hidden">New</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
