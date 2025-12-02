// Shared ticket status types (domain-level)
// Safe to import in both server and client code.

export interface TicketStatus {
  id: number;
  value: string;
  label: string;
  description: string | null;
  progress_percent: number;
  badge_color: string | null;
  is_active: boolean;
  is_final: boolean;
  display_order: number;
}

