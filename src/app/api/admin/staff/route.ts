import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, domains, scopes, roles } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import type { InferSelectModel } from "drizzle-orm";

export async function GET(_request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await getOrCreateUser(userId);
        const role = await getUserRoleFromDB(userId);

        if (role !== "super_admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Fetch users with admin or super_admin role
        const staffMembers = await db
            .select({
                id: users.id,
                clerkUserId: users.clerk_id,
                firstName: users.first_name,
                lastName: users.last_name,
                email: users.email,
                slackUserId: users.slack_user_id,
                role: roles.name,
                domain: domains.name,
                scope: scopes.name,
                createdAt: users.created_at,
                updatedAt: users.updated_at,
            })
            .from(users)
            .innerJoin(roles, eq(users.role_id, roles.id))
            .leftJoin(domains, eq(users.primary_domain_id, domains.id))
            .leftJoin(scopes, eq(users.primary_scope_id, scopes.id))
            .where(inArray(roles.name, ["admin", "super_admin"]));

        const formattedStaff = staffMembers.map((staff) => ({
            id: staff.id,
            clerkUserId: staff.clerkUserId,
            fullName: [staff.firstName, staff.lastName].filter(Boolean).join(" ") || "Unknown",
            email: staff.email,
            slackUserId: staff.slackUserId,
            role: staff.role,
            domain: staff.domain,
            scope: staff.scope,
            createdAt: staff.createdAt,
            updatedAt: staff.updatedAt,
        }));

        return NextResponse.json({ staff: formattedStaff });
    } catch (error) {
        console.error("Error fetching staff:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await getOrCreateUser(userId);
        const userRole = await getUserRoleFromDB(userId);

        if (userRole !== "super_admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { clerkUserId, domain, scope, role, slackUserId, whatsappNumber } = body;

        if (!clerkUserId || !domain || !role) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Find the user by clerk_id (clerkUserId from frontend is clerk_id)
        const [targetUser] = await db.select().from(users).where(eq(users.clerk_id, clerkUserId));

        if (!targetUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Resolve domain and scope IDs
        const [domainRecord] = await db.select().from(domains).where(eq(domains.name, domain));
        if (!domainRecord) {
            return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
        }

        let scopeRecord = null;
        if (scope) {
            [scopeRecord] = await db.select().from(scopes).where(eq(scopes.name, scope));
            if (!scopeRecord) {
                return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
            }
        }

        // Resolve role ID
        const [roleRecord] = await db.select().from(roles).where(eq(roles.name, role));
        if (!roleRecord) {
            return NextResponse.json({ error: "Invalid role" }, { status: 400 });
        }

        // Update user
        await db.update(users).set({
            role_id: roleRecord.id,
            primary_domain_id: domainRecord.id,
            primary_scope_id: scopeRecord ? scopeRecord.id : null,
            slack_user_id: slackUserId || null,
            phone: whatsappNumber || targetUser.phone, // Assuming whatsappNumber maps to phone
            updated_at: new Date(),
        }).where(eq(users.id, targetUser.id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error creating staff:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await getOrCreateUser(userId);
        const userRole = await getUserRoleFromDB(userId);

        if (userRole !== "super_admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { id, domain, scope, role, slackUserId, whatsappNumber } = body;

        if (!id) {
            return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
        }

        // Resolve domain and scope IDs
        let domainId = null;
        if (domain) {
            const [domainRecord] = await db.select().from(domains).where(eq(domains.name, domain));
            if (domainRecord) domainId = domainRecord.id;
        }

        let scopeId = null;
        if (scope) {
            const [scopeRecord] = await db.select().from(scopes).where(eq(scopes.name, scope));
            if (scopeRecord) scopeId = scopeRecord.id;
        }

        // Resolve role ID
        let roleId = null;
        if (role) {
            const [roleRecord] = await db.select().from(roles).where(eq(roles.name, role));
            if (roleRecord) roleId = roleRecord.id;
        }

        type UserUpdate = Partial<InferSelectModel<typeof users>> & {
            updated_at: Date;
        };
        const updateData: UserUpdate = {
            updated_at: new Date(),
        };
        if (domainId) updateData.primary_domain_id = domainId;
        if (scopeId !== undefined) updateData.primary_scope_id = scopeId; // Allow nulling scope
        if (roleId) updateData.role_id = roleId;
        if (slackUserId !== undefined) updateData.slack_user_id = slackUserId;
        if (whatsappNumber !== undefined) updateData.phone = whatsappNumber;

        await db.update(users).set(updateData).where(eq(users.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating staff:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { userId } = await auth();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!id) {
            return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
        }

        await getOrCreateUser(userId);
        const userRole = await getUserRoleFromDB(userId);

        if (userRole !== "super_admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Instead of deleting the user, we revert them to 'student' role and clear assignments
        const [studentRole] = await db.select().from(roles).where(eq(roles.name, "student"));

        if (!studentRole) {
            return NextResponse.json({ error: "Student role not found" }, { status: 500 });
        }

        await db.update(users).set({
            role_id: studentRole.id,
            primary_domain_id: null,
            primary_scope_id: null,
            slack_user_id: null,
            updated_at: new Date(),
        }).where(eq(users.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting staff:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
