import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { SuperAdminLayoutShell } from "@/components/nav/SuperAdminLayoutShell";

/**
 * Super Admin Role Root Layout
 * Handles navigation and layout for all superadmin routes
 * Protects against committee/admin/student access
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  // Ensure user exists in database
  await getOrCreateUser(userId);

  // Get role from database (single source of truth)
  const role = await getUserRoleFromDB(userId);

  // Redirect non-super_admin users to their appropriate dashboard
  if (role !== "super_admin") {
    if (role === "committee") {
      redirect("/committee/dashboard");
    } else if (role === "admin") {
      redirect("/admin/dashboard");
    } else {
      redirect("/student/dashboard");
    }
  }

  return (
    <SuperAdminLayoutShell>{children}</SuperAdminLayoutShell>
  );
}

