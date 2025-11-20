import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, escalation_rules, staff } from "@/db";
import { eq, and, or, isNull } from "drizzle-orm";
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
        domain: escalation_rules.domain,
        scope: escalation_rules.scope,
        level: escalation_rules.level,
        staff_id: escalation_rules.staff_id,
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

    // Fetch staff details if staff_id exists
    let staffDetails = null;
    if (rule.staff_id) {
      const [staffMember] = await db
        .select({
          id: staff.id,
          full_name: staff.full_name,
          email: staff.email,
          clerk_user_id: staff.clerk_user_id,
        })
        .from(staff)
        .where(eq(staff.id, rule.staff_id))
        .limit(1);

      staffDetails = staffMember || null;
    }

    return NextResponse.json({ 
      rule: { 
        ...rule, 
        notify_channel: rule.notify_channel || "slack", 
        staff: staffDetails 
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
    const { domain, scope, level, staff_id, notify_channel } = body;

    // Verify rule exists
    const [existingRule] = await db
      .select()
      .from(escalation_rules)
      .where(eq(escalation_rules.id, ruleId))
      .limit(1);

    if (!existingRule) {
      return NextResponse.json({ error: "Escalation rule not found" }, { status: 404 });
    }

    const updateData: any = {
      updated_at: new Date(),
    };

    if (domain !== undefined) {
      if (domain !== "Hostel" && domain !== "College") {
        return NextResponse.json({ error: "Domain must be 'Hostel' or 'College'" }, { status: 400 });
      }
      updateData.domain = domain;
      // If domain is College, set scope to null
      if (domain === "College") {
        updateData.scope = null;
      } else if (scope !== undefined) {
        updateData.scope = scope || null;
      }
    } else if (scope !== undefined) {
      updateData.scope = scope || null;
    }

    if (level !== undefined) {
      const levelNum = parseInt(String(level), 10);
      if (isNaN(levelNum) || levelNum < 1) {
        return NextResponse.json({ error: "Level must be a positive integer" }, { status: 400 });
      }
      updateData.level = levelNum;
    }

    if (staff_id !== undefined) {
      if (staff_id === null || staff_id === "") {
        updateData.staff_id = null;
      } else {
        const staffIdNum = parseInt(String(staff_id), 10);
        if (isNaN(staffIdNum)) {
          return NextResponse.json({ error: "Invalid staff_id" }, { status: 400 });
        }

        const [staffMember] = await db
          .select()
          .from(staff)
          .where(eq(staff.id, staffIdNum))
          .limit(1);

        if (!staffMember) {
          return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
        }

        updateData.staff_id = staffIdNum;
      }
    }

    if (notify_channel !== undefined) {
      if (notify_channel !== "slack" && notify_channel !== "email") {
        return NextResponse.json({ error: "Notify channel must be 'slack' or 'email'" }, { status: 400 });
      }
      // Only include notify_channel if column exists (will be ignored if column doesn't exist)
      updateData.notify_channel = notify_channel;
    }

    // Check for duplicate rule (if domain, scope, or level changed)
    const finalDomain = updateData.domain || existingRule.domain;
    const finalScope = updateData.scope !== undefined ? updateData.scope : existingRule.scope;
    const finalLevel = updateData.level || existingRule.level;

    const duplicateCheck = await db
      .select()
      .from(escalation_rules)
      .where(
        and(
          eq(escalation_rules.domain, finalDomain),
          eq(escalation_rules.level, finalLevel),
          finalScope 
            ? eq(escalation_rules.scope, finalScope)
            : or(eq(escalation_rules.scope, null), isNull(escalation_rules.scope)),
          // Exclude current rule
          eq(escalation_rules.id, ruleId)
        )
      )
      .limit(1);

    // Actually check for duplicates excluding current rule
    const duplicateRules = await db
      .select()
      .from(escalation_rules)
      .where(
        and(
          eq(escalation_rules.domain, finalDomain),
          eq(escalation_rules.level, finalLevel),
          finalScope 
            ? eq(escalation_rules.scope, finalScope)
            : or(eq(escalation_rules.scope, null), isNull(escalation_rules.scope))
        )
      );

    const duplicates = duplicateRules.filter(r => r.id !== ruleId);
    if (duplicates.length > 0) {
      return NextResponse.json({ error: "An escalation rule with this domain, scope, and level already exists" }, { status: 400 });
    }

    // Update the rule
    // Handle notify_channel gracefully if column doesn't exist
    try {
      const [updatedRule] = await db
        .update(escalation_rules)
        .set(updateData)
        .where(eq(escalation_rules.id, ruleId))
        .returning();
      
      // Add notify_channel to response if it wasn't in the update
      const result = { ...updatedRule };
      if (updateData.notify_channel && !(updatedRule as any).notify_channel) {
        (result as any).notify_channel = updateData.notify_channel;
      } else if (!(updatedRule as any).notify_channel) {
        (result as any).notify_channel = "slack"; // Default
      }
      
      return NextResponse.json({ rule: result });
    } catch (error: any) {
      // If notify_channel column doesn't exist, remove it and try again
      if (error?.message?.includes("notify_channel")) {
        const { notify_channel, ...updateDataWithoutChannel } = updateData;
        const [updatedRule] = await db
          .update(escalation_rules)
          .set(updateDataWithoutChannel)
          .where(eq(escalation_rules.id, ruleId))
          .returning();
        
        return NextResponse.json({ 
          rule: { 
            ...updatedRule, 
            notify_channel: notify_channel || "slack" 
          } 
        });
      }
      throw error;
    }
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

