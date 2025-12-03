import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { SuperAdminNav } from "@/components/nav/SuperAdminNav";
import { NavLoadingShimmer } from "@/components/nav/NavLoadingShimmer";
import { SuperAdminSideNav } from "@/components/nav/SuperAdminSideNav";

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
    <>
      <Suspense fallback={<NavLoadingShimmer />}>
        <SuperAdminNav />
      </Suspense>
      <div className="lg:flex">
        <SuperAdminSideNav />
        <main className="flex-1 lg:ml-56">{children}</main>
      </div>
    </>
  );
}

