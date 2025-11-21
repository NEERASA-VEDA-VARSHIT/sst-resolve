import { clerkClient } from "@clerk/nextjs/server";
import { db, users, roles } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Gets or creates a user in the database based on their Clerk ID.
 * Syncs user data from Clerk to the local database.
 */
export async function getOrCreateUser(clerkUserId: string) {
  try {
    // First, try to find the user in the database
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (existingUser) {
      return existingUser;
    }

    // If user doesn't exist, fetch from Clerk and create
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkUserId);

    // Get the student role ID (default role)
    const [studentRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, "student"))
      .limit(1);

    if (!studentRole) {
      throw new Error("Student role not found in database");
    }

    // Get primary email
    const primaryEmail = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId
    )?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || "";

    // Create new user in database
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
  } catch (error) {
    console.error("[getOrCreateUser] Error:", error);
    throw error;
  }
}
