import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, escalation_rules, users, domains, scopes } from "@/db";
import { eq, and, or, isNull, inArray } from "drizzle-orm";
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

    // Fetch escalation rules with explicit columns
    const rules = await db
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
      .from(escalation_rules);

    // Sort manually to avoid orderBy issues
    const sortedRules = rules.sort((a, b) => {
      if (a.domain_id !== b.domain_id) return (a.domain_id || 0) - (b.domain_id || 0);
      return (a.level || 0) - (b.level || 0);
    });

    // Fetch related data
    const domainIds = [...new Set(sortedRules.map(r => r.domain_id).filter(Boolean))];
    const scopeIds = [...new Set(sortedRules.map(r => r.scope_id).filter(Boolean))];
    const userIds = [...new Set(sortedRules.map(r => r.user_id).filter(Boolean))];

    const [domainsList, scopesList, usersList] = await Promise.all([
      domainIds.length > 0
        ? db.select().from(domains).where(inArray(domains.id, domainIds))
        : Promise.resolve([]),
      scopeIds.length > 0
        ? db.select().from(scopes).where(inArray(scopes.id, scopeIds as number[]))
        : Promise.resolve([]),
      userIds.length > 0
        ? db.select({
          id: users.id,
          email: users.email,
          first_name: users.first_name,
          last_name: users.last_name,
          clerk_id: users.clerk_id,
        }).from(users).where(inArray(users.id, userIds as string[]))
        : Promise.resolve([]),
    ]);

    const domainMap = new Map(domainsList.map(d => [d.id, d]));
    const scopeMap = new Map(scopesList.map(s => [s.id, s]));
    const userMap = new Map(usersList.map(u => [u.id, {
      ...u,
      name: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || null,
    }]));

    // Enrich rules with domain, scope, and user data
    const enrichedRules = sortedRules.map(rule => ({
      ...rule,
      domain: rule.domain_id ? domainMap.get(rule.domain_id) : null,
      scope: rule.scope_id ? scopeMap.get(rule.scope_id) : null,
      user: rule.user_id ? userMap.get(rule.user_id) : null,
      notify_channel: rule.notify_channel || "slack",
    }));

    return NextResponse.json({ rules: enrichedRules });
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
    const { domain_id, scope_id, level, user_id, notify_channel } = body;

    if (!domain_id || !level) {
      return NextResponse.json({ error: "domain_id and level are required" }, { status: 400 });
    }

    // Validate level is a positive integer
    const levelNum = parseInt(String(level), 10);
    if (isNaN(levelNum) || levelNum < 1) {
      return NextResponse.json({ error: "Level must be a positive integer" }, { status: 400 });
    }

    // Validate notify_channel (optional, defaults to "slack")
    const channel = notify_channel || "slack";
    if (channel !== "slack" && channel !== "email" && channel !== "in_app") {
      return NextResponse.json({ error: "Notify channel must be 'slack', 'email', or 'in_app'" }, { status: 400 });
    }

    // Check for duplicate rule (same domain_id, scope_id, and level)
    const [existingRule] = await db
      .select()
      .from(escalation_rules)
      .where(
        and(
          eq(escalation_rules.domain_id, domain_id),
          eq(escalation_rules.level, levelNum),
          scope_id
            ? eq(escalation_rules.scope_id, scope_id)
            : isNull(escalation_rules.scope_id)
        )
      )
      .limit(1);

    if (existingRule) {
      return NextResponse.json({ error: "An escalation rule with this domain, scope, and level already exists" }, { status: 400 });
    }

    // Validate user_id if provided
    if (user_id) {
      const [userRecord] = await db
        .select()
        .from(users)
        .where(eq(users.id, user_id))
        .limit(1);

      if (!userRecord) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
    }

    // Create the rule
    const [newRule] = await db
      .insert(escalation_rules)
      .values({
        domain_id,
        scope_id: scope_id || null,
        level: levelNum,
        user_id: user_id || null,
        notify_channel: channel,
      })
      .returning();

    return NextResponse.json({ rule: newRule }, { status: 201 });
  } catch (error) {
    console.error("Error creating escalation rule:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
