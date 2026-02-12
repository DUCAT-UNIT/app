/**
 * Tests for urlShortener service
 *
 * NOTE: This file uses type-safe fetch mock pattern.
 * See testUtils/fetchMock.ts for the implementation.
 */

import {
  setupMockFetch,
  getMockFetch,
  createMockResponse,
} from './testUtils';

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
    setupMockFetch();
  });

  describe('shortenCashuToken', () => {
    it('should shorten token using Ducat server', async () => {
      getMockFetch().mockResolvedValue(
        createMockResponse({
          success: true,
          data: {
            shortUrl: 'https://short.ducatprotocol.com/abc123',
            shortCode: 'abc123',
          },
        })
      );

      const result = await shortenCashuToken('cashuAtoken123');

      expect(result).toBe('https://short.ducatprotocol.com/abc123');
      expect(getMockFetch()).toHaveBeenCalledWith(
        'https://short.ducatprotocol.com/api/shorten',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should throw error when server returns error', async () => {
      getMockFetch().mockResolvedValue(
        createMockResponse(
          { error: 'Internal server error' },
          { ok: false, status: 500, statusText: 'Internal Server Error' }
        )
      );

      await expect(shortenCashuToken('cashuAtoken123')).rejects.toThrow('Ducat shortener error');
    });

    it('should throw error when response is invalid', async () => {
      getMockFetch().mockResolvedValue(
        createMockResponse({
          success: false,
        })
      );

      await expect(shortenCashuToken('cashuAtoken123')).rejects.toThrow('Invalid response');
    });

    it('should throw error when shortUrl is missing', async () => {
      getMockFetch().mockResolvedValue(
        createMockResponse({
          success: true,
          data: {},
        })
      );

      await expect(shortenCashuToken('cashuAtoken123')).rejects.toThrow('Invalid response');
    });

    it('should throw error on network failure', async () => {
      getMockFetch().mockRejectedValue(new Error('Network error'));

      await expect(shortenCashuToken('cashuAtoken123')).rejects.toThrow('Network error');
    });
  });
});
