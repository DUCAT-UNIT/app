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
(global as any).fetch = jest.fn();

describe('transactionBroadcastService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getBroadcastUrl as jest.Mock).mockReturnValue('https://mempool.space/api/tx');
  });

  describe('broadcastTransaction', () => {
    // Real minimal valid Bitcoin transaction (empty tx, but valid for parsing)
    const mockSignedTxHex = '02000000000000000000';
    // Real txid calculated from above transaction
    const mockTxid = '4ebd325a4b394cff8c57e8317ccf5a8d0e2bdf1b8526f8aad6c8e43d8240621a';

    it('should successfully broadcast a transaction', async () => {
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(mockTxid),
      };

      (retrySilently as jest.Mock).mockImplementation(async (fn: any) => fn());
      ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await broadcastTransaction(mockSignedTxHex);

      expect(result).toBe(mockTxid);
      expect(retrySilently).toHaveBeenCalledWith(
        expect.any(Function),
        'Broadcast transaction',
        { maxRetries: 2 }
      );
      expect((global as any).fetch).toHaveBeenCalledWith('https://mempool.space/api/tx', {
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

      (retrySilently as jest.Mock).mockImplementation(async (fn: any) => fn());
      ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

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

      (retrySilently as jest.Mock).mockImplementation(async (fn: any) => fn());
      ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow(errorText);
      expect(mockResponse.text).toHaveBeenCalled();
    });

    it('should throw generic error when response not ok and no error text', async () => {
      const mockResponse = {
        ok: false,
        text: jest.fn().mockResolvedValue(''),
      };

      (retrySilently as jest.Mock).mockImplementation(async (fn: any) => fn());
      ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow(
        'Failed to broadcast transaction'
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network request failed');
      (retrySilently as jest.Mock).mockRejectedValue(networkError);

      await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow('Network request failed');
    });

    it('should call getBroadcastUrl to get endpoint', async () => {
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(mockTxid),
      };

      (retrySilently as jest.Mock).mockImplementation(async (fn: any) => fn());
      ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

      await broadcastTransaction(mockSignedTxHex);

      expect(getBroadcastUrl).toHaveBeenCalled();
    });

    it('should handle different broadcast URLs', async () => {
      (getBroadcastUrl as jest.Mock).mockReturnValue('https://custom.mempool.space/api/tx');
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(mockTxid),
      };

      (retrySilently as jest.Mock).mockImplementation(async (fn: any) => fn());
      ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

      await broadcastTransaction(mockSignedTxHex);

      expect((global as any).fetch).toHaveBeenCalledWith('https://custom.mempool.space/api/tx', {
        method: 'POST',
        body: mockSignedTxHex,
      });
    });

    it('should properly pass signed transaction hex in POST body', async () => {
      // Use valid tx hex
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(mockTxid),
      };

      (retrySilently as jest.Mock).mockImplementation(async (fn: any) => fn());
      ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

      await broadcastTransaction(mockSignedTxHex);

      expect((global as any).fetch).toHaveBeenCalledWith(expect.any(String), {
        method: 'POST',
        body: mockSignedTxHex,
      });
    });

    it('should return calculated txid (not API response)', async () => {
      // Even if API returns correct txid, we return our calculated one
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(mockTxid),
      };

      (retrySilently as jest.Mock).mockImplementation(async (fn: any) => fn());
      ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await broadcastTransaction(mockSignedTxHex);

      // Should return our calculated txid for security
      expect(result).toBe(mockTxid);
    });

    it('should handle response.text() errors', async () => {
      const mockResponse = {
        ok: true,
        text: jest.fn().mockRejectedValue(new Error('Failed to read response')),
      };

      (retrySilently as jest.Mock).mockImplementation(async (fn: any) => fn());
      ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow('Failed to read response');
    });

    it('should propagate errors from retrySilently', async () => {
      const retryError = new Error('Max retries exceeded');
      (retrySilently as jest.Mock).mockRejectedValue(retryError);

      await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow('Max retries exceeded');
    });

    describe('integration with retry logic', () => {
      it('should use retrySilently wrapper for network resilience', async () => {
        const mockResponse = {
          ok: true,
          text: jest.fn().mockResolvedValue(mockTxid),
        };

        (retrySilently as jest.Mock).mockImplementation(async (fn: any) => fn());
        ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

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

        (retrySilently as jest.Mock).mockImplementation(async (fn: any) => fn());
        ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

        await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow(apiError);
      });

      it('should handle empty error responses', async () => {
        const mockResponse = {
          ok: false,
          text: jest.fn().mockResolvedValue(null),
        };

        (retrySilently as jest.Mock).mockImplementation(async (fn: any) => fn());
        ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

        await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow(
          'Failed to broadcast transaction'
        );
      });

      it('should reject invalid transaction hex before broadcasting', async () => {
        const invalidTxHex = 'invalid_hex_data';

        await expect(broadcastTransaction(invalidTxHex)).rejects.toThrow('Invalid transaction hex');
      });
    });

    describe('SECURITY: txid verification', () => {
      it('should verify returned txid matches expected txid', async () => {
        const mockResponse = {
          ok: true,
          text: jest.fn().mockResolvedValue(mockTxid),
        };

        (retrySilently as jest.Mock).mockImplementation(async (fn: any) => fn());
        ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

        const result = await broadcastTransaction(mockSignedTxHex);

        // Should return the calculated txid, not the API's
        expect(result).toBe(mockTxid);
      });

      it('should detect txid mismatch (MITM attack)', async () => {
        const fakeTxid = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        const mockResponse = {
          ok: true,
          text: jest.fn().mockResolvedValue(fakeTxid),
        };

        (retrySilently as jest.Mock).mockImplementation(async (fn: any) => fn());
        ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

        await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow('SECURITY: Txid mismatch');
        await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow('MITM attack');
      });

      it('should handle txid with whitespace', async () => {
        const txidWithWhitespace = `  ${mockTxid}  \n`;
        const mockResponse = {
          ok: true,
          text: jest.fn().mockResolvedValue(txidWithWhitespace),
        };

        (retrySilently as jest.Mock).mockImplementation(async (fn: any) => fn());
        ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

        const result = await broadcastTransaction(mockSignedTxHex);

        // Should still work after trimming
        expect(result).toBe(mockTxid);
      });
    });
  });
});
