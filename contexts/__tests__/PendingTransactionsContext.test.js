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

// Mock SecureStore
jest.mock('expo-secure-store');

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
  const mockShowToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue();
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
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showToast={mockShowToast}>
        {children}
      </PendingTransactionsProvider>
    );
    const { result } = renderHook(() => usePendingTransactions(), { wrapper });

    expect(result.current.pendingTransactions).toEqual({});
    expect(typeof result.current.addPendingTransaction).toBe('function');
    expect(typeof result.current.confirmTransaction).toBe('function');
    expect(typeof result.current.invalidateTransaction).toBe('function');
    expect(typeof result.current.getUnconfirmedUTXOs).toBe('function');
    expect(typeof result.current.getUnconfirmedBalance).toBe('function');
    expect(typeof result.current.cleanupInvalidTransactions).toBe('function');
  });

  it('should add pending transaction', async () => {
    const wrapper = ({ children }) => (
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showToast={mockShowToast}>
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
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showToast={mockShowToast}>
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
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showToast={mockShowToast}>
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
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showToast={mockShowToast}>
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

  it('should invalidate child transactions', async () => {
    const wrapper = ({ children }) => (
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showToast={mockShowToast}>
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
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showToast={mockShowToast}>
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
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showToast={mockShowToast}>
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
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showToast={mockShowToast}>
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
      <PendingTransactionsProvider currentAccount={mockCurrentAccount} showToast={mockShowToast}>
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
    expect(result.current.pendingTransactions['invalid_tx']).toBeUndefined();
  });
});
