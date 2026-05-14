/**
 * Tests for Vault Service
 * Tests vault history and vault data fetching
 *
 * NOTE: This file uses a type-safe fetch mock pattern.
 * See testUtils/fetchMock.ts for the implementation.
 */

import { fetchVaultHistory, fetchVaultData } from '../vaultService';
import {
  setupMockFetch,
  getMockFetch,
  createMockResponse,
  getFetchCallCount,
  getFetchCall,
  getFetchCallBody,
  mockFetchReject,
  expectFetchNotCalled,
} from './testUtils';

// Mock dependencies
jest.mock('../../utils/retry', () => ({
  retrySilently: jest.fn((fn) => fn()),
}));

jest.mock('../../utils/constants', () => ({
  API: {
    VAULT: 'https://api.example.com/vault',
  },
}));

// Required fields for VaultInfo validation
const REQUIRED_VAULT_FIELDS = {
  vault_pubkey: 'vpk_test_123',
  creation_account: 'acct_test_123',
  guard_pubkey: 'gpk_test_123',
  master_id: 'mid_test_123',
  utxo: 'txid:0',
};

describe('vaultService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockFetch();
  });

  describe('fetchVaultHistory', () => {
    it('should return empty array if no vaultPubkey provided', async () => {
      const result = await fetchVaultHistory(null as unknown as string);
      expect(result).toEqual([]);
      expect(getFetchCallCount()).toBe(0);
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

      getMockFetch()
        .mockResolvedValueOnce(createMockResponse(vaultListResponse))
        .mockResolvedValueOnce(createMockResponse(historyResponse));

      const result = await fetchVaultHistory(vaultPubkey);

      expect(result).toEqual(historyResponse.history);
      expect(getFetchCallCount()).toBe(2);
    });

    it('should return empty array if no vaults found', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      getMockFetch().mockResolvedValueOnce(createMockResponse({ vaults: [] }));

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

      getMockFetch()
        .mockResolvedValueOnce(createMockResponse(vaultListResponse))
        .mockResolvedValueOnce(createMockResponse(page1))
        .mockResolvedValueOnce(createMockResponse(page2));

      const result = await fetchVaultHistory(vaultPubkey);

      expect(result).toHaveLength(350);
      expect(getFetchCallCount()).toBe(3); // 1 for vault list, 2 for history
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

      getMockFetch().mockImplementation((url: RequestInfo | URL) => {
        const urlStr = String(url);
        if (urlStr.includes('vault_list')) {
          return Promise.resolve(createMockResponse(vaultListResponse));
        }
        return Promise.resolve(createMockResponse(fullPageResponse));
      });

      const result = await fetchVaultHistory(vaultPubkey);

      // 1 for vault_list + 20 for history pages
      expect(getFetchCallCount()).toBe(21);
      expect(result).toHaveLength(5000); // 20 pages * 250 items
    });

    it('should handle empty history gracefully', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      const vaultListResponse = {
        vaults: [{ vault_id: 'vault_1' }],
      };

      getMockFetch()
        .mockResolvedValueOnce(createMockResponse(vaultListResponse))
        .mockResolvedValueOnce(createMockResponse({ history: [] }));

      const result = await fetchVaultHistory(vaultPubkey);

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      mockFetchReject(new Error('Network error'));

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

      getMockFetch()
        .mockResolvedValueOnce(createMockResponse(vaultListResponse))
        .mockResolvedValueOnce(createMockResponse(historyResponse));

      await fetchVaultHistory(vaultPubkey);

      const requestBody = getFetchCallBody<{
        vault_id: string;
        pagination: { limit: number; offset: number };
        timestamp_start?: number;
        timestamp_end?: number;
      }>(1);

      expect(requestBody).toMatchObject({
        vault_id: 'vault_1',
        pagination: {
          limit: 250,
          offset: 0,
        },
      });
      expect(requestBody?.timestamp_start).toBeDefined();
      expect(requestBody?.timestamp_end).toBeDefined();
    });

    it('should fetch a limited page directly when vault id is provided', async () => {
      const vaultPubkey = 'vault_pubkey_123';
      const historyResponse = {
        history: [
          {
            transaction_id: 'tx1',
            timestamp: 1000,
          },
        ],
      };

      getMockFetch().mockResolvedValueOnce(createMockResponse(historyResponse));

      const result = await fetchVaultHistory(vaultPubkey, {
        vaultId: 'vault_1',
        limit: 50,
        maxPages: 1,
        lookbackDays: 120,
      });

      expect(result).toEqual(historyResponse.history);
      expect(getFetchCallCount()).toBe(1);
      expect(String(getFetchCall(0)?.[0])).toContain('vault_history_tx');

      const requestBody = getFetchCallBody<{
        vault_id: string;
        pagination: { limit: number; offset: number };
        timestamp_start?: number;
        timestamp_end?: number;
      }>(0);

      expect(requestBody).toMatchObject({
        vault_id: 'vault_1',
        pagination: {
          limit: 50,
          offset: 0,
        },
      });

      const oneHundredTwentyDaysInSeconds = 120 * 24 * 60 * 60;
      const timeDiff = (requestBody?.timestamp_end ?? 0) - (requestBody?.timestamp_start ?? 0);
      expect(timeDiff).toBeCloseTo(oneHundredTwentyDaysInSeconds, -2);
    });
  });

  describe('fetchVaultData', () => {
    it('should return null if no vaultPubkey provided', async () => {
      const result = await fetchVaultData(null as unknown as string);
      expect(result).toBeNull();
      expectFetchNotCalled();
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
            ...REQUIRED_VAULT_FIELDS,
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

      getMockFetch()
        .mockResolvedValueOnce(createMockResponse(vaultListResponse))
        .mockResolvedValueOnce(createMockResponse(historyResponse));

      const result = await fetchVaultData(vaultPubkey, { includeLatestTransaction: true });

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
        vaultInfo: {
          vault_id: 'vault_1',
          vault_tag: 'My Vault',
          unit_borrowed: 1000,
          btc_locked: 5000,
          oracle_price: 50000,
          vault_version: 1,
          collateral_ratio: 0,
          liquidation_price: 0,
          master_id: REQUIRED_VAULT_FIELDS.master_id,
          creation_account: REQUIRED_VAULT_FIELDS.creation_account,
          guard_pubkey: REQUIRED_VAULT_FIELDS.guard_pubkey,
          vault_pubkey: REQUIRED_VAULT_FIELDS.vault_pubkey,
          liquidation_hash: '',
          utxo: REQUIRED_VAULT_FIELDS.utxo,
          oracle_timestamp: 1000,
          vault_last_action: 'deposit',
        },
      });
    });

    it('should return vault data from the fast list-only path by default', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      const vaultListResponse = {
        vaults: [
          {
            vault_id: 'vault_1',
            vault_tag: 'My Vault',
            unit_borrowed: 1000,
            btc_locked: 5000,
            ...REQUIRED_VAULT_FIELDS,
          },
        ],
        total_debt: 1000,
        total_collateral: 5000,
        current_price: 50000,
      };

      getMockFetch().mockResolvedValueOnce(createMockResponse(vaultListResponse));

      const result = await fetchVaultData(vaultPubkey);

      expect(result).toMatchObject({
        vaultId: 'vault_1',
        vaultTag: 'My Vault',
        totalDebt: 1000,
        totalCollateral: 5000,
        currentPrice: 50000,
      });
      expect(result?.vaultInfo).toBeDefined();
      expect(result?.vaultInfo?.vault_id).toBe('vault_1');
      expect(result?.latestTransaction).toBeUndefined();
      expect(getFetchCallCount()).toBe(1);
    });

    it('should return null if no vaults found', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      getMockFetch().mockResolvedValueOnce(createMockResponse({ vaults: [] }));

      const result = await fetchVaultData(vaultPubkey);

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      mockFetchReject(new Error('Network error'));

      const result = await fetchVaultData(vaultPubkey);

      expect(result).toBeNull();
    });

    it('should make correct API calls with 30-day time range', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      const vaultListResponse = {
        vaults: [{ vault_id: 'vault_1', vault_tag: 'My Vault', ...REQUIRED_VAULT_FIELDS }],
        total_debt: 0,
        total_collateral: 0,
        current_price: 0,
      };

      getMockFetch()
        .mockResolvedValueOnce(createMockResponse(vaultListResponse))
        .mockResolvedValueOnce(createMockResponse({ history: [] }));

      await fetchVaultData(vaultPubkey);

      const requestBody = getFetchCallBody<{
        vault_id: string;
        pagination: { limit: number; offset: number };
        timestamp_start: number;
        timestamp_end: number;
      }>(1);

      expect(requestBody).toMatchObject({
        vault_id: 'vault_1',
        pagination: {
          limit: 1,
          offset: 0,
        },
      });

      // Verify 30-day time range
      const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
      const timeDiff = (requestBody?.timestamp_end ?? 0) - (requestBody?.timestamp_start ?? 0);
      expect(timeDiff).toBeCloseTo(thirtyDaysInSeconds, -2); // Allow some variance
    });

    it('should handle multiple vaults and use the first one', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      const vaultListResponse = {
        vaults: [
          {
            vault_id: 'vault_1',
            vault_tag: 'First Vault',
            unit_borrowed: 1000,
            btc_locked: 5000,
            ...REQUIRED_VAULT_FIELDS,
          },
          {
            vault_id: 'vault_2',
            vault_tag: 'Second Vault',
            unit_borrowed: 2000,
            btc_locked: 10000,
            ...REQUIRED_VAULT_FIELDS,
          },
          {
            vault_id: 'vault_3',
            vault_tag: 'Third Vault',
            unit_borrowed: 3000,
            btc_locked: 15000,
            ...REQUIRED_VAULT_FIELDS,
          },
        ],
        current_price: 50000,
      };

      getMockFetch().mockResolvedValueOnce(createMockResponse(vaultListResponse));

      const result = await fetchVaultData(vaultPubkey);

      // Should use first vault's data, not totals
      expect(result).toMatchObject({
        vaultId: 'vault_1',
        vaultTag: 'First Vault',
        totalDebt: 1000,
        totalCollateral: 5000,
        currentPrice: 50000,
      });
      expect(result?.vaultInfo).toBeDefined();
      expect(result?.vaultInfo?.vault_id).toBe('vault_1');

      expect(getFetchCallCount()).toBe(1);
    });

    it('should log debug messages for multiple vaults', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      jest.spyOn(console, 'log').mockImplementation();

      const vaultListResponse = {
        vaults: [
          { vault_id: 'vault_1', vault_tag: 'Vault 1', unit_borrowed: 100, btc_locked: 500, ...REQUIRED_VAULT_FIELDS },
          { vault_id: 'vault_2', vault_tag: 'Vault 2', unit_borrowed: 200, btc_locked: 1000, ...REQUIRED_VAULT_FIELDS },
        ],
        current_price: 50000,
      };

      getMockFetch().mockResolvedValueOnce(createMockResponse(vaultListResponse));

      await fetchVaultData(vaultPubkey);

      // Should have used first vault
      const call = getFetchCall(0);
      expect(call?.[1]?.body).toContain(vaultPubkey);
    });

    it('should handle single vault without logging multiple vaults warning', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      const vaultListResponse = {
        vaults: [
          {
            vault_id: 'vault_1',
            vault_tag: 'Only Vault',
            unit_borrowed: 1000,
            btc_locked: 5000,
            ...REQUIRED_VAULT_FIELDS,
          },
        ],
        current_price: 50000,
      };

      getMockFetch().mockResolvedValueOnce(createMockResponse(vaultListResponse));

      const result = await fetchVaultData(vaultPubkey);

      expect(result).toMatchObject({
        vaultId: 'vault_1',
        vaultTag: 'Only Vault',
        totalDebt: 1000,
        totalCollateral: 5000,
        currentPrice: 50000,
      });
      expect(result?.vaultInfo).toBeDefined();
      expect(result?.vaultInfo?.vault_id).toBe('vault_1');
    });

    it('should return display data without vaultInfo when vault is missing operation fields', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      const vaultListResponse = {
        vaults: [
          {
            vault_id: 'vault_1',
            vault_tag: 'Incomplete Vault',
            unit_borrowed: 1000,
            btc_locked: 5000,
            // Missing vault_pubkey, creation_account, guard_pubkey, master_id, utxo
          },
        ],
        current_price: 50000,
      };

      getMockFetch().mockResolvedValueOnce(createMockResponse(vaultListResponse));

      const result = await fetchVaultData(vaultPubkey);

      expect(result).toMatchObject({
        vaultId: 'vault_1',
        vaultTag: 'Incomplete Vault',
        totalDebt: 1000,
        totalCollateral: 5000,
        currentPrice: 50000,
      });
      expect(result?.vaultInfo).toBeUndefined();
    });

    it('should use vault oracle_price when current_price is unavailable', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      const vaultListResponse = {
        vaults: [
          {
            vault_id: 'vault_1',
            vault_tag: 'Oracle Vault',
            unit_borrowed: 1000,
            btc_locked: 5000,
            oracle_price: 51000,
            ...REQUIRED_VAULT_FIELDS,
          },
        ],
        current_price: 0,
      };

      getMockFetch().mockResolvedValueOnce(createMockResponse(vaultListResponse));

      const result = await fetchVaultData(vaultPubkey);

      expect(result?.currentPrice).toBe(51000);
      expect(result?.vaultInfo?.oracle_price).toBe(51000);
    });

    it('should use latest transaction oracle price when list prices are unavailable', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      const vaultListResponse = {
        vaults: [
          {
            vault_id: 'vault_1',
            vault_tag: 'History Oracle Vault',
            unit_borrowed: 1000,
            btc_locked: 5000,
            ...REQUIRED_VAULT_FIELDS,
          },
        ],
        current_price: 0,
      };

      const historyResponse = {
        history: [
          {
            amount_borrowed: 100,
            vault_amount: 1000,
            btc_amt: 0.5,
            unit_amt: 500,
            oracle_price: 52000,
            timestamp: 1000,
            action: 'borrow',
          },
        ],
      };

      getMockFetch()
        .mockResolvedValueOnce(createMockResponse(vaultListResponse))
        .mockResolvedValueOnce(createMockResponse(historyResponse));

      const result = await fetchVaultData(vaultPubkey);

      expect(result?.currentPrice).toBe(52000);
      expect(result?.vaultInfo?.oracle_price).toBe(52000);
      expect(result?.latestTransaction?.oraclePrice).toBe(52000);
    });

    it('should use first vault data in latestTransaction', async () => {
      const vaultPubkey = 'vault_pubkey_123';

      const vaultListResponse = {
        vaults: [
          {
            vault_id: 'vault_1',
            vault_tag: 'First Vault',
            unit_borrowed: 1000,
            btc_locked: 5000,
            ...REQUIRED_VAULT_FIELDS,
          },
          {
            vault_id: 'vault_2',
            vault_tag: 'Second Vault',
            unit_borrowed: 2000,
            btc_locked: 10000,
            ...REQUIRED_VAULT_FIELDS,
          },
        ],
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

      getMockFetch()
        .mockResolvedValueOnce(createMockResponse(vaultListResponse))
        .mockResolvedValueOnce(createMockResponse(historyResponse));

      const result = await fetchVaultData(vaultPubkey, { includeLatestTransaction: true });

      // Should use first vault's data, not sum of all vaults
      expect(result?.totalDebt).toBe(1000);
      expect(result?.totalCollateral).toBe(5000);
    });
  });
});
