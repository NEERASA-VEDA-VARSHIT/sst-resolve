import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRole, ensureUser } from "@/lib/auth/api-auth";
import { RoleNav } from "@/components/nav/RoleNav";
import { NavLoadingShimmer } from "@/components/nav/NavLoadingShimmer";

/**
 * Student Role Root Layout
 * Handles navigation and layout for all student routes
 * Protects against committee/admin/super_admin access
 * 
 * NOTE: Middleware has already verified userId exists before allowing access to /student/*
 * This layout should NOT redirect based on auth(), as that creates redirect loops.
 * If middleware allowed access, userId exists in Clerk session.
 */
export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get userId from Clerk session (should exist since middleware verified)
  const { userId } = await auth();

  // If userId is somehow null, the middleware should have prevented access
  // Don't throw - just return children and let nested layout/page handle it
  if (!userId) {
    // Return children - nested page/layout will handle auth errors gracefully
    return (
      <>
        <Suspense fallback={<NavLoadingShimmer />}>
          <RoleNav role="student" />
        </Suspense>
        {children}
      </>
    );
  }

  // Ensure user exists in database (non-blocking - don't fail if this errors)
  try {
    await ensureUser(userId);
  } catch (error) {
    console.error("[Student Layout] Failed to create user:", error);
    // Continue anyway - will default to student role
  }

  // Get role from API (single source of truth)
  // If this fails, default to student and don't redirect
  let role: string = "student";
  try {
    const dbRole = await getUserRole(userId);
    role = dbRole || "student";
  } catch (error) {
    console.error("[Student Layout] Failed to get role:", error);
    // Default to student - don't redirect
    role = "student";
  }

  // Only redirect if role is explicitly set to non-student AND we successfully got it
  // This prevents redirect loops when DB queries fail
  if (role && role !== "student" && role !== "snr_admin") {
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
        <RoleNav role="student" />
      </Suspense>
      {children}
    </>
  );
}

