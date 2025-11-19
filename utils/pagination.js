/**
 * Pagination Utility
 * Generic pagination logic for API requests
 *
 * Note: This utility is also available in utils/apiClient.js as fetchPaginated()
 * This standalone version is provided for use cases that don't need the full API client
 */

import { logger } from './logger';

/**
 * Fetches paginated data from an API endpoint
 * @param {Function} fetchPage - Function that fetches a single page (offset, limit) => Promise<Array>
 * @param {Object} options - Pagination options
 * @param {number} options.limit - Items per page (default: 250)
 * @param {number} options.maxPages - Maximum pages to fetch (default: 20)
 * @param {Function} options.onProgress - Callback called after each page (pageNum, totalItems)
 * @param {Function} options.shouldContinue - Optional function to determine if pagination should continue
 * @returns {Promise<Array>} All fetched items
 */
export async function fetchPaginated(fetchPage, options = {}) {
  const { limit = 250, maxPages = 20, onProgress, shouldContinue } = options;

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

      // Check custom continuation condition
      if (shouldContinue && !shouldContinue(items, allItems)) {
        hasMore = false;
        break;
      }

      // If we got less than limit, we've reached the end
      if (items.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }

      pageCount++;
    } catch (error) {
      // Don't log AbortErrors - they're expected when navigation cancels requests
      if (error.name !== 'AbortError') {
        logger.error(`Pagination error on page ${pageCount + 1}:`, error);
      }
      // Stop pagination on error
      hasMore = false;
    }
  }

  return allItems;
}

/**
 * Creates a paginated fetch function for a specific API endpoint
 * @param {Function} fetchFn - Base fetch function (body) => Promise<Response>
 * @param {Object} baseBody - Base request body to merge with pagination params
 * @param {string} dataKey - Key in response object containing the items array
 * @returns {Function} Paginated fetch function (offset, limit) => Promise<Array>
 */
export function createPaginatedFetcher(fetchFn, baseBody = {}, dataKey = 'items') {
  return async (offset, limit) => {
    const body = {
      ...baseBody,
      pagination: {
        limit,
        offset,
      },
    };

    const response = await fetchFn(body);
    const data = await response.json();

    return data[dataKey] || [];
  };
}

/**
 * Pagination state manager for manual pagination
 * Useful for paginating user-triggered loads (e.g., "Load More" button)
 */
export class PaginationManager {
  constructor(options = {}) {
    this.limit = options.limit || 25;
    this.offset = 0;
    this.hasMore = true;
    this.loading = false;
    this.totalLoaded = 0;
  }

  /**
   * Fetch the next page
   * @param {Function} fetchFn - Function to fetch data (offset, limit) => Promise<Array>
   * @returns {Promise<Array>} Items from the page
   */
  async fetchNext(fetchFn) {
    if (!this.hasMore || this.loading) {
      return [];
    }

    this.loading = true;

    try {
      const items = await fetchFn(this.offset, this.limit);

      if (!items || items.length === 0) {
        this.hasMore = false;
        return [];
      }

      this.totalLoaded += items.length;

      if (items.length < this.limit) {
        this.hasMore = false;
      } else {
        this.offset += this.limit;
      }

      return items;
    } catch (error) {
      // Don't log AbortErrors - they're expected when navigation cancels requests
      if (error.name !== 'AbortError') {
        logger.error('PaginationManager: Error fetching page:', error);
      }
      this.hasMore = false;
      return [];
    } finally {
      this.loading = false;
    }
  }

  /**
   * Reset pagination state
   */
  reset() {
    this.offset = 0;
    this.hasMore = true;
    this.loading = false;
    this.totalLoaded = 0;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      offset: this.offset,
      limit: this.limit,
      hasMore: this.hasMore,
      loading: this.loading,
      totalLoaded: this.totalLoaded,
    };
  }
}
