// @ts-nocheck
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

import { fetchCurrentPrice } from '../oracleService';

describe('oracleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchCurrentPrice', () => {
    it('should fetch current price successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ price: 100000 }),
      });

      const result = await fetchCurrentPrice();

      expect(mockFetch).toHaveBeenCalledWith('https://test.price.server/price');
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
        expect(e.message).toContain('Failed to fetch current Bitcoin price');
      }
    });

    it('should throw error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      try {
        await fetchCurrentPrice();
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect(e.message).toContain('Failed to fetch current Bitcoin price');
      }
    });
  });
});
