/**
 * Escalation Utility
 * Handles category/location-specific escalation rules
 */

import { db, escalation_rules, staff } from "@/db";
import { eq, and, or, isNull } from "drizzle-orm";

export interface EscalationTarget {
  clerkUserId: string;
  staffId: number;
  fullName: string;
  email: string | null;
  level: number;
}

/**
 * Get escalation targets for a specific category/location based on escalation rules
 * Returns ordered list of staff members to escalate to
 */
export async function getEscalationTargets(
  category: string,
  location: string | null,
  currentLevel: number = 0
): Promise<EscalationTarget[]> {
  try {
    // Build query for escalation rules matching category and location
    // Explicitly select only columns that exist to avoid migration issues
    let rulesQuery = db
      .select({
        id: escalation_rules.id,
        domain: escalation_rules.domain,
        scope: escalation_rules.scope,
        level: escalation_rules.level,
        staff_id: escalation_rules.staff_id,
      })
      .from(escalation_rules)
      .where(eq(escalation_rules.domain, category));

    // For Hostel category, match by scope (location)
    if (category === "Hostel" && location) {
      rulesQuery = db
        .select({
          id: escalation_rules.id,
          domain: escalation_rules.domain,
          scope: escalation_rules.scope,
          level: escalation_rules.level,
          staff_id: escalation_rules.staff_id,
        })
        .from(escalation_rules)
        .where(
          and(
            eq(escalation_rules.domain, "Hostel"),
            eq(escalation_rules.scope, location)
          )
        );
    }

    const rules = await rulesQuery;

    // If no specific rules found for Hostel with location, try domain-wide
    if (rules.length === 0 && category === "Hostel") {
      const domainRules = await db
        .select({
          id: escalation_rules.id,
          domain: escalation_rules.domain,
          scope: escalation_rules.scope,
          level: escalation_rules.level,
          staff_id: escalation_rules.staff_id,
        })
        .from(escalation_rules)
        .where(
          and(
            eq(escalation_rules.domain, "Hostel"),
            or(eq(escalation_rules.scope, null), isNull(escalation_rules.scope))
          )
        );
      rules.push(...domainRules);
    }

    // Sort rules by level (ascending)
    rules.sort((a, b) => {
      const levelA = parseInt(String(a.level || "0"), 10);
      const levelB = parseInt(String(b.level || "0"), 10);
      return levelA - levelB;
    });

    // Get staff details for each rule
    const targets: EscalationTarget[] = [];
    for (const rule of rules) {
      const level = parseInt(String(rule.level || "0"), 10);
      
      // Only include levels greater than current escalation level
      if (level > currentLevel) {
        // staff_id in escalation_rules is an integer FK to staff.id
        const staffIdNum = rule.staff_id;
        if (!staffIdNum) continue;
        
        const staffMember = await db
          .select()
          .from(staff)
          .where(eq(staff.id, staffIdNum))
          .limit(1);

        if (staffMember.length > 0 && staffMember[0].clerk_user_id) {
          targets.push({
            clerkUserId: staffMember[0].clerk_user_id,
            staffId: staffMember[0].id,
            fullName: staffMember[0].full_name,
            email: staffMember[0].email || null,
            level,
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

