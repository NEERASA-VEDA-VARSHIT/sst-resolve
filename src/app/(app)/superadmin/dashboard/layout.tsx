import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic';

export default async function SuperAdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const { userId } = await auth();

    if (!userId) {
      redirect("/");
    }

    // Ensure user exists in database
    const dbUser = await getOrCreateUser(userId);
    if (!dbUser) {
      console.error('[Super Admin Layout] Failed to create/fetch user');
      redirect("/");
    }

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
      <div className="pb-16 lg:pb-0 pt-16 lg:pt-0">
        <main className="min-h-screen p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    );
  } catch (error) {
    console.error('[Super Admin Layout] Error:', error);
    redirect("/");
  }
}


