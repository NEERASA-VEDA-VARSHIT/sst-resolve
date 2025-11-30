import { clerkClient } from "@clerk/nextjs/server";
import { db, users, roles } from "@/db";
import { eq, or, and } from "drizzle-orm";

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
      return existingUser;
    }

    // If user doesn't exist, fetch from Clerk
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkUserId);

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
      if (
        insertError instanceof Error &&
        'code' in insertError &&
        insertError.code === '23505'
      ) {
        // Duplicate key - user was created between our check and insert
        // Try to fetch the user again
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
          console.log(`[getOrCreateUser] User created by race condition, returning existing user ${raceConditionUser.id}`);
          return raceConditionUser;
        }
      }
      throw insertError;
    }
  } catch (error) {
    console.error("[getOrCreateUser] Error:", error);
    throw error;
  }
}
