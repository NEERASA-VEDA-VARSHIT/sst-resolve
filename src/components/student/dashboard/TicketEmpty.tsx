import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function TicketEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 border-2 border-dashed rounded-lg bg-muted/30">
      <div className="text-center space-y-3 max-w-sm">
        <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
          <Plus className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
        </div>
        <h3 className="text-base sm:text-lg font-semibold">No tickets yet</h3>
        <p className="text-sm sm:text-base text-muted-foreground">
          Get started by creating your first support ticket. We're here to
          help!
        </p>
        <Link
          href="/student/dashboard/ticket/new"
          className="inline-block mt-4"
        >
          <Button className="text-sm sm:text-base">
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Create Your First Ticket</span>
            <span className="sm:hidden">Create Ticket</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
