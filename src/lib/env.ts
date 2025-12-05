/**
 * Environment Variable Validation
 * Ensures all required environment variables are present and valid
 */

import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),

  // Clerk Authentication
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, "Clerk publishable key is required"),
  CLERK_SECRET_KEY: z.string().min(1, "Clerk secret key is required"),

  // Cloudinary
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().min(1, "Cloudinary cloud name is required"),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().optional().or(z.literal("")),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Optional: Monitoring
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional().or(z.literal("")),
  SENTRY_DSN: z.string().url().optional().or(z.literal("")),

  // Optional: Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),

  // Optional: Cron
  CRON_SECRET: z.string().optional(),
});

/**
 * Validated environment variables
 * Throws error at build time if required variables are missing
 */
export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NODE_ENV: process.env.NODE_ENV || "development",
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  SENTRY_DSN: process.env.SENTRY_DSN,
  LOG_LEVEL: process.env.LOG_LEVEL,
  CRON_SECRET: process.env.CRON_SECRET,
});
