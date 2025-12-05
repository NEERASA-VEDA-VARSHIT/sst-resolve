/**
 * Centralized Logging System
 * Provides structured logging with error tracking capabilities
 * Integrates with Sentry for production error monitoring
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private logLevel: LogLevel;
  private sentryEnabled: boolean;

  constructor() {
    // Set log level from environment or default to 'info'
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    const validLevels: LogLevel[] = ["debug", "info", "warn", "error"];
    this.logLevel = validLevels.includes(envLevel) ? envLevel : "info";

    // Check if Sentry is available (will be initialized separately)
    this.sentryEnabled =
      typeof window !== "undefined"
        ? !!(window as { Sentry?: unknown }).Sentry
        : typeof require !== "undefined" &&
          !!require("module")._cache["@sentry/nextjs"];

    // Try to dynamically import Sentry if available
    if (process.env.NODE_ENV === "production") {
      this.initializeSentry();
    }
  }

  private async initializeSentry(): Promise<void> {
    try {
      // Dynamic import to avoid bundling Sentry in development
      if (typeof window !== "undefined") {
        try {
          // @ts-ignore Optional dependency
          const Sentry = await import("@sentry/nextjs");
          if (Sentry) {
            this.sentryEnabled = true;
          }
        } catch {
          // Sentry not available
        }
      }
    } catch {
      // Sentry not installed or not configured
      this.sentryEnabled = false;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private sanitize(context: LogContext): LogContext {
    // Remove sensitive data from logs
    const sensitiveKeys = [
      "password",
      "token",
      "secret",
      "authorization",
      "apiKey",
      "apiSecret",
      "dsn",
    ];
    const sanitized = { ...context };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = "[REDACTED]";
      }
    }

    return sanitized;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(this.sanitize(context))}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private async captureToSentry(
    level: "error" | "warning" | "info",
    message: string,
    error?: Error | unknown,
    context?: LogContext
  ): Promise<void> {
    if (!this.sentryEnabled || process.env.NODE_ENV !== "production") {
      return;
    }

    try {
      // Dynamic import to avoid bundling issues
      const Sentry = await import("@sentry/nextjs").catch(() => null);
      if (!Sentry) return;

      const sanitizedContext = this.sanitize(context || {});

      if (level === "error" && error) {
        Sentry.captureException(error, {
          extra: {
            message,
            ...sanitizedContext,
          },
          tags: {
            component: (sanitizedContext.component as string) || "unknown",
          },
        });
      } else {
        Sentry.captureMessage(message, {
          level: level === "warning" ? "warning" : "info",
          extra: sanitizedContext,
          tags: {
            component: (sanitizedContext.component as string) || "unknown",
          },
        });
      }
    } catch {
      // Silently fail if Sentry is not available
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage("debug", message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog("info")) {
      if (process.env.NODE_ENV !== "production") {
        console.log(this.formatMessage("info", message, context));
      }
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, context));
      this.captureToSentry("warning", message, undefined, context);
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog("error")) {
      const errorContext: LogContext = {
        ...context,
        ...(error instanceof Error
          ? {
              error: error.message,
              stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
            }
          : { error: String(error) }),
      };
      console.error(this.formatMessage("error", message, errorContext));
      this.captureToSentry("error", message, error, context);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for use in other files
export type { LogContext, LogLevel };

