/**
 * Tests for useTransactionHistoryData hook
 */

import { create, act } from 'react-test-renderer';
import React from 'react';
import { useTransactionHistoryData } from '../useTransactionHistoryData';
import * as WalletDataContext from '../../contexts/WalletDataContext';
import * as transactionHistoryService from '../../services/transactionHistoryService';
import { Linking } from 'react-native';

// Mock dependencies
jest.mock('../../contexts/WalletDataContext');
jest.mock('../../services/transactionHistoryService');

// Helper to render hooks
function renderHook(hook, initialProps) {
  let props = initialProps;
  const result = { current: null };

  function TestComponent({ hookProps }) {
    result.current = hook(hookProps.showHistorySheet, hookProps.segwitAddress, hookProps.taprootAddress);
    return null;
  }

  let component;
  act(() => {
    component = create(<TestComponent hookProps={props} />);
  });

  return {
    result,
    unmount: () => component.unmount(),
    rerender: (newProps) => {
      props = newProps;
      act(() => {
        component.update(<TestComponent hookProps={newProps} />);
      });
    }
  };
}

describe('useTransactionHistoryData', () => {
  const mockFetchTransactionHistory = jest.fn();
  const mockSegwitAddress = 'bc1qtest';
  const mockTaprootAddress = 'bc1ptest';

  beforeEach(() => {
    jest.clearAllMocks();

    WalletDataContext.useTransactionHistory.mockReturnValue({
      transactionHistory: [],
      loadingTransactionHistory: false,
      fetchTransactionHistory: mockFetchTransactionHistory,
    });

    transactionHistoryService.calculateTransactionAmount.mockReturnValue({
      amount: 100000,
      type: 'BTC',
      isSelfTransfer: false,
    });

    Linking.canOpenURL.mockResolvedValue(true);
    Linking.openURL.mockResolvedValue(undefined);
  });

  it('should initialize with empty data', () => {
    const { result } = renderHook(
      useTransactionHistoryData,
      { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.displayTransactions).toEqual([]);
  });

  it('should fetch transaction history when sheet opens', () => {
    const { rerender } = renderHook(
      useTransactionHistoryData,
      { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
    );

    rerender({ showHistorySheet: true, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress });

    expect(mockFetchTransactionHistory).toHaveBeenCalled();
  });

  it('should show loading when no cached data and loading from context', () => {
    WalletDataContext.useTransactionHistory.mockReturnValue({
      transactionHistory: [],
      loadingTransactionHistory: true,
      fetchTransactionHistory: mockFetchTransactionHistory,
    });

    const { result } = renderHook(
      useTransactionHistoryData,
      { showHistorySheet: true, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
    );

    expect(result.current.loading).toBe(true);
  });

  it('should not show loading when cached data exists', () => {
    WalletDataContext.useTransactionHistory.mockReturnValue({
      transactionHistory: [{ txid: 'tx1', confirmations: 6 }],
      loadingTransactionHistory: true,
      fetchTransactionHistory: mockFetchTransactionHistory,
    });

    const { result } = renderHook(
      useTransactionHistoryData,
      { showHistorySheet: true, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
    );

    expect(result.current.loading).toBe(false);
  });

  it('should filter out self-transfers', () => {
    const mockTransactions = [
      { txid: 'tx1', confirmations: 6 },
      { txid: 'tx2', confirmations: 3 },
    ];

    WalletDataContext.useTransactionHistory.mockReturnValue({
      transactionHistory: mockTransactions,
      loadingTransactionHistory: false,
      fetchTransactionHistory: mockFetchTransactionHistory,
    });

    transactionHistoryService.calculateTransactionAmount
      .mockReturnValueOnce({ amount: 100000, type: 'BTC', isSelfTransfer: false })
      .mockReturnValueOnce({ amount: 0, type: 'BTC', isSelfTransfer: true });

    const { result } = renderHook(
      useTransactionHistoryData,
      { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
    );

    expect(result.current.displayTransactions).toHaveLength(1);
    expect(result.current.displayTransactions[0].txid).toBe('tx1');
  });

  it('should filter out zero amount transactions', () => {
    const mockTransactions = [
      { txid: 'tx1', confirmations: 6 },
      { txid: 'tx2', confirmations: 3 },
    ];

    WalletDataContext.useTransactionHistory.mockReturnValue({
      transactionHistory: mockTransactions,
      loadingTransactionHistory: false,
      fetchTransactionHistory: mockFetchTransactionHistory,
    });

    transactionHistoryService.calculateTransactionAmount
      .mockReturnValueOnce({ amount: 100000, type: 'BTC', isSelfTransfer: false })
      .mockReturnValueOnce({ amount: 0, type: 'BTC', isSelfTransfer: false });

    const { result } = renderHook(
      useTransactionHistoryData,
      { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
    );

    expect(result.current.displayTransactions).toHaveLength(1);
  });

  it('should always show vault transactions', () => {
    const mockTransactions = [
      { txid: 'tx1', confirmations: 6, vaultTransaction: true },
    ];

    WalletDataContext.useTransactionHistory.mockReturnValue({
      transactionHistory: mockTransactions,
      loadingTransactionHistory: false,
      fetchTransactionHistory: mockFetchTransactionHistory,
    });

    const { result } = renderHook(
      useTransactionHistoryData,
      { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
    );

    expect(result.current.displayTransactions).toHaveLength(1);
    expect(result.current.displayTransactions[0].vaultTransaction).toBe(true);
  });

  it('should attach txData for sent transactions', () => {
    const mockTransactions = [
      { txid: 'tx1', confirmations: 6 },
    ];

    WalletDataContext.useTransactionHistory.mockReturnValue({
      transactionHistory: mockTransactions,
      loadingTransactionHistory: false,
      fetchTransactionHistory: mockFetchTransactionHistory,
    });

    transactionHistoryService.calculateTransactionAmount.mockReturnValue({
      amount: -100000,
      type: 'BTC',
      isSelfTransfer: false,
    });

    const { result } = renderHook(
      useTransactionHistoryData,
      { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
    );

    expect(result.current.displayTransactions[0].txData).toBeDefined();
    expect(result.current.displayTransactions[0].txData.isSent).toBe(true);
    expect(result.current.displayTransactions[0].txData.isReceived).toBe(false);
    expect(result.current.displayTransactions[0].txData.assetType).toBe('BTC');
  });

  it('should attach txData for received transactions', () => {
    const mockTransactions = [
      { txid: 'tx1', confirmations: 6 },
    ];

    WalletDataContext.useTransactionHistory.mockReturnValue({
      transactionHistory: mockTransactions,
      loadingTransactionHistory: false,
      fetchTransactionHistory: mockFetchTransactionHistory,
    });

    transactionHistoryService.calculateTransactionAmount.mockReturnValue({
      amount: 100000,
      type: 'BTC',
      isSelfTransfer: false,
    });

    const { result } = renderHook(
      useTransactionHistoryData,
      { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
    );

    expect(result.current.displayTransactions[0].txData).toBeDefined();
    expect(result.current.displayTransactions[0].txData.isSent).toBe(false);
    expect(result.current.displayTransactions[0].txData.isReceived).toBe(true);
  });

  it('should handle BigInt amounts for UNIT transactions', () => {
    const mockTransactions = [
      { txid: 'tx1', confirmations: 6 },
    ];

    WalletDataContext.useTransactionHistory.mockReturnValue({
      transactionHistory: mockTransactions,
      loadingTransactionHistory: false,
      fetchTransactionHistory: mockFetchTransactionHistory,
    });

    transactionHistoryService.calculateTransactionAmount.mockReturnValue({
      amount: 1000000n,
      type: 'UNIT',
      isSelfTransfer: false,
    });

    const { result } = renderHook(
      useTransactionHistoryData,
      { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
    );

    expect(result.current.displayTransactions[0].txData.numericAmount).toBe(1000000);
    expect(result.current.displayTransactions[0].txData.assetType).toBe('UNIT');
  });

  it('should open BTC transaction in explorer', async () => {
    const { result } = renderHook(
      useTransactionHistoryData,
      { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
    );

    await act(async () => {
      await result.current.openTxInExplorer('tx123', 'BTC');
    });

    expect(Linking.canOpenURL).toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalled();
  });

  it('should open UNIT transaction in ord explorer', async () => {
    const { result } = renderHook(
      useTransactionHistoryData,
      { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
    );

    await act(async () => {
      await result.current.openTxInExplorer('tx123', 'UNIT');
    });

    expect(Linking.canOpenURL).toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalled();
  });

  it('should handle unsupported URL gracefully', async () => {
    Linking.canOpenURL.mockResolvedValue(false);

    const { result } = renderHook(
      useTransactionHistoryData,
      { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
    );

    await act(async () => {
      await result.current.openTxInExplorer('tx123', 'BTC');
    });

    expect(Linking.canOpenURL).toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('should handle linking errors gracefully', async () => {
    Linking.openURL.mockRejectedValue(new Error('Failed to open'));

    const { result } = renderHook(
      useTransactionHistoryData,
      { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
    );

    // Should not throw
    await act(async () => {
      await result.current.openTxInExplorer('tx123', 'BTC');
    });

    expect(Linking.openURL).toHaveBeenCalled();
  });

  it('should handle legacy amount format (number instead of object)', () => {
    const mockTransactions = [
      { txid: 'tx1', confirmations: 6 },
    ];

    WalletDataContext.useTransactionHistory.mockReturnValue({
      transactionHistory: mockTransactions,
      loadingTransactionHistory: false,
      fetchTransactionHistory: mockFetchTransactionHistory,
    });

    // Return just a number instead of object
    transactionHistoryService.calculateTransactionAmount.mockReturnValue(100000);

    const { result } = renderHook(
      useTransactionHistoryData,
      { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
    );

    expect(result.current.displayTransactions[0].txData.amount).toBe(100000);
    expect(result.current.displayTransactions[0].txData.assetType).toBe('BTC');
  });
});
