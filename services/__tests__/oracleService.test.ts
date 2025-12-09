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

import { fetchCurrentPrice, fetchPriceQuote } from '../oracleService';
import { OracleAPI } from '@ducat-unit/client-sdk';

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

  describe('fetchPriceQuote', () => {
    it('should fetch price quote successfully', async () => {
      const mockQuote = {
        price: 100000,
        signature: 'mock_signature',
        timestamp: Date.now(),
      };

      (OracleAPI.quote.fetch_price_quote as jest.Mock).mockResolvedValue({
        ok: true,
        data: mockQuote,
      });

      const result = await fetchPriceQuote(50000);

      expect(OracleAPI.quote.fetch_price_quote).toHaveBeenCalledWith(
        'https://test.quote.server',
        50000
      );
      expect(result).toEqual(mockQuote);
    });

    it('should use minimum threshold of 1 for zero price', async () => {
      const mockQuote = { price: 100000 };

      (OracleAPI.quote.fetch_price_quote as jest.Mock).mockResolvedValue({
        ok: true,
        data: mockQuote,
      });

      await fetchPriceQuote(0);

      expect(OracleAPI.quote.fetch_price_quote).toHaveBeenCalledWith(
        'https://test.quote.server',
        1
      );
    });

    it('should floor liquidation price', async () => {
      const mockQuote = { price: 100000 };

      (OracleAPI.quote.fetch_price_quote as jest.Mock).mockResolvedValue({
        ok: true,
        data: mockQuote,
      });

      await fetchPriceQuote(50000.75);

      expect(OracleAPI.quote.fetch_price_quote).toHaveBeenCalledWith(
        'https://test.quote.server',
        50000
      );
    });

    it('should throw error on API error response', async () => {
      (OracleAPI.quote.fetch_price_quote as jest.Mock).mockResolvedValue({
        ok: false,
        error: 'API Error',
      });

      try {
        await fetchPriceQuote(50000);
        expect(true).toBe(false);
      } catch (e) {
        expect(e.message).toContain('Oracle');
      }
    });

    it('should throw error on network failure', async () => {
      (OracleAPI.quote.fetch_price_quote as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      try {
        await fetchPriceQuote(50000);
        expect(true).toBe(false);
      } catch (e) {
        expect(e.message).toContain('price quote');
      }
    });
  });
});
