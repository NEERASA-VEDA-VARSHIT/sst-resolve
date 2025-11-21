import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

export default async function SuperAdminFormsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  // Ensure user exists in database
  await getOrCreateUser(userId);

  // Get role from database (single source of truth)
  const role = await getUserRoleFromDB(userId);
  if (role !== "super_admin") redirect("/student/dashboard");

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Forms Management</h1>
      <p className="text-muted-foreground">Form management coming soon...</p>
    </div>
  );
}
