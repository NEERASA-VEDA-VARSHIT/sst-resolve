import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { isAdminLevel } from "@/conf/constants";

export default async function AdminDashboardLayout({
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
            console.error('[Admin Layout] Failed to create/fetch user');
            redirect("/");
        }

        // Get role from database (single source of truth)
        const role = await getUserRoleFromDB(userId);

        // Only allow admin, committee, or super_admin
        if (!isAdminLevel(role)) {
            redirect("/student/dashboard");
        }

        return (
            <div className="pb-16 lg:pb-0 pt-16 lg:pt-0">
                <main className="min-h-screen p-4 md:p-6 lg:p-8">{children}</main>
            </div>
        );
    } catch (error) {
        console.error('[Admin Layout] Error:', error);
        redirect("/");
    }
}
