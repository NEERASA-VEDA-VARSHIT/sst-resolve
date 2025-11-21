
import 'dotenv/config';
import { db, users, roles } from "@/db";
import { eq } from "drizzle-orm";

const CLERK_ID = "user_35jfwc3NCPRHASrnR7SZIcEgcuI";

async function main() {
  console.log(`Promoting user ${CLERK_ID} to super_admin...`);

  // 1. Find the super_admin role ID
  const superAdminRole = await db.query.roles.findFirst({
    where: eq(roles.name, "super_admin"),
  });

  if (!superAdminRole) {
    console.error("Error: 'super_admin' role not found in database.");
    process.exit(1);
  }

  console.log(`Found super_admin role ID: ${superAdminRole.id}`);

  // 2. Find the user
  const user = await db.query.users.findFirst({
    where: eq(users.clerk_id, CLERK_ID),
  });

  if (!user) {
    console.error(`Error: User with Clerk ID ${CLERK_ID} not found.`);
    process.exit(1);
  }

  console.log(`Found user: ${user.first_name} ${user.last_name} (ID: ${user.id})`);
  console.log(`Current role ID: ${user.role_id}`);

  // 3. Update the user's role
  await db
    .update(users)
    .set({ role_id: superAdminRole.id })
    .where(eq(users.id, user.id));

  console.log("Successfully updated user role to super_admin.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error executing script:", err);
  process.exit(1);
});
