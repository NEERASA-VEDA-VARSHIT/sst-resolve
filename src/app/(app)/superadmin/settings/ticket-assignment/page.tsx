import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import { TicketAssignmentManager } from "@/components/admin/TicketAssignmentManager";

export default async function TicketAssignmentPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  // Ensure user exists in database
  await getOrCreateUser(userId);

  // Get role from database (single source of truth)
  const role = await getUserRoleFromDB(userId);

  if (role !== "super_admin") {
    redirect("/student/dashboard");
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold">Ticket Assignment & Notifications</h1>
        <p className="text-muted-foreground mt-2">
          Manage how tickets are automatically assigned and configure Slack notifications
        </p>
      </div>

      <TicketAssignmentManager />
    </div>
  );
}

