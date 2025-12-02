/**
 * Retry utility with exponential backoff
 * Used for external API calls that may fail transiently (Slack, Email, etc.)
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    'rate_limited',
    'rate_limited_error',
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENOTFOUND',
    'timeout',
    'TIMEOUT',
    'network',
    'NETWORK',
  ],
};

/**
 * Check if an error is retryable based on error message or code
 */
function isRetryableError(error: unknown, retryableErrors: string[]): boolean {
  if (!error) return false;
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorString = errorMessage.toLowerCase();
  
  // Check if error message contains any retryable error keywords
  return retryableErrors.some(keyword => errorString.includes(keyword.toLowerCase()));
}

/**
 * Extract error code from error object (for Slack/Email API errors)
 */
function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    return String(error.code);
  }
  if (error && typeof error === 'object' && 'data' in error && error.data && typeof error.data === 'object' && 'error' in error.data) {
    return String(error.data.error);
  }
  return undefined;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Function to retry (should return a Promise)
 * @param options - Retry configuration options
 * @returns Result of the function call
 * @throws Last error if all retries fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  let delay = config.initialDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const errorCode = getErrorCode(error);
      const isRetryable = errorCode 
        ? config.retryableErrors.some(keyword => errorCode.toLowerCase().includes(keyword.toLowerCase()))
        : isRetryableError(error, config.retryableErrors);

      // If not retryable or max retries reached, throw immediately
      if (!isRetryable || attempt === config.maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
      
      console.warn(
        `[Retry] Attempt ${attempt + 1}/${config.maxRetries + 1} failed, retrying in ${delay}ms...`,
        { error: error instanceof Error ? error.message : String(error), errorCode }
      );

      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}
