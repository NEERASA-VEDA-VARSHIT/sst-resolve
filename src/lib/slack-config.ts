/**
 * Helper functions to get Slack configuration from database
 * Falls back to environment variables if database settings are not available
 * Includes caching to reduce database load and improve performance
 */

import { db, notification_settings } from "@/db";
import { slackConfig as envSlackConfig } from "@/conf/config";

export interface SlackChannelConfig {
    hostel?: string;
    college?: string;
    committee?: string;
    hostel_channels?: Record<string, string>;
}

/**
 * In-memory cache for Slack channel configuration (60-second TTL)
 * Reduces database queries significantly for ticket processing
 */
const configCache: { config: SlackChannelConfig | null; expires: number } = {
    config: null,
    expires: 0,
};

/**
 * Get Slack channel configuration from database, falling back to env vars
 * Cached for 60 seconds to improve performance
 */
export async function getSlackChannelConfig(): Promise<SlackChannelConfig> {
    const now = Date.now();
    
    // Return cached config if still valid
    if (configCache.config && configCache.expires > now) {
        return configCache.config;
    }

    try {
        const [settings] = await db
            .select({ slack_config: notification_settings.slack_config })
            .from(notification_settings)
            .limit(1);

        let config: SlackChannelConfig;

        if (settings?.slack_config && typeof settings.slack_config === 'object') {
            const dbConfig = settings.slack_config as {
                hostel_channel?: string;
                college_channel?: string;
                committee_channel?: string;
                hostel_channels?: Record<string, string>;
            };

            // Merge database config with env config (DB takes precedence)
            config = {
                hostel: dbConfig.hostel_channel || envSlackConfig.channels.hostel,
                college: dbConfig.college_channel || envSlackConfig.channels.college,
                committee: dbConfig.committee_channel || envSlackConfig.channels.committee,
                hostel_channels: dbConfig.hostel_channels || envSlackConfig.channels.hostels as Record<string, string> || {},
            };
        } else {
            // Fallback to environment config
            config = {
                hostel: envSlackConfig.channels.hostel,
                college: envSlackConfig.channels.college,
                committee: envSlackConfig.channels.committee,
                hostel_channels: envSlackConfig.channels.hostels as Record<string, string> || {},
            };
        }

        // Cache for 60 seconds
        configCache.config = config;
        configCache.expires = now + 60_000;

        return config;
    } catch (error) {
        console.error("[getSlackChannelConfig] Error fetching from database:", error);
        
        // On error, use env config and cache it for 10 seconds (shorter to retry sooner)
        const fallbackConfig: SlackChannelConfig = {
            hostel: envSlackConfig.channels.hostel,
            college: envSlackConfig.channels.college,
            committee: envSlackConfig.channels.committee,
            hostel_channels: envSlackConfig.channels.hostels as Record<string, string> || {},
        };
        
        configCache.config = fallbackConfig;
        configCache.expires = now + 10_000; // Shorter cache on error
        
        return fallbackConfig;
    }
}

/**
 * Get the appropriate Slack channel for a hostel
 * Checks hostel-specific mapping first, then falls back to default
 * Uses cached config to avoid duplicate database queries
 */
export async function getHostelSlackChannel(hostelName: string | null | undefined): Promise<string> {
    const config = await getSlackChannelConfig();
    
    // If hostel name is provided and has a specific mapping, use it
    if (hostelName && config.hostel_channels?.[hostelName]) {
        return config.hostel_channels[hostelName];
    }
    
    // Otherwise use default hostel channel
    if (config.hostel) {
        return config.hostel;
    }
    
    // Last resort fallback
    return "#tickets-velankani";
}

/**
 * Invalidate the cache (call this when settings are updated)
 */
export function invalidateSlackConfigCache(): void {
    configCache.config = null;
    configCache.expires = 0;
}

