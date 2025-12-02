import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { formatStatus } from "@/lib/utils";
import type { TicketStatusDisplay } from "@/types/ticket";

interface CommitteeTicketHeaderProps {
  ticketId: number;
  status: TicketStatusDisplay | null;
  categoryName: string | null;
  subcategory?: string | null;
}

export function CommitteeTicketHeader({
  ticketId,
  status,
  categoryName,
  subcategory,
}: CommitteeTicketHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <Link href="/committee/dashboard">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Tickets
          </Button>
        </Link>
      </div>

      <Card className="border-2">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-3xl font-bold">Ticket #{ticketId}</CardTitle>
                {status && (
                  <Badge
                    variant={status.badge_color === "destructive" ? "destructive" : status.badge_color === "secondary" ? "secondary" : "outline"}
                    className={
                      status.badge_color === "destructive"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800"
                        : status.badge_color === "secondary"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                    }
                  >
                    {status.label}
                  </Badge>
                )}
                {categoryName && <Badge variant="outline">{categoryName}</Badge>}
              </div>
              {subcategory && (
                <CardDescription className="text-base">{subcategory}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>
    </>
  );
}
