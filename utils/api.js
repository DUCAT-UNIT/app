/**
 * API utilities
 */

/**
 * Fetch with timeout
 */
export const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

/**
 * Fetch with retry logic
 * Retries failed requests with exponential backoff
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * @param {boolean} silent - If true, don't log errors (default: false)
 * @returns {Promise<Response>}
 */
export const fetchWithRetry = async (
  url,
  options = {},
  maxRetries = 3,
  timeout = 10000,
  silent = false
) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeout);

      // If response is ok, return it
      if (response.ok) {
        return response;
      }

      // If it's a 4xx error (client error), don't retry
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // For 5xx errors, retry
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error;

      // If it's the last attempt, throw the error
      if (attempt === maxRetries) {
        if (!silent) {
        }
        throw error;
      }

      // Calculate backoff delay: 500ms, 1000ms, 2000ms
      const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 5000);

      if (!silent) {
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }

  throw lastError;
};
