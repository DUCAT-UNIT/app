/**
 * Tests for API Client
 */

import {
  postWithRetry,
  getWithRetry,
  postJSON,
  getJSON,
  fetchPaginated,
  fetchParallel,
} from '../apiClient';
import * as retry from '../retry';
import * as api from '../api';

// Mock dependencies
jest.mock('../retry');
jest.mock('../api');
jest.mock('../logger', () => ({
  logger: {
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('postWithRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    retry.retrySilently.mockImplementation((fn) => fn());
  });

  it('should make POST request with default options', async () => {
    const mockResponse = { ok: true };
    api.fetchWithTimeout.mockResolvedValue(mockResponse);

    const result = await postWithRetry('https://api.test', { data: 'test' });

    expect(api.fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' }),
      },
      10000
    );
    expect(result).toBe(mockResponse);
  });

  it('should merge custom headers', async () => {
    api.fetchWithTimeout.mockResolvedValue({});

    await postWithRetry('https://api.test', {}, {
      headers: { 'X-Custom': 'value' },
    });

    expect(api.fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          'X-Custom': 'value',
        },
      }),
      expect.any(Number)
    );
  });

  it('should use custom timeout', async () => {
    api.fetchWithTimeout.mockResolvedValue({});

    await postWithRetry('https://api.test', {}, { timeout: 5000 });

    expect(api.fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      5000
    );
  });

  it('should pass retry options to retrySilently', async () => {
    api.fetchWithTimeout.mockResolvedValue({});

    await postWithRetry('https://api.test', {}, {
      retryOptions: { maxRetries: 5 },
    });

    expect(retry.retrySilently).toHaveBeenCalledWith(
      expect.any(Function),
      'POST request',
      { maxRetries: 5 }
    );
  });

  it('should use custom description', async () => {
    api.fetchWithTimeout.mockResolvedValue({});

    await postWithRetry('https://api.test', {}, {
      description: 'Custom operation',
    });

    expect(retry.retrySilently).toHaveBeenCalledWith(
      expect.any(Function),
      'Custom operation',
      {}
    );
  });
});

describe('getWithRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    retry.retrySilently.mockImplementation((fn) => fn());
  });

  it('should make GET request with default options', async () => {
    const mockResponse = { ok: true };
    api.fetchWithTimeout.mockResolvedValue(mockResponse);

    const result = await getWithRetry('https://api.test');

    expect(api.fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test',
      {
        method: 'GET',
        headers: {},
      },
      10000
    );
    expect(result).toBe(mockResponse);
  });

  it('should include custom headers', async () => {
    api.fetchWithTimeout.mockResolvedValue({});

    await getWithRetry('https://api.test', {
      headers: { Authorization: 'Bearer token' },
    });

    expect(api.fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: 'Bearer token' },
      }),
      expect.any(Number)
    );
  });

  it('should use custom timeout', async () => {
    api.fetchWithTimeout.mockResolvedValue({});

    await getWithRetry('https://api.test', { timeout: 3000 });

    expect(api.fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      3000
    );
  });
});

describe('postJSON', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    retry.retrySilently.mockImplementation((fn) => fn());
  });

  it('should POST and parse JSON response', async () => {
    const mockData = { result: 'success' };
    const mockResponse = {
      json: jest.fn().mockResolvedValue(mockData),
    };
    api.fetchWithTimeout.mockResolvedValue(mockResponse);

    const result = await postJSON('https://api.test', { data: 'test' });

    expect(result).toEqual(mockData);
    expect(mockResponse.json).toHaveBeenCalled();
  });

  it('should pass options to postWithRetry', async () => {
    api.fetchWithTimeout.mockResolvedValue({
      json: jest.fn().mockResolvedValue({}),
    });

    await postJSON('https://api.test', {}, { timeout: 5000 });

    expect(api.fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      5000
    );
  });
});

describe('getJSON', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    retry.retrySilently.mockImplementation((fn) => fn());
  });

  it('should GET and parse JSON response', async () => {
    const mockData = { items: [1, 2, 3] };
    const mockResponse = {
      json: jest.fn().mockResolvedValue(mockData),
    };
    api.fetchWithTimeout.mockResolvedValue(mockResponse);

    const result = await getJSON('https://api.test');

    expect(result).toEqual(mockData);
    expect(mockResponse.json).toHaveBeenCalled();
  });

  it('should pass options to getWithRetry', async () => {
    api.fetchWithTimeout.mockResolvedValue({
      json: jest.fn().mockResolvedValue({}),
    });

    await getJSON('https://api.test', { timeout: 8000 });

    expect(api.fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      8000
    );
  });
});

describe('fetchPaginated', () => {
  it('should fetch single page when no more data', async () => {
    const mockFetchPage = jest.fn().mockResolvedValue([1, 2, 3]);

    const result = await fetchPaginated(mockFetchPage);

    expect(mockFetchPage).toHaveBeenCalledWith(0, 250);
    expect(result).toEqual([1, 2, 3]);
  });

  it('should fetch multiple pages until less than limit', async () => {
    const mockFetchPage = jest
      .fn()
      .mockResolvedValueOnce([1, 2, 3])
      .mockResolvedValueOnce([4, 5]); // Less than limit, so stops

    const result = await fetchPaginated(mockFetchPage, { limit: 3 });

    expect(mockFetchPage).toHaveBeenCalledTimes(2);
    expect(mockFetchPage).toHaveBeenNthCalledWith(1, 0, 3);
    expect(mockFetchPage).toHaveBeenNthCalledWith(2, 3, 3);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('should stop when page has less items than limit', async () => {
    const mockFetchPage = jest
      .fn()
      .mockResolvedValueOnce([1, 2, 3])
      .mockResolvedValueOnce([4, 5]); // Less than limit

    const result = await fetchPaginated(mockFetchPage, { limit: 3 });

    expect(mockFetchPage).toHaveBeenCalledTimes(2);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('should respect maxPages limit', async () => {
    const mockFetchPage = jest.fn().mockResolvedValue([1, 2, 3]);

    const result = await fetchPaginated(mockFetchPage, {
      limit: 3,
      maxPages: 2,
    });

    expect(mockFetchPage).toHaveBeenCalledTimes(2);
    expect(result).toEqual([1, 2, 3, 1, 2, 3]);
  });

  it('should call onProgress callback', async () => {
    const mockFetchPage = jest
      .fn()
      .mockResolvedValueOnce([1, 2])
      .mockResolvedValueOnce([3, 4])
      .mockResolvedValueOnce([]);

    const onProgress = jest.fn();

    await fetchPaginated(mockFetchPage, { limit: 2, onProgress });

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 4);
  });

  it('should handle null results', async () => {
    const mockFetchPage = jest
      .fn()
      .mockResolvedValueOnce([1, 2])
      .mockResolvedValueOnce(null);

    const result = await fetchPaginated(mockFetchPage, { limit: 2 });

    expect(result).toEqual([1, 2]);
  });

  it('should stop pagination on error', async () => {
    const mockFetchPage = jest
      .fn()
      .mockResolvedValueOnce([1, 2, 3])
      .mockRejectedValueOnce(new Error('API error'));

    const result = await fetchPaginated(mockFetchPage, { limit: 3 });

    expect(mockFetchPage).toHaveBeenCalledTimes(2);
    expect(result).toEqual([1, 2, 3]);
  });
});

describe('fetchParallel', () => {
  it('should fetch all operations in parallel', async () => {
    const operations = [
      { fn: jest.fn().mockResolvedValue('result1'), defaultValue: null, name: 'op1' },
      { fn: jest.fn().mockResolvedValue('result2'), defaultValue: null, name: 'op2' },
    ];

    const results = await fetchParallel(operations);

    expect(results).toEqual(['result1', 'result2']);
    expect(operations[0].fn).toHaveBeenCalled();
    expect(operations[1].fn).toHaveBeenCalled();
  });

  it('should return default value for failed operations', async () => {
    const operations = [
      { fn: jest.fn().mockResolvedValue('success'), defaultValue: 'default1', name: 'op1' },
      { fn: jest.fn().mockRejectedValue(new Error('fail')), defaultValue: 'default2', name: 'op2' },
    ];

    const results = await fetchParallel(operations);

    expect(results).toEqual(['success', 'default2']);
  });

  it('should handle operations that return error objects', async () => {
    const operations = [
      { fn: jest.fn().mockResolvedValue({ error: true, name: 'op1' }), defaultValue: 'default', name: 'op1' },
    ];

    const results = await fetchParallel(operations);

    expect(results).toEqual(['default']);
  });

  it('should handle mixed success and failure', async () => {
    const operations = [
      { fn: jest.fn().mockResolvedValue('data1'), defaultValue: 'def1', name: 'op1' },
      { fn: jest.fn().mockRejectedValue(new Error()), defaultValue: 'def2', name: 'op2' },
      { fn: jest.fn().mockResolvedValue('data3'), defaultValue: 'def3', name: 'op3' },
    ];

    const results = await fetchParallel(operations);

    expect(results).toEqual(['data1', 'def2', 'data3']);
  });

  it('should handle empty operations array', async () => {
    const results = await fetchParallel([]);

    expect(results).toEqual([]);
  });

  it('should preserve order of results', async () => {
    const operations = [
      { fn: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('slow'), 100))), defaultValue: 'def1', name: 'slow' },
      { fn: jest.fn().mockResolvedValue('fast'), defaultValue: 'def2', name: 'fast' },
    ];

    const results = await fetchParallel(operations);

    expect(results[0]).toBe('slow');
    expect(results[1]).toBe('fast');
  });
});
