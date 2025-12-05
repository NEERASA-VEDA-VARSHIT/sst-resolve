import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { RatingForm } from "@/components/features/tickets/forms/RatingForm";

interface TicketRatingProps {
  ticketId: number;
  currentRating?: string;
}

export function TicketRating({ ticketId, currentRating }: TicketRatingProps) {
  return (
    <Card className="border-2 border-emerald-200 dark:border-emerald-900 bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/10 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/50">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-xl">Rate Your Experience</CardTitle>
            <CardDescription>
              Help us improve by rating your ticket resolution experience
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <RatingForm ticketId={ticketId} currentRating={currentRating} />
      </CardContent>
    </Card>
  );
}
