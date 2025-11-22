import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import { ProgressBar } from "@/components/dashboard/ProgressBar";

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
    
    if (role !== "super_admin") {
      redirect("/student/dashboard");
    }

    return (
      <div className="pb-16 lg:pb-0 pt-16 lg:pt-0">
        <ProgressBar />
        <main className="min-h-screen p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    );
  } catch (error) {
    console.error('[Super Admin Layout] Error:', error);
    redirect("/");
  }
}


