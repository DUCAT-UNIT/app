/**
 * Tests for pendingTransactionsStore
 * Consolidated to test meaningful behavior - transaction lifecycle, UTXO tracking
 */

import { act } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import {
  usePendingTransactionsStore,
  resetPendingTransactionsStore,
  type PendingTransactionOutput,
} from '../pendingTransactionsStore';
import {
  resetOperationJournalStore,
  useOperationJournalStore,
} from '../operationJournalStore';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
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
  getPendingInputUtxoKeys: jest.fn((txs) => {
    const keys = new Set<string>();
    Object.values(txs as Record<string, { status: string; inputUtxos?: Array<{ txid: string; vout: number }> }>).forEach((tx) => {
      if (tx.status !== 'pending') return;
      tx.inputUtxos?.forEach((u) => keys.add(`${u.txid}:${u.vout}`));
    });
    return keys;
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
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    resetOperationJournalStore();
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
      const inputUtxos = [
        { txid: 'input_txid1', vout: 0 },
        { txid: 'input_txid2', vout: 1 },
      ];

      await act(async () => {
        await addPendingTransaction('txid789', mockOutputs, 'BTC', null, 100000, inputUtxos);
      });

      expect(
        usePendingTransactionsStore.getState().pendingTransactions['txid789'].inputUtxos
      ).toEqual(inputUtxos);
      expect(usePendingTransactionsStore.getState().spentUtxos.has('input_txid1:0')).toBe(true);
      expect(usePendingTransactionsStore.getState().spentUtxos.has('input_txid2:1')).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'spent_utxos_0',
        expect.stringContaining('input_txid1:0'),
        expect.any(Object),
      );
    });
  });

  describe('loadFromStorage', () => {
    it('hydrates persisted data for account 0 on cold startup', async () => {
      const persistedTx = {
        cold_txid: {
          txid: 'cold_txid',
          outputs: mockOutputs,
          parentTxid: null,
          assetType: 'BTC',
          status: 'pending',
          timestamp: Date.now(),
          sentAmount: 12345,
          inputUtxos: [{ txid: 'input_txid', vout: 0 }],
        },
      };

      (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
        if (key === 'pending_txs_0') return JSON.stringify(persistedTx);
        if (key === 'spent_utxos_0') return JSON.stringify(['input_txid:0']);
        return null;
      });

      await act(async () => {
        await usePendingTransactionsStore.getState().loadFromStorage(0);
      });

      const state = usePendingTransactionsStore.getState();
      expect(state.pendingTransactions.cold_txid).toEqual(persistedTx.cold_txid);
      expect(state.pendingTransactions.cold_txid.sentAmount).toBe(12345);
      expect(state.spentUtxos.has('input_txid:0')).toBe(true);
      expect(state.hydratedAccount).toBe(0);
      expect(useOperationJournalStore.getState().entries).toEqual([
        expect.objectContaining({
          id: 'btc-send:0:cold_txid',
          accountIndex: 0,
          kind: 'btc_send',
          stage: 'pending',
          label: 'BTC send submitted',
          retrySafety: 'unsafe_until_checked',
          txids: ['cold_txid'],
          asset: 'BTC',
          amount: '12345',
          recoveryAction: 'Wait for Mutinynet confirmation before spending the same funds again.',
        }),
      ]);
    });

    it('derives missing spent locks from persisted pending transaction inputs', async () => {
      const persistedTx = {
        cold_txid: {
          txid: 'cold_txid',
          outputs: mockOutputs,
          parentTxid: null,
          assetType: 'BTC',
          status: 'pending',
          timestamp: Date.now(),
          inputUtxos: [{ txid: 'input_txid', vout: 0 }],
        },
      };

      (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
        if (key === 'pending_txs_0') return JSON.stringify(persistedTx);
        if (key === 'spent_utxos_0') return null;
        return null;
      });

      await act(async () => {
        await usePendingTransactionsStore.getState().loadFromStorage(0);
      });

      expect(usePendingTransactionsStore.getState().spentUtxos.has('input_txid:0')).toBe(true);
    });

    it('auto-cleans persisted pending transactions older than three minutes', async () => {
      const now = Date.UTC(2026, 4, 17, 12, 0, 0);
      const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
      const persistedTx = {
        expired_txid: {
          txid: 'expired_txid',
          outputs: mockOutputs,
          parentTxid: null,
          assetType: 'BTC',
          status: 'pending',
          timestamp: now - 181_000,
          inputUtxos: [{ txid: 'expired_input_txid', vout: 0 }],
        },
      };

      (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
        if (key === 'pending_txs_0') return JSON.stringify(persistedTx);
        if (key === 'spent_utxos_0') return JSON.stringify(['expired_input_txid:0']);
        return null;
      });

      try {
        await act(async () => {
          await usePendingTransactionsStore.getState().loadFromStorage(0);
        });
      } finally {
        dateNowSpy.mockRestore();
      }

      const state = usePendingTransactionsStore.getState();
      expect(state.pendingTransactions).toEqual({});
      expect(state.spentUtxos.has('expired_input_txid:0')).toBe(false);
      expect(state.hydratedAccount).toBe(0);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'spent_utxos_0',
        '[]',
        expect.any(Object),
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'pending_txs_0',
        '{}',
        expect.any(Object),
      );
    });

    it('does not hydrate or overwrite corrupt pending transaction storage', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
        if (key === 'pending_txs_0') return '{bad json';
        return null;
      });

      await act(async () => {
        await usePendingTransactionsStore.getState().loadFromStorage(0);
      });

      expect(usePendingTransactionsStore.getState().hydratedAccount).toBeNull();
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^pending_txs_0_corrupt_/),
        '{bad json',
        expect.any(Object),
      );

      await expect(
        usePendingTransactionsStore
          .getState()
          .addPendingTransaction('new_txid', mockOutputs, 'BTC')
      ).rejects.toThrow('refusing to mutate pending locks');

      expect((SecureStore.setItemAsync as jest.Mock).mock.calls.some(
        ([key]) => key === 'pending_txs_0',
      )).toBe(false);
    });

    it('does not hydrate or overwrite corrupt spent UTXO storage', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
        if (key === 'spent_utxos_0') return '{"bad":"shape"}';
        return null;
      });

      await act(async () => {
        await usePendingTransactionsStore.getState().loadFromStorage(0);
      });

      expect(usePendingTransactionsStore.getState().hydratedAccount).toBeNull();
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^spent_utxos_0_corrupt_/),
        '{"bad":"shape"}',
        expect.any(Object),
      );

      await expect(
        usePendingTransactionsStore
          .getState()
          .markUtxosAsSpent([{ txid: 'utxo1', vout: 0 }])
      ).rejects.toThrow('refusing to mutate pending locks');

      expect((SecureStore.setItemAsync as jest.Mock).mock.calls.some(
        ([key]) => key === 'spent_utxos_0',
      )).toBe(false);
    });
  });

  describe('confirmTransaction', () => {
    it('should remove confirmed transaction and clear spent UTXOs', async () => {
      const { addPendingTransaction, confirmTransaction, markUtxosAsSpent } =
        usePendingTransactionsStore.getState();
      const inputUtxos = [{ txid: 'spent_utxo1', vout: 0 }];

      await act(async () => {
        await markUtxosAsSpent(inputUtxos);
        await addPendingTransaction('txid_to_confirm', [], 'BTC', null, 100000, inputUtxos);
      });

      expect(
        usePendingTransactionsStore.getState().pendingTransactions['txid_to_confirm']
      ).toBeDefined();
      expect(usePendingTransactionsStore.getState().spentUtxos.size).toBe(1);

      await act(async () => {
        await confirmTransaction('txid_to_confirm');
      });

      expect(
        usePendingTransactionsStore.getState().pendingTransactions['txid_to_confirm']
      ).toBeUndefined();
      expect(usePendingTransactionsStore.getState().spentUtxos.size).toBe(0);
    });
  });

  describe('invalidateTransaction', () => {
    it('should invalidate transaction and show snackbar', async () => {
      const mockShowSnackbar = jest.fn();
      jest.doMock('../notificationStore', () => ({
        useNotificationStore: { getState: () => ({ showSnackbar: mockShowSnackbar }) },
      }));

      const { addPendingTransaction, invalidateTransaction } =
        usePendingTransactionsStore.getState();

      await act(async () => {
        await addPendingTransaction('txid_to_invalidate', [], 'BTC');
      });

      let invalidated: string[] = [];
      await act(async () => {
        invalidated = await invalidateTransaction('txid_to_invalidate', 'Test reason');
      });

      expect(invalidated).toContain('txid_to_invalidate');
      expect(mockShowSnackbar).toHaveBeenCalled();
    });

    it('should release spent input locks for invalidated transactions', async () => {
      const { addPendingTransaction, invalidateTransaction, markUtxosAsSpent, isUtxoSpent } =
        usePendingTransactionsStore.getState();
      const inputUtxos = [{ txid: 'invalidated_input', vout: 0 }];

      await act(async () => {
        await markUtxosAsSpent(inputUtxos);
        await addPendingTransaction('txid_to_invalidate', [], 'BTC', null, 100000, inputUtxos);
      });

      expect(isUtxoSpent('invalidated_input', 0)).toBe(true);

      await act(async () => {
        await invalidateTransaction('txid_to_invalidate', 'Test reason');
      });

      expect(usePendingTransactionsStore.getState().isUtxoSpent('invalidated_input', 0)).toBe(false);
    });

    it('should persist spent lock removal before pending invalidation', async () => {
      const { addPendingTransaction, invalidateTransaction, markUtxosAsSpent } =
        usePendingTransactionsStore.getState();
      const inputUtxos = [{ txid: 'ordering_input', vout: 0 }];

      await act(async () => {
        await markUtxosAsSpent(inputUtxos);
        await addPendingTransaction('txid_to_invalidate', [], 'BTC', null, 100000, inputUtxos);
      });

      (SecureStore.setItemAsync as jest.Mock).mockClear();

      await act(async () => {
        await invalidateTransaction('txid_to_invalidate', 'Test reason');
      });

      const keys = (SecureStore.setItemAsync as jest.Mock).mock.calls.map(([key]) => key);
      expect(keys.indexOf('spent_utxos_0')).toBeGreaterThanOrEqual(0);
      expect(keys.indexOf('pending_txs_0')).toBeGreaterThanOrEqual(0);
      expect(keys.indexOf('spent_utxos_0')).toBeLessThan(keys.indexOf('pending_txs_0'));
    });
  });

  describe('UTXO tracking', () => {
    it('should mark and unmark UTXOs as spent', async () => {
      const { markUtxosAsSpent, unmarkUtxosAsSpent, isUtxoSpent } =
        usePendingTransactionsStore.getState();

      await act(async () => {
        await markUtxosAsSpent([{ txid: 'utxo1', vout: 0 }]);
      });
      expect(usePendingTransactionsStore.getState().isUtxoSpent('utxo1', 0)).toBe(true);

      await act(async () => {
        await unmarkUtxosAsSpent([{ txid: 'utxo1', vout: 0 }]);
      });
      expect(usePendingTransactionsStore.getState().isUtxoSpent('utxo1', 0)).toBe(false);
    });

    it('should return false for unspent UTXOs', () => {
      expect(usePendingTransactionsStore.getState().isUtxoSpent('nonexistent', 0)).toBe(false);
    });

    it('should return all spent UTXO keys', async () => {
      const { markUtxosAsSpent } = usePendingTransactionsStore.getState();

      await act(async () => {
        await markUtxosAsSpent([
          { txid: 'txid1', vout: 0 },
          { txid: 'txid2', vout: 1 },
        ]);
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

      await act(async () => {
        await confirmTransaction('tx_b');
      });

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

    act(() => {
      resetPendingTransactionsStore();
    });

    const state = usePendingTransactionsStore.getState();
    expect(state.pendingTransactions).toEqual({});
    expect(state.spentUtxos.size).toBe(0);
  });
});
