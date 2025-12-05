import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRole, ensureUser } from "@/lib/auth/api-auth";
import { RoleNav } from "@/components/nav/RoleNav";
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
  await ensureUser(userId);

  // Get role from API (single source of truth)
  const role = await getUserRole(userId);

  // Redirect committee members to their own dashboard
  if (role === "committee") {
    redirect("/committee/dashboard");
  }

  // Redirect super_admin to superadmin dashboard
  if (role === "super_admin") {
    redirect("/superadmin/dashboard");
  }

  // Redirect snr_admin to snr-admin dashboard
  if (role === "snr_admin") {
    redirect("/snr-admin/dashboard");
  }

  // Only allow admin role (exclude committee, super_admin, snr_admin, and students)
  if (role !== "admin") {
    redirect("/student/dashboard");
  }

  return (
    <>
      <Suspense fallback={<NavLoadingShimmer />}>
        <RoleNav role="admin" />
      </Suspense>
      {children}
    </>
  );
}

