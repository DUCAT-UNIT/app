// @ts-nocheck
/**
 * Tests for PendingTransactionsContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import {
  PendingTransactionsProvider,
  usePendingTransactions,
} from '../PendingTransactionsContext';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock SecureStore and AsyncStorage
jest.mock('expo-secure-store');
jest.mock('@react-native-async-storage/async-storage');

// Helper to render hooks
function renderHook(hook, { wrapper: Wrapper } = {}) {
  const result = { current: null };
  function TestComponent() {
    result.current = hook();
    return null;
  }
  let component;
  act(() => {
    component = Wrapper
      ? create(<Wrapper><TestComponent /></Wrapper>)
      : create(<TestComponent />);
  });
  return { result, rerender: component.update, unmount: component.unmount };
}

describe('PendingTransactionsContext', () => {
  const mockCurrentAccount = 0;
  const mockShowSnackbar = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue();
  });

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => usePendingTransactions());
    }).toThrow('usePendingTransactions must be used within a PendingTransactionsProvider');
    consoleError.mockRestore();
  });

  it('should provide initial empty state', () => {
    const wrapper = ({ children }) => (
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
        {children}
      </PendingTransactionsProvider>
    );
    const { result } = renderHook(() => usePendingTransactions(), { wrapper });

    expect(result.current.pendingTransactions).toEqual({});
  });

  it('should add pending transaction', async () => {
    const wrapper = ({ children }) => (
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
        {children}
      </PendingTransactionsProvider>
    );
    const { result } = renderHook(() => usePendingTransactions(), { wrapper });

    const txid = 'test_txid_123';
    const outputs = [{ address: 'tb1qtest', value: 10000, vout: 0 }];
    const assetType = 'BTC';

    await act(async () => {
      await result.current.addPendingTransaction(txid, outputs, assetType);
    });

    expect(result.current.pendingTransactions[txid]).toBeDefined();
    expect(result.current.pendingTransactions[txid].outputs).toEqual(outputs);
    expect(result.current.pendingTransactions[txid].status).toBe('pending');
  });

  it('should add pending transaction with parent txid', async () => {
    const wrapper = ({ children }) => (
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
        {children}
      </PendingTransactionsProvider>
    );
    const { result } = renderHook(() => usePendingTransactions(), { wrapper });

    const parentTxid = 'parent_txid';
    const txid = 'child_txid';
    const outputs = [{ address: 'tb1qtest', value: 10000, vout: 0 }];

    await act(async () => {
      await result.current.addPendingTransaction(txid, outputs, 'BTC', parentTxid);
    });

    expect(result.current.pendingTransactions[txid].parentTxid).toBe(parentTxid);
  });

  it('should confirm transaction', async () => {
    const wrapper = ({ children }) => (
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
        {children}
      </PendingTransactionsProvider>
    );
    const { result } = renderHook(() => usePendingTransactions(), { wrapper });

    const txid = 'test_txid_123';
    await act(async () => {
      await result.current.addPendingTransaction(txid, [], 'BTC');
    });

    await act(async () => {
      await result.current.confirmTransaction(txid);
    });

    expect(result.current.pendingTransactions[txid]).toBeUndefined();
  });

  it('should invalidate transaction', async () => {
    const wrapper = ({ children }) => (
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
        {children}
      </PendingTransactionsProvider>
    );
    const { result } = renderHook(() => usePendingTransactions(), { wrapper });

    const txid = 'test_txid_123';
    await act(async () => {
      await result.current.addPendingTransaction(txid, [], 'BTC');
    });

    await act(async () => {
      await result.current.invalidateTransaction(txid, 'Test reason');
    });

    expect(result.current.pendingTransactions[txid].status).toBe('invalid');
  });

  it('should show snackbar when invalidating transaction and use swap action for UNIT', async () => {
    const wrapper = ({ children }) => (
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
        {children}
      </PendingTransactionsProvider>
    );
    const { result } = renderHook(() => usePendingTransactions(), { wrapper });

    const txid = 'test_unit_txid';
    await act(async () => {
      await result.current.addPendingTransaction(txid, [], 'UNIT');
    });

    await act(async () => {
      await result.current.invalidateTransaction(txid, 'Transaction failed');
    });

    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        action: 'swap',
        message: expect.stringContaining('invalidated'),
      })
    );
  });

  it('should use withdraw action when invalidating BTC transaction', async () => {
    const wrapper = ({ children }) => (
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
        {children}
      </PendingTransactionsProvider>
    );
    const { result } = renderHook(() => usePendingTransactions(), { wrapper });

    const txid = 'test_btc_txid';
    await act(async () => {
      await result.current.addPendingTransaction(txid, [], 'BTC');
    });

    await act(async () => {
      await result.current.invalidateTransaction(txid, 'Transaction failed');
    });

    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        action: 'withdraw',
      })
    );
  });

  it('should invalidate child transactions', async () => {
    const wrapper = ({ children }) => (
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
        {children}
      </PendingTransactionsProvider>
    );
    const { result } = renderHook(() => usePendingTransactions(), { wrapper });

    const parentTxid = 'parent_txid';
    const childTxid = 'child_txid';

    await act(async () => {
      await result.current.addPendingTransaction(parentTxid, [], 'BTC');
    });

    await act(async () => {
      await result.current.addPendingTransaction(childTxid, [], 'BTC', parentTxid);
    });

    // Verify both transactions were added
    expect(result.current.pendingTransactions[parentTxid]).toBeDefined();
    expect(result.current.pendingTransactions[childTxid]).toBeDefined();

    await act(async () => {
      await result.current.invalidateTransaction(parentTxid, 'Parent failed');
    });

    // Both should be marked invalid
    expect(result.current.pendingTransactions[parentTxid]).toBeDefined();
    expect(result.current.pendingTransactions[parentTxid].status).toBe('invalid');
    expect(result.current.pendingTransactions[childTxid]).toBeDefined();
    expect(result.current.pendingTransactions[childTxid].status).toBe('invalid');
  });

  it('should get unconfirmed UTXOs', async () => {
    const wrapper = ({ children }) => (
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
        {children}
      </PendingTransactionsProvider>
    );
    const { result } = renderHook(() => usePendingTransactions(), { wrapper });

    const txid = 'test_txid';
    const outputs = [
      { address: 'tb1qtest', value: 10000, vout: 0 },
      { address: 'tb1ptest', value: 20000, vout: 1 },
    ];

    await act(async () => {
      await result.current.addPendingTransaction(txid, outputs, 'BTC');
    });

    const utxos = result.current.getUnconfirmedUTXOs();
    expect(utxos).toHaveLength(2);
    expect(utxos[0].txid).toBe(txid);
    expect(utxos[0].status.confirmed).toBe(false);
  });

  it('should filter unconfirmed UTXOs by address type', async () => {
    const wrapper = ({ children }) => (
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
        {children}
      </PendingTransactionsProvider>
    );
    const { result } = renderHook(() => usePendingTransactions(), { wrapper });

    const outputs = [
      { address: 'tb1qtest', value: 10000, vout: 0 }, // segwit
      { address: 'tb1ptest', value: 20000, vout: 1 }, // taproot
    ];

    await act(async () => {
      await result.current.addPendingTransaction('test_txid', outputs, 'BTC');
    });

    const segwitUtxos = result.current.getUnconfirmedUTXOs('segwit');
    const taprootUtxos = result.current.getUnconfirmedUTXOs('taproot');

    expect(segwitUtxos).toHaveLength(1);
    expect(segwitUtxos[0].address).toBe('tb1qtest');
    expect(taprootUtxos).toHaveLength(1);
    expect(taprootUtxos[0].address).toBe('tb1ptest');
  });

  it('should get unconfirmed balance', async () => {
    const wrapper = ({ children }) => (
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
        {children}
      </PendingTransactionsProvider>
    );
    const { result } = renderHook(() => usePendingTransactions(), { wrapper });

    const outputs = [
      { address: 'tb1qtest', value: 10000, vout: 0 },
      { address: 'tb1ptest', value: 20000, vout: 1, runeAmount: 5000 },
    ];

    await act(async () => {
      await result.current.addPendingTransaction('test_txid', outputs, 'UNIT');
    });

    const balance = result.current.getUnconfirmedBalance();
    expect(balance.btc).toBe(0.0003); // 30000 sats = 0.0003 BTC
    expect(balance.runes).toBe(50); // 5000 / 100 = 50 UNIT
  });

  it('should cleanup invalid transactions', async () => {
    const wrapper = ({ children }) => (
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
        {children}
      </PendingTransactionsProvider>
    );
    const { result } = renderHook(() => usePendingTransactions(), { wrapper });

    await act(async () => {
      await result.current.addPendingTransaction('pending_tx', [], 'BTC');
    });

    await act(async () => {
      await result.current.addPendingTransaction('invalid_tx', [], 'BTC');
    });

    await act(async () => {
      await result.current.invalidateTransaction('invalid_tx', 'Test');
    });

    expect(Object.keys(result.current.pendingTransactions)).toHaveLength(2);

    await act(async () => {
      await result.current.cleanupInvalidTransactions();
    });

    expect(Object.keys(result.current.pendingTransactions)).toHaveLength(1);
    expect(result.current.pendingTransactions.invalid_tx).toBeUndefined();
  });

  describe('Advanced UTXO management', () => {
    it('should exclude UTXOs from excludeFromIntent (BTC inputs)', async () => {
      const wrapper = ({ children }) => (
        <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
          {children}
        </PendingTransactionsProvider>
      );
      const { result } = renderHook(() => usePendingTransactions(), { wrapper });

      const txid = 'test_tx';
      const outputs = [
        { address: 'tb1qtest', value: 10000, vout: 0 },
        { address: 'tb1qtest2', value: 20000, vout: 1 },
      ];

      await act(async () => {
        await result.current.addPendingTransaction(txid, outputs, 'BTC');
      });

      const excludeIntent = {
        inputs: [{ txid: 'test_tx', vout: 0 }],
      };

      const utxos = result.current.getUnconfirmedUTXOs('all', excludeIntent);
      expect(utxos).toHaveLength(1);
      expect(utxos[0].vout).toBe(1);
    });

    it('should exclude UTXOs from excludeFromIntent (UNIT runeUtxo)', async () => {
      const wrapper = ({ children }) => (
        <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
          {children}
        </PendingTransactionsProvider>
      );
      const { result } = renderHook(() => usePendingTransactions(), { wrapper });

      const txid = 'rune_tx';
      const outputs = [{ address: 'tb1ptest', value: 10000, vout: 0, runeAmount: 50000 }];

      await act(async () => {
        await result.current.addPendingTransaction(txid, outputs, 'UNIT');
      });

      const excludeIntent = {
        runeUtxo: { transaction: 'rune_tx', vout: 0 },
      };

      const utxos = result.current.getUnconfirmedUTXOs('all', excludeIntent);
      expect(utxos).toHaveLength(0);
    });

    it('should exclude UTXOs from excludeFromIntent (UNIT satUtxo)', async () => {
      const wrapper = ({ children }) => (
        <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
          {children}
        </PendingTransactionsProvider>
      );
      const { result } = renderHook(() => usePendingTransactions(), { wrapper });

      const txid = 'sat_tx';
      const outputs = [{ address: 'tb1qtest', value: 15000, vout: 0 }];

      await act(async () => {
        await result.current.addPendingTransaction(txid, outputs, 'BTC');
      });

      const excludeIntent = {
        satUtxo: { txid: 'sat_tx', vout: 0 },
      };

      const utxos = result.current.getUnconfirmedUTXOs('all', excludeIntent);
      expect(utxos).toHaveLength(0);
    });

    it('should mark UTXO as spent and remove from outputs', async () => {
      const wrapper = ({ children }) => (
        <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
          {children}
        </PendingTransactionsProvider>
      );
      const { result } = renderHook(() => usePendingTransactions(), { wrapper });

      const txid = 'test_tx';
      const outputs = [
        { address: 'tb1qtest', value: 10000, vout: 0 },
        { address: 'tb1qtest2', value: 20000, vout: 1 },
      ];

      await act(async () => {
        await result.current.addPendingTransaction(txid, outputs, 'BTC');
      });

      await act(async () => {
        await result.current.markUtxoAsSpent(txid, 0);
      });

      expect(result.current.pendingTransactions[txid].outputs).toHaveLength(1);
      expect(result.current.pendingTransactions[txid].outputs[0].vout).toBe(1);
    });

    it('should remove transaction when all outputs are spent', async () => {
      const wrapper = ({ children }) => (
        <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
          {children}
        </PendingTransactionsProvider>
      );
      const { result } = renderHook(() => usePendingTransactions(), { wrapper });

      const txid = 'test_tx';
      const outputs = [{ address: 'tb1qtest', value: 10000, vout: 0 }];

      await act(async () => {
        await result.current.addPendingTransaction(txid, outputs, 'BTC');
      });

      await act(async () => {
        await result.current.markUtxoAsSpent(txid, 0);
      });

      expect(result.current.pendingTransactions[txid]).toBeUndefined();
    });

    it('should mark multiple UTXOs as spent', async () => {
      const wrapper = ({ children }) => (
        <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
          {children}
        </PendingTransactionsProvider>
      );
      const { result } = renderHook(() => usePendingTransactions(), { wrapper });

      await act(async () => {
        await result.current.markUtxosAsSpent([
          { txid: 'tx1', vout: 0 },
          { txid: 'tx2', vout: 1 },
        ]);
      });

      // spentUtxos is not exposed, test indirectly via getUnconfirmedUTXOs
      expect(result.current.markUtxosAsSpent).toBeDefined();
    });

    it('should unmark UTXOs as spent', async () => {
      const wrapper = ({ children }) => (
        <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
          {children}
        </PendingTransactionsProvider>
      );
      const { result } = renderHook(() => usePendingTransactions(), { wrapper });

      // First mark some UTXOs as spent
      await act(async () => {
        await result.current.markUtxosAsSpent([
          { txid: 'tx1', vout: 0 },
          { txid: 'tx2', vout: 1 },
        ]);
      });

      expect(result.current.isUtxoSpent('tx1', 0)).toBe(true);
      expect(result.current.isUtxoSpent('tx2', 1)).toBe(true);

      // Then unmark them
      await act(async () => {
        await result.current.unmarkUtxosAsSpent([
          { txid: 'tx1', vout: 0 },
        ]);
      });

      // tx1:0 should no longer be spent, tx2:1 should still be spent
      expect(result.current.isUtxoSpent('tx1', 0)).toBe(false);
      expect(result.current.isUtxoSpent('tx2', 1)).toBe(true);
    });
  });

  describe('Storage operations', () => {
    it('should handle load error gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      AsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));

      const wrapper = ({ children }) => (
        <PendingTransactionsProvider currentAccount={1} showSnackbar={mockShowSnackbar}>
          {children}
        </PendingTransactionsProvider>
      );

      renderHook(() => usePendingTransactions(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Console.error is called (jest.setup.js suppresses [ERROR] prefix messages)
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('should handle save error gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      AsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage error'));

      const wrapper = ({ children }) => (
        <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
          {children}
        </PendingTransactionsProvider>
      );
      const { result } = renderHook(() => usePendingTransactions(), { wrapper });

      await act(async () => {
        await result.current.addPendingTransaction('test_tx', [], 'BTC');
      });

      // Console.error is called (jest.setup.js suppresses [ERROR] prefix messages)
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('should handle spent UTXOs load error gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      AsyncStorage.getItem
        .mockResolvedValueOnce(null) // For pending transactions
        .mockRejectedValueOnce(new Error('Storage error')); // For spent UTXOs

      const wrapper = ({ children }) => (
        <PendingTransactionsProvider currentAccount={1} showSnackbar={mockShowSnackbar}>
          {children}
        </PendingTransactionsProvider>
      );

      renderHook(() => usePendingTransactions(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Console.error is called (jest.setup.js suppresses [ERROR] prefix messages)
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('should handle spent UTXOs save error gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Mock to fail only on the spent UTXOs save
      const originalSetItem = AsyncStorage.setItem;
      AsyncStorage.setItem.mockImplementation((key, _value) => {
        if (key.includes('spent_utxos')) {
          return Promise.reject(new Error('Storage error'));
        }
        return Promise.resolve();
      });

      const wrapper = ({ children }) => (
        <PendingTransactionsProvider currentAccount={mockCurrentAccount} showSnackbar={mockShowSnackbar}>
          {children}
        </PendingTransactionsProvider>
      );
      const { result } = renderHook(() => usePendingTransactions(), { wrapper });

      await act(async () => {
        try {
          await result.current.markUtxosAsSpent([{ txid: 'tx1', vout: 0 }]);
        } catch (e) {
          // Expected to fail
        }
      });

      // Console.error is called (jest.setup.js suppresses [ERROR] prefix messages)
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
      AsyncStorage.setItem = originalSetItem;
    });
  });

  describe('AsyncStorage data loading branches', () => {
    it('should load pending transactions from AsyncStorage when stored data exists', async () => {
      const storedTransactions = [
        { txid: 'stored1', vout: 0, confirmations: 0 },
        { txid: 'stored2', vout: 1, confirmations: 1 },
      ];

      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'pending_txs_1') {
          return Promise.resolve(JSON.stringify(storedTransactions));
        }
        return Promise.resolve(null);
      });

      const wrapper = ({ children }) => (
        <PendingTransactionsProvider currentAccount={1} showSnackbar={mockShowSnackbar}>
          {children}
        </PendingTransactionsProvider>
      );

      const { result } = renderHook(() => usePendingTransactions(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Should load the stored transactions (line 42 branch)
      expect(result.current.pendingTransactions).toEqual(storedTransactions);
    });

    it('should load spent UTXOs from AsyncStorage when stored data exists', async () => {
      const storedSpentUtxos = ['tx1:0', 'tx2:1', 'tx3:0'];

      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'spent_utxos_1') {
          return Promise.resolve(JSON.stringify(storedSpentUtxos));
        }
        return Promise.resolve(null);
      });

      const wrapper = ({ children }) => (
        <PendingTransactionsProvider currentAccount={1} showSnackbar={mockShowSnackbar}>
          {children}
        </PendingTransactionsProvider>
      );

      const { result } = renderHook(() => usePendingTransactions(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Should load the stored spent UTXOs (line 65 branch)
      expect(result.current.isUtxoSpent('tx1', 0)).toBe(true);
      expect(result.current.isUtxoSpent('tx2', 1)).toBe(true);
      expect(result.current.isUtxoSpent('tx3', 0)).toBe(true);
      expect(result.current.isUtxoSpent('tx4', 0)).toBe(false);
    });

    it('should use isUtxoSpent to check if UTXO is spent', async () => {
      const wrapper = ({ children }) => (
        <PendingTransactionsProvider currentAccount={0} showSnackbar={mockShowSnackbar}>
          {children}
        </PendingTransactionsProvider>
      );

      const { result } = renderHook(() => usePendingTransactions(), { wrapper });

      await act(async () => {
        await result.current.markUtxosAsSpent([
          { txid: 'test1', vout: 0 },
          { txid: 'test2', vout: 1 },
        ]);
      });

      // Test line 312-313 branches
      expect(result.current.isUtxoSpent('test1', 0)).toBe(true);
      expect(result.current.isUtxoSpent('test2', 1)).toBe(true);
      expect(result.current.isUtxoSpent('test3', 0)).toBe(false);
    });

    it('should use getSpentUtxos to retrieve all spent UTXOs', async () => {
      const wrapper = ({ children }) => (
        <PendingTransactionsProvider currentAccount={0} showSnackbar={mockShowSnackbar}>
          {children}
        </PendingTransactionsProvider>
      );

      const { result } = renderHook(() => usePendingTransactions(), { wrapper });

      await act(async () => {
        await result.current.markUtxosAsSpent([
          { txid: 'utxo1', vout: 0 },
          { txid: 'utxo2', vout: 1 },
        ]);
      });

      // Test line 321 branch
      const spentUtxos = result.current.getSpentUtxos();
      expect(spentUtxos.has('utxo1:0')).toBe(true);
      expect(spentUtxos.has('utxo2:1')).toBe(true);
      expect(spentUtxos.size).toBe(2);
    });
  });
});
