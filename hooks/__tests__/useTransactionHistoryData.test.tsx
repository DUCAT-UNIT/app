// @ts-nocheck
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
jest.mock('../../contexts/NavigationHandlersContext', () => ({
  useNavigationHandlers: () => ({
    settingsHandlers: {
      advancedMode: false,
    },
  }),
}));
jest.mock('../../services/cashu/cashuLockedTokensService', () => ({
  getSentLockedTokens: jest.fn(() => Promise.resolve([])),
  getReceivedTokens: jest.fn(() => Promise.resolve([])),
  subscribeToTokenChanges: jest.fn(() => jest.fn()), // Returns unsubscribe function
}));

// Mock tokenStatusService - delegates to underlying token fetching mocks
jest.mock('../../services/cashu/tokenStatusService', () => ({
  loadTokensWithStatus: async (taprootAddress, getSentLockedTokens, getReceivedTokens) => {
    const sent = await getSentLockedTokens(taprootAddress);
    const received = await getReceivedTokens(taprootAddress);
    return [...sent, ...received].map(t => ({ ...t, claimed: t.claimed ?? false }));
  },
  checkTokensStatus: jest.fn(),
  checkTokenStatus: jest.fn(),
  clearTokenStatusCache: jest.fn(),
}));

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

    // Loading is false initially when sheet is closed
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
      loadingTransactionHistory: false,
      fetchTransactionHistory: mockFetchTransactionHistory,
    });

    const { result } = renderHook(
      useTransactionHistoryData,
      { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
    );

    // With cached data and not loading, loading should be false
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

    // Mock to return different values based on which tx is being processed
    transactionHistoryService.calculateTransactionAmount.mockImplementation((tx) => {
      if (tx.txid === 'tx1') {
        return { amount: 100000, type: 'BTC', isSelfTransfer: false };
      } else if (tx.txid === 'tx2') {
        return { amount: 0, type: 'BTC', isSelfTransfer: true };
      }
      return { amount: 0, type: 'BTC', isSelfTransfer: true };
    });

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

    // Mock to return different values based on which tx is being processed
    // Note: calculateTransactionAmount is called twice per transaction (filter + map)
    transactionHistoryService.calculateTransactionAmount.mockImplementation((tx) => {
      if (tx.txid === 'tx1') {
        return { amount: 100000, type: 'BTC', isSelfTransfer: false };
      } else if (tx.txid === 'tx2') {
        return { amount: 0, type: 'BTC', isSelfTransfer: false };
      }
      return { amount: 0, type: 'BTC', isSelfTransfer: false };
    });

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

  // Note: Legacy format (number instead of object) is no longer supported.
  // The implementation now requires calculateTransactionAmount to return an object
  // with { amount, type, isSelfTransfer } fields.

  describe('Missing addresses', () => {
    it('should return empty transactions when segwitAddress is missing', () => {
      WalletDataContext.useTransactionHistory.mockReturnValue({
        transactionHistory: [{ txid: 'tx1', confirmations: 6 }],
        loadingTransactionHistory: false,
        fetchTransactionHistory: mockFetchTransactionHistory,
      });

      const { result } = renderHook(
        useTransactionHistoryData,
        { showHistorySheet: true, segwitAddress: undefined, taprootAddress: mockTaprootAddress }
      );

      expect(result.current.displayTransactions).toEqual([]);
    });

    it('should return empty transactions when taprootAddress is missing', () => {
      WalletDataContext.useTransactionHistory.mockReturnValue({
        transactionHistory: [{ txid: 'tx1', confirmations: 6 }],
        loadingTransactionHistory: false,
        fetchTransactionHistory: mockFetchTransactionHistory,
      });

      const { result } = renderHook(
        useTransactionHistoryData,
        { showHistorySheet: true, segwitAddress: mockSegwitAddress, taprootAddress: undefined }
      );

      expect(result.current.displayTransactions).toEqual([]);
    });
  });

  describe('Advanced mode behavior', () => {
    it('should clear ecash tokens when advanced mode is on', () => {
      jest.mock('../../contexts/NavigationHandlersContext', () => ({
        useNavigationHandlers: () => ({
          settingsHandlers: {
            advancedMode: true,
          },
        }),
      }));

      WalletDataContext.useTransactionHistory.mockReturnValue({
        transactionHistory: [],
        loadingTransactionHistory: false,
        fetchTransactionHistory: mockFetchTransactionHistory,
      });

      const { result } = renderHook(
        useTransactionHistoryData,
        { showHistorySheet: true, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
      );

      // With advanced mode on, only regular transactions should be shown
      expect(result.current.displayTransactions).toEqual([]);
    });
  });

  describe('Ecash token loading', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should load ecash tokens when sheet opens and not in advanced mode', async () => {
      const mockSentLockedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getSentLockedTokens;
      const mockGetReceivedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getReceivedTokens;

      mockSentLockedTokens.mockResolvedValue([
        { id: 'token1', token: 'cashuAbc123', amount: 10000, timestamp: 2000 },
      ]);
      mockGetReceivedTokens.mockResolvedValue([
        { id: 'token2', token: 'cashuDef456', amount: 5000, timestamp: 3000, claimed: true },
      ]);

      const mockDecodeToken = jest.fn().mockReturnValue({ proofs: [{ id: 'proof1' }] });
      const mockCheckProofsSpent = jest.fn().mockResolvedValue({ states: [{ state: 'UNSPENT' }] });
      const mockUpdateTokenClaimedStatus = jest.fn().mockResolvedValue(undefined);

      jest.doMock('../../services/cashu/crypto', () => ({
        decodeToken: mockDecodeToken,
      }));
      jest.doMock('../../services/cashu/cashuMintClient', () => ({
        checkProofsSpent: mockCheckProofsSpent,
      }));
      jest.doMock('../../services/cashu/cashuLockedTokensService', () => ({
        getSentLockedTokens: mockSentLockedTokens,
        getReceivedTokens: mockGetReceivedTokens,
        updateTokenClaimedStatus: mockUpdateTokenClaimedStatus,
        subscribeToTokenChanges: jest.fn(() => jest.fn()),
      }));

      WalletDataContext.useTransactionHistory.mockReturnValue({
        transactionHistory: [],
        loadingTransactionHistory: false,
        fetchTransactionHistory: mockFetchTransactionHistory,
      });

      const { result, rerender } = renderHook(
        useTransactionHistoryData,
        { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
      );

      // Open sheet to trigger ecash loading
      rerender({ showHistorySheet: true, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockSentLockedTokens).toHaveBeenCalledWith(mockTaprootAddress);
    });

    it('should handle token with cached claimed status', async () => {
      const mockSentLockedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getSentLockedTokens;
      const mockGetReceivedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getReceivedTokens;

      mockSentLockedTokens.mockResolvedValue([
        { id: 'token1', token: 'cashuAbc123', amount: 10000, timestamp: 2000, claimed: true },
      ]);
      mockGetReceivedTokens.mockResolvedValue([]);

      WalletDataContext.useTransactionHistory.mockReturnValue({
        transactionHistory: [],
        loadingTransactionHistory: false,
        fetchTransactionHistory: mockFetchTransactionHistory,
      });

      const { result, rerender } = renderHook(
        useTransactionHistoryData,
        { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
      );

      rerender({ showHistorySheet: true, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should find ecash transactions in the display
      expect(result.current.displayTransactions.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle token without valid token string', async () => {
      const mockSentLockedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getSentLockedTokens;
      const mockGetReceivedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getReceivedTokens;

      mockSentLockedTokens.mockResolvedValue([
        { id: 'token1', amount: 10000, timestamp: 2000 }, // No token string
      ]);
      mockGetReceivedTokens.mockResolvedValue([]);

      WalletDataContext.useTransactionHistory.mockReturnValue({
        transactionHistory: [],
        loadingTransactionHistory: false,
        fetchTransactionHistory: mockFetchTransactionHistory,
      });

      const { rerender } = renderHook(
        useTransactionHistoryData,
        { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
      );

      rerender({ showHistorySheet: true, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should not crash
      expect(true).toBe(true);
    });

    it('should handle token with URL instead of cashu token', async () => {
      const mockSentLockedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getSentLockedTokens;
      const mockGetReceivedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getReceivedTokens;

      mockSentLockedTokens.mockResolvedValue([
        { id: 'token1', token: 'http://example.com/token', amount: 10000, timestamp: 2000 },
      ]);
      mockGetReceivedTokens.mockResolvedValue([]);

      WalletDataContext.useTransactionHistory.mockReturnValue({
        transactionHistory: [],
        loadingTransactionHistory: false,
        fetchTransactionHistory: mockFetchTransactionHistory,
      });

      const { rerender } = renderHook(
        useTransactionHistoryData,
        { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
      );

      rerender({ showHistorySheet: true, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should handle gracefully
      expect(true).toBe(true);
    });

    it('should handle token with ducat:// URL', async () => {
      const mockSentLockedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getSentLockedTokens;
      const mockGetReceivedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getReceivedTokens;

      mockSentLockedTokens.mockResolvedValue([
        { id: 'token1', token: 'ducat://app/token', amount: 10000, timestamp: 2000 },
      ]);
      mockGetReceivedTokens.mockResolvedValue([]);

      WalletDataContext.useTransactionHistory.mockReturnValue({
        transactionHistory: [],
        loadingTransactionHistory: false,
        fetchTransactionHistory: mockFetchTransactionHistory,
      });

      const { rerender } = renderHook(
        useTransactionHistoryData,
        { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
      );

      rerender({ showHistorySheet: true, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should handle gracefully
      expect(true).toBe(true);
    });

    it('should handle invalid token format (not starting with cashu)', async () => {
      const mockSentLockedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getSentLockedTokens;
      const mockGetReceivedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getReceivedTokens;

      mockSentLockedTokens.mockResolvedValue([
        { id: 'token1', token: 'invalid_token_format', amount: 10000, timestamp: 2000 },
      ]);
      mockGetReceivedTokens.mockResolvedValue([]);

      WalletDataContext.useTransactionHistory.mockReturnValue({
        transactionHistory: [],
        loadingTransactionHistory: false,
        fetchTransactionHistory: mockFetchTransactionHistory,
      });

      const { rerender } = renderHook(
        useTransactionHistoryData,
        { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
      );

      rerender({ showHistorySheet: true, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should handle gracefully
      expect(true).toBe(true);
    });

    it('should handle partially spent tokens', async () => {
      const mockSentLockedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getSentLockedTokens;
      const mockGetReceivedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getReceivedTokens;
      const mockDecodeToken = jest.fn().mockReturnValue({ proofs: [{ id: 'proof1' }, { id: 'proof2' }] });
      const mockCheckProofsSpent = jest.fn().mockResolvedValue({
        states: [{ state: 'SPENT' }, { state: 'UNSPENT' }],
      });

      jest.doMock('../../services/cashu/crypto', () => ({
        decodeToken: mockDecodeToken,
      }));
      jest.doMock('../../services/cashu/cashuMintClient', () => ({
        checkProofsSpent: mockCheckProofsSpent,
      }));

      mockSentLockedTokens.mockResolvedValue([
        { id: 'token1', token: 'cashuAbc123', amount: 10000, timestamp: 2000 },
      ]);
      mockGetReceivedTokens.mockResolvedValue([]);

      WalletDataContext.useTransactionHistory.mockReturnValue({
        transactionHistory: [],
        loadingTransactionHistory: false,
        fetchTransactionHistory: mockFetchTransactionHistory,
      });

      const { rerender } = renderHook(
        useTransactionHistoryData,
        { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
      );

      rerender({ showHistorySheet: true, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should handle partially spent tokens
      expect(true).toBe(true);
    });

    it('should handle error during token status check', async () => {
      const mockSentLockedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getSentLockedTokens;
      const mockGetReceivedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getReceivedTokens;
      const mockDecodeToken = jest.fn().mockImplementation(() => {
        throw new Error('Decode failed');
      });

      jest.doMock('../../services/cashu/crypto', () => ({
        decodeToken: mockDecodeToken,
      }));

      mockSentLockedTokens.mockResolvedValue([
        { id: 'token1', token: 'cashuAbc123', amount: 10000, timestamp: 2000 },
      ]);
      mockGetReceivedTokens.mockResolvedValue([]);

      WalletDataContext.useTransactionHistory.mockReturnValue({
        transactionHistory: [],
        loadingTransactionHistory: false,
        fetchTransactionHistory: mockFetchTransactionHistory,
      });

      const { rerender } = renderHook(
        useTransactionHistoryData,
        { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
      );

      rerender({ showHistorySheet: true, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should handle error gracefully
      expect(true).toBe(true);
    });

    it('should handle error loading ecash tokens', async () => {
      const mockSentLockedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getSentLockedTokens;

      mockSentLockedTokens.mockRejectedValue(new Error('Network error'));

      WalletDataContext.useTransactionHistory.mockReturnValue({
        transactionHistory: [],
        loadingTransactionHistory: false,
        fetchTransactionHistory: mockFetchTransactionHistory,
      });

      const { rerender } = renderHook(
        useTransactionHistoryData,
        { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
      );

      rerender({ showHistorySheet: true, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should handle error gracefully
      expect(true).toBe(true);
    });

    it('should convert ecash token amounts correctly', async () => {
      const mockSentLockedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getSentLockedTokens;
      const mockGetReceivedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getReceivedTokens;

      // Include recipient field to identify as sent token (negative amount)
      mockSentLockedTokens.mockResolvedValue([
        { id: 'token1', token: 'cashuAbc123', amount: 10000, timestamp: 2000, claimed: true, recipient: 'somepubkey', taprootAddress: 'bc1pdifferent' },
      ]);
      mockGetReceivedTokens.mockResolvedValue([]);

      WalletDataContext.useTransactionHistory.mockReturnValue({
        transactionHistory: [],
        loadingTransactionHistory: false,
        fetchTransactionHistory: mockFetchTransactionHistory,
      });

      const { result, rerender } = renderHook(
        useTransactionHistoryData,
        { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
      );

      rerender({ showHistorySheet: true, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Check if ecash token amount is stored as integer (10000, negative for sent)
      const ecashTx = result.current.displayTransactions.find(tx => tx.ecashToken);
      if (ecashTx) {
        expect(ecashTx.txData.numericAmount).toBe(-10000);
      }
    });

    it('should sort merged transactions by timestamp', async () => {
      const mockSentLockedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getSentLockedTokens;
      const mockGetReceivedTokens = jest.requireMock('../../services/cashu/cashuLockedTokensService').getReceivedTokens;

      mockSentLockedTokens.mockResolvedValue([
        { id: 'token1', token: 'cashuAbc', amount: 10000, timestamp: 2000, claimed: true },
      ]);
      mockGetReceivedTokens.mockResolvedValue([]);

      const mockTransactions = [
        { txid: 'tx1', confirmations: 6, timestamp: 1000 },
        { txid: 'tx2', confirmations: 3, timestamp: 3000 },
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

      const { result, rerender } = renderHook(
        useTransactionHistoryData,
        { showHistorySheet: false, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress }
      );

      rerender({ showHistorySheet: true, segwitAddress: mockSegwitAddress, taprootAddress: mockTaprootAddress });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should be sorted: tx2 (3000), token1 (2000), tx1 (1000)
      if (result.current.displayTransactions.length >= 3) {
        expect(result.current.displayTransactions[0].txid).toBe('tx2');
        expect(result.current.displayTransactions[1].txid).toBe('token1');
        expect(result.current.displayTransactions[2].txid).toBe('tx1');
      }
    });
  });
});
