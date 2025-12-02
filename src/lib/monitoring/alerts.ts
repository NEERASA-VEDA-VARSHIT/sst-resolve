/**
 * Centralized monitoring and alerting utilities
 * Provides standardized error logging and critical error tracking
 * 
 * TODO: Integrate with external monitoring service (e.g., Sentry, DataDog)
 */

/**
 * Log a critical error that requires immediate attention
 * These errors indicate system misconfiguration or critical failures
 * 
 * @param context - Human-readable context describing where/when the error occurred
 * @param error - The error object or error message
 * @param metadata - Additional context data to include in the log
 */
export function logCriticalError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[CRITICAL] ${context}`, {
    error: errorMessage,
    stack: errorStack,
    ...metadata,
    timestamp: new Date().toISOString(),
  });

  // TODO: Integrate with monitoring service (e.g., Sentry, DataDog, etc.)
  // Example: Sentry.captureException(error, { extra: metadata });
}

/**
 * Log a warning for non-critical issues that should be monitored
 * 
 * @param message - Warning message
 * @param metadata - Additional context data
 */
export function logWarning(
  message: string,
  metadata?: Record<string, unknown>
): void {
  console.warn(`[WARNING] ${message}`, {
    ...metadata,
    timestamp: new Date().toISOString(),
  });

  // TODO: Integrate with monitoring service for warning tracking
  // Example: Sentry.captureMessage(message, { level: 'warning', extra: metadata });
}
