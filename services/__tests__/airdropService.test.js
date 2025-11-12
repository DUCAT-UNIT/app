/**
 * Tests for airdropService
 */

import * as AirdropService from '../airdropService';
import { API } from '../../utils/constants';

// Mock fetch
global.fetch = jest.fn();

describe('airdropService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestAirdrop', () => {
    const testAddress = 'tb1qtest1234567890';

    it('should request airdrop successfully', async () => {
      const mockTxId = 'mock_tx_id_123';
      const mockTimeout = 3600;

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            tx_id: mockTxId,
            timeout: mockTimeout,
          },
        }),
      });

      const result = await AirdropService.requestAirdrop(testAddress);

      expect(global.fetch).toHaveBeenCalledWith(API.FAUCET, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: testAddress,
          captchaToken: 'XXXX.DUMMY.TOKEN.XXXX',
          network: 'mutinynet',
        }),
      });

      expect(result).toEqual({
        txId: mockTxId,
        timeout: mockTimeout,
      });
    });

    it('should throw error when response is not ok', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 429,
      });

      await expect(AirdropService.requestAirdrop(testAddress)).rejects.toThrow(
        'Airdrop request failed: 429'
      );
    });

    it('should throw error when response data is missing', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          // Missing data field
        }),
      });

      await expect(AirdropService.requestAirdrop(testAddress)).rejects.toThrow(
        'Invalid airdrop response'
      );
    });

    it('should throw error when tx_id is missing', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            // Missing tx_id
            timeout: 3600,
          },
        }),
      });

      await expect(AirdropService.requestAirdrop(testAddress)).rejects.toThrow(
        'Invalid airdrop response'
      );
    });

    it('should handle fetch network error', async () => {
      const networkError = new Error('Network error');
      global.fetch.mockRejectedValue(networkError);

      await expect(AirdropService.requestAirdrop(testAddress)).rejects.toThrow('Network error');
    });

    it('should handle JSON parsing error', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(AirdropService.requestAirdrop(testAddress)).rejects.toThrow('Invalid JSON');
    });
  });
});
