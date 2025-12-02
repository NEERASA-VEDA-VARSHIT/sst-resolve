import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, domains, scopes, roles, students, admin_profiles, committees } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
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
            // Check if this user is a committee member and has a committee
            const committee = staff.role === "committee" 
                ? committeesMap.get(staff.id) 
                : null;
            return {
                id: staff.id,
                clerkUserId: staff.external_id, // Map external_id to clerkUserId for backward compatibility
                fullName: staff.full_name || "Unknown",
                email: staff.email,
                slackUserId: staff.slackUserId,
                whatsappNumber: staff.phone, // Map phone to whatsappNumber
                role: staff.role,
                domain: staff.domain,
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

        // Domain is always required
        if (!domain) {
            return NextResponse.json({ error: "Domain is required" }, { status: 400 });
        }

        // Scope is always required
        if (!scope) {
            return NextResponse.json({ error: "Scope is required" }, { status: 400 });
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
                // Create new user with pending external_id (will be updated when they sign up)
                const [studentRole] = await db.select().from(roles).where(eq(roles.name, "student")).limit(1);
                if (!studentRole) {
                    return NextResponse.json({ error: "Student role not found" }, { status: 500 });
                }

                // Generate a temporary external_id (will be updated when user signs up)
                const tempExternalId = `pending_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                const fullName = [firstName, lastName].filter(Boolean).join(" ");

                const [createdUser] = await db.insert(users).values({
                    auth_provider: "manual",
                    external_id: tempExternalId,
                    email: email,
                    full_name: fullName,
                    phone: phone || "",
                    role_id: studentRole.id, // Will be updated below
                    created_at: new Date(),
                    updated_at: new Date(),
                }).returning();

                targetUser = createdUser;
            }
        } else {
            // Find the user by external_id (Clerk user ID)
            [targetUser] = await db.select().from(users).where(eq(users.external_id, clerkUserId)).limit(1);

            if (!targetUser) {
                return NextResponse.json({ error: "User not found" }, { status: 404 });
            }
        }

        // Resolve domain and scope IDs (both required)
        const [domainRecord] = await db.select().from(domains).where(eq(domains.name, domain)).limit(1);
        if (!domainRecord) {
            return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
        }

        const [scopeRecord] = await db.select().from(scopes).where(eq(scopes.name, scope)).limit(1);
        if (!scopeRecord) {
            return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
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

        // Update user with role and contact info
        // Only update phone if whatsappNumber is provided and valid, otherwise keep existing value
        const updateData: { role_id: number; phone?: string; updated_at: Date } = {
            role_id: roleRecord.id,
            updated_at: new Date(),
        };
        if (whatsappNumber !== undefined && whatsappNumber !== null && whatsappNumber !== "" && typeof whatsappNumber === "string") {
            updateData.phone = whatsappNumber;
        } else if (targetUser.phone) {
            updateData.phone = targetUser.phone;
        }
        
        await db.update(users).set(updateData).where(eq(users.id, targetUser.id));

        // Use provided slackUserId or empty string as default (NOT NULL constraint)
        const finalSlackUserId = (slackUserId && typeof slackUserId === "string" && slackUserId.trim() !== "")
            ? slackUserId.trim()
            : "";

        // Update or create admin profile with domain, scope, and slack (all required)
        await db
            .insert(admin_profiles)
            .values({
                user_id: targetUser.id,
                primary_domain_id: domainRecord.id,
                primary_scope_id: scopeRecord.id,
                slack_user_id: finalSlackUserId,
            })
            .onConflictDoUpdate({
                target: admin_profiles.user_id,
                set: {
                    primary_domain_id: domainRecord.id,
                    primary_scope_id: scopeRecord.id,
                    slack_user_id: finalSlackUserId,
                    updated_at: new Date(),
                },
            });

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

        // Domain is always required
        if (!domain) {
            return NextResponse.json({ error: "Domain is required" }, { status: 400 });
        }

        // Scope is always required
        if (!scope) {
            return NextResponse.json({ error: "Scope is required" }, { status: 400 });
        }

        // Resolve domain and scope IDs
        const [domainRecord] = await db.select().from(domains).where(eq(domains.name, domain)).limit(1);
        if (!domainRecord) {
            return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
        }
        const domainId = domainRecord.id;

        const [scopeRecord] = await db.select().from(scopes).where(eq(scopes.name, scope)).limit(1);
        if (!scopeRecord) {
            return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
        }
        const scopeId = scopeRecord.id;

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
        if (roleId) updateData.role_id = roleId;
        // Only update phone if whatsappNumber is a non-empty string (phone column has NOT NULL constraint)
        if (whatsappNumber !== undefined && whatsappNumber !== null && whatsappNumber !== "" && typeof whatsappNumber === "string") {
            updateData.phone = whatsappNumber;
        }

        await db.update(users).set(updateData).where(eq(users.id, id));

        // Check if admin profile exists to preserve existing slack_user_id if not provided
        const [existingProfile] = await db
            .select({ slack_user_id: admin_profiles.slack_user_id })
            .from(admin_profiles)
            .where(eq(admin_profiles.user_id, id))
            .limit(1);

        // Use provided slackUserId, or existing value, or empty string as default (NOT NULL constraint)
        const finalSlackUserId = (slackUserId && typeof slackUserId === "string" && slackUserId.trim() !== "")
            ? slackUserId.trim()
            : (existingProfile?.slack_user_id || "");

        // Update admin profile with domain, scope, and slack (all required)
        await db
            .insert(admin_profiles)
            .values({
                user_id: id,
                primary_domain_id: domainId,
                primary_scope_id: scopeId,
                slack_user_id: finalSlackUserId,
            })
            .onConflictDoUpdate({
                target: admin_profiles.user_id,
                set: {
                    primary_domain_id: domainId,
                    primary_scope_id: scopeId,
                    slack_user_id: finalSlackUserId,
                    updated_at: new Date(),
                },
            });

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
            updated_at: new Date(),
        }).where(eq(users.id, id));

        // Clear admin profile primary domain/scope
        const [existingProfile] = await db
            .select({ user_id: admin_profiles.user_id })
            .from(admin_profiles)
            .where(eq(admin_profiles.user_id, id))
            .limit(1);

        if (existingProfile) {
            await db.update(admin_profiles)
                .set({
                    primary_domain_id: null,
                    primary_scope_id: null,
                    updated_at: new Date(),
                })
                .where(eq(admin_profiles.user_id, id));
        }

        await db.delete(admin_profiles).where(eq(admin_profiles.user_id, id));

        // If you want to actually delete the user (use with caution):
        // await db.delete(users).where(eq(users.id, id));

        return NextResponse.json({ success: true, message: "Staff member reverted to student role" });
    } catch (error) {
        console.error("Error deleting staff:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
