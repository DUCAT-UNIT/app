/**
 * Tests for useAssetTransactions Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useAssetTransactions } from '../useAssetTransactions';
import * as transactionHistoryService from '../../services/transactionHistoryService';

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

// Mock dependencies
jest.mock('../../services/transactionHistoryService');

describe('useAssetTransactions', () => {
  const segwitAddress = 'bc1qsegwit';
  const taprootAddress = 'bc1ptaproot';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty array when transaction history is null', () => {
    const { result } = renderHook(() =>
      useAssetTransactions(null, 'BTC', segwitAddress, taprootAddress)
    );

    expect(result.current.transactions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should return empty array when addresses are missing', () => {
    const txHistory = [{ txid: 'tx1' }];

    const { result } = renderHook(() =>
      useAssetTransactions(txHistory, 'BTC', null, null)
    );

    expect(result.current.transactions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should filter out vault transactions', () => {
    const txHistory = [
      { txid: 'tx1', vaultTransaction: true },
      { txid: 'tx2', vaultTransaction: false },
    ];

    transactionHistoryService.calculateTransactionAmount.mockReturnValue({
      amount: 100000,
      type: 'BTC',
    });

    const { result } = renderHook(() =>
      useAssetTransactions(txHistory, 'BTC', segwitAddress, taprootAddress)
    );

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current[0].txid).toBe('tx2');
  });

  it('should use existing txData if available', () => {
    const txHistory = [
      {
        txid: 'tx1',
        txData: {
          amount: 100000,
          assetType: 'BTC',
          numericAmount: 100000,
          isSent: false,
          isReceived: true,
        },
      },
    ];

    const { result } = renderHook(() =>
      useAssetTransactions(txHistory, 'BTC', segwitAddress, taprootAddress)
    );

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current[0].txData.amount).toBe(100000);
    expect(transactionHistoryService.calculateTransactionAmount).not.toHaveBeenCalled();
  });

  it('should process transactions without txData', () => {
    const txHistory = [
      { txid: 'tx1', status: { confirmed: true } },
    ];

    transactionHistoryService.calculateTransactionAmount.mockReturnValue({
      amount: 50000,
      type: 'BTC',
    });

    const { result } = renderHook(() =>
      useAssetTransactions(txHistory, 'BTC', segwitAddress, taprootAddress)
    );

    expect(transactionHistoryService.calculateTransactionAmount).toHaveBeenCalledWith(
      txHistory[0],
      segwitAddress,
      taprootAddress
    );
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current[0].txData.amount).toBe(50000);
    expect(result.current[0].txData.assetType).toBe('BTC');
  });

  it('should filter by asset type', () => {
    const txHistory = [
      {
        txid: 'tx1',
        txData: { amount: 100000, assetType: 'BTC', numericAmount: 100000 },
      },
      {
        txid: 'tx2',
        txData: { amount: 50, assetType: 'UNIT', numericAmount: 50 },
      },
    ];

    const { result } = renderHook(() =>
      useAssetTransactions(txHistory, 'BTC', segwitAddress, taprootAddress)
    );

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current[0].txid).toBe('tx1');
  });

  it('should filter out transactions with zero amount', () => {
    const txHistory = [
      {
        txid: 'tx1',
        txData: { amount: 0, assetType: 'BTC', numericAmount: 0 },
      },
      {
        txid: 'tx2',
        txData: { amount: 100000, assetType: 'BTC', numericAmount: 100000 },
      },
    ];

    const { result } = renderHook(() =>
      useAssetTransactions(txHistory, 'BTC', segwitAddress, taprootAddress)
    );

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current[0].txid).toBe('tx2');
  });

  it('should filter out transactions with null amount', () => {
    const txHistory = [
      {
        txid: 'tx1',
        txData: { amount: null, assetType: 'BTC', numericAmount: null },
      },
    ];

    const { result } = renderHook(() =>
      useAssetTransactions(txHistory, 'BTC', segwitAddress, taprootAddress)
    );

    expect(result.current.transactions).toHaveLength(0);
  });

  it('should mark transactions as sent when amount is negative', () => {
    transactionHistoryService.calculateTransactionAmount.mockReturnValue({
      amount: -100000,
      type: 'BTC',
    });

    const txHistory = [{ txid: 'tx1' }];

    const { result } = renderHook(() =>
      useAssetTransactions(txHistory, 'BTC', segwitAddress, taprootAddress)
    );

    expect(result.current[0].txData.isSent).toBe(true);
    expect(result.current[0].txData.isReceived).toBe(false);
  });

  it('should mark transactions as received when amount is positive', () => {
    transactionHistoryService.calculateTransactionAmount.mockReturnValue({
      amount: 100000,
      type: 'BTC',
    });

    const txHistory = [{ txid: 'tx1' }];

    const { result } = renderHook(() =>
      useAssetTransactions(txHistory, 'BTC', segwitAddress, taprootAddress)
    );

    expect(result.current[0].txData.isSent).toBe(false);
    expect(result.current[0].txData.isReceived).toBe(true);
  });

  it('should handle bigint amounts', () => {
    transactionHistoryService.calculateTransactionAmount.mockReturnValue({
      amount: BigInt(100000),
      type: 'BTC',
    });

    const txHistory = [{ txid: 'tx1' }];

    const { result } = renderHook(() =>
      useAssetTransactions(txHistory, 'BTC', segwitAddress, taprootAddress)
    );

    expect(result.current[0].txData.numericAmount).toBe(100000);
    expect(typeof result.current[0].txData.numericAmount).toBe('number');
  });

  it('should handle legacy format (amount as number)', () => {
    transactionHistoryService.calculateTransactionAmount.mockReturnValue(100000);

    const txHistory = [{ txid: 'tx1' }];

    const { result } = renderHook(() =>
      useAssetTransactions(txHistory, 'BTC', segwitAddress, taprootAddress)
    );

    expect(result.current[0].txData.amount).toBe(100000);
    expect(result.current[0].txData.assetType).toBe('BTC');
  });

  it('should cache results when inputs are unchanged', () => {
    const txHistory = [{ txid: 'tx1' }];

    transactionHistoryService.calculateTransactionAmount.mockReturnValue({
      amount: 100000,
      type: 'BTC',
    });

    const { result, rerender } = renderHook(
      ({ txHistory, assetType, segwit, taproot }) =>
        useAssetTransactions(txHistory, assetType, segwit, taproot),
      {
        initialProps: {
          txHistory,
          assetType: 'BTC',
          segwit: segwitAddress,
          taproot: taprootAddress,
        },
      }
    );

    const firstResult = result.current;

    // Rerender with same props
    rerender({
      txHistory,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(result.current.transactions).toBe(firstResult);
    // Should only be called once due to caching
    expect(transactionHistoryService.calculateTransactionAmount).toHaveBeenCalledTimes(1);
  });

  it('should recalculate when transaction history changes', () => {
    transactionHistoryService.calculateTransactionAmount.mockReturnValue({
      amount: 100000,
      type: 'BTC',
    });

    const { result, rerender } = renderHook(
      ({ txHistory, assetType, segwit, taproot }) =>
        useAssetTransactions(txHistory, assetType, segwit, taproot),
      {
        initialProps: {
          txHistory: [{ txid: 'tx1' }],
          assetType: 'BTC',
          segwit: segwitAddress,
          taproot: taprootAddress,
        },
      }
    );

    expect(result.current.transactions).toHaveLength(1);

    // Update with new transaction history
    rerender({
      txHistory: [{ txid: 'tx1' }, { txid: 'tx2' }],
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(result.current.transactions).toHaveLength(2);
  });

  it('should recalculate when asset type changes', () => {
    const txHistory = [
      {
        txid: 'tx1',
        txData: { amount: 100000, assetType: 'BTC', numericAmount: 100000 },
      },
      {
        txid: 'tx2',
        txData: { amount: 50, assetType: 'UNIT', numericAmount: 50 },
      },
    ];

    const { result, rerender } = renderHook(
      ({ txHistory, assetType, segwit, taproot }) =>
        useAssetTransactions(txHistory, assetType, segwit, taproot),
      {
        initialProps: {
          txHistory,
          assetType: 'BTC',
          segwit: segwitAddress,
          taproot: taprootAddress,
        },
      }
    );

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current[0].txid).toBe('tx1');

    // Change asset type
    rerender({
      txHistory,
      assetType: 'UNIT',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current[0].txid).toBe('tx2');
  });

  it('should preserve transaction properties', () => {
    transactionHistoryService.calculateTransactionAmount.mockReturnValue({
      amount: 100000,
      type: 'BTC',
    });

    const txHistory = [
      {
        txid: 'tx1',
        status: { confirmed: true },
        fee: 1000,
        customField: 'value',
      },
    ];

    const { result } = renderHook(() =>
      useAssetTransactions(txHistory, 'BTC', segwitAddress, taprootAddress)
    );

    expect(result.current[0]).toMatchObject({
      txid: 'tx1',
      status: { confirmed: true },
      fee: 1000,
      customField: 'value',
      txData: expect.any(Object),
    });
  });
});
