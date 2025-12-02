import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CalendarCheck, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RotateCw, 
  MessageSquare, 
  AlertTriangle 
} from "lucide-react";
import { format } from "date-fns";
import type { TicketTimelineEntry } from "@/types/ticket";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCw,
  MessageSquare,
  AlertTriangle,
};

interface TicketTimelineProps {
  entries: TicketTimelineEntry[];
}

export function TicketTimeline({ entries }: TicketTimelineProps) {
  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <CalendarCheck className="w-4 h-4 text-primary" />
          </div>
          Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {entries.length > 1 && (
            <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-border" />
          )}
          <div className="space-y-4 relative">
            {entries.map((entry, index) => {
              const IconComponent = ICON_MAP[entry.icon] ?? AlertCircle;
              return (
                <div key={index} className="flex items-start gap-4 relative">
                  <div className={`relative z-10 p-2.5 rounded-full flex-shrink-0 border-2 bg-background ${entry.color}`}>
                    <IconComponent className={`w-4 h-4 ${entry.textColor}`} />
                  </div>
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-sm font-semibold mb-1.5 break-words">{entry.title}</p>
                      {entry.date && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{format(entry.date, 'MMM d, yyyy')}</span>
                          <span>•</span>
                          <span>{format(entry.date, 'h:mm a')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
