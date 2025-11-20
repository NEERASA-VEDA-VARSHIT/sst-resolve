import { db } from "@/db";
import { students } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Check if student profile exists (created by admin)
 * Input: dbUserId (NOT Clerk userId)
 */
export async function isProfileComplete(dbUserId: string) {
  try {
    // dbUserId must be the UUID, not Clerk user_id
    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.user_id, dbUserId))
      .limit(1);

    return !!student;
  } catch (err) {
    console.error("Error checking profile existence:", err);
    return false;
  }
}

/**
 * Get missing profile status message
 */
export async function getMissingProfileFields(dbUserId: string): Promise<string[]> {
	try {
		const [student] = await db
			.select()
			.from(students)
			.where(eq(students.user_id, dbUserId))
			.limit(1);

		if (!student) {
			return ["Profile not created yet - Contact Administration"];
		}

		return [];
	} catch (error) {
		console.error("Error getting profile status:", error);
		return ["Error checking profile - Contact Administration"];
	}
}
