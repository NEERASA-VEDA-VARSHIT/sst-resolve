import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { StudentNav } from "@/components/nav/StudentNav";
import { NavLoadingShimmer } from "@/components/nav/NavLoadingShimmer";

/**
 * Student Role Root Layout
 * Handles navigation and layout for all student routes
 * Protects against committee/admin/super_admin access
 */
export default async function StudentLayout({
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

  // Redirect non-student users to their appropriate dashboard
  if (role !== "student") {
    if (role === "committee") {
      redirect("/committee/dashboard");
    } else if (role === "admin") {
      redirect("/admin/dashboard");
    } else if (role === "super_admin") {
      redirect("/superadmin/dashboard");
    }
  }

  return (
    <>
      <Suspense fallback={<NavLoadingShimmer />}>
        <StudentNav />
      </Suspense>
      {children}
    </>
  );
}

