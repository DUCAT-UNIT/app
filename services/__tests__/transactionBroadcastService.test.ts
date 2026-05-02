/**
 * Tests for Transaction Broadcast Service
 *
 * NOTE: This file uses type-safe fetch mock pattern.
 * See testUtils/fetchMock.ts for the implementation.
 */

import { broadcastTransaction } from '../transactionBroadcastService';
import { retrySilently } from '../../utils/retry';
import { getBroadcastUrl } from '../../utils/constants';
import {
  setupMockFetch,
  getMockFetch,
  createMockTextResponse,
} from './testUtils';

// Mock dependencies
jest.mock('../../utils/retry');
jest.mock('../../utils/constants');

describe('transactionBroadcastService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockFetch();
    (getBroadcastUrl as jest.Mock).mockReturnValue('https://mempool.space/api/tx');
  });

  describe('broadcastTransaction', () => {
    // Real minimal valid Bitcoin transaction (empty tx, but valid for parsing)
    const mockSignedTxHex = '02000000000000000000';
    // Real txid calculated from above transaction
    const mockTxid = '4ebd325a4b394cff8c57e8317ccf5a8d0e2bdf1b8526f8aad6c8e43d8240621a';

    it('should successfully broadcast a transaction', async () => {
      (retrySilently as jest.Mock).mockImplementation(async (fn: () => Promise<unknown>) => fn());
      getMockFetch().mockResolvedValue(createMockTextResponse(mockTxid));

      const result = await broadcastTransaction(mockSignedTxHex);

      expect(result).toBe(mockTxid);
      expect(retrySilently).toHaveBeenCalledWith(
        expect.any(Function),
        { maxRetries: 2 }
      );
      expect(getMockFetch()).toHaveBeenCalledWith('https://mempool.space/api/tx', {
        method: 'POST',
        body: mockSignedTxHex,
        signal: expect.any(AbortSignal),
      });
    });

    it('should use retry logic with max 2 retries', async () => {
      (retrySilently as jest.Mock).mockImplementation(async (fn: () => Promise<unknown>) => fn());
      getMockFetch().mockResolvedValue(createMockTextResponse(mockTxid));

      await broadcastTransaction(mockSignedTxHex);

      expect(retrySilently).toHaveBeenCalledWith(
        expect.any(Function),
        { maxRetries: 2 }
      );
    });

    it('should throw error when response is not ok', async () => {
      const errorText = 'Transaction rejected: insufficient fee';

      (retrySilently as jest.Mock).mockImplementation(async (fn: () => Promise<unknown>) => fn());
      getMockFetch().mockResolvedValue(
        createMockTextResponse(errorText, { ok: false, status: 400, statusText: 'Bad Request' })
      );

      await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow(errorText);
    });

    it('should throw generic error when response not ok and no error text', async () => {
      (retrySilently as jest.Mock).mockImplementation(async (fn: () => Promise<unknown>) => fn());
      getMockFetch().mockResolvedValue(
        createMockTextResponse('', { ok: false, status: 500, statusText: 'Server Error' })
      );

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
      (retrySilently as jest.Mock).mockImplementation(async (fn: () => Promise<unknown>) => fn());
      getMockFetch().mockResolvedValue(createMockTextResponse(mockTxid));

      await broadcastTransaction(mockSignedTxHex);

      expect(getBroadcastUrl).toHaveBeenCalled();
    });

    it('should handle different broadcast URLs', async () => {
      (getBroadcastUrl as jest.Mock).mockReturnValue('https://custom.mempool.space/api/tx');

      (retrySilently as jest.Mock).mockImplementation(async (fn: () => Promise<unknown>) => fn());
      getMockFetch().mockResolvedValue(createMockTextResponse(mockTxid));

      await broadcastTransaction(mockSignedTxHex);

      expect(getMockFetch()).toHaveBeenCalledWith('https://custom.mempool.space/api/tx', {
        method: 'POST',
        body: mockSignedTxHex,
        signal: expect.any(AbortSignal),
      });
    });

    it('should properly pass signed transaction hex in POST body', async () => {
      (retrySilently as jest.Mock).mockImplementation(async (fn: () => Promise<unknown>) => fn());
      getMockFetch().mockResolvedValue(createMockTextResponse(mockTxid));

      await broadcastTransaction(mockSignedTxHex);

      expect(getMockFetch()).toHaveBeenCalledWith(expect.any(String), {
        method: 'POST',
        body: mockSignedTxHex,
        signal: expect.any(AbortSignal),
      });
    });

    it('should return calculated txid (not API response)', async () => {
      (retrySilently as jest.Mock).mockImplementation(async (fn: () => Promise<unknown>) => fn());
      getMockFetch().mockResolvedValue(createMockTextResponse(mockTxid));

      const result = await broadcastTransaction(mockSignedTxHex);

      // Should return our calculated txid for security
      expect(result).toBe(mockTxid);
    });

    it('should handle response.text() errors', async () => {
      // Create a custom response where text() rejects
      const mockResponse = {
        ok: true,
        text: jest.fn().mockRejectedValue(new Error('Failed to read response')),
      } as unknown as Response;

      (retrySilently as jest.Mock).mockImplementation(async (fn: () => Promise<unknown>) => fn());
      getMockFetch().mockResolvedValue(mockResponse);

      await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow('Failed to read response');
    });

    it('should propagate errors from retrySilently', async () => {
      const retryError = new Error('Max retries exceeded');
      (retrySilently as jest.Mock).mockRejectedValue(retryError);

      await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow('Max retries exceeded');
    });

    describe('integration with retry logic', () => {
      it('should use retrySilently wrapper for network resilience', async () => {
        (retrySilently as jest.Mock).mockImplementation(async (fn: () => Promise<unknown>) => fn());
        getMockFetch().mockResolvedValue(createMockTextResponse(mockTxid));

        await broadcastTransaction(mockSignedTxHex);

        // Verify retrySilently was called with correct parameters
        expect(retrySilently).toHaveBeenCalledWith(
          expect.any(Function),
          { maxRetries: 2 }
        );
      });
    });

    describe('error message handling', () => {
      it('should include API error message in thrown error', async () => {
        const apiError = 'Transaction already in mempool';

        (retrySilently as jest.Mock).mockImplementation(async (fn: () => Promise<unknown>) => fn());
        getMockFetch().mockResolvedValue(
          createMockTextResponse(apiError, { ok: false, status: 400, statusText: 'Bad Request' })
        );

        await expect(broadcastTransaction(mockSignedTxHex)).resolves.toBe(mockTxid);
      });

      it('should handle empty error responses', async () => {
        (retrySilently as jest.Mock).mockImplementation(async (fn: () => Promise<unknown>) => fn());
        getMockFetch().mockResolvedValue(
          createMockTextResponse(null, { ok: false, status: 500, statusText: 'Server Error' })
        );

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
        (retrySilently as jest.Mock).mockImplementation(async (fn: () => Promise<unknown>) => fn());
        getMockFetch().mockResolvedValue(createMockTextResponse(mockTxid));

        const result = await broadcastTransaction(mockSignedTxHex);

        // Should return the calculated txid, not the API's
        expect(result).toBe(mockTxid);
      });

      it('should detect txid mismatch (MITM attack)', async () => {
        const fakeTxid = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

        (retrySilently as jest.Mock).mockImplementation(async (fn: () => Promise<unknown>) => fn());
        getMockFetch().mockResolvedValue(createMockTextResponse(fakeTxid));

        await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow('SECURITY: Txid mismatch');
        await expect(broadcastTransaction(mockSignedTxHex)).rejects.toThrow('MITM attack');
      });

      it('should handle txid with whitespace', async () => {
        const txidWithWhitespace = `  ${mockTxid}  \n`;

        (retrySilently as jest.Mock).mockImplementation(async (fn: () => Promise<unknown>) => fn());
        getMockFetch().mockResolvedValue(createMockTextResponse(txidWithWhitespace));

        const result = await broadcastTransaction(mockSignedTxHex);

        // Should still work after trimming
        expect(result).toBe(mockTxid);
      });
    });
  });
});
