import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { IntegratedUserManagement } from "@/components/admin/IntegratedUserManagement";
import { ArrowLeft, Users as UsersIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { db, users, roles } from "@/db";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";

export default async function SuperAdminUsersPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  // Get role from database (single source of truth)
  const role = await getUserRoleFromDB(userId);

  if (role !== 'super_admin') {
    redirect('/student/dashboard');
  }

  // Fetch all users from database with their roles
  const dbUsers = await db
    .select({
      id: users.id,
      clerkId: users.clerk_id,
      firstName: users.first_name,
      lastName: users.last_name,
      email: users.email,
      roleName: roles.name,
    })
    .from(users)
    .leftJoin(roles, eq(users.role_id, roles.id));

  // Get Clerk user details for email addresses
  // Optimize: Only fetch Clerk data when needed (missing email or name), and batch with concurrency limit
  const client = await clerkClient();
  const clerkUserMap = new Map<string, { emailAddresses: Array<{ emailAddress: string }>; firstName: string | null; lastName: string | null }>();

  // Filter users that need Clerk data (only if missing email or name in DB)
  // This significantly reduces API calls
  const usersNeedingClerkData = dbUsers.filter(u => u.clerkId && (!u.email || !u.firstName || !u.lastName));

  // Batch Clerk API calls with concurrency limit to avoid rate limits and timeouts
  const BATCH_SIZE = 10; // Process 10 users at a time to avoid overwhelming Clerk API
  
  for (let i = 0; i < usersNeedingClerkData.length; i += BATCH_SIZE) {
    const batch = usersNeedingClerkData.slice(i, i + BATCH_SIZE);
    
    await Promise.all(
      batch.map(async (dbUser) => {
        try {
          // Use Promise.race with timeout to prevent hanging (5 second timeout)
          const clerkUser = await Promise.race([
            client.users.getUser(dbUser.clerkId!),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Clerk API timeout')), 5000)
            )
          ]);

          const emailAddresses = Array.isArray(clerkUser.emailAddresses)
            ? clerkUser.emailAddresses.map((email: { emailAddress?: string | null }) => ({
                emailAddress: typeof email?.emailAddress === 'string' ? email.emailAddress : String(email?.emailAddress || ''),
              }))
            : dbUser.email ? [{ emailAddress: dbUser.email }] : [];

          clerkUserMap.set(dbUser.clerkId!, {
            emailAddresses,
            firstName: clerkUser.firstName,
            lastName: clerkUser.lastName,
          });
        } catch (error) {
          // Fallback to database data if Clerk fetch fails or times out
          clerkUserMap.set(dbUser.clerkId!, {
            emailAddresses: dbUser.email ? [{ emailAddress: dbUser.email }] : [],
            firstName: dbUser.firstName,
            lastName: dbUser.lastName,
          });
        }
      })
    );
  }

  // Map database users to the format expected by IntegratedUserManagement
  const mappedUsers = dbUsers.map(dbUser => {
    const clerkData = dbUser.clerkId ? clerkUserMap.get(dbUser.clerkId) : null;
    
    return {
      id: dbUser.clerkId || String(dbUser.id),
      name: clerkData
        ? [clerkData.firstName, clerkData.lastName].filter(Boolean).join(' ').trim() || null
        : [dbUser.firstName, dbUser.lastName].filter(Boolean).join(' ').trim() || null,
      emailAddresses: clerkData?.emailAddresses || (dbUser.email ? [{ emailAddress: dbUser.email }] : []),
      publicMetadata: {
        role: (dbUser.roleName as "admin" | "student" | "super_admin" | "committee" | undefined) || undefined,
      },
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

      <IntegratedUserManagement users={mappedUsers} />
    </div>
  );
}
