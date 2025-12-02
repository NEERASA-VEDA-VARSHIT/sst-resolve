/**
 * Status normalization utilities
 * Ensures consistent status value handling across the application
 */

import { getCanonicalStatus } from "@/conf/constants";
import type { TicketStatusValue } from "@/conf/constants";

/**
 * Normalize a status value to canonical form
 * Handles both uppercase DB values (OPEN, IN_PROGRESS) and lowercase constants (open, in_progress)
 * Also handles aliases (awaiting_student_response -> awaiting_student, closed -> resolved)
 */
export function normalizeStatus(status: string | null | undefined): TicketStatusValue | null {
  if (!status) return null;
  return getCanonicalStatus(status);
}

/**
 * Check if two status values match (after normalization)
 */
export function statusMatches(status1: string | null | undefined, status2: string | null | undefined): boolean {
  const normalized1 = normalizeStatus(status1);
  const normalized2 = normalizeStatus(status2);
  if (!normalized1 || !normalized2) return false;
  return normalized1 === normalized2;
}

/**
 * Check if a status is a final status (resolved, closed, etc.)
 * Uses database status metadata if available, otherwise checks canonical values
 */
export function isFinalStatus(
  status: string | null | undefined,
  finalStatusValues?: Set<string>
): boolean {
  if (!status) return false;
  const normalized = normalizeStatus(status);
  if (!normalized) return false;
  
  // If final status set provided, use it
  if (finalStatusValues) {
    return finalStatusValues.has(normalized);
  }
  
  // Otherwise, check against known final statuses
  return normalized === "resolved";
}

/**
 * Check if a status is an open/pending status (not final)
 */
export function isOpenStatus(
  status: string | null | undefined,
  finalStatusValues?: Set<string>
): boolean {
  return !isFinalStatus(status, finalStatusValues);
}
