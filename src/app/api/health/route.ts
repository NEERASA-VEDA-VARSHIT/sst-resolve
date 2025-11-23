import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { validateConfig } from "@/conf/config";
import { emailConfig, slackConfig } from "@/conf/config";
import { logger } from "@/lib/logger";

type ServiceStatus = "healthy" | "degraded" | "unhealthy";

interface HealthCheckResponse {
  status: ServiceStatus;
  timestamp: string;
  services: {
    database: ServiceStatus;
    email: ServiceStatus;
    slack: ServiceStatus;
    cloudinary: ServiceStatus;
  };
  config: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

/**
 * Health Check Endpoint
 * GET /api/health
 * 
 * Checks the health of all critical services and integrations
 * Used for monitoring and uptime checks
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  const services: HealthCheckResponse["services"] = {
    database: "unhealthy",
    email: "unhealthy",
    slack: "unhealthy",
    cloudinary: "unhealthy",
  };

  // Validate configuration
  const configValidation = validateConfig();

  // Check database connectivity
  try {
    await db.execute(sql`SELECT 1`);
    services.database = "healthy";
  } catch (error) {
    logger.error("[Health Check] Database connection failed", error);
    services.database = "unhealthy";
  }

  // Check email service
  if (emailConfig.enabled) {
    services.email = "healthy";
  } else {
    services.email = "degraded";
  }

  // Check Slack integration
  if (slackConfig.enabled) {
    services.slack = "healthy";
  } else {
    services.slack = "degraded";
  }

  // Check Cloudinary
  if (
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    services.cloudinary = "healthy";
  } else {
    services.cloudinary = "degraded";
  }

  // Determine overall status
  const allHealthy = Object.values(services).every((status) => status === "healthy");
  const anyUnhealthy = Object.values(services).some((status) => status === "unhealthy");

  const overallStatus: ServiceStatus = anyUnhealthy
    ? "unhealthy"
    : allHealthy
    ? "healthy"
    : "degraded";

  // Return appropriate HTTP status
  const httpStatus = overallStatus === "unhealthy" ? 503 : overallStatus === "degraded" ? 200 : 200;

  const response: HealthCheckResponse = {
    status: overallStatus,
    timestamp,
    services,
    config: {
      valid: configValidation.valid,
      errors: configValidation.errors,
      warnings: configValidation.warnings,
    },
  };

  return NextResponse.json(response, { status: httpStatus });
}

