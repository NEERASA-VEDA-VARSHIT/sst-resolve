/**
 * Ticket Model - TypeScript types derived from database schema
 */

import type { TicketStatus, TicketCategory, TicketDetails } from "@/schema/ticket.schema";

/**
 * Ticket Model (matches database schema)
 */
export interface Ticket {
  id: number;
  userNumber: string;
  category: string;
  subcategory: string;
  description: string | null;
  location: string | null;
  details: string | null; // JSON string
  status: TicketStatus | null;
  assignedTo: string | null; // Clerk userId
  escalationCount: string | null;
  escalatedAt: Date | null;
  escalatedTo: string | null;
  rating: string | null;
  ratingSubmitted: Date | null;
  ratingRequired: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/**
 * Ticket with parsed details
 */
export interface TicketWithDetails extends Omit<Ticket, "details"> {
  details: TicketDetails | null;
}

/**
 * Comment Model (from ticket details)
 */
export interface Comment {
  text: string;
  author: string;
  createdAt: string;
  source?: string;
  type?: "student_visible" | "internal_note" | "super_admin_note";
  isInternal?: boolean;
}

/**
 * Ticket Statistics
 */
export interface TicketStats {
  total: number;
  open: number;
  closed: number;
  inProgress: number;
}

/**
 * Category-wise ticket counts
 */
export interface CategoryCounts {
  Hostel: number;
  College: number;
}

/**
 * Category status breakdown
 */
export interface CategoryStatusCounts {
  Hostel: {
    open: number;
    inProgress: number;
    closed: number;
  };
  College: {
    open: number;
    inProgress: number;
    closed: number;
  };
}

/**
 * Helper function to parse ticket details
 */
export function parseTicketDetails(ticket: Ticket): TicketWithDetails {
  let details: TicketDetails | null = null;
  
  if (ticket.details) {
    try {
      details = JSON.parse(ticket.details) as TicketDetails;
    } catch (e) {
      console.error("Error parsing ticket details:", e);
    }
  }
  
  return {
    ...ticket,
    details,
  };
}

/**
 * Helper function to get ticket status display
 */
export function getStatusDisplay(status: TicketStatus | null | undefined): string {
  if (!status) return "Unknown";
  return status.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Helper function to get status badge variant
 */
export function getStatusVariant(status: TicketStatus | null | undefined): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "open":
      return "default";
    case "closed":
    case "resolved":
      return "secondary";
    case "in_progress":
      return "outline";
    case "awaiting_student_response":
      return "outline";
    default:
      return "outline";
  }
}

/**
 * Helper function to check if ticket can be escalated
 */
export function canEscalateTicket(ticket: Ticket): boolean {
  if (!ticket.status) return false;
  return ticket.status !== "closed" && ticket.status !== "resolved";
}

/**
 * Helper function to check if ticket requires rating
 */
export function requiresRating(ticket: Ticket): boolean {
  return ticket.ratingRequired === "true" && !ticket.rating;
}

/**
 * Helper function to get escalation priority
 */
export function getEscalationPriority(escalationCount: string | null): "normal" | "high" | "urgent" {
  const count = parseInt(escalationCount || "0", 10);
  if (count >= 2) return "urgent";
  if (count === 1) return "high";
  return "normal";
}

