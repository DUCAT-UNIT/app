/**
 * Tests for Pagination Utility
 */

import { fetchPaginated, createPaginatedFetcher, PaginationManager } from '../pagination';

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('fetchPaginated', () => {
  it('should fetch all pages until empty response', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce([1, 2, 3])
      .mockResolvedValueOnce([4, 5, 6])
      .mockResolvedValueOnce([]);

    const result = await fetchPaginated(mockFetch, { limit: 3 });

    expect(result).toEqual([1, 2, 3, 4, 5, 6]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch).toHaveBeenNthCalledWith(1, 0, 3);
    expect(mockFetch).toHaveBeenNthCalledWith(2, 3, 3);
    expect(mockFetch).toHaveBeenNthCalledWith(3, 6, 3);
  });

  it('should stop when reaching less than limit items', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce([1, 2, 3, 4, 5])
      .mockResolvedValueOnce([6, 7]);

    const result = await fetchPaginated(mockFetch, { limit: 5 });

    expect(result).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should respect maxPages limit', async () => {
    const mockFetch = jest.fn().mockResolvedValue([1, 2, 3]);

    const result = await fetchPaginated(mockFetch, { limit: 3, maxPages: 2 });

    expect(result).toEqual([1, 2, 3, 1, 2, 3]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should call onProgress callback after each page', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce([1, 2, 3])
      .mockResolvedValueOnce([4, 5]);

    const onProgress = jest.fn();

    await fetchPaginated(mockFetch, { limit: 3, onProgress });

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 5);
  });

  it('should use shouldContinue to determine continuation', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce([1, 2, 3])
      .mockResolvedValueOnce([4, 5, 6])
      .mockResolvedValueOnce([7, 8, 9]);

    const shouldContinue = jest
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    const result = await fetchPaginated(mockFetch, {
      limit: 3,
      shouldContinue,
    });

    expect(result).toEqual([1, 2, 3, 4, 5, 6]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(shouldContinue).toHaveBeenCalledTimes(2);
  });

  it('should handle errors and stop pagination', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce([1, 2, 3])
      .mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchPaginated(mockFetch, { limit: 3 });

    expect(result).toEqual([1, 2, 3]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should handle null or undefined responses', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce([1, 2, 3])
      .mockResolvedValueOnce(null);

    const result = await fetchPaginated(mockFetch);

    expect(result).toEqual([1, 2, 3]);
  });

  it('should use default options when not provided', async () => {
    const mockFetch = jest.fn().mockResolvedValue([]);

    await fetchPaginated(mockFetch);

    expect(mockFetch).toHaveBeenCalledWith(0, 250);
  });
});

describe('createPaginatedFetcher', () => {
  it('should create a paginated fetcher function', async () => {
    const mockFetchFn = jest.fn().mockResolvedValue({
      json: async () => ({ items: [1, 2, 3] }),
    });

    const fetcher = createPaginatedFetcher(mockFetchFn, { filter: 'active' });

    const result = await fetcher(0, 10);

    expect(result).toEqual([1, 2, 3]);
    expect(mockFetchFn).toHaveBeenCalledWith({
      filter: 'active',
      pagination: { limit: 10, offset: 0 },
    });
  });

  it('should use custom dataKey', async () => {
    const mockFetchFn = jest.fn().mockResolvedValue({
      json: async () => ({ transactions: [1, 2, 3] }),
    });

    const fetcher = createPaginatedFetcher(mockFetchFn, {}, 'transactions');

    const result = await fetcher(10, 20);

    expect(result).toEqual([1, 2, 3]);
  });

  it('should return empty array if dataKey not found', async () => {
    const mockFetchFn = jest.fn().mockResolvedValue({
      json: async () => ({ otherKey: [1, 2, 3] }),
    });

    const fetcher = createPaginatedFetcher(mockFetchFn);

    const result = await fetcher(0, 10);

    expect(result).toEqual([]);
  });
});

describe('PaginationManager', () => {
  it('should initialize with default options', () => {
    const manager = new PaginationManager();

    const state = manager.getState();

    expect(state).toEqual({
      offset: 0,
      limit: 25,
      hasMore: true,
      loading: false,
      totalLoaded: 0,
    });
  });

  it('should initialize with custom options', () => {
    const manager = new PaginationManager({ limit: 50 });

    expect(manager.getState().limit).toBe(50);
  });

  it('should fetch next page successfully', async () => {
    const manager = new PaginationManager({ limit: 3 });
    const mockFetch = jest.fn().mockResolvedValue([1, 2, 3]);

    const result = await manager.fetchNext(mockFetch);

    expect(result).toEqual([1, 2, 3]);
    expect(mockFetch).toHaveBeenCalledWith(0, 3);
    expect(manager.getState().offset).toBe(3);
    expect(manager.getState().totalLoaded).toBe(3);
    expect(manager.getState().hasMore).toBe(true);
  });

  it('should set hasMore to false when receiving less than limit items', async () => {
    const manager = new PaginationManager({ limit: 5 });
    const mockFetch = jest.fn().mockResolvedValue([1, 2, 3]);

    await manager.fetchNext(mockFetch);

    expect(manager.getState().hasMore).toBe(false);
  });

  it('should set hasMore to false when receiving empty array', async () => {
    const manager = new PaginationManager();
    const mockFetch = jest.fn().mockResolvedValue([]);

    const result = await manager.fetchNext(mockFetch);

    expect(result).toEqual([]);
    expect(manager.getState().hasMore).toBe(false);
  });

  it('should not fetch if already loading', async () => {
    const manager = new PaginationManager();
    const mockFetch = jest.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([1, 2, 3]), 100))
    );

    const promise1 = manager.fetchNext(mockFetch);
    const promise2 = manager.fetchNext(mockFetch);

    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(result1).toEqual([1, 2, 3]);
    expect(result2).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should not fetch if hasMore is false', async () => {
    const manager = new PaginationManager();
    const mockFetch = jest.fn().mockResolvedValue([]);

    await manager.fetchNext(mockFetch);
    await manager.fetchNext(mockFetch);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should handle errors gracefully', async () => {
    const manager = new PaginationManager();
    const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await manager.fetchNext(mockFetch);

    expect(result).toEqual([]);
    expect(manager.getState().hasMore).toBe(false);
    expect(manager.getState().loading).toBe(false);
  });

  it('should reset state correctly', async () => {
    const manager = new PaginationManager({ limit: 5 });
    const mockFetch = jest.fn().mockResolvedValue([1, 2, 3, 4, 5]);

    await manager.fetchNext(mockFetch);

    expect(manager.getState().offset).toBe(5);
    expect(manager.getState().totalLoaded).toBe(5);

    manager.reset();

    const state = manager.getState();
    expect(state.offset).toBe(0);
    expect(state.totalLoaded).toBe(0);
    expect(state.hasMore).toBe(true);
    expect(state.loading).toBe(false);
  });

  it('should handle null responses', async () => {
    const manager = new PaginationManager();
    const mockFetch = jest.fn().mockResolvedValue(null);

    const result = await manager.fetchNext(mockFetch);

    expect(result).toEqual([]);
    expect(manager.getState().hasMore).toBe(false);
  });
});
