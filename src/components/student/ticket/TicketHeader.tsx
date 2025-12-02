import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { TicketStatusBadge } from "@/components/tickets/TicketStatusBadge";
import { ArrowLeft, FileText } from "lucide-react";
import type { TicketStatusDisplay, TicketCategory, TicketSubcategory, TicketSubSubcategory } from "@/types/ticket";

interface TicketHeaderProps {
  ticketId: number;
  status: TicketStatusDisplay | null;
  category: TicketCategory | null;
  subcategory: TicketSubcategory | null;
  subSubcategory: TicketSubSubcategory | null;
}

export function TicketHeader({
  ticketId,
  status,
  category,
  subcategory,
  subSubcategory,
}: TicketHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-4">
        <Link href="/student/dashboard">
          <Button variant="ghost" className="gap-2 hover:bg-accent/50 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Tickets</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </Link>
      </div>

      <CardHeader className="space-y-4 pb-4 p-6 bg-gradient-to-r from-primary/5 via-transparent to-transparent border-b">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-3xl sm:text-4xl font-bold tracking-tight">
                Ticket #{ticketId}
              </CardTitle>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <TicketStatusBadge status={status} />
              {category && (
                <Badge variant="secondary" className="font-medium">
                  {category.name}
                </Badge>
              )}
              {subcategory && (
                <Badge variant="outline" className="font-medium">
                  {subcategory.name}
                </Badge>
              )}
              {subSubcategory && (
                <Badge variant="outline" className="font-medium text-xs">
                  {subSubcategory.name}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
    </>
  );
}
