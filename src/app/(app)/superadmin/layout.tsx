import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRole, ensureUser } from "@/lib/auth/api-auth";
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
  await ensureUser(userId);

  // Get role from API (single source of truth)
  const role = await getUserRole(userId);

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

