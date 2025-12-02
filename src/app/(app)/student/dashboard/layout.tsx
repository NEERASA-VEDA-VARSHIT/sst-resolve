import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isProfileComplete } from "@/lib/auth/profile-check";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";

export default async function StudentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) redirect("/");

  // Ensure DB user exists for this Clerk ID
  const dbUser = await getOrCreateUser(userId);
  if (!dbUser) redirect("/");

  // Safety check (UUID should always exist)
  if (!dbUser.id) {
    console.error("[StudentDashboardLayout] Missing dbUser.id", dbUser);
    redirect("/");
  }

  // Get role from database (single source of truth)
  const role = await getUserRoleFromDB(userId);

  // Redirect committee members to their own dashboard
  if (role === "committee") {
    redirect("/committee/dashboard");
  }

  // Redirect admin to admin dashboard
  if (role === "admin") {
    redirect("/admin/dashboard");
  }

  // Redirect super_admin to superadmin dashboard
  if (role === "super_admin") {
    redirect("/superadmin/dashboard");
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
