import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { NotificationSettingsManager } from "@/components/superadmin/NotificationSettingsManager";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  const user = await getOrCreateUser(userId);
  if (!user) {
    redirect("/");
  }

  const role = await getUserRoleFromDB(userId);
  if (role !== "super_admin") {
    redirect("/superadmin/dashboard");
  }

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Notification Settings
        </h1>
        <p className="text-muted-foreground">
          Manage Slack channels and email CC recipients for ticket notifications
        </p>
      </div>

      <NotificationSettingsManager />
    </div>
  );
}
