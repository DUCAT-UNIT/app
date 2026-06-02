/**
 * Tests for Oracle Service - fetchCurrentPrice function
 */

// Mock SDK before any imports
jest.mock('@ducat-unit/client-sdk', () => ({
  OracleAPI: {
    quote: {
      fetch_price_quote: jest.fn(),
    },
  },
}));

// Mock constants
jest.mock('../../utils/constants', () => ({
  API: {
    QUOTE_SERVER: 'https://test.quote.server',
    PRICE_SERVER: 'https://test.price.server',
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { fetchCurrentPrice, fetchPriceQuote } from '../oracleService';
import { resetRequestPolicyForTests } from '../../utils/requestPolicy';

describe('oracleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRequestPolicyForTests();
  });

  describe('fetchCurrentPrice', () => {
    it('should fetch current price successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ price: 100000 }),
      });

      const result = await fetchCurrentPrice();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.price.server/api/price/latest',
        expect.objectContaining({
          method: 'GET',
          signal: expect.any(AbortSignal),
        })
      );
      expect(result).toBe(100000);
    });

    it('should use curr_price fallback', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ curr_price: 95000 }),
      });

      const result = await fetchCurrentPrice();

      expect(result).toBe(95000);
    });

    it('should throw error on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      try {
        await fetchCurrentPrice();
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect((e as Error).message).toContain('Failed to fetch current Bitcoin price');
      }
    });

    it('should throw error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      try {
        await fetchCurrentPrice();
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect((e as Error).message).toContain('Failed to fetch current Bitcoin price');
      }
    });
  });

  describe('fetchPriceQuote', () => {
    it('should fetch price quote successfully', async () => {
      const mockQuote = {
        price: 100000,
        signature: 'mock_signature',
        timestamp: Date.now(),
        latest_stamp: Math.floor(Date.now() / 1000),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockQuote),
      });

      const result = await fetchPriceQuote(50000);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.quote.server/api/quote?th=50000',
        expect.objectContaining({
          method: 'GET',
          signal: expect.any(AbortSignal),
        })
      );
      expect(result).toEqual(mockQuote);
    });

    it('should use minimum threshold of 1 for zero price', async () => {
      const mockQuote = { price: 100000, latest_stamp: Math.floor(Date.now() / 1000) };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockQuote),
      });

      await fetchPriceQuote(0);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.quote.server/api/quote?th=1',
        expect.objectContaining({
          method: 'GET',
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should floor liquidation price', async () => {
      const mockQuote = { price: 100000, latest_stamp: Math.floor(Date.now() / 1000) };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockQuote),
      });

      await fetchPriceQuote(50000.75);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.quote.server/api/quote?th=50000',
        expect.objectContaining({
          method: 'GET',
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should throw error on API error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      });

      try {
        await fetchPriceQuote(50000);
        expect(true).toBe(false);
      } catch (e) {
        expect((e as Error).message).toContain('HTTP 500');
      }
    });

    it('should map temporary quote gaps to a retryable oracle message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(fetchPriceQuote(50000)).rejects.toThrow(
        'Oracle price quote is temporarily unavailable. Please try again in a minute.'
      );
    });

    it('should throw error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      try {
        await fetchPriceQuote(50000);
        expect(true).toBe(false);
      } catch (e) {
        expect((e as Error).message).toContain('Network error');
      }
    });

    it('should turn aborts into a user-friendly quote timeout', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      await expect(fetchPriceQuote(50000)).rejects.toThrow(
        'Timed out fetching oracle price quote. Please try again.'
      );
    });
  });
});
