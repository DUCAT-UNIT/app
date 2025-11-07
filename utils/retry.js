/**
 * Retry utility for handling transient network errors
 * Silently retries failed requests without user notification
 */

/**
 * Checks if an error is a network-related error that should be retried
 * @param {Error|string} error - The error to check
 * @returns {boolean} True if error is network-related
 */
function isNetworkError(error) {
  const errorMessage = typeof error === 'string' ? error : error?.message || '';

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

  return networkPatterns.some(pattern => pattern.test(errorMessage));
}

/**
 * Retry a function with exponential backoff for network errors
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {Function} options.shouldRetry - Custom function to determine if error should be retried
 * @returns {Promise} Result of the function or throws final error
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = isNetworkError,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
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
      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }

  throw lastError;
}

/**
 * Wraps a fetch call with automatic retry logic
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {Object} retryOptions - Retry options (see retryWithBackoff)
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithRetry(url, options = {}, retryOptions = {}) {
  return retryWithBackoff(
    () => fetch(url, options),
    {
      maxRetries: 2, // Fewer retries for fetches
      initialDelay: 500,
      maxDelay: 3000,
      ...retryOptions,
    }
  );
}

/**
 * Wraps an async operation with silent retry logic
 * Logs retries to console but doesn't notify user
 * @param {Function} fn - Async function to retry
 * @param {string} operationName - Name of operation for logging
 * @param {Object} retryOptions - Retry options
 * @returns {Promise} Result of the function
 */
export async function retrySilently(fn, operationName = 'Operation', retryOptions = {}) {
  const originalShouldRetry = retryOptions.shouldRetry || isNetworkError;

  return retryWithBackoff(fn, {
    ...retryOptions,
    shouldRetry: (error) => {
      const shouldRetry = originalShouldRetry(error);
      if (shouldRetry) {
        console.log(`${operationName} failed, retrying...`, error.message);
      }
      return shouldRetry;
    },
  });
}
