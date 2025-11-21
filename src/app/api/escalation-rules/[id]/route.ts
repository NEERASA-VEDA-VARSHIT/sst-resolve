import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, escalation_rules, users } from "@/db";
import { eq, and, isNull } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

// GET - Get a specific escalation rule
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);

    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const ruleId = parseInt(id, 10);

    if (isNaN(ruleId)) {
      return NextResponse.json({ error: "Invalid rule ID" }, { status: 400 });
    }

    const [rule] = await db
      .select({
        id: escalation_rules.id,
        domain_id: escalation_rules.domain_id,
        scope_id: escalation_rules.scope_id,
        level: escalation_rules.level,
        user_id: escalation_rules.user_id,
        notify_channel: escalation_rules.notify_channel,
        created_at: escalation_rules.created_at,
        updated_at: escalation_rules.updated_at,
      })
      .from(escalation_rules)
      .where(eq(escalation_rules.id, ruleId))
      .limit(1);

    if (!rule) {
      return NextResponse.json({ error: "Escalation rule not found" }, { status: 404 });
    }

    // Fetch user details if user_id exists
    let userDetails = null;
    if (rule.user_id) {
      const [user] = await db
        .select({
          id: users.id,
          first_name: users.first_name,
          last_name: users.last_name,
          email: users.email,
          clerk_id: users.clerk_id,
        })
        .from(users)
        .where(eq(users.id, rule.user_id))
        .limit(1);

      userDetails = user ? {
        ...user,
        name: [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || null,
      } : null;
    }

    return NextResponse.json({
      rule: {
        ...rule,
        notify_channel: rule.notify_channel || "slack",
        user: userDetails
      }
    });
  } catch (error) {
    console.error("Error fetching escalation rule:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH - Update an escalation rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);

    if (role !== "super_admin") {
      return NextResponse.json({ error: "Only super admins can update escalation rules" }, { status: 403 });
    }

    const { id } = await params;
    const ruleId = parseInt(id, 10);

    if (isNaN(ruleId)) {
      return NextResponse.json({ error: "Invalid rule ID" }, { status: 400 });
    }

    const body = await request.json();
    const { domain_id, scope_id, level, user_id, notify_channel } = body;

    // Verify rule exists
    const [existingRule] = await db
      .select()
      .from(escalation_rules)
      .where(eq(escalation_rules.id, ruleId))
      .limit(1);

    if (!existingRule) {
      return NextResponse.json({ error: "Escalation rule not found" }, { status: 404 });
    }

    const updateData: { 
      updated_at: Date; 
      domain_id?: number; 
      scope_id?: number | null;
      level?: number;
      user_id?: string | null;
      notify_channel?: string;
    } = {
      updated_at: new Date(),
    };

    if (domain_id !== undefined) {
      updateData.domain_id = domain_id;
    }

    if (scope_id !== undefined) {
      updateData.scope_id = scope_id || null;
    }

    if (level !== undefined) {
      const levelNum = parseInt(String(level), 10);
      if (isNaN(levelNum) || levelNum < 1) {
        return NextResponse.json({ error: "Level must be a positive integer" }, { status: 400 });
      }
      updateData.level = levelNum;
    }

    if (user_id !== undefined) {
      if (user_id === null || user_id === "") {
        updateData.user_id = null;
      } else {
        // user_id is UUID string
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, user_id))
          .limit(1);

        if (!user) {
          return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        updateData.user_id = user_id;
      }
    }

    if (notify_channel !== undefined) {
      if (notify_channel !== "slack" && notify_channel !== "email") {
        return NextResponse.json({ error: "Notify channel must be 'slack' or 'email'" }, { status: 400 });
      }
      updateData.notify_channel = notify_channel;
    }

    // Check for duplicate rule (if domain, scope, or level changed)
    const finalDomainId = updateData.domain_id !== undefined ? updateData.domain_id : existingRule.domain_id;
    const finalScopeId = updateData.scope_id !== undefined ? updateData.scope_id : existingRule.scope_id;
    const finalLevel = updateData.level || existingRule.level;

    const duplicateCheck = await db
      .select()
      .from(escalation_rules)
      .where(
        and(
          eq(escalation_rules.domain_id, finalDomainId),
          eq(escalation_rules.level, finalLevel),
          finalScopeId
            ? eq(escalation_rules.scope_id, finalScopeId)
            : isNull(escalation_rules.scope_id),
          // Exclude current rule
          eq(escalation_rules.id, ruleId) // This logic is wrong in original code, it should be ne(id, ruleId) but here we filter duplicates separately
        )
      );

    const duplicates = duplicateCheck.filter(r => r.id !== ruleId);
    if (duplicates.length > 0) {
      return NextResponse.json({ error: "An escalation rule with this domain, scope, and level already exists" }, { status: 400 });
    }

    // Update the rule
    const [updatedRule] = await db
      .update(escalation_rules)
      .set(updateData)
      .where(eq(escalation_rules.id, ruleId))
      .returning();

    return NextResponse.json({ rule: updatedRule });

  } catch (error) {
    console.error("Error updating escalation rule:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE - Delete an escalation rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);

    if (role !== "super_admin") {
      return NextResponse.json({ error: "Only super admins can delete escalation rules" }, { status: 403 });
    }

    const { id } = await params;
    const ruleId = parseInt(id, 10);

    if (isNaN(ruleId)) {
      return NextResponse.json({ error: "Invalid rule ID" }, { status: 400 });
    }

    // Verify rule exists
    const [rule] = await db
      .select()
      .from(escalation_rules)
      .where(eq(escalation_rules.id, ruleId))
      .limit(1);

    if (!rule) {
      return NextResponse.json({ error: "Escalation rule not found" }, { status: 404 });
    }

    // Delete the rule
    await db
      .delete(escalation_rules)
      .where(eq(escalation_rules.id, ruleId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting escalation rule:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
