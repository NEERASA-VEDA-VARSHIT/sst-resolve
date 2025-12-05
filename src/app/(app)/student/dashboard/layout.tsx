import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { isProfileComplete } from "@/lib/auth/profile-check";
import { getCachedUser } from "@/lib/cache/cached-queries";

/**
 * Student Dashboard Layout
 * Note: Auth and role checks are handled by parent student/layout.tsx
 * This layout only handles profile completion check
 * 
 * DO NOT call auth() or redirect based on userId here - creates loops!
 * Parent layout already verified userId exists.
 */
export default async function StudentDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Get userId from auth (should exist - parent layout verified)
  const { userId } = await auth();
  
  // If userId is null, something went wrong at parent layout level
  // Just render children - page will show error message
  if (!userId) {
    return <>{children}</>;
  }

  // Use cached function for better performance (request-scoped deduplication)
  // Parent layout already ensures user exists, so dbUser will exist
  const dbUser = await getCachedUser(userId);

  // Safety check (UUID should always exist)
  if (!dbUser.id) {
    console.error("[StudentDashboardLayout] Missing dbUser.id", dbUser);
    return <>{children}</>;
  }

  // Profile check must use DB UUID (not Clerk ID)
  const profileComplete = await isProfileComplete(dbUser.id);

  // Temporarily disabled to prevent redirect loops
  // TODO: Re-enable after fixing auth flow
  // if (!profileComplete) {
  //   redirect("/student/profile");
  // }

  return (
    <div className="pb-16 lg:pb-0 pt-16 lg:pt-0">
      <main className="min-h-screen p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}
