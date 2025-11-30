/**
 * Notification Channel Routing
 * Database-driven channel routing with priority-based fallback
 * 
 * Priority Order (highest → lowest):
 * 1. Ticket-specific Slack thread (if exists)
 * 2. Category channel
 * 3. Scope channel
 * 4. Domain channel
 * 5. Committee channel(s)
 * 6. Assigned admin's Slack DM
 * 7. Super admin fallback channel
 */

import { db, notification_channels, categories } from "@/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { slackConfig } from "@/conf/config";

export interface ChannelRoutingResult {
  channel: string | null;
  threadTs: string | null;
  slackUserId: string | null; // For DM notifications
  channelType: "slack" | "email" | "webhook";
}

/**
 * Find notification channel for a ticket using priority-based routing
 * 
 * Priority Order (highest → lowest):
 * 1. Ticket-specific Slack thread (if exists)
 * 2. Category channel
 * 3. Scope channel
 * 4. Domain channel (fetched from category if not provided)
 * 5. Committee channel(s)
 * 6. Assigned admin's Slack DM
 * 7. Super admin fallback channel
 */
export async function findNotificationChannel(
  ticketId: number,
  categoryId: number | null,
  scopeId: number | null,
  domainId: number | null,
  committeeIds: number[] | null,
  assignedToUserId: string | null
): Promise<ChannelRoutingResult> {
  try {
    // Priority 1: Ticket-specific Slack thread (if exists)
    const ticketChannel = await findChannel("ticket", ticketId.toString());
    if (ticketChannel) {
      return {
        channel: ticketChannel.slack_channel_id || null,
        threadTs: ticketChannel.slack_thread || null,
        slackUserId: ticketChannel.slack_user_id || null,
        channelType: (ticketChannel.channel_type as "slack" | "email" | "webhook") || "slack",
      };
    }

    // Priority 2: Category channel
    if (categoryId) {
      const categoryChannel = await findChannel("category", categoryId.toString());
      if (categoryChannel) {
        return {
          channel: categoryChannel.slack_channel_id || null,
          threadTs: null,
          slackUserId: null,
          channelType: (categoryChannel.channel_type as "slack" | "email" | "webhook") || "slack",
        };
      }
    }

    // Priority 3: Scope channel
    if (scopeId) {
      const scopeChannel = await findChannel("scope", scopeId.toString());
      if (scopeChannel) {
        return {
          channel: scopeChannel.slack_channel_id || null,
          threadTs: null,
          slackUserId: null,
          channelType: (scopeChannel.channel_type as "slack" | "email" | "webhook") || "slack",
        };
      }
    }

    // Priority 4: Domain channel (fetch from category if domainId not provided)
    let resolvedDomainId = domainId;
    if (!resolvedDomainId && categoryId) {
      try {
        const [categoryRecord] = await db
          .select({ domain_id: categories.domain_id })
          .from(categories)
          .where(eq(categories.id, categoryId))
          .limit(1);
        if (categoryRecord?.domain_id) {
          resolvedDomainId = categoryRecord.domain_id;
        }
      } catch (error) {
        console.warn(`[findNotificationChannel] Error fetching domain_id from category ${categoryId}:`, error);
      }
    }

    if (resolvedDomainId) {
      const domainChannel = await findChannel("domain", resolvedDomainId.toString());
      if (domainChannel) {
        return {
          channel: domainChannel.slack_channel_id || null,
          threadTs: null,
          slackUserId: null,
          channelType: (domainChannel.channel_type as "slack" | "email" | "webhook") || "slack",
        };
      }
    }

    // Priority 5: Committee channel(s) - get first active committee channel
    if (committeeIds && committeeIds.length > 0) {
      const committeeChannels = await findChannels("committee", committeeIds.map(id => id.toString()));
      if (committeeChannels.length > 0) {
        const firstChannel = committeeChannels[0];
        return {
          channel: firstChannel.slack_channel_id || null,
          threadTs: null,
          slackUserId: null,
          channelType: (firstChannel.channel_type as "slack" | "email" | "webhook") || "slack",
        };
      }
    }

    // Priority 6: Assigned admin's Slack DM
    if (assignedToUserId) {
      const userChannel = await findChannel("user", assignedToUserId);
      if (userChannel && userChannel.slack_user_id) {
        return {
          channel: null, // DM doesn't use channel
          threadTs: null,
          slackUserId: userChannel.slack_user_id,
          channelType: (userChannel.channel_type as "slack" | "email" | "webhook") || "slack",
        };
      }
    }

    // Priority 7: Super admin fallback channel (from env config)
    return {
      channel: getFallbackSuperAdminChannel(),
      threadTs: null,
      slackUserId: null,
      channelType: "slack",
    };
  } catch (error) {
    console.error("[findNotificationChannel] Error finding channel:", error);
    // Fallback to super admin channel
    return {
      channel: getFallbackSuperAdminChannel(),
      threadTs: null,
      slackUserId: null,
      channelType: "slack",
    };
  }
}

/**
 * Find a single notification channel by owner type and ID
 */
async function findChannel(
  ownerType: string,
  ownerId: string
): Promise<typeof notification_channels.$inferSelect | null> {
  try {
    const [channel] = await db
      .select()
      .from(notification_channels)
      .where(
        and(
          eq(notification_channels.owner_type, ownerType),
          eq(notification_channels.owner_id, ownerId),
          eq(notification_channels.is_active, true)
        )
      )
      .orderBy(desc(notification_channels.priority))
      .limit(1);
    
    return channel || null;
  } catch (error) {
    console.error(`[findChannel] Error finding channel for ${ownerType}:${ownerId}:`, error);
    return null;
  }
}

/**
 * Find multiple notification channels by owner type and IDs
 */
async function findChannels(
  ownerType: string,
  ownerIds: string[]
): Promise<Array<typeof notification_channels.$inferSelect>> {
  try {
    if (ownerIds.length === 0) return [];
    
    const channels = await db
      .select()
      .from(notification_channels)
      .where(
        and(
          eq(notification_channels.owner_type, ownerType),
          inArray(notification_channels.owner_id, ownerIds),
          eq(notification_channels.is_active, true)
        )
      )
      .orderBy(desc(notification_channels.priority));
    
    return channels;
  } catch (error) {
    console.error(`[findChannels] Error finding channels for ${ownerType}:`, error);
    return [];
  }
}

/**
 * Get fallback super admin channel from environment config
 */
function getFallbackSuperAdminChannel(): string | null {
  // Try to find a default channel from config
  if (slackConfig.channels.committee) {
    return slackConfig.channels.committee as string;
  }
  if (slackConfig.channels.college) {
    return slackConfig.channels.college as string;
  }
  if (slackConfig.channels.hostel) {
    return slackConfig.channels.hostel as string;
  }
  return null;
}

/**
 * Save ticket Slack thread to notification_channels
 * This allows all future updates to go to the same thread
 */
export async function saveTicketSlackThread(
  ticketId: number,
  channel: string,
  threadTs: string
): Promise<void> {
  try {
    // Check if entry already exists
    const existing = await findChannel("ticket", ticketId.toString());
    
    if (existing) {
      // Update existing entry
      await db
        .update(notification_channels)
        .set({
          slack_channel_id: channel,
          slack_thread: threadTs,
          updated_at: new Date(),
        })
        .where(eq(notification_channels.id, existing.id));
    } else {
      // Create new entry
      await db.insert(notification_channels).values({
        owner_type: "ticket",
        owner_id: ticketId.toString(),
        channel_type: "slack",
        slack_channel_id: channel,
        slack_thread: threadTs,
        priority: 100, // Highest priority
        is_active: true,
      });
    }
  } catch (error) {
    console.error(`[saveTicketSlackThread] Error saving thread for ticket ${ticketId}:`, error);
    // Don't throw - this is not critical
  }
}

/**
 * Get all notification channels for a specific owner type
 * Useful for admin UI to show configured channels
 */
export async function getChannelsByOwnerType(
  ownerType: string
): Promise<Array<typeof notification_channels.$inferSelect>> {
  try {
    return await db
      .select()
      .from(notification_channels)
      .where(
        and(
          eq(notification_channels.owner_type, ownerType),
          eq(notification_channels.is_active, true)
        )
      )
      .orderBy(desc(notification_channels.priority));
  } catch (error) {
    console.error(`[getChannelsByOwnerType] Error fetching channels for ${ownerType}:`, error);
    return [];
  }
}
