import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, escalation_rules, staff } from "@/db";
import { eq, and, or, isNull } from "drizzle-orm";
import { asc } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

// GET - Get all escalation rules
export async function GET(request: NextRequest) {
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

    // Fetch escalation rules with staff details
    const rules = await db
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
      .orderBy(asc(escalation_rules.domain), asc(escalation_rules.level));

    // Fetch staff details for each rule
    const rulesWithStaff = await Promise.all(
      rules.map(async (rule) => {
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

          return {
            ...rule,
            notify_channel: rule.notify_channel || "slack",
            staff: staffMember || null,
          };
        }
        return {
          ...rule,
          notify_channel: rule.notify_channel || "slack",
          staff: null,
        };
      })
    );

    return NextResponse.json({ rules: rulesWithStaff });
  } catch (error) {
    console.error("Error fetching escalation rules:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST - Create a new escalation rule
export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: "Only super admins can create escalation rules" }, { status: 403 });
    }

    const body = await request.json();
    const { domain, scope, level, staff_id, notify_channel } = body;

    if (!domain || !level) {
      return NextResponse.json({ error: "Domain and level are required" }, { status: 400 });
    }

    // Validate domain
    if (domain !== "Hostel" && domain !== "College") {
      return NextResponse.json({ error: "Domain must be 'Hostel' or 'College'" }, { status: 400 });
    }

    // Validate level is a positive integer
    const levelNum = parseInt(String(level), 10);
    if (isNaN(levelNum) || levelNum < 1) {
      return NextResponse.json({ error: "Level must be a positive integer" }, { status: 400 });
    }

    // Validate notify_channel (optional, defaults to "slack")
    const channel = notify_channel || "slack";
    if (channel !== "slack" && channel !== "email") {
      return NextResponse.json({ error: "Notify channel must be 'slack' or 'email'" }, { status: 400 });
    }

    // Check for duplicate rule (same domain, scope, and level)
    const existingRule = await db
      .select()
      .from(escalation_rules)
      .where(
        and(
          eq(escalation_rules.domain, domain),
          eq(escalation_rules.level, levelNum),
          scope 
            ? eq(escalation_rules.scope, scope)
            : or(eq(escalation_rules.scope, null), isNull(escalation_rules.scope))
        )
      )
      .limit(1);

    if (existingRule.length > 0) {
      return NextResponse.json({ error: "An escalation rule with this domain, scope, and level already exists" }, { status: 400 });
    }

    // Validate staff_id if provided
    if (staff_id) {
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
    }

    // Create the rule
    // Note: notify_channel might not exist in database, so we'll try to insert it but handle gracefully
    const insertValues: any = {
      domain,
      scope: domain === "College" ? null : (scope || null),
      level: levelNum,
      staff_id: staff_id ? parseInt(String(staff_id), 10) : null,
    };
    
    // Only include notify_channel if the column exists (we'll try and catch if it fails)
    try {
      const [newRule] = await db
        .insert(escalation_rules)
        .values({
          ...insertValues,
          notify_channel: channel,
        })
        .returning();
      return NextResponse.json({ rule: newRule }, { status: 201 });
    } catch (error: any) {
      // If notify_channel column doesn't exist, insert without it
      if (error?.message?.includes("notify_channel")) {
        const [newRule] = await db
          .insert(escalation_rules)
          .values(insertValues)
          .returning();
        return NextResponse.json({ rule: { ...newRule, notify_channel: channel } }, { status: 201 });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error creating escalation rule:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

