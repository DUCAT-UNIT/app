/**
 * Tests for Transaction Broadcast Service
 */

import { broadcastTransaction } from '../transactionBroadcastService';
import { retrySilently } from '../../utils/retry';
import { getBroadcastUrl } from '../../utils/constants';

// Mock dependencies
jest.mock('../../utils/retry');
jest.mock('../../utils/constants');

// Mock global fetch
global.fetch = jest.fn();

describe('transactionBroadcastService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getBroadcastUrl.mockReturnValue('https://mempool.space/api/tx');
  });

  describe('broadcastTransaction', () => {
    const mockSignedTxHex = '0200000001abcdef...'; // Mock transaction hex
    const mockTxid = '1a2b3c4d5e6f...'; // Mock transaction ID

    it('should successfully broadcast a transaction', async () => {
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(mockTxid),
      };

      retrySilently.mockImplementation(async (fn) => fn());
      global.fetch.mockResolvedValue(mockResponse);

      const result = await broadcastTransaction(mockSignedTxHex);

      expect(result).toBe(mockTxid);
      expect(retrySilently).toHaveBeenCalledWith(
        expect.any(Function),
        'Broadcast transaction',
        { maxRetries: 2 }
      );
      expect(global.fetch).toHaveBeenCalledWith('https://mempool.space/api/tx', {
        method: 'POST',
        body: mockSignedTxHex,
      });
      expect(mockResponse.text).toHaveBeenCalled();
    });

    it('should use retry logic with max 2 retries', async () => {
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(mockTxid),
      };

      retrySilently.mockImplementation(async (fn) => fn());
      global.fetch.mockResolvedValue(mockResponse);

      await broadcastTransaction(mockSignedTxHex);

      expect(retrySilently).toHaveBeenCalledWith(
        expect.any(Function),
        'Broadcast transaction',
        { maxRetries: 2 }
      );
    });

    it('should throw error when response is not ok', async () => {
      const errorText = 'Transaction rejected: insufficient fee';
      const mockResponse = {
        ok: false,
        text: jest.fn().mockResolvedValue(errorText),
      };

      retrySilently.mockImplementation(async (fn) => fn());
      global.fetch.mockResolvedValue(mockResponse);

      await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow(errorText);
      expect(mockResponse.text).toHaveBeenCalled();
    });

    it('should throw generic error when response not ok and no error text', async () => {
      const mockResponse = {
        ok: false,
        text: jest.fn().mockResolvedValue(''),
      };

      retrySilently.mockImplementation(async (fn) => fn());
      global.fetch.mockResolvedValue(mockResponse);

      await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow(
        'Failed to broadcast transaction'
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network request failed');
      retrySilently.mockRejectedValue(networkError);

      await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow('Network request failed');
    });

    it('should call getBroadcastUrl to get endpoint', async () => {
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(mockTxid),
      };

      retrySilently.mockImplementation(async (fn) => fn());
      global.fetch.mockResolvedValue(mockResponse);

      await broadcastTransaction(mockSignedTxHex);

      expect(getBroadcastUrl).toHaveBeenCalled();
    });

    it('should handle different broadcast URLs', async () => {
      getBroadcastUrl.mockReturnValue('https://custom.mempool.space/api/tx');
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(mockTxid),
      };

      retrySilently.mockImplementation(async (fn) => fn());
      global.fetch.mockResolvedValue(mockResponse);

      await broadcastTransaction(mockSignedTxHex);

      expect(global.fetch).toHaveBeenCalledWith('https://custom.mempool.space/api/tx', {
        method: 'POST',
        body: mockSignedTxHex,
      });
    });

    it('should properly pass signed transaction hex in POST body', async () => {
      const customTxHex = '02000000012345...custom';
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(mockTxid),
      };

      retrySilently.mockImplementation(async (fn) => fn());
      global.fetch.mockResolvedValue(mockResponse);

      await broadcastTransaction(customTxHex);

      expect(global.fetch).toHaveBeenCalledWith(expect.any(String), {
        method: 'POST',
        body: customTxHex,
      });
    });

    it('should return exact txid from response', async () => {
      const customTxid = 'abc123def456...custom';
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(customTxid),
      };

      retrySilently.mockImplementation(async (fn) => fn());
      global.fetch.mockResolvedValue(mockResponse);

      const result = await broadcastTransaction(mockSignedTxHex);

      expect(result).toBe(customTxid);
    });

    it('should handle response.text() errors', async () => {
      const mockResponse = {
        ok: true,
        text: jest.fn().mockRejectedValue(new Error('Failed to read response')),
      };

      retrySilently.mockImplementation(async (fn) => fn());
      global.fetch.mockResolvedValue(mockResponse);

      await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow('Failed to read response');
    });

    it('should propagate errors from retrySilently', async () => {
      const retryError = new Error('Max retries exceeded');
      retrySilently.mockRejectedValue(retryError);

      await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow('Max retries exceeded');
    });

    describe('integration with retry logic', () => {
      it('should use retrySilently wrapper for network resilience', async () => {
        const mockResponse = {
          ok: true,
          text: jest.fn().mockResolvedValue(mockTxid),
        };

        retrySilently.mockImplementation(async (fn) => fn());
        global.fetch.mockResolvedValue(mockResponse);

        await broadcastTransaction(mockSignedTxHex);

        // Verify retrySilently was called with correct parameters
        expect(retrySilently).toHaveBeenCalledWith(
          expect.any(Function),
          'Broadcast transaction',
          { maxRetries: 2 }
        );
      });
    });

    describe('error message handling', () => {
      it('should include API error message in thrown error', async () => {
        const apiError = 'Transaction already in mempool';
        const mockResponse = {
          ok: false,
          text: jest.fn().mockResolvedValue(apiError),
        };

        retrySilently.mockImplementation(async (fn) => fn());
        global.fetch.mockResolvedValue(mockResponse);

        await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow(apiError);
      });

      it('should handle empty error responses', async () => {
        const mockResponse = {
          ok: false,
          text: jest.fn().mockResolvedValue(null),
        };

        retrySilently.mockImplementation(async (fn) => fn());
        global.fetch.mockResolvedValue(mockResponse);

        await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow(
          'Failed to broadcast transaction'
        );
      });
    });
  });
});
