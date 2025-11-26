// @ts-nocheck
/**
 * Tests for airdropService
 */

import * as AirdropService from '../airdropService';
import { API } from '../../utils/constants';
import * as apiClient from '../../utils/apiClient';

// Mock apiClient instead of fetch
jest.mock('../../utils/apiClient');

describe('airdropService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestAirdrop', () => {
    const testAddress = 'tb1qtest1234567890';

    it('should request airdrop successfully', async () => {
      const mockTxId = 'mock_tx_id_123';
      const mockTimeout = 3600;

      (apiClient.postJSON as jest.Mock).mockResolvedValue({
        data: {
          tx_id: mockTxId,
          timeout: mockTimeout,
        },
      });

      const result = await AirdropService.requestAirdrop(testAddress);

      expect(apiClient.postJSON).toHaveBeenCalledWith(
        API.FAUCET,
        {
          address: testAddress,
          captchaToken: 'XXXX.DUMMY.TOKEN.XXXX',
          network: 'mutinynet',
        },
        { description: 'Request airdrop' }
      );

      expect(result).toEqual({
        txId: mockTxId,
        timeout: mockTimeout,
      });
    });

    it('should throw error when response is not ok', async () => {
      const error = new Error('HTTP 429: Too Many Requests');
      (apiClient.postJSON as jest.Mock).mockRejectedValue(error);

      await expect(AirdropService.requestAirdrop(testAddress)).rejects.toThrow(
        'HTTP 429: Too Many Requests'
      );
    });

    it('should throw error when response data is missing', async () => {
      (apiClient.postJSON as jest.Mock).mockResolvedValue({
        // Missing data field
      });

      await expect(AirdropService.requestAirdrop(testAddress)).rejects.toThrow(
        'Invalid airdrop response'
      );
    });

    it('should throw error when tx_id is missing', async () => {
      (apiClient.postJSON as jest.Mock).mockResolvedValue({
        data: {
          // Missing tx_id
          timeout: 3600,
        },
      });

      await expect(AirdropService.requestAirdrop(testAddress)).rejects.toThrow(
        'Invalid airdrop response'
      );
    });

    it('should handle fetch network error', async () => {
      const networkError = new Error('Network error');
      (apiClient.postJSON as jest.Mock).mockRejectedValue(networkError);

      await expect(AirdropService.requestAirdrop(testAddress)).rejects.toThrow('Network error');
    });

    it('should handle JSON parsing error', async () => {
      const jsonError = new Error('Invalid JSON');
      (apiClient.postJSON as jest.Mock).mockRejectedValue(jsonError);

      await expect(AirdropService.requestAirdrop(testAddress)).rejects.toThrow('Invalid JSON');
    });
  });
});
