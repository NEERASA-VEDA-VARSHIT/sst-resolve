/**
 * Application Configuration
 * Centralized configuration management
 */

/**
 * Application Settings
 */
export const appConfig = {
  name: "SST Resolve",
  version: "2.1",
  description: "WhatsApp-First Ticket Management System",
  maxTicketsPerWeek: parseInt(process.env.MAX_TICKETS_PER_WEEK || "3", 10),
  autoEscalationDays: parseInt(process.env.AUTO_ESCALATION_DAYS || "7", 10),
  escalationCooldownDays: parseInt(process.env.ESCALATION_COOLDOWN_DAYS || "2", 10),
} as const;

/**
 * Email Configuration
 */
export const emailConfig = {
  enabled: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true",
  from: process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@sst-resolve.com",
  domain: process.env.EMAIL_DOMAIN || "sst-resolve.local",
} as const;

/**
 * Slack Configuration
 */
const hostelChannelsMap = (() => {
  try {
    const raw = process.env.SLACK_HOSTEL_CHANNELS_JSON; // e.g., {"Velankani":"#tickets-velankani","Neeladri":"#tickets-neeladri"}
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    Velankani: process.env.SLACK_HOSTEL_VELANKANI_CHANNEL || "#tickets-velankani",
    Neeladri: process.env.SLACK_HOSTEL_NEELADRI_CHANNEL || "#tickets-neeladri",
  } as Record<string, string>;
})();

const defaultHostelChannel =
  process.env.SLACK_HOSTEL_CHANNEL ||
  Object.values(hostelChannelsMap)[0] ||
  "#tickets-hostel";

export const slackConfig = {
  enabled: !!(process.env.SLACK_BOT_TOKEN || process.env.SLACK_WEBHOOK_URL),
  botToken: process.env.SLACK_BOT_TOKEN,
  webhookUrl: process.env.SLACK_WEBHOOK_URL,
  channels: {
    hostel: defaultHostelChannel,
    college: process.env.SLACK_COLLEGE_CHANNEL || "#tickets-college",
    committee: process.env.SLACK_COMMITTEE_CHANNEL || "#tickets-committee",
    hostels: hostelChannelsMap,
  },
  // Comma-separated Slack user IDs, e.g. "U0123ABCD,U0456EFGH". Defaults to the provided CC.
  defaultCc: (process.env.SLACK_DEFAULT_CC || "U09NQH3MRM2")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  // Optional per-category and per-category:subcategory CC mappings
  // Keys can be "Hostel", "College", or "Hostel:Leave Application" etc.
  ccMap: ((): Record<string, string[]> => {
    try {
      const raw = process.env.SLACK_CC_MAP_JSON;
      if (raw) {
        const parsed = JSON.parse(raw);
        // Ensure parsed result is a valid object
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn("[Slack Config] Error parsing SLACK_CC_MAP_JSON, using defaults:", error);
    }
    // Default mapping: apply provided CC to broad categories; extend as needed
    return {
      Hostel: ["U09NQH3MRM2"],
      College: ["U09NQH3MRM2"],
      Committee: ["U09NQH3MRM2"],
      // example: "Hostel:Leave Application": ["UXXXXXXXXX"],
    };
  })(),
} as const;

/**
 * Database Configuration
 */
export const dbConfig = {
  url: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" || process.env.DATABASE_URL?.includes("sslmode=require"),
} as const;

/**
 * Clerk Configuration
 */
export const clerkConfig = {
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
} as const;

/**
 * WhatsApp Configuration (for bot)
 */
export const whatsappConfig = {
  enabled: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  fromNumber: process.env.TWILIO_WHATSAPP_FROM,
} as const;

/**
 * Cron Configuration
 */
export const cronConfig = {
  secret: process.env.CRON_SECRET,
  autoEscalateEnabled: !!(process.env.CRON_SECRET || process.env.ENABLE_AUTO_ESCALATION === "true"),
} as const;

/**
 * Environment
 */
export const env = {
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test",
} as const;

/**
 * Validate required configuration
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!dbConfig.url) {
    errors.push("DATABASE_URL is required");
  }

  if (!clerkConfig.publishableKey) {
    errors.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required");
  }

  if (!clerkConfig.secretKey) {
    errors.push("CLERK_SECRET_KEY is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get configuration summary (for debugging, excludes secrets)
 */
export function getConfigSummary() {
  return {
    app: appConfig,
    email: {
      enabled: emailConfig.enabled,
      host: emailConfig.host,
      port: emailConfig.port,
      from: emailConfig.from,
    },
    slack: {
      enabled: slackConfig.enabled,
      hasBotToken: !!slackConfig.botToken,
      hasWebhookUrl: !!slackConfig.webhookUrl,
      channels: slackConfig.channels,
    },
    database: {
      hasUrl: !!dbConfig.url,
      ssl: dbConfig.ssl,
    },
    clerk: {
      hasPublishableKey: !!clerkConfig.publishableKey,
      hasSecretKey: !!clerkConfig.secretKey,
    },
    whatsapp: {
      enabled: whatsappConfig.enabled,
      hasAccountSid: !!whatsappConfig.accountSid,
    },
    cron: {
      hasSecret: !!cronConfig.secret,
      autoEscalateEnabled: cronConfig.autoEscalateEnabled,
    },
    environment: env,
  };
}

