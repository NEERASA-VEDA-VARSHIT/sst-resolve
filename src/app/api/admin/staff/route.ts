import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, domains, scopes, roles, students } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import type { InferSelectModel } from "drizzle-orm";

export async function GET() {
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

        // Fetch users with admin, super_admin, or committee role
        const staffMembers = await db
            .select({
                id: users.id,
                clerkUserId: users.clerk_id,
                firstName: users.first_name,
                lastName: users.last_name,
                email: users.email,
                slackUserId: users.slack_user_id,
                phone: users.phone,
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
            .where(inArray(roles.name, ["admin", "super_admin", "committee"]));

        const formattedStaff = staffMembers.map((staff) => ({
            id: staff.id,
            clerkUserId: staff.clerkUserId,
            fullName: [staff.firstName, staff.lastName].filter(Boolean).join(" ") || "Unknown",
            email: staff.email,
            slackUserId: staff.slackUserId,
            whatsappNumber: staff.phone, // Map phone to whatsappNumber
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
        const { clerkUserId, domain, scope, role, slackUserId, whatsappNumber, newUser } = body;

        if ((!clerkUserId && !newUser) || !role) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Domain is required for admin and committee, optional for super_admin
        if (role !== "super_admin" && !domain) {
            return NextResponse.json({ error: "Domain is required for admin and committee roles" }, { status: 400 });
        }

        let targetUser;

        if (newUser) {
            // Create new user
            const { email, firstName, lastName, phone } = newUser;

            if (!email || !firstName || !lastName) {
                return NextResponse.json({ error: "Missing required user fields (email, firstName, lastName)" }, { status: 400 });
            }

            // Check if user with this email already exists
            const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
            
            if (existingUser) {
                // User exists - use existing user
                targetUser = existingUser;
            } else {
                // Create new user with pending clerk_id (will be updated when they sign up)
                const [studentRole] = await db.select().from(roles).where(eq(roles.name, "student")).limit(1);
                if (!studentRole) {
                    return NextResponse.json({ error: "Student role not found" }, { status: 500 });
                }

                // Generate a temporary clerk_id (will be updated when user signs up)
                const tempClerkId = `pending_${Date.now()}_${Math.random().toString(36).substring(7)}`;

                const [createdUser] = await db.insert(users).values({
                    clerk_id: tempClerkId,
                    email: email,
                    first_name: firstName,
                    last_name: lastName,
                    phone: phone || null,
                    role_id: studentRole.id, // Will be updated below
                    created_at: new Date(),
                    updated_at: new Date(),
                }).returning();

                targetUser = createdUser;
            }
        } else {
            // Find the user by clerk_id
            [targetUser] = await db.select().from(users).where(eq(users.clerk_id, clerkUserId)).limit(1);

            if (!targetUser) {
                return NextResponse.json({ error: "User not found" }, { status: 404 });
            }
        }

        // Resolve domain and scope IDs (optional for super_admin)
        let domainRecord = null;
        let scopeRecord = null;

        if (domain) {
            [domainRecord] = await db.select().from(domains).where(eq(domains.name, domain)).limit(1);
            if (!domainRecord) {
                return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
            }

            if (scope) {
                [scopeRecord] = await db.select().from(scopes).where(eq(scopes.name, scope)).limit(1);
                if (!scopeRecord) {
                    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
                }
            }
        }

        // Resolve role ID
        const [roleRecord] = await db.select().from(roles).where(eq(roles.name, role)).limit(1);
        if (!roleRecord) {
            return NextResponse.json({ error: "Invalid role" }, { status: 400 });
        }

        // If promoting from student, delete student record
        const elevatedRoles: string[] = ["admin", "super_admin", "committee"];
        if (elevatedRoles.includes(role)) {
            const [studentRecord] = await db.select().from(students).where(eq(students.user_id, targetUser.id)).limit(1);
            if (studentRecord) {
                await db.delete(students).where(eq(students.user_id, targetUser.id));
                console.log(`[Staff API] Deleted student record for user ${targetUser.id} after promotion to ${role}`);
            }
        }

        // Update user with role, domain, scope, and contact info
        await db.update(users).set({
            role_id: roleRecord.id,
            primary_domain_id: domainRecord ? domainRecord.id : null,
            primary_scope_id: scopeRecord ? scopeRecord.id : null,
            slack_user_id: slackUserId || null,
            phone: whatsappNumber || targetUser.phone || null,
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

        // Find the user
        const [targetUser] = await db.select().from(users).where(eq(users.id, id)).limit(1);

        if (!targetUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Check if user has any tickets assigned or created
        // For now, we'll revert to student role instead of deleting
        // If you want to actually delete, uncomment the delete code below
        
        const [studentRole] = await db.select().from(roles).where(eq(roles.name, "student")).limit(1);

        if (!studentRole) {
            return NextResponse.json({ error: "Student role not found" }, { status: 500 });
        }

        // Revert to student role and clear staff assignments
        await db.update(users).set({
            role_id: studentRole.id,
            primary_domain_id: null,
            primary_scope_id: null,
            slack_user_id: null,
            updated_at: new Date(),
        }).where(eq(users.id, id));

        // If you want to actually delete the user (use with caution):
        // await db.delete(users).where(eq(users.id, id));

        return NextResponse.json({ success: true, message: "Staff member reverted to student role" });
    } catch (error) {
        console.error("Error deleting staff:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
