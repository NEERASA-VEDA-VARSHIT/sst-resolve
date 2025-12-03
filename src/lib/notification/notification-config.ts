/**
 * Notification Configuration Helper
 * Fetches notification settings from database (notification_config table)
 * Falls back to environment variables if no database config exists
 */

import { db, notification_config } from "@/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { slackConfig } from "@/conf/config";

export interface NotificationConfig {
  enableSlack: boolean;
  enableEmail: boolean;
  slackChannel: string | null;
  slackCcUserIds: string[];
  emailRecipients: string[];
}

/**
 * Get notification configuration for a category/subcategory/scope combination
 * Priority: Category+Subcategory (20) > Category+Scope (10-15) > Category-only (10) > Scope-only (5) > Global Default (0)
 * 
 * Note: Category-only (priority 10) is checked before Scope-only (priority 5) because
 * category-level configs should take precedence over scope-level configs when both exist.
 * 
 * @param categoryId - Category ID (optional)
 * @param subcategoryId - Subcategory ID (optional)
 * @param scopeId - Scope ID (optional, for scope-level configs)
 * @param ticketLocation - Ticket location string (optional, used to resolve scope from location)
 */
export async function getNotificationConfig(
  categoryId: number | null,
  subcategoryId: number | null,
  scopeId?: number | null,
  ticketLocation?: string | null
): Promise<NotificationConfig> {
  try {
    // Resolve scope_id from ticketLocation if scopeId not provided
    let resolvedScopeId = scopeId;
    if (!resolvedScopeId && ticketLocation) {
      const { scopes } = await import("@/db");
      const [scope] = await db
        .select({ id: scopes.id })
        .from(scopes)
        .where(eq(scopes.name, ticketLocation))
        .limit(1);
      if (scope) {
        resolvedScopeId = scope.id;
      }
    }

    // Try to find the most specific config first (category + subcategory = priority 20)
    let config = null;
    
    if (categoryId && subcategoryId) {
      const [subcategoryConfig] = await db
        .select()
        .from(notification_config)
        .where(
          and(
            eq(notification_config.category_id, categoryId),
            eq(notification_config.subcategory_id, subcategoryId),
            isNull(notification_config.scope_id), // Category+subcategory configs don't use scope
            eq(notification_config.is_active, true)
          )
        )
        .orderBy(desc(notification_config.priority))
        .limit(1);
      
      if (subcategoryConfig) {
        config = subcategoryConfig;
      }
    }
    
    // If no subcategory config, try category+scope combination (priority 10-15, depends on config)
    // This matches configs that have both category_id and scope_id (e.g., Hostel + Neeladri)
    if (!config && categoryId && resolvedScopeId) {
      const [categoryScopeConfig] = await db
        .select()
        .from(notification_config)
        .where(
          and(
            eq(notification_config.category_id, categoryId),
            eq(notification_config.scope_id, resolvedScopeId),
            isNull(notification_config.subcategory_id),
            eq(notification_config.is_active, true)
          )
        )
        .orderBy(desc(notification_config.priority))
        .limit(1);
      
      if (categoryScopeConfig) {
        config = categoryScopeConfig;
      }
    }
    
    // If no category+scope config, try category-only config (priority 10)
    // This should come before scope-only since category has higher priority
    if (!config && categoryId) {
      const [categoryConfig] = await db
        .select()
        .from(notification_config)
        .where(
          and(
            eq(notification_config.category_id, categoryId),
            isNull(notification_config.subcategory_id),
            isNull(notification_config.scope_id), // Category-only configs don't use scope
            eq(notification_config.is_active, true)
          )
        )
        .orderBy(desc(notification_config.priority))
        .limit(1);
      
      if (categoryConfig) {
        config = categoryConfig;
      }
    }
    
    // If no category config, try scope-only config (priority 5)
    if (!config && resolvedScopeId) {
      const [scopeConfig] = await db
        .select()
        .from(notification_config)
        .where(
          and(
            eq(notification_config.scope_id, resolvedScopeId),
            isNull(notification_config.category_id), // Scope-only configs don't use category
            isNull(notification_config.subcategory_id),
            eq(notification_config.is_active, true)
          )
        )
        .orderBy(desc(notification_config.priority))
        .limit(1);
      
      if (scopeConfig) {
        config = scopeConfig;
      }
    }
    
    // If no category config, try global default (no category_id, no scope_id, priority 0)
    if (!config) {
      const [globalConfig] = await db
        .select()
        .from(notification_config)
        .where(
          and(
            isNull(notification_config.category_id),
            isNull(notification_config.subcategory_id),
            isNull(notification_config.scope_id),
            eq(notification_config.is_active, true)
          )
        )
        .orderBy(desc(notification_config.priority))
        .limit(1);
      
      if (globalConfig) {
        config = globalConfig;
      }
    }
    
    // If we found a config, use it
    if (config) {
      const slackCcUserIds = Array.isArray(config.slack_cc_user_ids)
        ? config.slack_cc_user_ids.filter((id): id is string => typeof id === 'string')
        : [];
      
      const emailRecipients = Array.isArray(config.email_recipients)
        ? config.email_recipients.filter((email): email is string => typeof email === 'string')
        : [];
      
      // Debug logging
      console.log(`[getNotificationConfig] Found config: categoryId=${categoryId}, scopeId=${resolvedScopeId}, enableSlack=${config.enable_slack}, enableEmail=${config.enable_email}, slackChannel=${config.slack_channel}`);
      
      return {
        enableSlack: config.enable_slack ?? true,
        enableEmail: config.enable_email ?? true,
        slackChannel: config.slack_channel || null,
        slackCcUserIds,
        emailRecipients,
      };
    }
    
    // Debug logging when no config found
    console.log(`[getNotificationConfig] No config found: categoryId=${categoryId}, scopeId=${resolvedScopeId}, ticketLocation=${ticketLocation}`);
    
    // Fallback to environment-based config (backward compatibility)
    return getDefaultNotificationConfig();
  } catch (error) {
    // Table might not exist yet - this is expected during migration
    // Only log if it's not a "relation does not exist" error
    if (error instanceof Error && !error.message.includes('does not exist')) {
      console.warn("[getNotificationConfig] Error fetching from database, using defaults:", error.message);
    }
    return getDefaultNotificationConfig();
  }
}

/**
 * Get default notification config from environment variables
 * This is used as fallback when no database config exists
 */
function getDefaultNotificationConfig(): NotificationConfig {
  return {
    enableSlack: slackConfig.enabled,
    enableEmail: true, // Email is always enabled if SMTP is configured
    slackChannel: null, // Will be determined by channel routing
    slackCcUserIds: Array.isArray(slackConfig.defaultCc) ? slackConfig.defaultCc : [],
    emailRecipients: [],
  };
}

/**
 * Check if Slack notifications should be sent for a category
 * Uses database config if available, otherwise falls back to legacy behavior
 */
export async function shouldSendSlackNotification(
  categoryName: string,
  categoryId: number | null,
  subcategoryId: number | null,
  scopeId?: number | null,
  ticketLocation?: string | null
): Promise<boolean> {
  try {
    const config = await getNotificationConfig(categoryId, subcategoryId, scopeId, ticketLocation);
    
    // If database config says Slack is disabled, don't send
    if (!config.enableSlack) {
      return false;
    }
    
    // If Slack is not enabled in environment, don't send
    if (!slackConfig.enabled) {
      return false;
    }
    
    // Legacy check: if no database config exists, use hardcoded list for backward compatibility
    // This ensures existing behavior continues until admins configure via database
    const SLACK_SUPPORTED_CATEGORIES = ["Hostel", "College", "Committee"] as const;
    const hasDbConfig = await hasNotificationConfig(categoryId, subcategoryId, scopeId, ticketLocation);
    
    if (!hasDbConfig) {
      // No database config, use legacy hardcoded check
      return SLACK_SUPPORTED_CATEGORIES.includes(categoryName as typeof SLACK_SUPPORTED_CATEGORIES[number]);
    }
    
    // Database config exists, use it
    return config.enableSlack;
  } catch (error) {
    // Table might not exist yet - this is expected during migration
    if (error instanceof Error && !error.message.includes('does not exist')) {
      console.warn("[shouldSendSlackNotification] Error checking config:", error.message);
    }
    // Fallback to legacy behavior
    const SLACK_SUPPORTED_CATEGORIES = ["Hostel", "College", "Committee"] as const;
    return SLACK_SUPPORTED_CATEGORIES.includes(categoryName as typeof SLACK_SUPPORTED_CATEGORIES[number]);
  }
}

/**
 * Check if email notifications should be sent
 */
export async function shouldSendEmailNotification(
  categoryId: number | null,
  subcategoryId: number | null,
  scopeId?: number | null,
  ticketLocation?: string | null
): Promise<boolean> {
  try {
    const config = await getNotificationConfig(categoryId, subcategoryId, scopeId, ticketLocation);
    return config.enableEmail;
  } catch (error) {
    // Table might not exist yet - this is expected during migration
    if (error instanceof Error && !error.message.includes('does not exist')) {
      console.warn("[shouldSendEmailNotification] Error checking config:", error.message);
    }
    return true; // Default to enabled
  }
}

/**
 * Check if notification config exists in database for given category/subcategory/scope
 */
async function hasNotificationConfig(
  categoryId: number | null,
  subcategoryId: number | null,
  scopeId?: number | null,
  ticketLocation?: string | null
): Promise<boolean> {
  try {
    // Resolve scope_id from ticketLocation if scopeId not provided
    let resolvedScopeId = scopeId;
    if (!resolvedScopeId && ticketLocation) {
      const { scopes } = await import("@/db");
      const [scope] = await db
        .select({ id: scopes.id })
        .from(scopes)
        .where(eq(scopes.name, ticketLocation))
        .limit(1);
      if (scope) {
        resolvedScopeId = scope.id;
      }
    }

    if (categoryId && subcategoryId) {
      const [config] = await db
        .select({ id: notification_config.id })
        .from(notification_config)
        .where(
          and(
            eq(notification_config.category_id, categoryId),
            eq(notification_config.subcategory_id, subcategoryId),
            eq(notification_config.is_active, true)
          )
        )
        .limit(1);
      if (config) return true;
    }
    
    // Check for category+scope combination
    if (categoryId && resolvedScopeId) {
      const [config] = await db
        .select({ id: notification_config.id })
        .from(notification_config)
        .where(
          and(
            eq(notification_config.category_id, categoryId),
            eq(notification_config.scope_id, resolvedScopeId),
            isNull(notification_config.subcategory_id),
            eq(notification_config.is_active, true)
          )
        )
        .limit(1);
      if (config) return true;
    }
    
    if (categoryId) {
      const [config] = await db
        .select({ id: notification_config.id })
        .from(notification_config)
        .where(
          and(
            eq(notification_config.category_id, categoryId),
            isNull(notification_config.subcategory_id),
            isNull(notification_config.scope_id),
            eq(notification_config.is_active, true)
          )
        )
        .limit(1);
      if (config) return true;
    }
    
    if (resolvedScopeId) {
      const [config] = await db
        .select({ id: notification_config.id })
        .from(notification_config)
        .where(
          and(
            eq(notification_config.scope_id, resolvedScopeId),
            isNull(notification_config.category_id),
            isNull(notification_config.subcategory_id),
            eq(notification_config.is_active, true)
          )
        )
        .limit(1);
      if (config) return true;
    }
    
    const [config] = await db
      .select({ id: notification_config.id })
      .from(notification_config)
      .where(
        and(
          isNull(notification_config.category_id),
          isNull(notification_config.subcategory_id),
          isNull(notification_config.scope_id),
          eq(notification_config.is_active, true)
        )
      )
      .limit(1);
    
    return !!config;
  } catch (error) {
    // Table might not exist yet - this is expected during migration
    // Return false silently (table doesn't exist = no config exists)
    if (error instanceof Error && !error.message.includes('does not exist')) {
      console.warn("[hasNotificationConfig] Error checking:", error.message);
    }
    return false;
  }
}
