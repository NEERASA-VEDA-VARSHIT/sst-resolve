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
      ? user.emailAddresses.map((email: any) => ({
          emailAddress: typeof email?.emailAddress === 'string' ? email.emailAddress : ''
        }))
      : [];

    const publicMetadata = user.publicMetadata && typeof user.publicMetadata === 'object'
      ? { role: (user.publicMetadata as any)?.role || undefined }
      : { role: undefined };

    return {
      id: String(user.id || ''),
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      emailAddresses,
      publicMetadata
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            User Management
          </h1>
          <p className="text-muted-foreground">
            Manage user roles and permissions across the system
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/superadmin/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <IntegratedUserManagement users={users} />
    </div>
  );
}

