// @ts-nocheck
/**
 * Tests for useTransactionHistoryFetch hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useTransactionHistoryFetch } from '../useTransactionHistoryFetch';
import * as transactionHistoryService from '../../services/transactionHistoryService';

// Mock transaction history service
jest.mock('../../services/transactionHistoryService');

// Helper to render hooks
function renderHook(hook, props) {
  const result = { current: null };
  function TestComponent() {
    result.current = hook(props);
    return null;
  }
  let component;
  act(() => {
    component = create(<TestComponent />);
  });
  return {
    result,
    unmount: () => component.unmount(),
  };
}

describe('useTransactionHistoryFetch', () => {
  const mockWallet = {
    segwitAddress: 'bc1qtest',
    taprootAddress: 'bc1ptest',
    taprootPubkey: 'pubkey123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useTransactionHistoryFetch(mockWallet));

    expect(result.current.transactionHistory).toEqual([]);
    expect(result.current.loadingTransactionHistory).toBe(false);
    expect(result.current.historyError).toBe(null);
  });

  it('should fetch transaction history successfully', async () => {
    const mockHistory = [
      {
        txid: 'tx1',
        confirmations: 6,
        value: 100000,
        timestamp: 1234567890,
      },
      {
        txid: 'tx2',
        confirmations: 0,
        value: 50000,
        timestamp: null,
      },
    ];

    transactionHistoryService.fetchAllTransactionHistory.mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useTransactionHistoryFetch(mockWallet));

    await act(async () => {
      await result.current.fetchTransactionHistory();
    });

    expect(result.current.transactionHistory).toEqual(mockHistory);
    expect(result.current.historyError).toBe(null);
    expect(result.current.loadingTransactionHistory).toBe(false);
  });

  it('should handle transaction history fetch error', async () => {
    transactionHistoryService.fetchAllTransactionHistory.mockRejectedValue(
      new Error('API error')
    );

    const { result } = renderHook(() => useTransactionHistoryFetch(mockWallet));

    await act(async () => {
      await result.current.fetchTransactionHistory();
    });

    expect(result.current.historyError).toBe('Failed to fetch transaction history');
    expect(result.current.loadingTransactionHistory).toBe(false);
  });

  it('should not fetch when wallet is missing', async () => {
    const { result } = renderHook(() => useTransactionHistoryFetch(null));

    await act(async () => {
      await result.current.fetchTransactionHistory();
    });

    expect(transactionHistoryService.fetchAllTransactionHistory).not.toHaveBeenCalled();
  });

  it('should not fetch when addresses are missing', async () => {
    const incompleteWallet = {
      segwitAddress: 'bc1qtest',
      // Missing taprootAddress and taprootPubkey
    };

    const { result } = renderHook(() => useTransactionHistoryFetch(incompleteWallet));

    await act(async () => {
      await result.current.fetchTransactionHistory();
    });

    expect(transactionHistoryService.fetchAllTransactionHistory).not.toHaveBeenCalled();
  });

  it('should reset transaction history', () => {
    const { result } = renderHook(() => useTransactionHistoryFetch(mockWallet));

    act(() => {
      result.current.resetTransactionHistory();
    });

    expect(result.current.transactionHistory).toEqual([]);
  });

  it('should not update state when history has not changed', async () => {
    const mockHistory = [
      {
        txid: 'tx1',
        status: { confirmed: true, block_height: 100 },
        value: 100000,
      },
    ];

    transactionHistoryService.fetchAllTransactionHistory.mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useTransactionHistoryFetch(mockWallet));

    // First fetch - should update state
    await act(async () => {
      await result.current.fetchTransactionHistory();
    });

    expect(result.current.transactionHistory).toEqual(mockHistory);

    // Second fetch with same data - should not trigger re-render
    await act(async () => {
      await result.current.fetchTransactionHistory();
    });

    // State should still be the same
    expect(result.current.transactionHistory).toEqual(mockHistory);
  });

  it('should update state when confirmation status changes', async () => {
    const pendingHistory = [
      {
        txid: 'tx1',
        status: { confirmed: false, block_height: 0 },
        value: 100000,
      },
    ];

    const confirmedHistory = [
      {
        txid: 'tx1',
        status: { confirmed: true, block_height: 100 },
        value: 100000,
      },
    ];

    transactionHistoryService.fetchAllTransactionHistory.mockResolvedValue(pendingHistory);

    const { result } = renderHook(() => useTransactionHistoryFetch(mockWallet));

    // First fetch - pending transaction
    await act(async () => {
      await result.current.fetchTransactionHistory();
    });

    expect(result.current.transactionHistory[0].status.confirmed).toBe(false);

    // Second fetch - transaction now confirmed
    transactionHistoryService.fetchAllTransactionHistory.mockResolvedValue(confirmedHistory);

    await act(async () => {
      await result.current.fetchTransactionHistory();
    });

    expect(result.current.transactionHistory[0].status.confirmed).toBe(true);
  });

  it('should clear error on successful fetch after error', async () => {
    // First fetch fails
    transactionHistoryService.fetchAllTransactionHistory.mockRejectedValueOnce(
      new Error('API error')
    );

    const { result } = renderHook(() => useTransactionHistoryFetch(mockWallet));

    await act(async () => {
      await result.current.fetchTransactionHistory();
    });

    expect(result.current.historyError).toBe('Failed to fetch transaction history');

    // Second fetch succeeds
    transactionHistoryService.fetchAllTransactionHistory.mockResolvedValue([
      { txid: 'tx1', status: { confirmed: true, block_height: 100 } },
    ]);

    await act(async () => {
      await result.current.fetchTransactionHistory();
    });

    expect(result.current.historyError).toBe(null);
    expect(result.current.transactionHistory.length).toBe(1);
  });
});
