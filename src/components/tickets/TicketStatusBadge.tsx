/**
 * Reusable TicketStatusBadge component
 * Now works with dynamic ticket_statuses table
 */

import { Badge } from "@/components/ui/badge";

interface TicketStatusBadgeProps {
  // New: Accept status object from ticket_statuses table
  status?: {
    value: string;
    label: string;
    badge_color: string | null;
  } | null;
  // Legacy: Accept string value directly (for backward compatibility)
  statusValue?: string | null;
  className?: string;
}

export function TicketStatusBadge({
  status,
  statusValue,
  className = ""
}: TicketStatusBadgeProps) {
  // Use status object if provided, otherwise fall back to statusValue
  const label = status?.label || statusValue || "Unknown";
  const badgeColor = status?.badge_color || "outline";

  // Map badge_color from database to Badge variant
  const getVariant = (color: string | null) => {
    switch (color) {
      case "default":
        return "default" as const;
      case "secondary":
        return "secondary" as const;
      case "destructive":
        return "destructive" as const;
      case "outline":
      default:
        return "outline" as const;
    }
  };

  return (
    <Badge
      variant={getVariant(badgeColor)}
      className={`text-sm px-3 py-1.5 font-semibold ${className}`}
    >
      {label}
    </Badge>
  );
}
