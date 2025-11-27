/**
 * Unified API Client
 * Provides consistent API request patterns with retry logic, timeout, and error handling
 */

import { retrySilently, type RetryOptions } from './retry';
import { fetchWithTimeout } from './api';
import { logger } from './logger';

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

export interface PostOptions {
  headers?: Record<string, string>;
  timeout?: number;
  description?: string;
  retryOptions?: RetryOptions;
}

export interface GetOptions {
  headers?: Record<string, string>;
  timeout?: number;
  description?: string;
  retryOptions?: RetryOptions;
}

/**
 * Makes a POST request with automatic retry and timeout
 * @param url - The endpoint URL
 * @param body - Request body (will be JSON stringified)
 * @param options - Additional options
 * @returns Fetch response object
 */
export async function postWithRetry(
  url: string,
  body: unknown,
  options: PostOptions = {}
): Promise<Response> {
  const {
    headers = {},
    timeout = DEFAULT_TIMEOUT,
    description = 'POST request',
    retryOptions = {},
  } = options;

  const startTime = Date.now();
  try {
    const response = await retrySilently(
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
      retryOptions
    );
    const duration = Date.now() - startTime;
    logger.api(url, 'POST', response.status, duration);
    return response;
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logger.api(url, 'POST', 0, duration);
    throw error;
  }
}

/**
 * Makes a GET request with automatic retry and timeout
 * @param url - The endpoint URL
 * @param options - Additional options
 * @returns Fetch response object
 */
export async function getWithRetry(url: string, options: GetOptions = {}): Promise<Response> {
  const {
    headers = {},
    timeout = DEFAULT_TIMEOUT,
    description = 'GET request',
    retryOptions = {},
  } = options;

  const startTime = Date.now();
  try {
    const response = await retrySilently(
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
      retryOptions
    );
    const duration = Date.now() - startTime;
    logger.api(url, 'GET', response.status, duration);
    return response;
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logger.api(url, 'GET', 0, duration);
    throw error;
  }
}

/**
 * Makes a POST request and parses JSON response with automatic retry
 * @param url - The endpoint URL
 * @param body - Request body
 * @param options - Additional options (see postWithRetry)
 * @returns Parsed JSON response
 */
export async function postJSON<T = unknown>(url: string, body: unknown, options: PostOptions = {}): Promise<T> {
  const response = await postWithRetry(url, body, options);

  // Check if response was successful
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: string; message?: string };
    throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Makes a GET request and parses JSON response with automatic retry
 * @param url - The endpoint URL
 * @param options - Additional options (see getWithRetry)
 * @returns Parsed JSON response
 */
export async function getJSON<T = unknown>(url: string, options: GetOptions = {}): Promise<T> {
  const response = await getWithRetry(url, options);

  // Check if response is OK before parsing
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Check content-type to ensure it's JSON before parsing
  const contentType = response.headers.get('content-type');
  if (contentType && !contentType.includes('application/json')) {
    throw new Error(`Expected JSON response but got ${contentType}`);
  }

  return response.json() as Promise<T>;
}

export type FetchPageFunction<T> = (offset: number, limit: number) => Promise<T[]>;

export interface FetchPaginatedOptions {
  limit?: number;
  maxPages?: number;
  onProgress?: (pageNum: number, totalItems: number) => void;
}

/**
 * Fetches paginated data from an API endpoint
 * @param fetchPage - Function that fetches a single page (offset, limit) => Promise<Array>
 * @param options - Pagination options
 * @returns All fetched items
 */
export async function fetchPaginated<T = unknown>(
  fetchPage: FetchPageFunction<T>,
  options: FetchPaginatedOptions = {}
): Promise<T[]> {
  const { limit = 250, maxPages = 20, onProgress } = options;

  const allItems: T[] = [];
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
    } catch (error: unknown) {
      logger.error(error as Error, { page: pageCount + 1 });
      // Stop pagination on error
      hasMore = false;
    }
  }

  return allItems;
}

export interface ParallelOperation<T> {
  fn: () => Promise<T>;
  defaultValue: T;
  name: string;
}

/**
 * Executes multiple async operations in parallel with error handling
 * Returns results with graceful degradation (failed operations return default values)
 * @param operations - Array of operations to execute
 * @returns Results array (same order as operations)
 */
export async function fetchParallel<T = unknown>(operations: ParallelOperation<T>[]): Promise<T[]> {
  const promises = operations.map(({ fn, name }) =>
    fn().catch((error) => {
      // Only log as debug for network errors (these are expected to happen sometimes)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNetworkError = errorMessage.includes('HTTP 5') ||
                             errorMessage.includes('timeout') ||
                             errorMessage.includes('network') ||
                             errorMessage.includes('Expected JSON');
      if (isNetworkError) {
        logger.debug(`⚠️ ${name} failed (using default): ${errorMessage}`);
      } else {
        logger.error(error as Error, { operation: name });
      }
      return { error: true, name } as T & { error: boolean; name: string };
    })
  );

  const results = await Promise.allSettled(promises);

  return results.map((result, index) => {
    const { defaultValue } = operations[index];

    if (result.status === 'fulfilled') {
      // If the fulfilled value is an error object, return default
      if ((result.value as { error?: boolean })?.error) {
        return defaultValue;
      }
      return result.value;
    }

    // For rejected promises, return default value
    return defaultValue;
  });
}
