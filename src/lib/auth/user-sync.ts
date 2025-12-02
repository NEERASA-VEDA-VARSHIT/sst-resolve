import { clerkClient } from "@clerk/nextjs/server";
import { db, users, roles } from "@/db";
import { eq, or, and } from "drizzle-orm";
import { logCriticalError, logWarning } from "@/lib/monitoring/alerts";

const CLERK_VERIFICATION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const clerkVerificationCache = new Map<string, number>();

function getClerkErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object") {
    const maybeStatus = (error as { status?: number }).status;
    if (typeof maybeStatus === "number") return maybeStatus;

    const maybeStatusCode = (error as { statusCode?: number }).statusCode;
    if (typeof maybeStatusCode === "number") return maybeStatusCode;
  }
  return undefined;
}

function isClerkNotFoundError(error: unknown): boolean {
  return getClerkErrorStatus(error) === 404;
}

async function fetchClerkUserOrThrow(clerkUserId: string) {
  try {
    const client = await clerkClient();
    return await client.users.getUser(clerkUserId);
  } catch (error) {
    if (isClerkNotFoundError(error)) {
      logWarning("[getOrCreateUser] Clerk user not found (deleted or disabled)", {
        clerkUserId,
      });
      const friendlyError = new Error(
        "Your account is no longer active. Please contact support."
      );
      (friendlyError as { code?: string }).code = "CLERK_USER_NOT_FOUND";
      throw friendlyError;
    }

    logCriticalError("Failed to fetch Clerk user from API", error, {
      clerkUserId,
      status: getClerkErrorStatus(error),
    });
    const friendlyError = new Error(
      "Authentication service is temporarily unavailable. Please try again."
    );
    (friendlyError as { code?: string }).code = "CLERK_API_UNAVAILABLE";
    throw friendlyError;
  }
}

async function ensureClerkUserExists(clerkUserId: string) {
  const now = Date.now();
  const lastVerified = clerkVerificationCache.get(clerkUserId);

  if (lastVerified && now - lastVerified < CLERK_VERIFICATION_TTL_MS) {
    return;
  }

  await fetchClerkUserOrThrow(clerkUserId);
  clerkVerificationCache.set(clerkUserId, now);
}

/**
 * Gets or creates a user in the database based on their Clerk ID.
 * Syncs user data from Clerk to the local database.
 * 
 * Handles the case where a user was created with a pending external_id
 * (e.g., when a student is created via admin form) and then signs up with Clerk.
 */
export async function getOrCreateUser(clerkUserId: string) {
  try {
    // First, try to find the user in the database by auth_provider and external_id
    const [existingUser] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.auth_provider, 'clerk'),
          eq(users.external_id, clerkUserId)
        )
      )
      .limit(1);

    if (existingUser) {
      // Edge case: Clerk user might have been deleted but local session persisted.
      // Periodically re-validate with Clerk (cached to avoid excessive API calls).
      await ensureClerkUserExists(clerkUserId);
      return existingUser;
    }

    // If user doesn't exist, fetch from Clerk (handles deleted/disabled users)
    const clerkUser = await fetchClerkUserOrThrow(clerkUserId);

    // Get primary email
    const primaryEmail = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId
    )?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || "";

    if (!primaryEmail) {
      throw new Error("No email address found for Clerk user");
    }

    // Build full name from first and last name
    const fullName = clerkUser.firstName || clerkUser.lastName
      ? `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim()
      : null;

    // Check if a user exists with this email (might be a pending user)
    const [userByEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, primaryEmail))
      .limit(1);

    if (userByEmail) {
      // User exists with this email - update it with the real Clerk external_id
      // This handles the case where a student was created via admin form with pending external_id
      const [updatedUser] = await db
        .update(users)
        .set({
          auth_provider: 'clerk',
          external_id: clerkUserId,
          full_name: fullName || userByEmail.full_name,
          avatar_url: clerkUser.imageUrl || userByEmail.avatar_url,
          updated_at: new Date(),
        })
        .where(eq(users.id, userByEmail.id))
        .returning();

      console.log(`[getOrCreateUser] Updated existing user ${userByEmail.id} with real Clerk ID ${clerkUserId}`);
      return updatedUser;
    }

    // Get the student role ID (default role)
    const [studentRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, "student"))
      .limit(1);

    if (!studentRole) {
      throw new Error("Student role not found in database");
    }

    // Get phone number if available
    const primaryPhone =
      (clerkUser.primaryPhoneNumber as { phoneNumber?: string } | undefined)?.phoneNumber ||
      ((clerkUser.phoneNumbers as Array<{ phoneNumber?: string }> | undefined)?.[0]?.phoneNumber) ||
      null;

    // Create new user in database
    try {
      const [newUser] = await db
        .insert(users)
        .values({
          auth_provider: 'clerk',
          external_id: clerkUserId,
          email: primaryEmail,
          // If Clerk has no phone, fall back to an empty string to satisfy NOT NULL.
          // Business flows should prompt user to fill a real phone later.
          phone: primaryPhone || "",
          full_name: fullName,
          avatar_url: clerkUser.imageUrl || null,
          role_id: studentRole.id,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning();

      return newUser;
    } catch (insertError: unknown) {
      // Handle duplicate key errors (race condition)
      // The unique constraint on (auth_provider, external_id) prevents duplicates
      if (
        insertError instanceof Error &&
        'code' in insertError &&
        insertError.code === '23505'
      ) {
        // Duplicate key - user was created between our check and insert
        // Try to fetch the user again (idempotent operation)
        const [raceConditionUser] = await db
          .select()
          .from(users)
          .where(
            or(
              and(
                eq(users.auth_provider, 'clerk'),
                eq(users.external_id, clerkUserId)
              ),
              eq(users.email, primaryEmail)
            )
          )
          .limit(1);

        if (raceConditionUser) {
          console.log(`[getOrCreateUser] User created by race condition (unique constraint prevented duplicate), returning existing user ${raceConditionUser.id}`);
          return raceConditionUser;
        }
        
        // If we still can't find the user after a duplicate key error, this is unexpected
        // Log a warning but don't throw - let the caller handle it
        console.warn(`[getOrCreateUser] Duplicate key error but user not found after retry for clerkId: ${clerkUserId}`);
        throw new Error("User creation failed due to race condition. Please try again.");
      }
      
      // Re-throw other errors
      throw insertError;
    }
  } catch (error) {
    console.error("[getOrCreateUser] Error:", error);
    throw error;
  }
}
