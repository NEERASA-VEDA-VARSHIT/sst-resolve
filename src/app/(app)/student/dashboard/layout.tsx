import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isProfileComplete } from "@/lib/auth/profile-check";
import { getCachedUser } from "@/lib/cache/cached-queries";

/**
 * Student Dashboard Layout
 * Note: Auth and role checks are handled by parent student/layout.tsx
 * This layout only handles profile completion check
 */
export default async function StudentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layout ensures userId exists and user is a student
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized"); // TypeScript type guard - parent layout ensures this never happens

  // Use cached function for better performance (request-scoped deduplication)
  // Parent layout already ensures user exists, so dbUser will exist
  const dbUser = await getCachedUser(userId);

  // Safety check (UUID should always exist)
  if (!dbUser.id) {
    console.error("[StudentDashboardLayout] Missing dbUser.id", dbUser);
    redirect("/");
  }

  // Profile check must use DB UUID (not Clerk ID)
  const profileComplete = await isProfileComplete(dbUser.id);

  if (!profileComplete) {
    redirect("/student/profile");
  }

  return (
    <div className="pb-16 lg:pb-0 pt-16 lg:pt-0">
      <main className="min-h-screen p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}
