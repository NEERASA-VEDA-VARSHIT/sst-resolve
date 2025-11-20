/**
 * Reusable TicketStatusBadge component
 * Encapsulates status variant logic and styling
 */

import { Badge } from "@/components/ui/badge";
import { normalizeStatusForComparison, formatStatus } from "@/lib/utils";
import { enumToStatus } from "@/db/status-mapper";

interface TicketStatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

export function TicketStatusBadge({ status, className = "" }: TicketStatusBadgeProps) {
  const normalized = normalizeStatusForComparison(status);
  
  const getVariant = () => {
    switch (normalized) {
      case "open":
      case "reopened":
        return "default" as const;
      case "in_progress":
      case "awaiting_student_response":
        return "outline" as const;
      case "closed":
      case "resolved":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  if (!status) return null;

  return (
    <Badge 
      variant={getVariant()} 
      className={`text-sm px-3 py-1.5 font-semibold ${className}`}
    >
      {formatStatus(enumToStatus(status))}
    </Badge>
  );
}
