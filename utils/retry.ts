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
      const jitter = Math.random() * 0.3 * delay; // +/- 30% jitter
      const finalDelay = delay + jitter;

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    }
  }

  throw lastError;
}

/**
 * Wraps a fetch call with automatic retry logic
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param retryOptions - Retry options (see retryWithBackoff)
 * @returns Fetch response
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return retryWithBackoff(() => fetch(url, options), {
    maxRetries: 2, // Fewer retries for fetches
    initialDelay: 500,
    maxDelay: 3000,
    ...retryOptions,
  });
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
