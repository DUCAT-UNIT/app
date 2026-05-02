/**
 * Retry utility for handling transient network errors
 * Silently retries failed requests without user notification
 */

export type ShouldRetryFunction = (error: Error | string | unknown) => boolean;

/**
 * Checks if an error is a network-related error that should be retried
 * @param error - The error to check
 * @returns True if error is network-related
 */
function isNetworkError(error: Error | string | unknown): boolean {
  const errorMessage = typeof error === 'string' ? error : (error as Error)?.message || '';

  const networkPatterns = [
    /network request failed/i,
    /fetch failed/i,
    /ECONNREFUSED/i,
    /ENOTFOUND/i,
    /ETIMEDOUT/i,
    /timeout/i,
    /timed out/i,
    /connection refused/i,
    /connection reset/i,
    /socket hang up/i,
    /network error/i,
  ];

  return networkPatterns.some((pattern) => pattern.test(errorMessage));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    (timer as { unref?: () => void }).unref?.();
  });
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  shouldRetry?: ShouldRetryFunction;
}

/**
 * Retry a function with exponential backoff for network errors
 * @param fn - Async function to retry
 * @param options - Retry options
 * @returns Result of the function or throws final error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = isNetworkError,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      // If it's the last attempt or not a retryable error, throw immediately
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);

      // Add jitter to prevent thundering herd
      // Math.random() is intentional here — jitter is for retry timing, not cryptographic use
      const jitter = Math.random() * 0.3 * delay; // +/- 30% jitter
      const finalDelay = delay + jitter;

      // Wait before retrying
      await sleep(finalDelay);
    }
  }

  throw lastError;
}

/**
 * Wraps an async operation with silent retry logic
 * @param fn - Async function to retry
 * @param retryOptions - Retry options
 * @returns Result of the function
 */
export async function retrySilently<T>(
  fn: () => Promise<T>,
  retryOptions: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(fn, retryOptions);
}
