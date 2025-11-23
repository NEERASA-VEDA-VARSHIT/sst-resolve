/**
 * Student Profile Check for Middleware
 * Fast, optimized check for Edge runtime
 */

import { db, users, students } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Check if a student profile exists and is linked
 * Returns true if student has a complete profile in the database
 * Used by middleware to gate access to ticket creation
 */
export async function hasStudentProfile(clerkUserId: string): Promise<boolean> {
  try {
    // Single optimized query with join
    const result = await db
      .select({ 
        studentId: students.id,
        active: students.active,
      })
      .from(users)
      .innerJoin(students, eq(students.user_id, users.id))
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    // Profile exists and is active
    return result.length > 0 && result[0].active === true;
  } catch (error) {
    console.error("[Student Profile Check] Error:", error);
    // On error, allow access (fail open to avoid blocking legitimate users)
    return true;
  }
}

/**
 * Cached version with 10-second TTL for production
 * Reduces database load in middleware
 */
const profileCache = new Map<string, { hasProfile: boolean; expires: number }>();

export async function hasStudentProfileCached(clerkUserId: string): Promise<boolean> {
  const now = Date.now();
  const cached = profileCache.get(clerkUserId);
  
  if (cached && cached.expires > now) {
    return cached.hasProfile;
  }

  const hasProfile = await hasStudentProfile(clerkUserId);
  
  // Cache for 10 seconds
  profileCache.set(clerkUserId, { 
    hasProfile, 
    expires: now + 10_000 
  });

  return hasProfile;
}
