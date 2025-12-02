/**
 * Shared ticket-related types
 * Used across server and client components
 */

export interface TicketMetadata {
  tat?: string;
  tatDate?: string;
  tatSetAt?: string;
  tatSetBy?: string;
  tatExtensions?: Array<{
    previousTAT: string;
    newTAT: string;
    previousTATDate: string;
    newTATDate: string;
    extendedAt: string;
    extendedBy: string;
  }>;
  images?: string[];
  profile?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TicketStatusDisplay {
  value: string;
  label: string;
  badge_color: string | null;
}

export interface TicketCategory {
  id: number;
  name: string;
  slug?: string;
}

export interface TicketSubcategory {
  id: number;
  name: string;
  slug?: string;
}

export interface TicketSubSubcategory {
  id: number;
  name: string;
  slug: string;
}

export interface TicketComment {
  text: string;
  author?: string;
  createdAt: string | Date | null;
  created_at?: string | Date | null;
  source?: string;
  type?: string;
  isInternal?: boolean;
  [key: string]: unknown;
}

export interface TicketTimelineEntry {
  title: string;
  icon: string;
  date: Date | null;
  color: string;
  textColor: string;
}

export interface ResolvedProfileField {
  field_name: string;
  label: string;
  value: string;
}

export interface TATInfo {
  tat: string | null;
  tatDate: string | null;
  tatSetAt: string | null;
  tatSetBy: string | null;
  tatExtensions: Array<Record<string, unknown>>;
  expectedResolution: string | null;
  isOverdue: boolean;
}
