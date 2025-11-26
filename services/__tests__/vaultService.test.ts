// @ts-nocheck
/**
 * Tests for Vault Service
 * Tests vault history and vault data fetching
 */

import { fetchVaultHistory, fetchVaultData } from '../vaultService';

// Mock dependencies
jest.mock('../../utils/retry', () => ({
  retrySilently: jest.fn((fn) => fn()),
}));

jest.mock('../../utils/constants', () => ({
  API: {
    VAULT: 'https://api.example.com/vault',
  },
}));

describe('vaultService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn();
  });

  describe('fetchVaultHistory', () => {
    it('should return empty array if no vaultPubkey provided', async () => {
      const result = await fetchVaultHistory(null as unknown as string);
      expect(result).toEqual([]);
      expect((global as any).fetch).not.toHaveBeenCalled();
    });

    it('should fetch vault history successfully', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      const vaultListResponse = {
        vaults: [
          {
            vault_id: 'vault_1',
            vault_tag: 'My Vault',
          },
        ],
      };

      const historyResponse = {
        history: [
          {
            transaction_id: 'tx1',
            timestamp: 1000,
            action: 'deposit',
            amount_borrowed: 100,
            vault_amount: 1000,
            btc_amt: 0.5,
            unit_amt: 500,
            oracle_price: 50000,
          },
        ],
      };

      (global as any).fetch
        .mockResolvedValueOnce({
          json: async () => vaultListResponse,
        })
        .mockResolvedValueOnce({
          json: async () => historyResponse,
        });

      const result = await fetchVaultHistory(vaultPubkey);

      expect(result).toEqual(historyResponse.history);
      expect((global as any).fetch).toHaveBeenCalledTimes(2);
    });

    it('should return empty array if no vaults found', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      (global as any).fetch.mockResolvedValueOnce({
        json: async () => ({ vaults: [] }),
      });

      const result = await fetchVaultHistory(vaultPubkey);

      expect(result).toEqual([]);
    });

    it('should handle pagination correctly', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      const vaultListResponse = {
        vaults: [{ vault_id: 'vault_1' }],
      };

      // First page: 250 items
      const page1 = {
        history: Array.from({ length: 250 }, (_, i) => ({
          transaction_id: `tx${i}`,
          timestamp: 1000 + i,
        })),
      };

      // Second page: 100 items (less than limit, so last page)
      const page2 = {
        history: Array.from({ length: 100 }, (_, i) => ({
          transaction_id: `tx${250 + i}`,
          timestamp: 2000 + i,
        })),
      };

      (global as any).fetch
        .mockResolvedValueOnce({
          json: async () => vaultListResponse,
        })
        .mockResolvedValueOnce({
          json: async () => page1,
        })
        .mockResolvedValueOnce({
          json: async () => page2,
        });

      const result = await fetchVaultHistory(vaultPubkey);

      expect(result).toHaveLength(350);
      expect((global as any).fetch).toHaveBeenCalledTimes(3); // 1 for vault list, 2 for history
    });

    it('should stop after max pages (20)', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      const vaultListResponse = {
        vaults: [{ vault_id: 'vault_1' }],
      };

      // Always return full pages
      const fullPageResponse = {
        history: Array.from({ length: 250 }, (_, i) => ({
          transaction_id: `tx${i}`,
          timestamp: 1000,
        })),
      };

      (global as any).fetch.mockImplementation((url: string) => {
        if (url.includes('vault_list')) {
          return Promise.resolve({ json: async () => vaultListResponse });
        }
        return Promise.resolve({ json: async () => fullPageResponse });
      });

      const result = await fetchVaultHistory(vaultPubkey);

      // 1 for vault_list + 20 for history pages
      expect((global as any).fetch).toHaveBeenCalledTimes(21);
      expect(result).toHaveLength(5000); // 20 pages * 250 items
    });

    it('should handle empty history gracefully', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      const vaultListResponse = {
        vaults: [{ vault_id: 'vault_1' }],
      };

      (global as any).fetch
        .mockResolvedValueOnce({
          json: async () => vaultListResponse,
        })
        .mockResolvedValueOnce({
          json: async () => ({ history: [] }),
        });

      const result = await fetchVaultHistory(vaultPubkey);

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      (global as any).fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchVaultHistory(vaultPubkey);

      expect(result).toEqual([]);
    });

    it('should make correct API calls with pagination parameters', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      const vaultListResponse = {
        vaults: [{ vault_id: 'vault_1' }],
      };

      const historyResponse = {
        history: Array.from({ length: 100 }, () => ({
          transaction_id: 'tx1',
          timestamp: 1000,
        })),
      };

      (global as any).fetch
        .mockResolvedValueOnce({
          json: async () => vaultListResponse,
        })
        .mockResolvedValueOnce({
          json: async () => historyResponse,
        });

      await fetchVaultHistory(vaultPubkey);

      const historyCall = (global as any).fetch.mock.calls[1];
      const requestBody = JSON.parse(historyCall[1].body);

      expect(requestBody).toMatchObject({
        vault_id: 'vault_1',
        pagination: {
          limit: 250,
          offset: 0,
        },
      });
      expect(requestBody.timestamp_start).toBeDefined();
      expect(requestBody.timestamp_end).toBeDefined();
    });
  });

  describe('fetchVaultData', () => {
    it('should return null if no vaultPubkey provided', async () => {
      const result = await fetchVaultData(null as unknown as string);
      expect(result).toBeNull();
      expect((global as any).fetch).not.toHaveBeenCalled();
    });

    it('should fetch vault data with latest transaction', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      const vaultListResponse = {
        vaults: [
          {
            vault_id: 'vault_1',
            vault_tag: 'My Vault',
            unit_borrowed: 1000,
            btc_locked: 5000,
          },
        ],
        total_debt: 1000,
        total_collateral: 5000,
        current_price: 50000,
      };

      const historyResponse = {
        history: [
          {
            amount_borrowed: 100,
            vault_amount: 1000,
            btc_amt: 0.5,
            unit_amt: 500,
            oracle_price: 50000,
            timestamp: 1000,
            action: 'deposit',
          },
        ],
      };

      (global as any).fetch
        .mockResolvedValueOnce({
          json: async () => vaultListResponse,
        })
        .mockResolvedValueOnce({
          json: async () => historyResponse,
        });

      const result = await fetchVaultData(vaultPubkey);

      expect(result).toEqual({
        vaultId: 'vault_1',
        vaultTag: 'My Vault',
        totalDebt: 1000,
        totalCollateral: 5000,
        currentPrice: 50000,
        latestTransaction: {
          amountBorrowed: 100,
          vaultAmount: 1000,
          btcAmount: 0.5,
          unitAmt: 500,
          oraclePrice: 50000,
          timestamp: 1000,
          action: 'deposit',
        },
      });
    });

    it('should return vault data without latest transaction if history is empty', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      const vaultListResponse = {
        vaults: [
          {
            vault_id: 'vault_1',
            vault_tag: 'My Vault',
            unit_borrowed: 1000,
            btc_locked: 5000,
          },
        ],
        total_debt: 1000,
        total_collateral: 5000,
        current_price: 50000,
      };

      (global as any).fetch
        .mockResolvedValueOnce({
          json: async () => vaultListResponse,
        })
        .mockResolvedValueOnce({
          json: async () => ({ history: [] }),
        });

      const result = await fetchVaultData(vaultPubkey);

      expect(result).toEqual({
        vaultTag: 'My Vault',
        totalDebt: 1000,
        totalCollateral: 5000,
        currentPrice: 50000,
      });
      expect(result?.latestTransaction).toBeUndefined();
    });

    it('should return null if no vaults found', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      (global as any).fetch.mockResolvedValueOnce({
        json: async () => ({ vaults: [] }),
      });

      const result = await fetchVaultData(vaultPubkey);

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      (global as any).fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchVaultData(vaultPubkey);

      expect(result).toBeNull();
    });

    it('should make correct API calls with 30-day time range', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      const vaultListResponse = {
        vaults: [{ vault_id: 'vault_1', vault_tag: 'My Vault' }],
        total_debt: 0,
        total_collateral: 0,
        current_price: 0,
      };

      (global as any).fetch
        .mockResolvedValueOnce({
          json: async () => vaultListResponse,
        })
        .mockResolvedValueOnce({
          json: async () => ({ history: [] }),
        });

      await fetchVaultData(vaultPubkey);

      const historyCall = (global as any).fetch.mock.calls[1];
      const requestBody = JSON.parse(historyCall[1].body);

      expect(requestBody).toMatchObject({
        vault_id: 'vault_1',
        pagination: {
          limit: 250,
          offset: 0,
        },
      });

      // Verify 30-day time range
      const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
      const timeDiff = requestBody.timestamp_end - requestBody.timestamp_start;
      expect(timeDiff).toBeCloseTo(thirtyDaysInSeconds, -2); // Allow some variance
    });
  });
});
