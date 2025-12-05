import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRole, ensureUser } from "@/lib/auth/api-auth";
import { RoleNav } from "@/components/nav/RoleNav";
import { NavLoadingShimmer } from "@/components/nav/NavLoadingShimmer";

/**
 * Committee Role Root Layout
 * Handles navigation and layout for all committee routes
 * Protects against admin/student/super_admin access
 */
export default async function CommitteeLayout({
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

  // Redirect non-committee users to their appropriate dashboard
  if (role !== "committee") {
    if (role === "admin") {
      redirect("/admin/dashboard");
    } else if (role === "super_admin") {
      redirect("/superadmin/dashboard");
    } else {
      redirect("/student/dashboard");
    }
  }

  return (
    <>
      <Suspense fallback={<NavLoadingShimmer />}>
        <RoleNav role="committee" />
      </Suspense>
      {children}
    </>
  );
}

