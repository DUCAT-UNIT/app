/**
 * Tests for pendingTransactionsStore
 * Consolidated to test meaningful behavior - transaction lifecycle, UTXO tracking
 */

import { act } from '@testing-library/react-native';
import {
  usePendingTransactionsStore,
  resetPendingTransactionsStore,
  type PendingTransactionOutput,
} from '../pendingTransactionsStore';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/pendingTransactionsUtils', () => ({
  buildExclusionSet: jest.fn(() => new Set()),
  getUnconfirmedUTXOsFromPending: jest.fn(() => []),
  calculateUnconfirmedBalance: jest.fn(() => ({ btc: 0, unit: 0 })),
  invalidateTransactionTree: jest.fn((txs, txid) => ({
    updated: { ...txs },
    invalidated: [txid],
  })),
  removeUtxoFromPending: jest.fn((txs) => ({ ...txs })),
  cleanupInvalidTransactions: jest.fn((txs) => ({ updated: txs, cleaned: 0 })),
  markUtxosAsSpent: jest.fn((set, utxos) => {
    const newSet = new Set(set);
    utxos.forEach((u: { txid: string; vout: number }) => newSet.add(`${u.txid}:${u.vout}`));
    return newSet;
  }),
  unmarkUtxosAsSpent: jest.fn((set, utxos) => {
    const newSet = new Set(set);
    utxos.forEach((u: { txid: string; vout: number }) => newSet.delete(`${u.txid}:${u.vout}`));
    return newSet;
  }),
}));

describe('pendingTransactionsStore', () => {
  const mockOutputs: PendingTransactionOutput[] = [
    { address: 'tb1qtest123', value: 100000, vout: 0 },
    { address: 'tb1qchange456', value: 50000, vout: 1 },
  ];

  beforeEach(() => {
    resetPendingTransactionsStore();
  });

  it('should have correct initial state', () => {
    const state = usePendingTransactionsStore.getState();
    expect(state.pendingTransactions).toEqual({});
    expect(state.spentUtxos.size).toBe(0);
    expect(state.currentAccount).toBe(0);
  });

  describe('addPendingTransaction', () => {
    it('should add transaction with correct properties', async () => {
      const { addPendingTransaction } = usePendingTransactionsStore.getState();
      const beforeAdd = Date.now();

      await act(async () => {
        await addPendingTransaction('txid123', mockOutputs, 'BTC', 'parent_txid', 100000);
      });

      const tx = usePendingTransactionsStore.getState().pendingTransactions['txid123'];
      expect(tx).toBeDefined();
      expect(tx.assetType).toBe('BTC');
      expect(tx.status).toBe('pending');
      expect(tx.sentAmount).toBe(100000);
      expect(tx.parentTxid).toBe('parent_txid');
      expect(tx.timestamp).toBeGreaterThanOrEqual(beforeAdd);
    });

    it('should track input UTXOs', async () => {
      const { addPendingTransaction } = usePendingTransactionsStore.getState();
      const inputUtxos = [{ txid: 'input_txid1', vout: 0 }, { txid: 'input_txid2', vout: 1 }];

      await act(async () => {
        await addPendingTransaction('txid789', mockOutputs, 'BTC', null, 100000, inputUtxos);
      });

      expect(usePendingTransactionsStore.getState().pendingTransactions['txid789'].inputUtxos).toEqual(inputUtxos);
    });
  });

  describe('confirmTransaction', () => {
    it('should remove confirmed transaction and clear spent UTXOs', async () => {
      const { addPendingTransaction, confirmTransaction, markUtxosAsSpent } = usePendingTransactionsStore.getState();
      const inputUtxos = [{ txid: 'spent_utxo1', vout: 0 }];

      await act(async () => {
        await markUtxosAsSpent(inputUtxos);
        await addPendingTransaction('txid_to_confirm', [], 'BTC', null, 100000, inputUtxos);
      });

      expect(usePendingTransactionsStore.getState().pendingTransactions['txid_to_confirm']).toBeDefined();
      expect(usePendingTransactionsStore.getState().spentUtxos.size).toBe(1);

      await act(async () => { await confirmTransaction('txid_to_confirm'); });

      expect(usePendingTransactionsStore.getState().pendingTransactions['txid_to_confirm']).toBeUndefined();
      expect(usePendingTransactionsStore.getState().spentUtxos.size).toBe(0);
    });
  });

  describe('invalidateTransaction', () => {
    it('should invalidate transaction and show snackbar', async () => {
      const { addPendingTransaction, invalidateTransaction } = usePendingTransactionsStore.getState();
      const mockShowSnackbar = jest.fn();

      await act(async () => { await addPendingTransaction('txid_to_invalidate', [], 'BTC'); });

      let invalidated: string[] = [];
      await act(async () => {
        invalidated = await invalidateTransaction('txid_to_invalidate', 'Test reason', mockShowSnackbar);
      });

      expect(invalidated).toContain('txid_to_invalidate');
      expect(mockShowSnackbar).toHaveBeenCalled();
    });
  });

  describe('UTXO tracking', () => {
    it('should mark and unmark UTXOs as spent', async () => {
      const { markUtxosAsSpent, unmarkUtxosAsSpent, isUtxoSpent } = usePendingTransactionsStore.getState();

      await act(async () => { await markUtxosAsSpent([{ txid: 'utxo1', vout: 0 }]); });
      expect(usePendingTransactionsStore.getState().isUtxoSpent('utxo1', 0)).toBe(true);

      await act(async () => { await unmarkUtxosAsSpent([{ txid: 'utxo1', vout: 0 }]); });
      expect(usePendingTransactionsStore.getState().isUtxoSpent('utxo1', 0)).toBe(false);
    });

    it('should return false for unspent UTXOs', () => {
      expect(usePendingTransactionsStore.getState().isUtxoSpent('nonexistent', 0)).toBe(false);
    });

    it('should return all spent UTXO keys', async () => {
      const { markUtxosAsSpent } = usePendingTransactionsStore.getState();

      await act(async () => {
        await markUtxosAsSpent([{ txid: 'txid1', vout: 0 }, { txid: 'txid2', vout: 1 }]);
      });

      const spentUtxos = usePendingTransactionsStore.getState().getSpentUtxos();
      expect(spentUtxos.has('txid1:0')).toBe(true);
      expect(spentUtxos.has('txid2:1')).toBe(true);
    });
  });

  describe('multiple transactions', () => {
    it('should handle multiple pending transactions with parent-child relationships', async () => {
      const { addPendingTransaction } = usePendingTransactionsStore.getState();

      await act(async () => {
        await addPendingTransaction('tx1', [], 'BTC', null, 10000);
        await addPendingTransaction('tx2', [], 'BTC', 'tx1', 5000);
        await addPendingTransaction('tx3', [], 'UNIT', null, 1000);
      });

      const state = usePendingTransactionsStore.getState();
      expect(Object.keys(state.pendingTransactions).length).toBe(3);
      expect(state.pendingTransactions['tx2'].parentTxid).toBe('tx1');
    });

    it('should confirm transactions independently', async () => {
      const { addPendingTransaction, confirmTransaction } = usePendingTransactionsStore.getState();

      await act(async () => {
        await addPendingTransaction('tx_a', [], 'BTC');
        await addPendingTransaction('tx_b', [], 'BTC');
        await addPendingTransaction('tx_c', [], 'BTC');
      });

      await act(async () => { await confirmTransaction('tx_b'); });

      const state = usePendingTransactionsStore.getState();
      expect(Object.keys(state.pendingTransactions).length).toBe(2);
      expect(state.pendingTransactions['tx_a']).toBeDefined();
      expect(state.pendingTransactions['tx_b']).toBeUndefined();
      expect(state.pendingTransactions['tx_c']).toBeDefined();
    });
  });

  it('should reset all state', async () => {
    const { addPendingTransaction, markUtxosAsSpent } = usePendingTransactionsStore.getState();

    await act(async () => {
      await addPendingTransaction('txid_reset', [], 'BTC');
      await markUtxosAsSpent([{ txid: 'utxo_reset', vout: 0 }]);
    });

    act(() => { resetPendingTransactionsStore(); });

    const state = usePendingTransactionsStore.getState();
    expect(state.pendingTransactions).toEqual({});
    expect(state.spentUtxos.size).toBe(0);
  });
});
