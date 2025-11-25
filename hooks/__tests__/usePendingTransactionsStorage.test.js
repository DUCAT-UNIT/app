/**
 * Tests for usePendingTransactionsStorage Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePendingTransactionsStorage } from '../usePendingTransactionsStorage';

// Helper to render hooks with react-test-renderer
function renderHook(hook, { initialProps } = {}) {
  const result = { current: null };

  function TestComponent({ hookProps }) {
    result.current = hook(hookProps);
    return null;
  }

  let component;
  act(() => {
    component = create(<TestComponent hookProps={initialProps} />);
  });

  return {
    result,
    rerender: (newProps) => {
      act(() => {
        component.update(<TestComponent hookProps={newProps} />);
      });
    },
    unmount: () => component.unmount(),
  };
}

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('usePendingTransactionsStorage', () => {
  const mockAccount = 'account_0';

  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(null);
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook((account) => usePendingTransactionsStorage(account), {
      initialProps: mockAccount,
    });

    expect(result.current.pendingTransactions).toEqual({});
    expect(result.current.spentUtxos).toBeInstanceOf(Set);
    expect(result.current.spentUtxos.size).toBe(0);
  });

  it('should load pending transactions on mount', async () => {
    const mockPendingTxs = { 'tx1': { txid: 'tx1', amount: 100000 } };
    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === `pending_txs_${mockAccount}`) {
        return Promise.resolve(JSON.stringify(mockPendingTxs));
      }
      return Promise.resolve(null);
    });

    const { result } = renderHook((account) => usePendingTransactionsStorage(account), {
      initialProps: mockAccount,
    });

    // Wait for async load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(AsyncStorage.getItem).toHaveBeenCalledWith(`pending_txs_${mockAccount}`);
    expect(result.current.pendingTransactions).toEqual(mockPendingTxs);
  });

  it('should load spent UTXOs on mount', async () => {
    const mockSpentUtxos = ['utxo1', 'utxo2', 'utxo3'];
    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === `spent_utxos_${mockAccount}`) {
        return Promise.resolve(JSON.stringify(mockSpentUtxos));
      }
      return Promise.resolve(null);
    });

    const { result } = renderHook((account) => usePendingTransactionsStorage(account), {
      initialProps: mockAccount,
    });

    // Wait for async load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(AsyncStorage.getItem).toHaveBeenCalledWith(`spent_utxos_${mockAccount}`);
    expect(result.current.spentUtxos).toBeInstanceOf(Set);
    expect(result.current.spentUtxos.has('utxo1')).toBe(true);
    expect(result.current.spentUtxos.has('utxo2')).toBe(true);
    expect(result.current.spentUtxos.has('utxo3')).toBe(true);
    expect(result.current.spentUtxos.size).toBe(3);
  });

  it('should reload when account changes', async () => {
    const mockAccount1 = 'account_0';
    const mockAccount2 = 'account_1';

    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === `pending_txs_${mockAccount1}`) {
        return Promise.resolve(JSON.stringify({ tx1: { txid: 'tx1' } }));
      }
      if (key === `pending_txs_${mockAccount2}`) {
        return Promise.resolve(JSON.stringify({ tx2: { txid: 'tx2' } }));
      }
      return Promise.resolve(null);
    });

    const { result, rerender } = renderHook((account) => usePendingTransactionsStorage(account), {
      initialProps: mockAccount1,
    });

    // Wait for first account to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.pendingTransactions).toEqual({ tx1: { txid: 'tx1' } });

    // Clear mock calls
    jest.clearAllMocks();

    // Change account
    rerender(mockAccount2);

    // Wait for second account to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(AsyncStorage.getItem).toHaveBeenCalledWith(`pending_txs_${mockAccount2}`);
    expect(result.current.pendingTransactions).toEqual({ tx2: { txid: 'tx2' } });
  });

  it('should handle missing storage data gracefully', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    const { result } = renderHook((account) => usePendingTransactionsStorage(account), {
      initialProps: mockAccount,
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.pendingTransactions).toEqual({});
    expect(result.current.spentUtxos.size).toBe(0);
  });

  it('should handle storage load errors gracefully', async () => {
    const mockError = new Error('Storage error');
    AsyncStorage.getItem.mockRejectedValue(mockError);

    const { result } = renderHook((account) => usePendingTransactionsStorage(account), {
      initialProps: mockAccount,
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Should still have initial state
    expect(result.current.pendingTransactions).toEqual({});
    expect(result.current.spentUtxos.size).toBe(0);
  });

  it('should save pending transactions', async () => {
    const { result } = renderHook((account) => usePendingTransactionsStorage(account), {
      initialProps: mockAccount,
    });

    const newTxs = { tx1: { txid: 'tx1', amount: 100000 } };

    await act(async () => {
      await result.current.savePendingTransactions(newTxs);
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      `pending_txs_${mockAccount}`,
      JSON.stringify(newTxs)
    );
  });

  it('should save spent UTXOs', async () => {
    const { result } = renderHook((account) => usePendingTransactionsStorage(account), {
      initialProps: mockAccount,
    });

    const newSpent = new Set(['utxo1', 'utxo2']);

    await act(async () => {
      await result.current.saveSpentUtxos(newSpent);
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      `spent_utxos_${mockAccount}`,
      JSON.stringify(['utxo1', 'utxo2'])
    );
  });

  it('should handle save errors gracefully', async () => {
    AsyncStorage.setItem.mockRejectedValue(new Error('Save error'));

    const { result } = renderHook((account) => usePendingTransactionsStorage(account), {
      initialProps: mockAccount,
    });

    // Should not throw
    await act(async () => {
      await result.current.savePendingTransactions({ tx1: {} });
      await result.current.saveSpentUtxos(new Set(['utxo1']));
    });

    // Errors should be logged but not thrown
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('should update pending transactions state', () => {
    const { result } = renderHook((account) => usePendingTransactionsStorage(account), {
      initialProps: mockAccount,
    });

    const newTxs = { tx1: { txid: 'tx1' } };

    act(() => {
      result.current.setPendingTransactions(newTxs);
    });

    expect(result.current.pendingTransactions).toEqual(newTxs);
  });

  it('should update spent UTXOs state', () => {
    const { result } = renderHook((account) => usePendingTransactionsStorage(account), {
      initialProps: mockAccount,
    });

    const newSpent = new Set(['utxo1', 'utxo2']);

    act(() => {
      result.current.setSpentUtxos(newSpent);
    });

    expect(result.current.spentUtxos).toEqual(newSpent);
  });

  it('should not load when account is null', async () => {
    renderHook((account) => usePendingTransactionsStorage(account), {
      initialProps: null,
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });

  it('should return all expected properties', () => {
    const { result } = renderHook((account) => usePendingTransactionsStorage(account), {
      initialProps: mockAccount,
    });

    expect(result.current).toHaveProperty('pendingTransactions');
    expect(result.current).toHaveProperty('setPendingTransactions');
    expect(result.current).toHaveProperty('savePendingTransactions');
    expect(result.current).toHaveProperty('spentUtxos');
    expect(result.current).toHaveProperty('setSpentUtxos');
    expect(result.current).toHaveProperty('saveSpentUtxos');
    expect(typeof result.current.setPendingTransactions).toBe('function');
    expect(typeof result.current.savePendingTransactions).toBe('function');
    expect(typeof result.current.setSpentUtxos).toBe('function');
    expect(typeof result.current.saveSpentUtxos).toBe('function');
  });
});
