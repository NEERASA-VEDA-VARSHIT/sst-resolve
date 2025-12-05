import { db, committees, users } from "@/db";
import { eq } from "drizzle-orm";
import { CommitteesManagement } from "@/components/admin/committees";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// Use ISR - revalidate every 5 minutes (committees change infrequently)
export const revalidate = 300;

async function getCommitteeMembers(committeeId: number) {
  const [committee] = await db
    .select({
      id: committees.id,
      name: committees.name,
      head_id: committees.head_id,
    })
    .from(committees)
    .where(eq(committees.id, committeeId))
    .limit(1);

  if (!committee || !committee.head_id) {
    return [];
  }

  const [member] = await db
    .select({
      id: users.id,
      auth_provider: users.auth_provider,
      external_id: users.external_id,
      full_name: users.full_name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, committee.head_id))
    .limit(1);

  if (!member) {
    return [];
  }

  const [firstName, ...restNameParts] = (member.full_name || "").split(" ").filter(Boolean);
  const lastName = restNameParts.length > 0 ? restNameParts.join(" ") : null;

  return [{
    id: member.id,
    committee_id: committee.id,
    user_id: member.id,
    clerk_user_id: member.external_id || "",
    role: "head",
    created_at: null,
    updated_at: null,
    user: {
      firstName: firstName || null,
      lastName,
      emailAddresses: member.email
        ? [{ emailAddress: member.email }]
        : [],
    },
  }];
}

export default async function CommitteesPage() {
  // Fetch all committees from database
  const allCommittees = await db
    .select({
      id: committees.id,
      name: committees.name,
      description: committees.description,
      contact_email: committees.contact_email,
      created_at: committees.created_at,
      updated_at: committees.updated_at,
    })
    .from(committees)
    .orderBy(committees.name);

  // Fetch members for each committee
  const membersMap: Record<number, Awaited<ReturnType<typeof getCommitteeMembers>>> = {};
  await Promise.all(
    allCommittees.map(async (committee) => {
      const members = await getCommitteeMembers(committee.id);
      membersMap[committee.id] = members;
    })
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Committee Management
          </h1>
          <p className="text-muted-foreground">
            Manage committees and assign members to committees
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/superadmin/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      <CommitteesManagement 
        initialCommittees={allCommittees}
        initialMembers={membersMap}
      />
    </div>
  );
}
