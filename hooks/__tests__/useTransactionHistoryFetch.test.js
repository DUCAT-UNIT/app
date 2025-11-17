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
});
