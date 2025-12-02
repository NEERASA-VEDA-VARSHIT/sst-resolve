import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { AdminActions } from "@/components/tickets/AdminActions";

interface CommitteeActionsProps {
  ticketId: number;
  currentStatus: string;
  hasTAT: boolean;
}

export function CommitteeActions({
  ticketId,
  currentStatus,
  hasTAT,
}: CommitteeActionsProps) {
  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-blue-600" />
          Committee Actions
        </CardTitle>
        <CardDescription>
          This ticket was tagged to your committee. You can manage it with full admin-style actions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AdminActions
          ticketId={ticketId}
          currentStatus={currentStatus}
          hasTAT={hasTAT}
          isSuperAdmin={false}
          currentAssignedTo={null}
          forwardTargets={[]}
        />
      </CardContent>
    </Card>
  );
}
