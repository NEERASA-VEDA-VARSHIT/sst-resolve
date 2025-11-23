/**
 * Escalation Utility
 * Handles category/location-specific escalation rules
 */

import { db, escalation_rules, users, domains, scopes } from "@/db";
import { eq, and, or, isNull } from "drizzle-orm";

export interface EscalationTarget {
  clerkUserId: string;
  userId: string;
  fullName: string;
  email: string | null;
  level: number;
}

/**
 * Get escalation targets for a specific category/location based on escalation rules
 * Returns ordered list of staff members to escalate to
 */
export async function getEscalationTargets(
  categoryName: string,
  locationName: string | null,
  currentLevel: number = 0
): Promise<EscalationTarget[]> {
  try {
    // 1. Get Domain ID
    const [domain] = await db
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.name, categoryName))
      .limit(1);

    if (!domain) return [];

    // 2. Get Scope ID (if location provided)
    let scopeId: number | null = null;
    if (locationName) {
      const [scope] = await db
        .select({ id: scopes.id })
        .from(scopes)
        .where(and(eq(scopes.name, locationName), eq(scopes.domain_id, domain.id)))
        .limit(1);
      scopeId = scope?.id || null;
    }

    // 3. Build query for escalation rules
    let rulesQuery;

    if (scopeId) {
      // Match (domain_id = X AND scope_id = Y) OR (domain_id = X AND scope_id IS NULL)
      rulesQuery = db
        .select({
          id: escalation_rules.id,
          domain_id: escalation_rules.domain_id,
          scope_id: escalation_rules.scope_id,
          level: escalation_rules.level,
          user_id: escalation_rules.user_id,
        })
        .from(escalation_rules)
        .where(
          and(
            eq(escalation_rules.domain_id, domain.id),
            or(eq(escalation_rules.scope_id, scopeId), isNull(escalation_rules.scope_id))
          )
        );
    } else {
      // No location provided, only fetch domain-wide rules
      rulesQuery = db
        .select({
          id: escalation_rules.id,
          domain_id: escalation_rules.domain_id,
          scope_id: escalation_rules.scope_id,
          level: escalation_rules.level,
          user_id: escalation_rules.user_id,
        })
        .from(escalation_rules)
        .where(
          and(
            eq(escalation_rules.domain_id, domain.id),
            isNull(escalation_rules.scope_id)
          )
        );
    }

    const rules = await rulesQuery;

    // Sort rules by level (ascending)
    rules.sort((a, b) => (a.level || 0) - (b.level || 0));

    // Get user details for each rule
    const targets: EscalationTarget[] = [];

    for (const rule of rules) {
      // Only include levels greater than current escalation level
      if ((rule.level || 0) > currentLevel) {
        if (!rule.user_id) continue;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, rule.user_id))
          .limit(1);

        if (user) {
          targets.push({
            clerkUserId: user.clerk_id,
            userId: user.id,
            fullName: [user.first_name, user.last_name].filter(Boolean).join(' '),
            email: user.email,
            level: rule.level || 0,
          });
        }
      }
    }

    return targets;

  } catch (error) {
    console.error("Error getting escalation targets:", error);
    return [];
  }
}

/**
 * Get the next escalation target for a ticket
 * Returns the staff member at the next escalation level
 */
export async function getNextEscalationTarget(
  category: string,
  location: string | null,
  currentEscalationCount: number
): Promise<EscalationTarget | null> {
  const targets = await getEscalationTargets(category, location, currentEscalationCount);

  if (targets.length === 0) {
    // No more escalation targets, escalate to super admin
    return null;
  }

  // Return the first target (next level)
  return targets[0];
}
