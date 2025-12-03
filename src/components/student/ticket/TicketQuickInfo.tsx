import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, UserCheck, Clock } from "lucide-react";
import { format } from "date-fns";
import type { TATInfo } from "@/types/ticket";

interface TicketQuickInfoProps {
  ticketProgress: number;
  normalizedStatus: string;
  assignedStaff: { name: string; email: string | null } | null;
  tatInfo: TATInfo;
  ticket: {
    resolved_at?: Date | string | null;
    closed_at?: Date | string | null;
    updated_at?: Date | string | null;
  };
}

export function TicketQuickInfo({
  ticketProgress,
  normalizedStatus,
  assignedStaff,
  tatInfo,
  ticket,
}: TicketQuickInfoProps) {
  const isResolved = normalizedStatus === "resolved" || ticketProgress === 100;
  const isClosed = normalizedStatus === "closed";
  const isReopened = normalizedStatus === "reopened" || normalizedStatus.includes("reopened");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
      {/* Progress Card */}
      <Card className="border-2 bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-muted-foreground">Progress</span>
            </div>
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{ticketProgress}%</span>
          </div>
          <div className="relative">
            <Progress 
              value={ticketProgress} 
              className={`h-2.5 rounded-full shadow-inner ${
                normalizedStatus === "in_progress" 
                  ? "[&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:via-blue-600 [&>div]:to-blue-500 [&>div]:shadow-[0_0_8px_rgba(37,99,235,0.4)]" 
                  : normalizedStatus === "resolved" || normalizedStatus === "closed"
                  ? "[&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:via-emerald-600 [&>div]:to-emerald-500 [&>div]:shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                  : normalizedStatus === "reopened"
                  ? "[&>div]:bg-gradient-to-r [&>div]:from-indigo-500 [&>div]:via-indigo-600 [&>div]:to-indigo-500 [&>div]:shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                  : normalizedStatus === "awaiting_student_response"
                  ? "[&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:via-amber-600 [&>div]:to-amber-500 [&>div]:shadow-[0_0_8px_rgba(217,119,6,0.4)]"
                  : "[&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:via-primary/90 [&>div]:to-primary [&>div]:shadow-[0_0_8px_rgba(var(--primary),0.3)]"
              }`} 
            />
            {ticketProgress > 0 && ticketProgress < 100 && (
              <div 
                className="absolute top-0 left-0 h-2.5 rounded-full pointer-events-none overflow-hidden"
                style={{ width: `${ticketProgress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assignment Card */}
      <Card className="border-2 bg-gradient-to-br from-purple-50/50 to-purple-100/30 dark:from-purple-950/20 dark:to-purple-900/10">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-medium text-muted-foreground">Assigned To</span>
          </div>
          <p className="text-base font-semibold break-words">
            {assignedStaff ? assignedStaff.name : <span className="text-muted-foreground">Not assigned</span>}
          </p>
        </CardContent>
      </Card>

      {/* SLA Card */}
      {isResolved ? (
        <Card className="border-2 bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/10 sm:col-span-2 md:col-span-1">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-muted-foreground">Status</span>
            </div>
            <p className="text-sm font-semibold break-words text-emerald-700 dark:text-emerald-400">
              Resolved
            </p>
            {ticket.resolved_at && (
              <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800">
                <p className="text-xs text-muted-foreground">
                  Resolved on {format(new Date(ticket.resolved_at), 'MMM d, yyyy')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : isClosed ? (
        <Card className="border-2 bg-gradient-to-br from-gray-50/50 to-gray-100/30 dark:from-gray-950/20 dark:to-gray-900/10 sm:col-span-2 md:col-span-1">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-muted-foreground">Status</span>
            </div>
            <p className="text-sm font-semibold break-words text-gray-700 dark:text-gray-400">
              Closed
            </p>
            {ticket.closed_at && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                <p className="text-xs text-muted-foreground">
                  Closed on {format(new Date(ticket.closed_at), 'MMM d, yyyy')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : isReopened ? (
        <Card className="border-2 bg-gradient-to-br from-indigo-50/50 to-indigo-100/30 dark:from-indigo-950/20 dark:to-indigo-900/10 sm:col-span-2 md:col-span-1">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-medium text-muted-foreground">Status</span>
            </div>
            <p className="text-sm font-semibold break-words text-indigo-700 dark:text-indigo-400">
              Reopened
            </p>
            {(ticket.updated_at) && (
              <div className="mt-2 pt-2 border-t border-indigo-200 dark:border-indigo-800">
                <p className="text-xs text-muted-foreground">
                  Reopened on {format(new Date(ticket.updated_at), 'MMM d, yyyy')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  New TAT will be set by admin
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : tatInfo.expectedResolution ? (
        <Card className={`border-2 sm:col-span-2 md:col-span-1 ${tatInfo.isOverdue ? 'bg-gradient-to-br from-red-50/50 to-red-100/30 dark:from-red-950/20 dark:to-red-900/10' : 'bg-gradient-to-br from-green-50/50 to-green-100/30 dark:from-green-950/20 dark:to-green-900/10'}`}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className={`w-4 h-4 ${tatInfo.isOverdue ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
              <span className="text-sm font-medium text-muted-foreground">Expected Resolution</span>
            </div>
            <p className={`text-sm font-semibold break-words ${tatInfo.isOverdue ? 'text-red-700 dark:text-red-400' : ''}`}>
              {tatInfo.expectedResolution}
            </p>
            {tatInfo.tatSetAt && tatInfo.tatSetBy && (
              <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                <p className="text-xs text-muted-foreground">
                  Set by {tatInfo.tatSetBy} on {format(new Date(tatInfo.tatSetAt), 'MMM d, yyyy')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
