import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { IntegratedUserManagement } from "@/components/admin/IntegratedUserManagement";
import { ArrowLeft, Users as UsersIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function SuperAdminUsersPage() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/");
  }

  const role = sessionClaims?.metadata?.role || 'student';

  if (role !== 'super_admin') {
    redirect('/student/dashboard');
  }

  const client = await clerkClient();
  const userList = await client.users.getUserList();

  const users = userList.data.map(user => {
    const emailAddresses = Array.isArray(user.emailAddresses)
      ? user.emailAddresses.map((email: { emailAddress?: string | null }) => ({
        emailAddress: typeof email?.emailAddress === 'string' ? email.emailAddress : String(email?.emailAddress || ''),
      }))
      : [];

    return {
      id: user.id,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null,
      emailAddresses,
      publicMetadata: user.publicMetadata || {},
    };
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/superadmin/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UsersIcon className="w-8 h-8" />
            User & Staff Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage user roles and staff assignments across the system
          </p>
        </div>
      </div>

      <IntegratedUserManagement users={users} />
    </div>
  );
}
