import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { AdminNav } from "@/components/nav/AdminNav";
import { NavLoadingShimmer } from "@/components/nav/NavLoadingShimmer";

/**
 * Admin Role Root Layout
 * Handles navigation and layout for all admin routes
 * Protects against committee/student/super_admin access
 */
export default async function AdminLayout({
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

  // Redirect committee members to their own dashboard
  if (role === "committee") {
    redirect("/committee/dashboard");
  }

  // Redirect super_admin to superadmin dashboard
  if (role === "super_admin") {
    redirect("/superadmin/dashboard");
  }

  // Only allow admin role (exclude committee, super_admin, and students)
  if (role !== "admin") {
    redirect("/student/dashboard");
  }

  return (
    <>
      <Suspense fallback={<NavLoadingShimmer />}>
        <AdminNav />
      </Suspense>
      {children}
    </>
  );
}

