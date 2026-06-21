/**
 * Tests for Transaction History Service
 * Tests transaction fetching, rune transfer parsing, and transaction amount calculation
 *
 * NOTE: This file uses type-safe fetch mock pattern.
 * See testUtils/fetchMock.ts for the implementation.
 */

import {
  fetchAddressTransactions,
  parseRuneTransfer,
  calculateTransactionAmount,
  fetchAllTransactionHistory,
} from '../transactionHistoryService';
import { fetchVaultHistory } from '../vaultService';
import {
  setupMockFetch,
  getMockFetch,
  createMockResponse,
} from './testUtils';

// Mock dependencies
jest.mock('../../utils/retry', () => ({
  retrySilently: jest.fn((fn: () => unknown) => fn()),
}));

jest.mock('../../utils/constants', () => ({
  RUNES_CONFIG: {
    DUCAT_UNIT_RUNE_ID: {
      block: 1527352n,
      tx: 1n,
    },
  },
  getAddressTxsUrl: jest.fn((address: string, lastTxid?: string) =>
    lastTxid
      ? `https://api.example.com/address/${address}/txs/chain/${lastTxid}`
      : `https://api.example.com/address/${address}/txs`
  ),
}));

jest.mock('../vaultService');
jest.mock('../../utils/runestoneEncoder');

const { decodeRunestone } = jest.requireMock('../../utils/runestoneEncoder') as {
  decodeRunestone: jest.Mock;
};
const mockFetchVaultHistory = fetchVaultHistory as jest.MockedFunction<typeof fetchVaultHistory>;

describe('transactionHistoryService', () => {
  const configuredUnitRuneId = {
    block: 1527352n,
    tx: 1n,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupMockFetch();
  });

  describe('fetchAddressTransactions', () => {
    it('should fetch all transactions for an address', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

      const mockTxs = [
        { txid: 'tx1', status: { block_time: 1000 } },
        { txid: 'tx2', status: { block_time: 2000 } },
      ];

      getMockFetch().mockResolvedValueOnce(createMockResponse(mockTxs));

      const result = await fetchAddressTransactions(address);

      expect(result).toEqual(mockTxs);
      expect(getMockFetch()).toHaveBeenCalledTimes(1);
    });

    it('should handle pagination correctly', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

      // First page: 25 transactions
      const page1 = Array.from({ length: 25 }, (_, i) => ({
        txid: `tx${i}`,
        status: { block_time: 1000 + i },
      }));

      // Second page: 10 transactions (less than 25, so it's the last page)
      const page2 = Array.from({ length: 10 }, (_, i) => ({
        txid: `tx${25 + i}`,
        status: { block_time: 2000 + i },
      }));

      getMockFetch()
        .mockResolvedValueOnce(createMockResponse(page1))
        .mockResolvedValueOnce(createMockResponse(page2));

      const result = await fetchAddressTransactions(address);

      expect(result).toHaveLength(35);
      expect(getMockFetch()).toHaveBeenCalledTimes(2);
    });

    it('should stop after max pages (40)', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

      // Mock 41 pages of 25 transactions each
      getMockFetch().mockImplementation(() =>
        Promise.resolve(createMockResponse(
          Array.from({ length: 25 }, (_, i) => ({
            txid: `tx${i}`,
            status: { block_time: 1000 },
          }))
        ))
      );

      const result = await fetchAddressTransactions(address);

      // Should only fetch 40 pages
      expect(getMockFetch()).toHaveBeenCalledTimes(40);
      expect(result).toHaveLength(1000); // 40 pages * 25 txs
    });

    it('should stop at the provided max pages', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

      getMockFetch().mockImplementation(() =>
        Promise.resolve(createMockResponse(
          Array.from({ length: 25 }, (_, i) => ({
            txid: `tx${i}`,
            status: { block_time: 1000 },
          }))
        ))
      );

      const result = await fetchAddressTransactions(address, { maxPages: 4 });

      expect(getMockFetch()).toHaveBeenCalledTimes(4);
      expect(result).toHaveLength(100);
    });

    it('should return empty array on error', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

      getMockFetch().mockResolvedValueOnce(
        createMockResponse({}, { ok: false, status: 404, statusText: 'Not Found' })
      );

      const result = await fetchAddressTransactions(address);

      expect(result).toEqual([]);
    });

    it('should handle empty response', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

      getMockFetch().mockResolvedValueOnce(createMockResponse([]));

      const result = await fetchAddressTransactions(address);

      expect(result).toEqual([]);
    });
  });

  describe('parseRuneTransfer', () => {
    const segwitAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
    const taprootAddress = 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';

    it('should return null if no OP_RETURN output', () => {
      const tx = {
        txid: 'test_tx',
        status: { confirmed: true, block_time: 1000 },
        vout: [
          { scriptpubkey: 'abcd1234', value: 0 },
        ],
      };

      const result = parseRuneTransfer(tx, segwitAddress, taprootAddress);

      expect(result).toBeNull();
    });

    it('should parse UNIT transfer correctly', () => {
      decodeRunestone.mockReturnValueOnce({
        edicts: [
          {
            id: configuredUnitRuneId,
            amount: 1000n,
            output: 1,
          },
        ],
      });

      const tx = {
        txid: 'test_tx',
        status: { confirmed: true, block_time: 1000 },
        vin: [
          {
            prevout: {
              scriptpubkey_address: taprootAddress,
              value: 10000,
            },
          },
        ],
        vout: [
          {
            scriptpubkey: '6a5d0102', // OP_RETURN
            value: 0,
          },
          {
            scriptpubkey_address: 'tb1precipientsaddress',
            value: 10000,
          },
        ],
      };

      const result = parseRuneTransfer(tx, segwitAddress, taprootAddress);

      expect(result).toEqual({
        amount: -1000n,
        type: 'UNIT',
      });
    });

    it('should handle receiving UNIT transfers', () => {
      decodeRunestone.mockReturnValueOnce({
        edicts: [
          {
            id: configuredUnitRuneId,
            amount: 500n,
            output: 0,
          },
        ],
      });

      const tx = {
        txid: 'test_tx',
        status: { confirmed: true, block_time: 1000 },
        vin: [
          {
            prevout: {
              scriptpubkey_address: 'tb1psenderaddress',
              value: 10000,
            },
          },
        ],
        vout: [
          {
            scriptpubkey_address: taprootAddress,
            value: 10000,
          },
          {
            scriptpubkey: '6a5d0102',
            value: 0,
          },
        ],
      };

      const result = parseRuneTransfer(tx, segwitAddress, taprootAddress);

      expect(result).toEqual({
        amount: 500n,
        type: 'UNIT',
      });
    });

    it('should return null for non-UNIT runes', () => {
      decodeRunestone.mockReturnValueOnce({
        edicts: [
          {
            id: { block: 999999n, tx: 1n }, // Different rune
            amount: 1000n,
            output: 1,
          },
        ],
      });

      const tx = {
        txid: 'test_tx',
        status: { confirmed: true, block_time: 1000 },
        vin: [
          {
            prevout: {
              scriptpubkey_address: taprootAddress,
              value: 10000,
            },
          },
        ],
        vout: [
          {
            scriptpubkey: '6a5d0102',
            value: 0,
          },
          {
            scriptpubkey_address: 'tb1precipient',
            value: 10000,
          },
        ],
      };

      const result = parseRuneTransfer(tx, segwitAddress, taprootAddress);

      expect(result).toBeNull();
    });

    it('should return null if runestone decode fails', () => {
      decodeRunestone.mockReturnValueOnce(null);

      const tx = {
        txid: 'test_tx',
        status: { confirmed: true, block_time: 1000 },
        vout: [
          {
            scriptpubkey: '6a5d0102',
            value: 0,
          },
        ],
      };

      const result = parseRuneTransfer(tx, segwitAddress, taprootAddress);

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', () => {
      decodeRunestone.mockImplementationOnce(() => {
        throw new Error('Decode error');
      });

      const tx = {
        txid: 'test_tx',
        status: { confirmed: true, block_time: 1000 },
        vout: [
          {
            scriptpubkey: '6a5d0102',
            value: 0,
          },
        ],
      };

      const result = parseRuneTransfer(tx, segwitAddress, taprootAddress);

      expect(result).toBeNull();
    });

    it('should handle missing targetOutput for edict', () => {
      decodeRunestone.mockReturnValueOnce({
        edicts: [
          {
            id: configuredUnitRuneId,
            amount: 1000n,
            output: 10, // Output index that doesn't exist
          },
        ],
      });

      const tx = {
        txid: 'test_tx',
        status: { confirmed: true, block_time: 1000 },
        vin: [
          {
            prevout: {
              scriptpubkey_address: taprootAddress,
              value: 10000,
            },
          },
        ],
        vout: [
          {
            scriptpubkey: '6a5d0102',
            value: 0,
          },
          {
            scriptpubkey_address: 'tb1precipient',
            value: 10000,
          },
        ],
      };

      const result = parseRuneTransfer(tx, segwitAddress, taprootAddress);

      // Should return UNIT transfer with 0 amount (we're sender, but output doesn't exist)
      expect(result).toEqual({
        amount: 0n,
        type: 'UNIT',
      });
    });

    it('should return null if not involved in transfer', () => {
      decodeRunestone.mockReturnValueOnce({
        edicts: [
          {
            id: configuredUnitRuneId,
            amount: 1000n,
            output: 0,
          },
        ],
      });

      const tx = {
        txid: 'test_tx',
        status: { confirmed: true, block_time: 1000 },
        vin: [
          {
            prevout: {
              scriptpubkey_address: 'tb1psomeoneelse',
              value: 10000,
            },
          },
        ],
        vout: [
          {
            scriptpubkey_address: 'tb1panotheraddress',
            value: 10000,
          },
          {
            scriptpubkey: '6a5d0102',
            value: 0,
          },
        ],
      };

      const result = parseRuneTransfer(tx, segwitAddress, taprootAddress);

      // Should return null because we're not the sender or receiver
      expect(result).toBeNull();
    });
  });

  describe('calculateTransactionAmount', () => {
    const segwitAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
    const taprootAddress = 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';

    beforeEach(() => {
      decodeRunestone.mockReturnValue(null);
    });

    it('should prioritize rune transfers over BTC calculations', () => {
      // Mock a UNIT transfer
      decodeRunestone.mockReturnValueOnce({
        edicts: [
          {
            id: configuredUnitRuneId,
            amount: 500n,
            output: 0,
          },
        ],
      });

      const tx = {
        txid: 'test_tx',
        status: { confirmed: true, block_time: 1000 },
        vin: [
          {
            prevout: {
              scriptpubkey_address: 'tb1psenderaddress',
              value: 10000,
            },
          },
        ],
        vout: [
          {
            scriptpubkey_address: taprootAddress,
            value: 10000,
          },
          {
            scriptpubkey: '6a5d0102',
            value: 0,
          },
        ],
      };

      const result = calculateTransactionAmount(tx, segwitAddress, taprootAddress);

      // Should return UNIT transfer, not BTC
      expect(result).toEqual({
        amount: 500n,
        type: 'UNIT',
      });
    });

    it('should calculate BTC received', () => {
      const tx = {
        txid: 'test_tx',
        status: { confirmed: true, block_time: 1000 },
        vin: [
          {
            prevout: {
              scriptpubkey_address: 'tb1qsenderaddress',
              value: 100000,
            },
          },
        ],
        vout: [
          {
            scriptpubkey_address: segwitAddress,
            value: 50000,
          },
        ],
      };

      const result = calculateTransactionAmount(tx, segwitAddress, taprootAddress);

      expect(result).toEqual({
        amount: 50000,
        type: 'BTC',
      });
    });

    it('should calculate BTC sent', () => {
      const tx = {
        txid: 'test_tx',
        status: { confirmed: true, block_time: 1000 },
        vin: [
          {
            prevout: {
              scriptpubkey_address: segwitAddress,
              value: 100000,
            },
          },
        ],
        vout: [
          {
            scriptpubkey_address: 'tb1qrecipientaddress',
            value: 90000,
          },
        ],
      };

      const result = calculateTransactionAmount(tx, segwitAddress, taprootAddress);

      expect(result).toEqual({
        amount: -100000,
        type: 'BTC',
      });
    });

    it('should detect self-transfer', () => {
      const tx = {
        txid: 'test_tx',
        status: { confirmed: true, block_time: 1000 },
        vin: [
          {
            prevout: {
              scriptpubkey_address: segwitAddress,
              value: 100000,
            },
          },
        ],
        vout: [
          {
            scriptpubkey_address: taprootAddress,
            value: 99000,
          },
        ],
      };

      const result = calculateTransactionAmount(tx, segwitAddress, taprootAddress);

      expect(result).toEqual({
        amount: 0,
        type: 'BTC',
        isSelfTransfer: true,
      });
    });

    it('should ignore OP_RETURN outputs in self-transfer detection', () => {
      const tx = {
        txid: 'test_tx',
        status: { confirmed: true, block_time: 1000 },
        vin: [
          {
            prevout: {
              scriptpubkey_address: segwitAddress,
              value: 100000,
            },
          },
        ],
        vout: [
          {
            scriptpubkey_address: taprootAddress,
            value: 99000,
          },
          {
            scriptpubkey_type: 'op_return',
            value: 0,
          },
        ],
      };

      const result = calculateTransactionAmount(tx, segwitAddress, taprootAddress);

      expect(result).toEqual({
        amount: 0,
        type: 'BTC',
        isSelfTransfer: true,
      });
    });
  });

  describe('fetchAllTransactionHistory', () => {
    const segwitAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
    const taprootAddress = 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';
    const vaultPubkey = 'vault_pubkey_123';

    it('should fetch and combine all transaction history', async () => {
      const segwitTxs = [
        { txid: 'tx1', status: { block_time: 3000 } },
      ];

      const taprootTxs = [
        { txid: 'tx2', status: { block_time: 2000 } },
      ];

      const vaultHistory = [
        {
          transaction_id: 'vault_tx1',
          timestamp: 1000,
          action: 'deposit',
          amount_borrowed: 100,
          vault_amount: 1000,
          btc_amt: 0.5,
          unit_amt: 500,
          oracle_price: 50000,
        },
      ];

      getMockFetch()
        .mockResolvedValueOnce(createMockResponse(segwitTxs))
        .mockResolvedValueOnce(createMockResponse(taprootTxs));

      mockFetchVaultHistory.mockResolvedValueOnce(vaultHistory);

      const result = await fetchAllTransactionHistory(segwitAddress, taprootAddress, vaultPubkey);

      expect(result).toHaveLength(3);
      expect(result[0].txid).toBe('tx1'); // Most recent first
      expect(result[1].txid).toBe('tx2');
      expect(result[2].vaultTransaction).toBe(true);
    });

    it('should pass lazy-load limits to address and vault history sources', async () => {
      getMockFetch()
        .mockResolvedValueOnce(createMockResponse([]))
        .mockResolvedValueOnce(createMockResponse([]));
      mockFetchVaultHistory.mockResolvedValueOnce([]);

      await fetchAllTransactionHistory(segwitAddress, taprootAddress, vaultPubkey, {
        addressMaxPages: 4,
        vaultHistoryOptions: {
          limit: 50,
          maxPages: 1,
          lookbackDays: 120,
        },
      });

      expect(getMockFetch()).toHaveBeenCalledTimes(2);
      expect(mockFetchVaultHistory).toHaveBeenCalledWith(vaultPubkey, {
        limit: 50,
        maxPages: 1,
        lookbackDays: 120,
      });
    });

    it('should deduplicate transactions by txid', async () => {
      const duplicateTx = { txid: 'tx1', status: { block_time: 1000 } };

      getMockFetch()
        .mockResolvedValueOnce(createMockResponse([duplicateTx]))
        .mockResolvedValueOnce(createMockResponse([duplicateTx]));

      mockFetchVaultHistory.mockResolvedValueOnce([]);

      const result = await fetchAllTransactionHistory(segwitAddress, taprootAddress, vaultPubkey);

      expect(result).toHaveLength(1);
      expect(result[0].txid).toBe('tx1');
    });

    it('should exclude vault transaction IDs from regular transactions', async () => {
      const segwitTxs = [
        { txid: 'tx1', status: { block_time: 3000 } },
        { txid: 'vault_tx1', status: { block_time: 2000 } },
      ];

      const vaultHistory = [
        {
          transaction_id: 'vault_tx1',
          timestamp: 2000,
          action: 'deposit',
          amount_borrowed: 100,
          vault_amount: 1000,
          btc_amt: 0.5,
          unit_amt: 500,
          oracle_price: 50000,
        },
      ];

      getMockFetch()
        .mockResolvedValueOnce(createMockResponse(segwitTxs))
        .mockResolvedValueOnce(createMockResponse([]));

      mockFetchVaultHistory.mockResolvedValueOnce(vaultHistory);

      const result = await fetchAllTransactionHistory(segwitAddress, taprootAddress, vaultPubkey);

      // Should only have 2 transactions: tx1 and vault_tx1 (but vault_tx1 as synthetic vault transaction)
      expect(result).toHaveLength(2);
      expect(result.find(tx => tx.txid === 'tx1')).toBeDefined();
      expect(result.find(tx => tx.txid === 'vault_tx1' && tx.vaultTransaction)).toBeDefined();
    });

    it('should hide companion UNIT issue transactions for indexed open vault actions', async () => {
      const issueTx = {
        txid: 'open_issue_tx',
        status: { block_time: 2000 },
        vin: [
          {
            prevout: {
              scriptpubkey_address: taprootAddress,
              value: 1000,
            },
          },
        ],
        vout: [
          { scriptpubkey: '6a5dissue', value: 0 },
          { scriptpubkey_address: 'tb1pguardianaddress', value: 1000 },
        ],
      };
      const unrelatedUnitSend = {
        txid: 'unrelated_unit_send',
        status: { block_time: 2000 },
        vin: [
          {
            prevout: {
              scriptpubkey_address: taprootAddress,
              value: 1000,
            },
          },
        ],
        vout: [
          { scriptpubkey: '6a5dother', value: 0 },
          { scriptpubkey_address: 'tb1potheraddress', value: 1000 },
        ],
      };

      decodeRunestone.mockImplementation((scriptpubkey: string) => ({
        edicts: [
          {
            id: configuredUnitRuneId,
            amount: scriptpubkey === '6a5dissue' ? 120000n : 2500n,
            output: 1,
          },
        ],
      }));

      getMockFetch()
        .mockResolvedValueOnce(createMockResponse([issueTx, unrelatedUnitSend]))
        .mockResolvedValueOnce(createMockResponse([]));

      mockFetchVaultHistory.mockResolvedValueOnce([
        {
          transaction_id: 'vault_tx1',
          timestamp: 2000,
          action: 'open',
          amount_borrowed: 120000,
          vault_amount: 4999000,
          btc_amt: 4999000,
          unit_amt: 120000,
          oracle_price: 50000,
        },
      ]);

      const result = await fetchAllTransactionHistory(segwitAddress, taprootAddress, vaultPubkey);

      expect(result.find((tx) => tx.txid === 'open_issue_tx')).toBeUndefined();
      expect(result.find((tx) => tx.txid === 'unrelated_unit_send')).toBeDefined();
      expect(result.find((tx) => tx.txid === 'vault_tx1' && tx.vaultTransaction)).toBeDefined();
    });

    it('should sort transactions by timestamp (most recent first)', async () => {
      const segwitTxs = [
        { txid: 'tx1', status: { block_time: 1000 } },
      ];

      const taprootTxs = [
        { txid: 'tx2', status: { block_time: 3000 } },
      ];

      const vaultHistory = [
        {
          transaction_id: 'vault_tx1',
          timestamp: 2000,
          action: 'deposit',
          amount_borrowed: 0,
          vault_amount: 1000,
          btc_amt: 0.5,
          unit_amt: 500,
          oracle_price: 50000,
        },
      ];

      getMockFetch()
        .mockResolvedValueOnce(createMockResponse(segwitTxs))
        .mockResolvedValueOnce(createMockResponse(taprootTxs));

      mockFetchVaultHistory.mockResolvedValueOnce(vaultHistory);

      const result = await fetchAllTransactionHistory(segwitAddress, taprootAddress, vaultPubkey);

      expect(result[0].txid).toBe('tx2'); // 3000
      expect(result[1].txid).toBe('vault_tx1'); // 2000
      expect(result[2].txid).toBe('tx1'); // 1000
    });

    it('should return partial history when one source hangs', async () => {
      jest.useFakeTimers();
      try {
        const taprootTxs = [
          { txid: 'taproot_tx', status: { block_time: 2000 } },
        ];
        const vaultHistory = [
          {
            transaction_id: 'vault_tx_timeout',
            timestamp: 3000,
            action: 'borrow',
            amount_borrowed: 25,
            vault_amount: 1000,
            btc_amt: 0.5,
            unit_amt: 2500,
            oracle_price: 50000,
          },
        ];

        getMockFetch()
          .mockImplementationOnce(() => new Promise(() => undefined))
          .mockResolvedValueOnce(createMockResponse(taprootTxs));
        mockFetchVaultHistory.mockResolvedValueOnce(vaultHistory);

        const resultPromise = fetchAllTransactionHistory(segwitAddress, taprootAddress, vaultPubkey);
        await Promise.resolve();
        await jest.advanceTimersByTimeAsync(15_000);

        await expect(resultPromise).resolves.toEqual([
          expect.objectContaining({ txid: 'vault_tx_timeout', vaultTransaction: true }),
          expect.objectContaining({ txid: 'taproot_tx' }),
        ]);
      } finally {
        jest.useRealTimers();
      }
    });

    it('should handle fetch errors gracefully', async () => {
      // fetchAddressTransactions catches errors and returns []
      getMockFetch().mockRejectedValueOnce(new Error('Network error'));
      mockFetchVaultHistory.mockResolvedValueOnce([]);

      const result = await fetchAllTransactionHistory(segwitAddress, taprootAddress, vaultPubkey);

      // Should return empty array when segwit fetch fails
      expect(result).toEqual([]);
    });
  });
});
