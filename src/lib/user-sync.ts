import { clerkClient } from "@clerk/nextjs/server";
import { db, users, roles } from "@/db";
import { eq, or } from "drizzle-orm";

/**
 * Gets or creates a user in the database based on their Clerk ID.
 * Syncs user data from Clerk to the local database.
 * 
 * Handles the case where a user was created with a pending clerk_id
 * (e.g., when a student is created via admin form) and then signs up with Clerk.
 */
export async function getOrCreateUser(clerkUserId: string) {
  try {
    // First, try to find the user in the database by clerk_id
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
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

    // Check if a user exists with this email (might be a pending user)
    const [userByEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, primaryEmail))
      .limit(1);

    if (userByEmail) {
      // User exists with this email - update it with the real clerk_id
      // This handles the case where a student was created via admin form with pending_ clerk_id
      const [updatedUser] = await db
        .update(users)
        .set({
          clerk_id: clerkUserId,
          first_name: clerkUser.firstName || userByEmail.first_name,
          last_name: clerkUser.lastName || userByEmail.last_name,
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

    // Create new user in database
    try {
      const [newUser] = await db
        .insert(users)
        .values({
          clerk_id: clerkUserId,
          email: primaryEmail,
          first_name: clerkUser.firstName || null,
          last_name: clerkUser.lastName || null,
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
              eq(users.clerk_id, clerkUserId),
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
