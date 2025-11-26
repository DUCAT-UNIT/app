// @ts-nocheck
/**
 * Tests for useAssetTransactions Hook
 *
 * Note: This hook has async effects with dynamic imports for UNIT assets.
 * Tests focus on BTC transactions which don't trigger the async ecash loading.
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useAssetTransactions } from '../useAssetTransactions';
import * as transactionHistoryService from '../../services/transactionHistoryService';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../services/cashu/cashuLockedTokensService', () => ({
  getSentLockedTokens: jest.fn(() => Promise.resolve([])),
  getReceivedTokens: jest.fn(() => Promise.resolve([])),
}));

jest.mock('../../services/transactionHistoryService');

// Helper to render hooks with react-test-renderer
function renderHook(initialProps) {
  const result = { current: null };

  function TestComponent({ props }) {
    const { txHistory, assetType, segwit, taproot, advancedMode } = props;
    result.current = useAssetTransactions(txHistory, assetType, segwit, taproot, advancedMode);
    return null;
  }

  let component;
  act(() => {
    component = create(<TestComponent props={initialProps} />);
  });

  return {
    result,
    rerender: (newProps) => {
      act(() => {
        component.update(<TestComponent props={newProps} />);
      });
    },
    unmount: () => component.unmount(),
  };
}

describe('useAssetTransactions', () => {
  const segwitAddress = 'bc1qsegwit';
  const taprootAddress = 'bc1ptaproot';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty array when transaction history is null', () => {
    const { result } = renderHook({
      txHistory: null,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(result.current.transactions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should return empty array when segwit address is missing', () => {
    const txHistory = [{ txid: 'tx1' }];

    const { result } = renderHook({
      txHistory,
      assetType: 'BTC',
      segwit: null,
      taproot: taprootAddress,
    });

    expect(result.current.transactions).toEqual([]);
  });

  it('should return empty array when taproot address is missing', () => {
    const txHistory = [{ txid: 'tx1' }];

    const { result } = renderHook({
      txHistory,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: null,
    });

    expect(result.current.transactions).toEqual([]);
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

    const { result } = renderHook({
      txHistory,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].txid).toBe('tx2');
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

    const { result } = renderHook({
      txHistory,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].txData.amount).toBe(100000);
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

    const { result } = renderHook({
      txHistory,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(transactionHistoryService.calculateTransactionAmount).toHaveBeenCalledWith(
      txHistory[0],
      segwitAddress,
      taprootAddress
    );
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].txData.amount).toBe(50000);
    expect(result.current.transactions[0].txData.assetType).toBe('BTC');
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

    const { result } = renderHook({
      txHistory,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].txid).toBe('tx2');
  });

  it('should filter out transactions with null amount', () => {
    const txHistory = [
      {
        txid: 'tx1',
        txData: { amount: null, assetType: 'BTC', numericAmount: null },
      },
    ];

    const { result } = renderHook({
      txHistory,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(result.current.transactions).toHaveLength(0);
  });

  it('should mark transactions as sent when amount is negative', () => {
    transactionHistoryService.calculateTransactionAmount.mockReturnValue({
      amount: -100000,
      type: 'BTC',
    });

    const txHistory = [{ txid: 'tx1' }];

    const { result } = renderHook({
      txHistory,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(result.current.transactions[0].txData.isSent).toBe(true);
    expect(result.current.transactions[0].txData.isReceived).toBe(false);
  });

  it('should mark transactions as received when amount is positive', () => {
    transactionHistoryService.calculateTransactionAmount.mockReturnValue({
      amount: 100000,
      type: 'BTC',
    });

    const txHistory = [{ txid: 'tx1' }];

    const { result } = renderHook({
      txHistory,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(result.current.transactions[0].txData.isSent).toBe(false);
    expect(result.current.transactions[0].txData.isReceived).toBe(true);
  });

  it('should handle bigint amounts', () => {
    transactionHistoryService.calculateTransactionAmount.mockReturnValue({
      amount: BigInt(100000),
      type: 'BTC',
    });

    const txHistory = [{ txid: 'tx1' }];

    const { result } = renderHook({
      txHistory,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(result.current.transactions[0].txData.numericAmount).toBe(100000);
    expect(typeof result.current.transactions[0].txData.numericAmount).toBe('number');
  });

  it('should handle legacy format (amount as number)', () => {
    transactionHistoryService.calculateTransactionAmount.mockReturnValue(100000);

    const txHistory = [{ txid: 'tx1' }];

    const { result } = renderHook({
      txHistory,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(result.current.transactions[0].txData.amount).toBe(100000);
    expect(result.current.transactions[0].txData.assetType).toBe('BTC');
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

    const { result } = renderHook({
      txHistory,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(result.current.transactions[0]).toMatchObject({
      txid: 'tx1',
      status: { confirmed: true },
      fee: 1000,
      customField: 'value',
      txData: expect.any(Object),
    });
  });

  it('should not show loading for BTC asset type', () => {
    const { result } = renderHook({
      txHistory: [],
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should not show loading in advanced mode for UNIT', () => {
    const { result } = renderHook({
      txHistory: [],
      assetType: 'UNIT',
      segwit: segwitAddress,
      taproot: taprootAddress,
      advancedMode: true,
    });

    expect(result.current.isLoading).toBe(false);
  });
});
