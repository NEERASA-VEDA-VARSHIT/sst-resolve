/**
 * Student Model - TypeScript types derived from database schema
 */

import type { Hostel } from "@/schema/student.schema";

/**
 * Student Model (matches database schema)
 */
export interface Student {
  id: number;
  userNumber: string;
  fullName: string | null;
  email: string | null;
  roomNumber: string | null;
  mobile: string | null;
  hostel: Hostel | null;
  whatsappNumber: string | null;
  ticketsThisWeek: string | null;
  lastTicketDate: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/**
 * Student Profile (for display/editing)
 */
export interface StudentProfile {
  userNumber: string;
  fullName: string | null;
  email: string | null;
  roomNumber: string | null;
  mobile: string | null;
  hostel: Hostel | null;
  whatsappNumber: string | null;
}

/**
 * Helper function to check if student can create ticket
 */
export function canCreateTicket(student: Student | null, maxTicketsPerWeek: number = 3): {
  allowed: boolean;
  reason?: string;
} {
  if (!student) {
    return { allowed: false, reason: "Student profile not found" };
  }

  // Check ticket limit
  const ticketsThisWeek = parseInt(student.ticketsThisWeek || "0", 10);
  if (ticketsThisWeek >= maxTicketsPerWeek) {
    return {
      allowed: false,
      reason: `You have reached the weekly ticket limit (${maxTicketsPerWeek} tickets/week)`,
    };
  }

  return { allowed: true };
}

/**
 * Helper function to format student name
 */
export function formatStudentName(student: Student | null): string {
  if (!student) return "Unknown";
  return student.fullName || student.userNumber || "Unknown";
}

/**
 * Helper function to get student contact info
 */
export function getStudentContact(student: Student): {
  email: string | null;
  mobile: string | null;
  whatsapp: string | null;
} {
  return {
    email: student.email,
    mobile: student.mobile,
    whatsapp: student.whatsappNumber || student.mobile,
  };
}

