/**
 * Unified API Client
 * Provides consistent API request patterns with retry logic, timeout, and error handling
 */

import { retrySilently } from './retry';
import { fetchWithTimeout } from './api';
import { logger } from './logger';

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

/**
 * Makes a POST request with automatic retry and timeout
 * @param {string} url - The endpoint URL
 * @param {Object} body - Request body (will be JSON stringified)
 * @param {Object} options - Additional options
 * @param {Object} options.headers - Additional headers to merge
 * @param {number} options.timeout - Request timeout in ms (default: 10000)
 * @param {string} options.description - Operation description for logging
 * @param {Object} options.retryOptions - Options to pass to retrySilently
 * @returns {Promise<Response>} Fetch response object
 */
export async function postWithRetry(url, body, options = {}) {
  const {
    headers = {},
    timeout = DEFAULT_TIMEOUT,
    description = 'POST request',
    retryOptions = {},
  } = options;

  return retrySilently(
    () =>
      fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            ...DEFAULT_HEADERS,
            ...headers,
          },
          body: JSON.stringify(body),
        },
        timeout
      ),
    description,
    retryOptions
  );
}

/**
 * Makes a GET request with automatic retry and timeout
 * @param {string} url - The endpoint URL
 * @param {Object} options - Additional options
 * @param {Object} options.headers - Additional headers to merge
 * @param {number} options.timeout - Request timeout in ms (default: 10000)
 * @param {string} options.description - Operation description for logging
 * @param {Object} options.retryOptions - Options to pass to retrySilently
 * @returns {Promise<Response>} Fetch response object
 */
export async function getWithRetry(url, options = {}) {
  const {
    headers = {},
    timeout = DEFAULT_TIMEOUT,
    description = 'GET request',
    retryOptions = {},
  } = options;

  return retrySilently(
    () =>
      fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            ...headers,
          },
        },
        timeout
      ),
    description,
    retryOptions
  );
}

/**
 * Makes a POST request and parses JSON response with automatic retry
 * @param {string} url - The endpoint URL
 * @param {Object} body - Request body
 * @param {Object} options - Additional options (see postWithRetry)
 * @returns {Promise<Object>} Parsed JSON response
 */
export async function postJSON(url, body, options = {}) {
  const response = await postWithRetry(url, body, options);
  return response.json();
}

/**
 * Makes a GET request and parses JSON response with automatic retry
 * @param {string} url - The endpoint URL
 * @param {Object} options - Additional options (see getWithRetry)
 * @returns {Promise<Object>} Parsed JSON response
 */
export async function getJSON(url, options = {}) {
  const response = await getWithRetry(url, options);
  return response.json();
}

/**
 * Fetches paginated data from an API endpoint
 * @param {Function} fetchPage - Function that fetches a single page (offset, limit) => Promise<Array>
 * @param {Object} options - Pagination options
 * @param {number} options.limit - Items per page (default: 250)
 * @param {number} options.maxPages - Maximum pages to fetch (default: 20)
 * @param {Function} options.onProgress - Callback called after each page (pageNum, totalItems)
 * @returns {Promise<Array>} All fetched items
 */
export async function fetchPaginated(fetchPage, options = {}) {
  const { limit = 250, maxPages = 20, onProgress } = options;

  const allItems = [];
  let offset = 0;
  let hasMore = true;
  let pageCount = 0;

  while (hasMore && pageCount < maxPages) {
    try {
      const items = await fetchPage(offset, limit);

      if (!items || items.length === 0) {
        hasMore = false;
        break;
      }

      allItems.push(...items);

      // Call progress callback if provided
      if (onProgress) {
        onProgress(pageCount + 1, allItems.length);
      }

      // If we got less than limit, we've reached the end
      if (items.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }

      pageCount++;
    } catch (error) {
      logger.error(`Pagination error on page ${pageCount + 1}:`, error);
      // Stop pagination on error
      hasMore = false;
    }
  }

  return allItems;
}

/**
 * Executes multiple async operations in parallel with error handling
 * Returns results with graceful degradation (failed operations return default values)
 * @param {Array<{fn: Function, defaultValue: any, name: string}>} operations
 * @returns {Promise<Array>} Results array (same order as operations)
 */
export async function fetchParallel(operations) {
  const promises = operations.map(({ fn, name }) =>
    fn().catch((error) => {
      logger.error(`Parallel fetch failed for "${name}":`, error);
      return { error: true, name };
    })
  );

  const results = await Promise.allSettled(promises);

  return results.map((result, index) => {
    const { defaultValue } = operations[index];

    if (result.status === 'fulfilled') {
      // If the fulfilled value is an error object, return default
      if (result.value?.error) {
        return defaultValue;
      }
      return result.value;
    }

    // For rejected promises, return default value
    return defaultValue;
  });
}
