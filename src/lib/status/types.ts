// Client-safe type definitions for ticket statuses
// This file can be imported in client components without triggering server-only checks

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

