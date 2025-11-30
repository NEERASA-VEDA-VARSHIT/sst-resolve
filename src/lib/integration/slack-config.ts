/**
 * Helper functions to get Slack configuration from database
 * Falls back to environment variables if database settings are not available
 * Includes caching to reduce database load and improve performance
 */

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

    const config: SlackChannelConfig = {
        hostel: envSlackConfig.channels.hostel as string | undefined,
        college: envSlackConfig.channels.college as string | undefined,
        committee: envSlackConfig.channels.committee as string | undefined,
        hostel_channels: (envSlackConfig.channels.hostels as Record<string, string> | undefined) || {},
    };

    configCache.config = config;
    configCache.expires = now + 60_000;

    return config;
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

