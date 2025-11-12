/**
 * Tests for TransactionHistoryContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { TransactionHistoryProvider, useTransactionHistory } from '../TransactionHistoryContext';
import { useWallet } from '../WalletContext';
import * as transactionHistoryService from '../../services/transactionHistoryService';

// Helper to render hooks with react-test-renderer
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

// Mock dependencies
jest.mock('../WalletContext');
jest.mock('../../services/transactionHistoryService');

describe('TransactionHistoryContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockWallet = {
    segwitAddress: 'bc1qsegwit',
    taprootAddress: 'bc1ptaproot',
    taprootPubkey: 'taproot_pubkey',
  };

  const mockHistory = [
    { txid: 'tx1', type: 'btc', amount: 10000, timestamp: 1234567890 },
    { txid: 'tx2', type: 'rune', amount: 5000, timestamp: 1234567900 },
  ];

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useTransactionHistory());
    }).toThrow('useTransactionHistory must be used within a TransactionHistoryProvider');

    consoleError.mockRestore();
  });

  it('should provide initial state', () => {
    useWallet.mockReturnValue({ wallet: null });

    const wrapper = ({ children }) => <TransactionHistoryProvider>{children}</TransactionHistoryProvider>;
    const { result } = renderHook(() => useTransactionHistory(), { wrapper });

    expect(result.current.transactionHistory).toEqual([]);
    expect(result.current.loadingTransactionHistory).toBe(false);
    expect(typeof result.current.fetchTransactionHistory).toBe('function');
    expect(typeof result.current.resetTransactionHistory).toBe('function');
  });

  it('should fetch transaction history on mount when wallet exists', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    transactionHistoryService.fetchAllTransactionHistory.mockResolvedValue(mockHistory);

    const wrapper = ({ children }) => <TransactionHistoryProvider>{children}</TransactionHistoryProvider>;
    const { result } = renderHook(() => useTransactionHistory(), { wrapper });

    // Wait for the async effect to complete
    await act(async () => {
      await Promise.resolve();
    });

    expect(transactionHistoryService.fetchAllTransactionHistory).toHaveBeenCalledWith(
      mockWallet.segwitAddress,
      mockWallet.taprootAddress,
      mockWallet.taprootPubkey
    );
    expect(result.current.transactionHistory).toEqual(mockHistory);
    expect(result.current.loadingTransactionHistory).toBe(false);
  });

  it('should auto-refresh transaction history every 30 seconds', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    transactionHistoryService.fetchAllTransactionHistory.mockResolvedValue(mockHistory);

    const wrapper = ({ children }) => <TransactionHistoryProvider>{children}</TransactionHistoryProvider>;
    renderHook(() => useTransactionHistory(), { wrapper });

    // Initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    expect(transactionHistoryService.fetchAllTransactionHistory).toHaveBeenCalledTimes(1);

    // Advance 30 seconds
    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    expect(transactionHistoryService.fetchAllTransactionHistory).toHaveBeenCalledTimes(2);

    // Advance another 30 seconds
    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    expect(transactionHistoryService.fetchAllTransactionHistory).toHaveBeenCalledTimes(3);
  });

  it('should reset transaction history when wallet is null', async () => {
    useWallet.mockReturnValue({ wallet: null });

    const wrapper = ({ children }) => <TransactionHistoryProvider>{children}</TransactionHistoryProvider>;
    const { result } = renderHook(() => useTransactionHistory(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.transactionHistory).toEqual([]);
    expect(transactionHistoryService.fetchAllTransactionHistory).not.toHaveBeenCalled();
  });

  it('should handle fetchTransactionHistory errors gracefully', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    transactionHistoryService.fetchAllTransactionHistory.mockRejectedValue(new Error('Network error'));

    const wrapper = ({ children }) => <TransactionHistoryProvider>{children}</TransactionHistoryProvider>;
    const { result } = renderHook(() => useTransactionHistory(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    // Should set history to empty array on error
    expect(result.current.transactionHistory).toEqual([]);
    expect(result.current.loadingTransactionHistory).toBe(false);
  });

  it('should manually fetch transaction history', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    const newHistory = [...mockHistory, { txid: 'tx3', type: 'btc', amount: 15000 }];
    transactionHistoryService.fetchAllTransactionHistory
      .mockResolvedValueOnce(mockHistory)
      .mockResolvedValueOnce(newHistory);

    const wrapper = ({ children }) => <TransactionHistoryProvider>{children}</TransactionHistoryProvider>;
    const { result } = renderHook(() => useTransactionHistory(), { wrapper });

    // Wait for initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.transactionHistory).toEqual(mockHistory);

    // Clear previous calls
    transactionHistoryService.fetchAllTransactionHistory.mockClear();

    // Manual fetch
    await act(async () => {
      await result.current.fetchTransactionHistory();
    });

    expect(transactionHistoryService.fetchAllTransactionHistory).toHaveBeenCalledTimes(1);
    expect(result.current.transactionHistory).toEqual(newHistory);
  });

  it('should reset transaction history manually', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    transactionHistoryService.fetchAllTransactionHistory.mockResolvedValue(mockHistory);

    const wrapper = ({ children }) => <TransactionHistoryProvider>{children}</TransactionHistoryProvider>;
    const { result } = renderHook(() => useTransactionHistory(), { wrapper });

    // Wait for initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.transactionHistory).toEqual(mockHistory);

    // Reset transaction history
    act(() => {
      result.current.resetTransactionHistory();
    });

    expect(result.current.transactionHistory).toEqual([]);
  });

  it('should not fetch if wallet addresses are missing', async () => {
    useWallet.mockReturnValue({ wallet: { segwitAddress: null, taprootAddress: null, taprootPubkey: null } });

    const wrapper = ({ children }) => <TransactionHistoryProvider>{children}</TransactionHistoryProvider>;
    renderHook(() => useTransactionHistory(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(transactionHistoryService.fetchAllTransactionHistory).not.toHaveBeenCalled();
  });

  it('should cleanup interval on unmount', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    transactionHistoryService.fetchAllTransactionHistory.mockResolvedValue(mockHistory);

    const wrapper = ({ children }) => <TransactionHistoryProvider>{children}</TransactionHistoryProvider>;
    const { unmount } = renderHook(() => useTransactionHistory(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    const callCount = transactionHistoryService.fetchAllTransactionHistory.mock.calls.length;

    // Unmount
    act(() => {
      unmount();
    });

    // Advance time
    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    // Should not have called again after unmount
    expect(transactionHistoryService.fetchAllTransactionHistory).toHaveBeenCalledTimes(callCount);
  });
});
