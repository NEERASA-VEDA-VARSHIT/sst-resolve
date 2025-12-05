import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { TicketStatusBadge } from "@/components/features/tickets/display/TicketStatusBadge";
import { ArrowLeft, FileText } from "lucide-react";
import type { TicketStatusDisplay, TicketCategory, TicketSubcategory } from "@/types/ticket";

interface TicketHeaderProps {
  ticketId: number;
  status: TicketStatusDisplay | null;
  category: TicketCategory | null;
  subcategory: TicketSubcategory | null;
}

export function TicketHeader({
  ticketId,
  status,
  category,
  subcategory,
}: TicketHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-4 mb-2 sm:mb-0">
        <Link href="/student/dashboard">
          <Button variant="ghost" size="sm" className="gap-2 hover:bg-accent/50 transition-colors h-9 sm:h-10">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Tickets</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </Link>
      </div>

      <CardHeader className="space-y-3 sm:space-y-4 pb-3 sm:pb-4 px-4 py-4 sm:px-6 sm:py-6 bg-gradient-to-r from-primary/5 via-transparent to-transparent border-b">
        <div className="flex items-start justify-between gap-3 sm:gap-4 flex-wrap">
          <div className="space-y-2 sm:space-y-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <CardTitle className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
                Ticket #{ticketId}
              </CardTitle>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <TicketStatusBadge status={status} />
              {category && (
                <Badge variant="secondary" className="font-medium text-xs sm:text-sm">
                  {category.name}
                </Badge>
              )}
              {subcategory && (
                <Badge variant="outline" className="font-medium text-xs sm:text-sm">
                  {subcategory.name}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
    </>
  );
}
