/**
 * Tests for urlShortener service
 */

// Mock fetch globally
global.fetch = jest.fn();

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { shortenCashuToken } from '../urlShortener';

describe('urlShortener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
  });

  describe('shortenCashuToken', () => {
    it('should shorten token using Ducat server', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            shortUrl: 'https://short.ducatprotocol.com/abc123',
            shortCode: 'abc123',
          },
        }),
      });

      const result = await shortenCashuToken('cashuAtoken123');

      expect(result).toBe('https://short.ducatprotocol.com/abc123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://short.ducatprotocol.com/api/shorten',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should throw error when server returns error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal server error'),
      });

      await expect(shortenCashuToken('cashuAtoken123')).rejects.toThrow('Ducat shortener error');
    });

    it('should throw error when response is invalid', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: false,
        }),
      });

      await expect(shortenCashuToken('cashuAtoken123')).rejects.toThrow('Invalid response');
    });

    it('should throw error when shortUrl is missing', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {},
        }),
      });

      await expect(shortenCashuToken('cashuAtoken123')).rejects.toThrow('Invalid response');
    });

    it('should throw error on network failure', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      await expect(shortenCashuToken('cashuAtoken123')).rejects.toThrow('Network error');
    });
  });
});
