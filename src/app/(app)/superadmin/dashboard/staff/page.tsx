import { db, users, domains, scopes, roles, admin_profiles, committees, hostels, batches, class_sections } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { StaffManagement } from "@/components/admin/staff";

// Use ISR - revalidate every 5 minutes (staff changes infrequently)
export const revalidate = 300;

async function getStaffMembers() {
  // Fetch users with admin, super_admin, or committee role
  const staffMembers = await db
    .select({
      id: users.id,
      external_id: users.external_id,
      full_name: users.full_name,
      email: users.email,
      slackUserId: admin_profiles.slack_user_id,
      phone: users.phone,
      role: roles.name,
      domain: domains.name,
      scope: scopes.name,
      createdAt: users.created_at,
      updatedAt: users.updated_at,
    })
    .from(users)
    .innerJoin(roles, eq(users.role_id, roles.id))
    .leftJoin(admin_profiles, eq(admin_profiles.user_id, users.id))
    .leftJoin(domains, eq(admin_profiles.primary_domain_id, domains.id))
    .leftJoin(scopes, eq(admin_profiles.primary_scope_id, scopes.id))
    .where(inArray(roles.name, ["admin", "super_admin", "committee"]));

  // Fetch committees for committee members
  const committeeMembers = staffMembers.filter(s => s.role === "committee");
  const committeeMemberIds = committeeMembers.map(s => s.id);
  const committeesMap = new Map<string, { id: number; name: string; description: string | null }>();
  
  if (committeeMemberIds.length > 0) {
    const committeeRecords = await db
      .select({
        id: committees.id,
        name: committees.name,
        description: committees.description,
        head_id: committees.head_id,
      })
      .from(committees)
      .where(inArray(committees.head_id, committeeMemberIds));
    
    for (const committee of committeeRecords) {
      if (committee.head_id) {
        committeesMap.set(committee.head_id, {
          id: committee.id,
          name: committee.name,
          description: committee.description,
        });
      }
    }
  }

  const formattedStaff = staffMembers.map((staff) => {
    const committee = staff.role === "committee" 
      ? committeesMap.get(staff.id) 
      : null;
    return {
      id: staff.id,
      clerkUserId: staff.external_id,
      fullName: staff.full_name || "Unknown",
      email: staff.email,
      slackUserId: staff.slackUserId,
      whatsappNumber: staff.phone,
      role: staff.role,
      domain: staff.domain || "",
      scope: staff.scope,
      committee: committee ? {
        id: committee.id,
        name: committee.name,
        description: committee.description,
      } : null,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
    };
  });

  return formattedStaff;
}

async function getMasterData() {
  // Fetch all master data in parallel
  const [domainsList, scopesList, hostelsList, batchesList, classSectionsList, rolesList] = await Promise.all([
    db.select().from(domains),
    db.select().from(scopes),
    db.select().from(hostels),
    db.select().from(batches),
    db.select().from(class_sections),
    db.select().from(roles),
  ]);

  // Format domains for dropdown
  const formattedDomains = domainsList
    .filter(d => d.name && d.name.trim() !== "")
    .map(d => ({
      value: d.name,
      label: d.name,
    }));

  // Format roles for dropdown
  const formattedRoles = rolesList
    .filter(r => r.name && r.name.trim() !== "")
    .map(r => ({
      value: r.name,
      label: r.name,
      description: r.description,
    }));

  // Format scopes for dropdown (extract unique scopes from staff data)
  const formattedScopes = scopesList
    .filter(s => s.name && s.name.trim() !== "")
    .map(s => ({
      value: s.name,
      label: s.name,
    }));

  return {
    hostels: hostelsList,
    batches: batchesList,
    class_sections: classSectionsList,
    domains: formattedDomains,
    roles: formattedRoles,
    scopes: formattedScopes,
  };
}

export default async function StaffPage() {
  const [staff, masterData] = await Promise.all([
    getStaffMembers(),
    getMasterData(),
  ]);

  return (
    <StaffManagement 
      initialStaff={staff}
      initialMasterData={masterData}
    />
  );
}
