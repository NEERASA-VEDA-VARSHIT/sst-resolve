import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRole, ensureUser } from "@/lib/auth/api-auth";
import { RoleNav } from "@/components/nav/RoleNav";
import { NavLoadingShimmer } from "@/components/nav/NavLoadingShimmer";

/**
 * Senior Admin Role Root Layout
 * Handles navigation and layout for all snr-admin routes
 * Protects against non-snr_admin access
 * 
 * Permissions:
 * - View ALL tickets (not just assigned)
 * - Manage committees (create, edit, delete)
 * - Manage categories/subcategories
 * - All standard admin features
 * 
 * Does NOT have:
 * - User management (superadmin only)
 * - Domain/scope management (superadmin only)
 * - Master data management (superadmin only)
 */
export default async function SnrAdminLayout({
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

  // Redirect non-snr_admin users to their appropriate dashboard
  if (role !== "snr_admin") {
    if (role === "super_admin") {
      redirect("/superadmin/dashboard");
    } else if (role === "admin") {
      redirect("/admin/dashboard");
    } else if (role === "committee") {
      redirect("/committee/dashboard");
    } else {
      redirect("/student/dashboard");
    }
  }

  return (
    <>
      <Suspense fallback={<NavLoadingShimmer />}>
        <RoleNav role="snr_admin" />
      </Suspense>
      {children}
    </>
  );
}
