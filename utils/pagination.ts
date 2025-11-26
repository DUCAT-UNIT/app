/**
 * Pagination Utility
 * Generic pagination logic for API requests
 *
 * Note: This utility is also available in utils/apiClient.js as fetchPaginated()
 * This standalone version is provided for use cases that don't need the full API client
 */

import { logger } from './logger';

export interface FetchPaginatedOptions<T> {
  limit?: number;
  maxPages?: number;
  onProgress?: (pageNum: number, totalItems: number) => void;
  shouldContinue?: (items: T[], allItems: T[]) => boolean;
}

export type FetchPageFunction<T> = (offset: number, limit: number) => Promise<T[]>;

/**
 * Fetches paginated data from an API endpoint
 * @param fetchPage - Function that fetches a single page (offset, limit) => Promise<Array>
 * @param options - Pagination options
 * @returns All fetched items
 */
export async function fetchPaginated<T = unknown>(
  fetchPage: FetchPageFunction<T>,
  options: FetchPaginatedOptions<T> = {}
): Promise<T[]> {
  const { limit = 250, maxPages = 20, onProgress, shouldContinue } = options;

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
      if ((error as Error).name !== 'AbortError') {
        logger.error(error as Error, { page: pageCount + 1 });
      }
      // Stop pagination on error
      hasMore = false;
    }
  }

  return allItems;
}

export type FetchFunction = (body: Record<string, unknown>) => Promise<Response>;

/**
 * Creates a paginated fetch function for a specific API endpoint
 * @param fetchFn - Base fetch function (body) => Promise<Response>
 * @param baseBody - Base request body to merge with pagination params
 * @param dataKey - Key in response object containing the items array
 * @returns Paginated fetch function (offset, limit) => Promise<Array>
 */
export function createPaginatedFetcher<T = unknown>(
  fetchFn: FetchFunction,
  baseBody: Record<string, unknown> = {},
  dataKey = 'items'
): FetchPageFunction<T> {
  return async (offset: number, limit: number): Promise<T[]> => {
    const body = {
      ...baseBody,
      pagination: {
        limit,
        offset,
      },
    };

    const response = await fetchFn(body);
    const data = await response.json();

    return (data[dataKey] as T[]) || [];
  };
}

export interface PaginationManagerOptions {
  limit?: number;
}

export interface PaginationState {
  offset: number;
  limit: number;
  hasMore: boolean;
  loading: boolean;
  totalLoaded: number;
}

/**
 * Pagination state manager for manual pagination
 * Useful for paginating user-triggered loads (e.g., "Load More" button)
 */
export class PaginationManager<T = unknown> {
  private limit: number;
  private offset: number;
  private hasMore: boolean;
  private loading: boolean;
  private totalLoaded: number;

  constructor(options: PaginationManagerOptions = {}) {
    this.limit = options.limit || 25;
    this.offset = 0;
    this.hasMore = true;
    this.loading = false;
    this.totalLoaded = 0;
  }

  /**
   * Fetch the next page
   * @param fetchFn - Function to fetch data (offset, limit) => Promise<Array>
   * @returns Items from the page
   */
  async fetchNext(fetchFn: FetchPageFunction<T>): Promise<T[]> {
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
      if ((error as Error).name !== 'AbortError') {
        logger.error(error as Error, { context: 'PaginationManager' });
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
  reset(): void {
    this.offset = 0;
    this.hasMore = true;
    this.loading = false;
    this.totalLoaded = 0;
  }

  /**
   * Get current state
   */
  getState(): PaginationState {
    return {
      offset: this.offset,
      limit: this.limit,
      hasMore: this.hasMore,
      loading: this.loading,
      totalLoaded: this.totalLoaded,
    };
  }
}
