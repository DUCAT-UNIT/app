/**
 * Tests for Retry utility
 */

import { retryWithBackoff, retrySilently, RetryOptions } from '../retry';

// Mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('retry utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('retryWithBackoff', () => {
    it('should return result on first successful attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network request failed'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        retryWithBackoff(mockFn, { maxRetries: 2 })
      ).rejects.toThrow('ECONNREFUSED');

      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should NOT retry on non-network errors by default', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Invalid input'));

      await expect(retryWithBackoff(mockFn)).rejects.toThrow('Invalid input');

      expect(mockFn).toHaveBeenCalledTimes(1); // No retries
    });

    it('should use custom shouldRetry function', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Custom error'))
        .mockResolvedValueOnce('success');

      const customShouldRetry = (error: unknown) => (error as Error).message === 'Custom error';

      const result = await retryWithBackoff(mockFn, {
        shouldRetry: customShouldRetry,
      });

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();

      await retryWithBackoff(mockFn, {
        initialDelay: 100,
        maxDelay: 10000,
      });

      const elapsed = Date.now() - startTime;

      // Should have delays: 100ms + 200ms = 300ms (plus jitter)
      expect(elapsed).toBeGreaterThanOrEqual(250);
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should respect maxDelay', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce('success');

      await retryWithBackoff(mockFn, {
        initialDelay: 1000,
        maxDelay: 2000,
      });

      // Should cap at maxDelay
      expect(mockFn).toHaveBeenCalledTimes(4);
    }, 10000); // 10 second timeout

    it('should apply jitter to delays', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce('success');

      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((fn: () => void, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(fn, delay);
      }) as unknown as typeof setTimeout;

      await retryWithBackoff(mockFn, {
        initialDelay: 1000,
      });

      global.setTimeout = originalSetTimeout;

      // Jitter should add variability (+/- 30%)
      expect(delays[0]).toBeGreaterThan(700);
      expect(delays[0]).toBeLessThan(1300);
    });

    it('should detect ENOTFOUND errors', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ENOTFOUND'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should detect timeout errors', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Request timed out'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should handle string errors', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce('Network error')
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('retrySilently', () => {
    it('should retry silently and return result', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('network request failed'))
        .mockResolvedValueOnce('success');

      const result = await retrySilently(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should work with no options', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await retrySilently(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should pass custom retry options', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce('success');

      await retrySilently(mockFn, {
        maxRetries: 2,
      });

      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should respect custom shouldRetry function', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Custom retryable error'))
        .mockResolvedValueOnce('success');

      const customShouldRetry = (error: unknown) =>
        (error as Error).message.includes('retryable');

      await retrySilently(mockFn, {
        shouldRetry: customShouldRetry,
      });

      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry non-network errors', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Invalid data'));

      await expect(
        retrySilently(mockFn)
      ).rejects.toThrow('Invalid data');

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('timeout'));

      await expect(
        retrySilently(mockFn, { maxRetries: 1 })
      ).rejects.toThrow('timeout');

      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('network error detection', () => {
    const networkErrors = [
      'Network request failed',
      'fetch failed',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'Timeout occurred',
      'Connection refused',
      'Connection reset',
      'Socket hang up',
      'Network error',
    ];

    networkErrors.forEach((errorMsg) => {
      it(`should detect "${errorMsg}" as network error`, async () => {
        const mockFn = jest
          .fn()
          .mockRejectedValueOnce(new Error(errorMsg))
          .mockResolvedValueOnce('success');

        const result = await retryWithBackoff(mockFn);

        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(2);
      });
    });

    const nonNetworkErrors = [
      'Invalid input',
      'Permission denied',
      'Not found',
      'Validation error',
    ];

    nonNetworkErrors.forEach((errorMsg) => {
      it(`should NOT retry "${errorMsg}"`, async () => {
        const mockFn = jest.fn().mockRejectedValue(new Error(errorMsg));

        await expect(retryWithBackoff(mockFn)).rejects.toThrow(errorMsg);

        expect(mockFn).toHaveBeenCalledTimes(1);
      });
    });
  });
});
