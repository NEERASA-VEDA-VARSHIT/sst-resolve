/**
 * Centralized Logging System
 * Provides structured logging with error tracking capabilities
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private logLevel: LogLevel;

  constructor() {
    // Set log level from environment or default to 'info'
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    const validLevels: LogLevel[] = ["debug", "info", "warn", "error"];
    this.logLevel = validLevels.includes(envLevel) ? envLevel : "info";
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private sanitize(context: LogContext): LogContext {
    // Remove sensitive data from logs
    const sensitiveKeys = ["password", "token", "secret", "authorization", "apiKey", "apiSecret"];
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

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage("debug", message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog("info")) {
      console.log(this.formatMessage("info", message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, context));
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
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for use in other files
export type { LogContext, LogLevel };

