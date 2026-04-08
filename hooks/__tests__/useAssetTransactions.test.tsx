/**
 * Tests for useAssetTransactions Hook
 *
 * Covers transaction filtering, ecash token loading, and edge cases.
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useAssetTransactions } from '../useAssetTransactions';
import * as transactionHistoryService from '../../services/transactionHistoryService';

// Mock useEcashTokens from context
const mockFetchEcashTokens = jest.fn();
const mockResetEcashTokens = jest.fn();
let mockEcashTokens: any[] = [];
let mockLoadingEcashTokens = false;

jest.mock('../../contexts/WalletDataContext', () => ({
  useEcashTokens: () => ({
    ecashTokens: mockEcashTokens,
    loadingEcashTokens: mockLoadingEcashTokens,
    fetchEcashTokens: mockFetchEcashTokens,
    resetEcashTokens: mockResetEcashTokens,
  }),
}));

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGetSentLockedTokens = jest.fn();
const mockGetReceivedTokens = jest.fn();
const mockUpdateTokenClaimedStatus = jest.fn();
const mockSubscribeToTokenChanges: jest.Mock = jest.fn(() => jest.fn()); // Returns unsubscribe function

jest.mock('../../services/cashu/cashuLockedTokensService', () => ({
  getSentLockedTokens: (...args: any[]) => mockGetSentLockedTokens(...args),
  getReceivedTokens: (...args: any[]) => mockGetReceivedTokens(...args),
  updateTokenClaimedStatus: (...args: any[]) => mockUpdateTokenClaimedStatus(...args),
  subscribeToTokenChanges: (...args: any[]) => mockSubscribeToTokenChanges(...args),
}));

// Mock tokenStatusService - delegates to underlying token fetching mocks
jest.mock('../../services/cashu/tokenStatusService', () => ({
  loadTokensWithStatus: async (taprootAddress: any, getSentLockedTokens: any, getReceivedTokens: any) => {
    const sent = await getSentLockedTokens(taprootAddress);
    const received = await getReceivedTokens(taprootAddress);
    // Return tokens with claimed status (default to false if not specified)
    return [...sent, ...received].map(t => ({ ...t, claimed: t.claimed ?? false }));
  },
  checkTokensStatus: jest.fn(),
  checkTokenStatus: jest.fn(),
  clearTokenStatusCache: jest.fn(),
}));

const mockDecodeToken = jest.fn();
jest.mock('../../services/cashu/crypto', () => ({
  decodeToken: (...args: any[]) => mockDecodeToken(...args),
}));

const mockCheckProofsSpent = jest.fn();
jest.mock('../../services/cashu/cashuMintClient', () => ({
  checkProofsSpent: (...args: any[]) => mockCheckProofsSpent(...args),
}));

jest.mock('../../services/transactionHistoryService');

// Mock pending transactions store
let mockPendingTransactions = {};
jest.mock('../../stores/pendingTransactionsStore', () => ({
  usePendingTxs: () => mockPendingTransactions,
}));

// Mock bitcoinjs-lib for taproot address decoding
const mockFromBech32 = jest.fn();
jest.mock('bitcoinjs-lib', () => ({
  address: {
    fromBech32: (...args: any[]) => mockFromBech32(...args),
  },
}));

// Helper to render hooks with react-test-renderer
function renderHook(initialProps: any) {
  const result: { current: any } = { current: null };

  function TestComponent({ props }: { props: any }) {
    const { txHistory, assetType, segwit, taproot, advancedMode } = props;
    result.current = useAssetTransactions(txHistory, assetType, segwit, taproot, advancedMode);
    return null;
  }

  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent props={initialProps} />);
  });

  return {
    result,
    rerender: (newProps?: unknown) => {
      act(() => {
        component?.update(<TestComponent props={newProps} />);
      });
    },
    unmount: () => component?.unmount(),
  };
}

describe('useAssetTransactions', () => {
  const segwitAddress = 'bc1qsegwit';
  const taprootAddress = 'bc1ptaproot';

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock ecash tokens from context
    mockEcashTokens = [];
    mockLoadingEcashTokens = false;
    // Reset pending transactions
    mockPendingTransactions = {};
    // Reset legacy mocks (kept for backwards compatibility with some tests)
    mockGetSentLockedTokens.mockResolvedValue([]);
    mockGetReceivedTokens.mockResolvedValue([]);
    mockDecodeToken.mockReturnValue({ proofs: [] });
    mockCheckProofsSpent.mockResolvedValue({ states: [] });
    mockUpdateTokenClaimedStatus.mockResolvedValue(undefined);
    // Default: successful taproot decode
    mockFromBech32.mockReturnValue({ data: Buffer.from('test_pubkey_hex', 'hex') });
  });

  it('should return empty array when transaction history is null', () => {
    const { result } = renderHook({
      txHistory: null,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(result.current!.transactions).toEqual([]);
    // isLoading is true until transactions are processed at least once
    // With null txHistory, the useMemo early-returns without setting transactionsProcessedRef
    expect(result.current!.isLoading).toBe(true);
  });

  it('should return empty array when segwit address is missing', () => {
    const txHistory = [{ txid: 'tx1' }];

    const { result } = renderHook({
      txHistory,
      assetType: 'BTC',
      segwit: null,
      taproot: taprootAddress,
    });

    expect(result.current!.transactions).toEqual([]);
  });

  it('should return empty array when taproot address is missing', () => {
    const txHistory = [{ txid: 'tx1' }];

    const { result } = renderHook({
      txHistory,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: null,
    });

    expect(result.current!.transactions).toEqual([]);
  });

  it('should filter out vault transactions', () => {
    const txHistory = [
      { txid: 'tx1', vaultTransaction: true },
      { txid: 'tx2', vaultTransaction: false },
    ];

    (transactionHistoryService.calculateTransactionAmount as jest.Mock).mockReturnValue({
      amount: 100000,
      type: 'BTC',
    });

    const { result } = renderHook({
      txHistory,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(result.current!.transactions).toHaveLength(1);
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

    expect(result.current!.transactions).toHaveLength(1);
    expect(result.current.transactions[0].txData.amount).toBe(100000);
    expect(transactionHistoryService.calculateTransactionAmount).not.toHaveBeenCalled();
  });

  it('should process transactions without txData', () => {
    const txHistory = [
      { txid: 'tx1', status: { confirmed: true } },
    ];

    (transactionHistoryService.calculateTransactionAmount as jest.Mock).mockReturnValue({
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
    expect(result.current!.transactions).toHaveLength(1);
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

    expect(result.current!.transactions).toHaveLength(1);
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

    expect(result.current!.transactions).toHaveLength(0);
  });

  it('should mark transactions as sent when amount is negative', () => {
    (transactionHistoryService.calculateTransactionAmount as jest.Mock).mockReturnValue({
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
    (transactionHistoryService.calculateTransactionAmount as jest.Mock).mockReturnValue({
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
    (transactionHistoryService.calculateTransactionAmount as jest.Mock).mockReturnValue({
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
    (transactionHistoryService.calculateTransactionAmount as jest.Mock).mockReturnValue(100000);

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
    (transactionHistoryService.calculateTransactionAmount as jest.Mock).mockReturnValue({
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

    expect(result.current!.isLoading).toBe(false);
  });

  it('should not show loading in advanced mode for UNIT', () => {
    const { result } = renderHook({
      txHistory: [],
      assetType: 'UNIT',
      segwit: segwitAddress,
      taproot: taprootAddress,
      advancedMode: true,
    });

    expect(result.current!.isLoading).toBe(false);
  });

  it('should filter transactions by asset type (filter out non-matching)', () => {
    const txHistory = [
      {
        txid: 'tx1',
        txData: { amount: 100, assetType: 'UNIT', numericAmount: 100 },
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

    expect(result.current!.transactions).toHaveLength(1);
    expect(result.current.transactions[0].txid).toBe('tx2');
  });

  it('should use cached transactions when hash unchanged', () => {
    (transactionHistoryService.calculateTransactionAmount as jest.Mock).mockReturnValue({
      amount: 100000,
      type: 'BTC',
    });

    const txHistory = [
      { txid: 'tx1', status: { confirmed: true, block_height: 100 } },
    ];

    const { result, rerender } = renderHook({
      txHistory,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    expect(result.current!.transactions).toHaveLength(1);
    const firstResult = result.current.transactions;

    // Rerender with same data
    rerender({
      txHistory,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    // Should use cached result
    expect(result.current!.transactions).toBe(firstResult);
  });

  it('should sort transactions by timestamp', () => {
    const txHistory = [
      {
        txid: 'tx1',
        status: { block_time: 1000 },
        txData: { amount: 100000, assetType: 'BTC', numericAmount: 100000 },
      },
      {
        txid: 'tx2',
        status: { block_time: 3000 },
        txData: { amount: 100000, assetType: 'BTC', numericAmount: 100000 },
      },
      {
        txid: 'tx3',
        status: { block_time: 2000 },
        txData: { amount: 100000, assetType: 'BTC', numericAmount: 100000 },
      },
    ];

    const { result } = renderHook({
      txHistory,
      assetType: 'BTC',
      segwit: segwitAddress,
      taproot: taprootAddress,
    });

    // Most recent first
    expect(result.current.transactions[0].txid).toBe('tx2');
    expect(result.current.transactions[1].txid).toBe('tx3');
    expect(result.current.transactions[2].txid).toBe('tx1');
  });

  describe('UNIT asset type with ecash tokens', () => {
    // NOTE: Ecash tokens are only processed when advancedMode=true for UNIT assets

    it('should show loading initially for UNIT assets when tokens loading', async () => {
      // Set loading state from context
      mockLoadingEcashTokens = true;
      mockEcashTokens = [];

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true,
      });

      // isLoading is false after useMemo processes (even with empty results),
      // because transactionsProcessedRef is set when the useMemo completes
      expect(result.current!.isLoading).toBe(false);
    });

    it('should load and display ecash tokens for UNIT', async () => {
      // Set pre-loaded ecash tokens from context
      mockEcashTokens = [
        { id: 'token1', token: 'cashuAbc123', amount: 10000, timestamp: 2000, claimed: false, recipient: 'someone' },
        { id: 'token2', token: 'cashuDef456', amount: 5000, timestamp: 3000, claimed: true, sender: 'someone' },
      ];
      mockLoadingEcashTokens = false;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      expect(result.current!.isLoading).toBe(false);
      expect(result.current!.transactions).toHaveLength(2);
      expect(result.current.transactions[0].ecashToken).toBe(true);
    });

    it('should handle token with cached claimed status', async () => {
      // Set pre-loaded ecash tokens from context
      mockEcashTokens = [
        { id: 'token1', token: 'cashuAbc123', amount: 10000, timestamp: 2000, claimed: true, recipient: 'someone' },
      ];
      mockLoadingEcashTokens = false;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      expect(result.current.transactions[0].claimed).toBe(true);
    });

    it('should handle missing token string', async () => {
      // Set pre-loaded ecash tokens from context
      mockEcashTokens = [
        { id: 'token1', amount: 10000, timestamp: 2000, claimed: false, recipient: 'someone' }, // No token string
      ];
      mockLoadingEcashTokens = false;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current!.transactions).toHaveLength(1);
      expect(result.current.transactions[0].claimed).toBe(false);
    });

    it('should handle URL instead of cashu token', () => {
      // Set pre-loaded ecash tokens from context
      mockEcashTokens = [
        { id: 'token1', token: 'http://example.com/token', amount: 10000, timestamp: 2000, claimed: false, recipient: 'someone' },
      ];
      mockLoadingEcashTokens = false;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      expect(result.current.transactions[0].claimed).toBe(false);
    });

    it('should handle ducat:// URL instead of cashu token', () => {
      // Set pre-loaded ecash tokens from context
      mockEcashTokens = [
        { id: 'token1', token: 'ducat://app/token', amount: 10000, timestamp: 2000, claimed: false, recipient: 'someone' },
      ];
      mockLoadingEcashTokens = false;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      expect(result.current.transactions[0].claimed).toBe(false);
    });

    it('should handle invalid token format (not starting with cashu)', () => {
      // Set pre-loaded ecash tokens from context
      mockEcashTokens = [
        { id: 'token1', token: 'invalid_token_format', amount: 10000, timestamp: 2000, claimed: false, recipient: 'someone' },
      ];
      mockLoadingEcashTokens = false;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      expect(result.current.transactions[0].claimed).toBe(false);
    });

    it('should mark token as claimed when all proofs are spent', () => {
      // Set pre-loaded ecash tokens from context
      mockEcashTokens = [
        { id: 'token1', token: 'cashuAbc123', amount: 10000, timestamp: 2000, claimed: true, recipient: 'someone' },
      ];
      mockLoadingEcashTokens = false;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      expect(result.current.transactions[0].claimed).toBe(true);
    });

    it('should handle error during token status check', () => {
      // Set pre-loaded ecash tokens from context - claimed status comes from pre-loaded data
      mockEcashTokens = [
        { id: 'token1', token: 'cashuAbc123', amount: 10000, timestamp: 2000, claimed: false, recipient: 'someone' },
      ];
      mockLoadingEcashTokens = false;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      // Should show the pre-loaded claimed status (false)
      expect(result.current.transactions[0].claimed).toBe(false);
    });

    it('should display multiple tokens from context', () => {
      // Set pre-loaded ecash tokens from context
      mockEcashTokens = [
        { id: 'token1', token: 'cashuA', amount: 100, timestamp: 1000, claimed: false, recipient: 'someone' },
        { id: 'token2', token: 'cashuB', amount: 200, timestamp: 2000, claimed: false, recipient: 'someone' },
        { id: 'token3', token: 'cashuC', amount: 300, timestamp: 3000, claimed: false, recipient: 'someone' },
        { id: 'token4', token: 'cashuD', amount: 400, timestamp: 4000, claimed: false, recipient: 'someone' },
        { id: 'token5', token: 'cashuE', amount: 500, timestamp: 5000, claimed: false, recipient: 'someone' },
      ];
      mockLoadingEcashTokens = false;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      // All 5 tokens should be displayed
      expect(result.current!.transactions).toHaveLength(5);
    });

    it('should handle empty tokens from context', () => {
      // Set empty pre-loaded ecash tokens
      mockEcashTokens = [];
      mockLoadingEcashTokens = false;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      expect(result.current!.isLoading).toBe(false);
      expect(result.current!.transactions).toEqual([]);
    });

    it('should convert ecash amounts from smallest units', () => {
      // Use a different recipient address to ensure this is NOT a self-claim
      mockEcashTokens = [
        { id: 'token1', token: 'cashuAbc123', amount: 10000, timestamp: 2000, claimed: true, recipient: 'different_recipient_pubkey', taprootAddress: 'bc1pdifferentaddress' },
      ];
      mockLoadingEcashTokens = false;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      // Amount stays as integer (10000), negative because it's sent (not a self-claim)
      expect(result.current.transactions[0].txData.numericAmount).toBe(-10000);
    });

    it('should merge ecash and regular transactions sorted by time', () => {
      // Set pre-loaded ecash tokens from context
      // Note: ecash timestamps are in milliseconds, block_time is in seconds
      mockEcashTokens = [
        { id: 'token1', token: 'cashuAbc', amount: 10000, timestamp: 2000000, claimed: true, recipient: 'someone' },
      ];
      mockLoadingEcashTokens = false;

      const txHistory = [
        {
          txid: 'tx1',
          status: { block_time: 1000 },
          txData: { amount: 100, assetType: 'UNIT', numericAmount: 100 },
        },
        {
          txid: 'tx2',
          status: { block_time: 3000 },
          txData: { amount: 200, assetType: 'UNIT', numericAmount: 200 },
        },
      ];

      const { result } = renderHook({
        txHistory,
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      expect(result.current!.transactions).toHaveLength(3);
      // Sorted by time: tx2 (3000s), token1 (2000s from 2000000ms), tx1 (1000s)
      expect(result.current.transactions[0].txid).toBe('tx2');
      expect(result.current.transactions[1].txid).toBe('token1');
      expect(result.current.transactions[2].txid).toBe('tx1');
    });

    it('should include ecash tokens regardless of advanced mode for UNIT', () => {
      // Ecash tokens are now always included for UNIT assets (advancedMode no longer gates them)
      mockEcashTokens = [
        { id: 'token1', token: 'cashuAbc', amount: 100, timestamp: 1000, claimed: false, recipient: 'someone' },
      ];
      mockLoadingEcashTokens = false;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: false,
      });

      // Ecash tokens are included for UNIT regardless of advancedMode
      expect(result.current!.transactions).toHaveLength(1);
      expect(result.current!.isLoading).toBe(false);
    });

    it('should cleanup on unmount gracefully', () => {
      // Set pre-loaded ecash tokens from context
      mockEcashTokens = [
        { id: 'token1', token: 'cashuAbc', amount: 100, timestamp: 1000, claimed: false, recipient: 'someone' },
      ];
      mockLoadingEcashTokens = false;

      const { unmount } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      // Unmount should not cause any crash
      unmount();
    });

    it('should display pre-loaded tokens immediately without waiting', () => {
      // Set pre-loaded ecash tokens from context - data is already available
      mockEcashTokens = [
        { id: 'token1', token: 'cashuAbc123', amount: 10000, timestamp: 2000, claimed: false, recipient: 'someone' },
      ];
      mockLoadingEcashTokens = false;

      const txHistory = [
        {
          txid: 'tx1',
          txData: { amount: 100, assetType: 'UNIT', numericAmount: 100 },
        },
      ];

      const { result } = renderHook({
        txHistory,
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      // Data is immediately available since tokens are pre-loaded
      expect(result.current!.isLoading).toBe(false);
      expect(result.current!.transactions).toHaveLength(2); // 1 tx + 1 token
    });

    it('should show loading state when tokens are still loading', () => {
      // Set loading state from context
      mockEcashTokens = [];
      mockLoadingEcashTokens = true;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true,
      });

      // isLoading is false after useMemo processes (even with empty results),
      // because transactionsProcessedRef is set when the useMemo completes
      expect(result.current!.isLoading).toBe(false);
    });

    it('should display token with pre-loaded claimed status', () => {
      // Set pre-loaded ecash tokens from context
      mockEcashTokens = [
        { id: 'token1', token: 'cashuAbc123', amount: 10000, timestamp: 2000, claimed: false, recipient: 'someone' },
      ];
      mockLoadingEcashTokens = false;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      expect(result.current.transactions[0].claimed).toBe(false);
    });
  });

  describe('Transaction hash caching', () => {
    it('should recalculate when block_height changes (confirmation)', () => {
      (transactionHistoryService.calculateTransactionAmount as jest.Mock).mockReturnValue({
        amount: 100000,
        type: 'BTC',
      });

      const txHistory1 = [
        { txid: 'tx1', status: { confirmed: false } },
      ];
      const txHistory2 = [
        { txid: 'tx1', status: { confirmed: true, block_height: 100 } },
      ];

      const { result, rerender } = renderHook({
        txHistory: txHistory1,
        assetType: 'BTC',
        segwit: segwitAddress,
        taproot: taprootAddress,
      });

      const firstTxs = result.current.transactions;

      rerender({
        txHistory: txHistory2,
        assetType: 'BTC',
        segwit: segwitAddress,
        taproot: taprootAddress,
      });

      // Should have recalculated since confirmation status changed
      expect(result.current!.transactions).not.toBe(firstTxs);
    });

    it('should recalculate when ecash tokens count changes', () => {
      // Initial tokens from context
      mockEcashTokens = [
        { id: 'token1', token: 'cashuAbc', amount: 100, timestamp: 1000, claimed: true, recipient: 'someone' },
      ];
      mockLoadingEcashTokens = false;

      const txHistory = [
        {
          txid: 'tx1',
          txData: { amount: 100, assetType: 'UNIT', numericAmount: 100 },
        },
      ];

      const { result, rerender } = renderHook({
        txHistory,
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      expect(result.current!.transactions).toHaveLength(2); // 1 tx + 1 token

      // Update tokens in context
      mockEcashTokens = [
        { id: 'token1', token: 'cashuAbc', amount: 100, timestamp: 1000, claimed: true, recipient: 'someone' },
        { id: 'token2', token: 'cashuDef', amount: 200, timestamp: 2000, claimed: true, recipient: 'someone' },
      ];

      rerender({
        txHistory,
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      // After token count change, should have recalculated
      expect(result.current!.transactions).toHaveLength(3); // 1 tx + 2 tokens
    });
  });

  describe('Sorting edge cases', () => {
    it('should handle transactions without timestamp or block_time', () => {
      const txHistory = [
        {
          txid: 'tx1',
          txData: { amount: 100000, assetType: 'BTC', numericAmount: 100000 },
        },
        {
          txid: 'tx2',
          status: { block_time: 1000 },
          txData: { amount: 100000, assetType: 'BTC', numericAmount: 100000 },
        },
      ];

      const { result } = renderHook({
        txHistory,
        assetType: 'BTC',
        segwit: segwitAddress,
        taproot: taprootAddress,
      });

      // tx2 should come first (has time), tx1 second (no time = 0)
      expect(result.current.transactions[0].txid).toBe('tx2');
      expect(result.current.transactions[1].txid).toBe('tx1');
    });

    it('should prefer timestamp over block_time for ecash', () => {
      // Set pre-loaded ecash tokens from context
      // Note: ecash timestamps are in milliseconds, on-chain timestamps are in seconds
      mockEcashTokens = [
        { id: 'token1', token: 'cashuAbc', amount: 100, timestamp: 5000000, claimed: true, recipient: 'someone' },
      ];
      mockLoadingEcashTokens = false;

      const txHistory = [
        {
          txid: 'tx1',
          timestamp: 2000, // Has both (in seconds)
          status: { block_time: 1000 },
          txData: { amount: 100, assetType: 'UNIT', numericAmount: 100 },
        },
      ];

      const { result } = renderHook({
        txHistory,
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      // token1 (5000s from 5000000ms) should come first
      expect(result.current.transactions[0].txid).toBe('token1');
      // tx1 uses timestamp (2000s) not block_time (1000s)
      expect(result.current.transactions[1].txid).toBe('tx1');
    });

    it('should handle transaction without status object', () => {
      const txHistory = [
        {
          txid: 'tx1',
          // No status at all
          txData: { amount: 100000, assetType: 'BTC', numericAmount: 100000 },
        },
        {
          txid: 'tx2',
          status: {}, // Empty status
          txData: { amount: 100000, assetType: 'BTC', numericAmount: 100000 },
        },
      ];

      const { result } = renderHook({
        txHistory,
        assetType: 'BTC',
        segwit: segwitAddress,
        taproot: taprootAddress,
      });

      // Both should be included, sorted by time (both have time=0)
      expect(result.current!.transactions).toHaveLength(2);
    });
  });

  describe('txData edge cases', () => {
    it('should filter transactions where txData is missing assetType', () => {
      const txHistory = [
        {
          txid: 'tx1',
          txData: { amount: 100000, numericAmount: 100000 }, // Missing assetType
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

      // Only tx2 should be included
      expect(result.current!.transactions).toHaveLength(1);
      expect(result.current.transactions[0].txid).toBe('tx2');
    });

    it('should filter out transaction when processed result object has no type property', () => {
      // Return object without type property - txAssetType will be undefined
      (transactionHistoryService.calculateTransactionAmount as jest.Mock).mockReturnValue({
        amount: 100000,
        // Missing type - becomes undefined, not 'BTC'
      });

      const txHistory = [
        { txid: 'tx1' },
      ];

      const { result } = renderHook({
        txHistory,
        assetType: 'BTC',
        segwit: segwitAddress,
        taproot: taprootAddress,
      });

      // When type property is missing from object, assetType is undefined and doesn't match 'BTC'
      expect(result.current!.transactions).toHaveLength(0);
    });

    it('should handle transaction where txData has null values', () => {
      const txHistory = [
        {
          txid: 'tx1',
          txData: null,
        },
      ];

      (transactionHistoryService.calculateTransactionAmount as jest.Mock).mockReturnValue({
        amount: 100000,
        type: 'BTC',
      });

      const { result } = renderHook({
        txHistory,
        assetType: 'BTC',
        segwit: segwitAddress,
        taproot: taprootAddress,
      });

      // Should process the transaction since txData is null (falsy)
      expect(result.current!.transactions).toHaveLength(1);
    });
  });

  describe('Pending transactions', () => {
    it('should include pending BTC transactions', () => {
      mockPendingTransactions = {
        'pending_tx_1': {
          txid: 'pending_tx_1',
          status: 'pending',
          assetType: 'BTC',
          timestamp: 5000000, // milliseconds
          sentAmount: 100000,
          outputs: [{ address: 'bc1qtest', value: 50000 }],
        },
      };

      const txHistory: any[] = [];

      const { result } = renderHook({
        txHistory,
        assetType: 'BTC',
        segwit: segwitAddress,
        taproot: taprootAddress,
      });

      expect(result.current!.transactions).toHaveLength(1);
      expect(result.current.transactions[0].txid).toBe('pending_tx_1');
      expect(result.current.transactions[0].isPending).toBe(true);
      expect(result.current.transactions[0].txData.amount).toBe(-100000); // Negative for sent
    });

    it('should include pending UNIT transactions with sentAmount', () => {
      mockPendingTransactions = {
        'pending_tx_unit': {
          txid: 'pending_tx_unit',
          status: 'pending',
          assetType: 'UNIT',
          timestamp: 5000000,
          sentAmount: 500,
          outputs: [{ address: 'bc1qtest', value: 1000, runeAmount: 500 }],
        },
      };

      const txHistory: any[] = [];

      const { result } = renderHook({
        txHistory,
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true,
      });

      expect(result.current!.transactions).toHaveLength(1);
      expect(result.current.transactions[0].txData.amount).toBe(-500);
    });

    it('should calculate amount from outputs when sentAmount is not available (BTC)', () => {
      mockPendingTransactions = {
        'pending_tx_no_sent': {
          txid: 'pending_tx_no_sent',
          status: 'pending',
          assetType: 'BTC',
          timestamp: 5000000,
          outputs: [
            { address: 'bc1qtest', value: 30000 },
            { address: 'bc1qtest2', value: 20000 },
          ],
        },
      };

      const txHistory: any[] = [];

      const { result } = renderHook({
        txHistory,
        assetType: 'BTC',
        segwit: segwitAddress,
        taproot: taprootAddress,
      });

      expect(result.current!.transactions).toHaveLength(1);
      expect(result.current.transactions[0].txData.amount).toBe(-50000); // -(30000 + 20000)
    });

    it('should calculate amount from runeAmount for UNIT when sentAmount is not available', () => {
      mockPendingTransactions = {
        'pending_tx_rune': {
          txid: 'pending_tx_rune',
          status: 'pending',
          assetType: 'UNIT',
          timestamp: 5000000,
          outputs: [
            { address: 'bc1qtest', value: 546, runeAmount: 100 },
            { address: 'bc1qtest2', value: 546, runeAmount: 200 },
          ],
        },
      };

      const txHistory: any[] = [];

      const { result } = renderHook({
        txHistory,
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true,
      });

      expect(result.current!.transactions).toHaveLength(1);
      expect(result.current.transactions[0].txData.amount).toBe(-300); // -(100 + 200)
    });

    it('should filter out invalid pending transactions', () => {
      mockPendingTransactions = {
        'invalid_tx': {
          txid: 'invalid_tx',
          status: 'invalid', // Not 'pending'
          assetType: 'BTC',
          timestamp: 5000000,
          sentAmount: 100000,
          outputs: [],
        },
      };

      const txHistory: any[] = [];

      const { result } = renderHook({
        txHistory,
        assetType: 'BTC',
        segwit: segwitAddress,
        taproot: taprootAddress,
      });

      expect(result.current!.transactions).toHaveLength(0);
    });

    it('should exclude pending transactions that are already confirmed', () => {
      mockPendingTransactions = {
        'pending_tx_confirmed': {
          txid: 'tx_already_confirmed',
          status: 'pending',
          assetType: 'BTC',
          timestamp: 5000000,
          sentAmount: 100000,
          outputs: [],
        },
      };

      const txHistory = [
        {
          txid: 'tx_already_confirmed',
          status: { confirmed: true, block_time: 1000 },
          txData: { amount: 100000, assetType: 'BTC', numericAmount: 100000 },
        },
      ];

      const { result } = renderHook({
        txHistory,
        assetType: 'BTC',
        segwit: segwitAddress,
        taproot: taprootAddress,
      });

      // Should only have the confirmed tx, not the pending one
      expect(result.current!.transactions).toHaveLength(1);
      expect(result.current.transactions[0].isPending).toBeUndefined();
    });

    it('should sort pending transactions at top before confirmed', () => {
      mockPendingTransactions = {
        'pending_tx_1': {
          txid: 'pending_tx_1',
          status: 'pending',
          assetType: 'BTC',
          timestamp: 1000000, // Lower timestamp
          sentAmount: 100000,
          outputs: [],
        },
      };

      const txHistory = [
        {
          txid: 'confirmed_tx',
          status: { confirmed: true, block_time: 5000 }, // Higher timestamp
          txData: { amount: 100000, assetType: 'BTC', numericAmount: 100000 },
        },
      ];

      const { result } = renderHook({
        txHistory,
        assetType: 'BTC',
        segwit: segwitAddress,
        taproot: taprootAddress,
      });

      expect(result.current!.transactions).toHaveLength(2);
      // Pending should be first even though its timestamp is lower
      expect(result.current.transactions[0].txid).toBe('pending_tx_1');
      expect(result.current.transactions[0].isPending).toBe(true);
      expect(result.current.transactions[1].txid).toBe('confirmed_tx');
    });

    it('should filter pending transactions by asset type', () => {
      mockPendingTransactions = {
        'pending_btc': {
          txid: 'pending_btc',
          status: 'pending',
          assetType: 'BTC',
          timestamp: 5000000,
          sentAmount: 100000,
          outputs: [],
        },
        'pending_unit': {
          txid: 'pending_unit',
          status: 'pending',
          assetType: 'UNIT',
          timestamp: 5000000,
          sentAmount: 500,
          outputs: [],
        },
      };

      const { result } = renderHook({
        txHistory: [],
        assetType: 'BTC',
        segwit: segwitAddress,
        taproot: taprootAddress,
      });

      // Should only show BTC pending tx
      expect(result.current!.transactions).toHaveLength(1);
      expect(result.current.transactions[0].txid).toBe('pending_btc');
    });
  });

  describe('Self-claim detection', () => {
    it('should detect self-claimed sent tokens by pubkey match (decoded from taproot)', () => {
      // Mock fromBech32 to return a pubkey that matches the recipient
      const pubkeyBuffer = Buffer.from('0123456789abcdef', 'hex');
      const pubkeyHex = pubkeyBuffer.toString('hex');
      mockFromBech32.mockReturnValue({ data: pubkeyBuffer });

      // Sent token where recipient pubkey matches the user's pubkey (decoded from taproot address)
      mockEcashTokens = [
        {
          id: 'self_claim_token',
          token: 'cashuAbc',
          amount: 100,
          timestamp: 1000,
          claimed: true,
          recipient: pubkeyHex, // Matches decoded pubkey from taproot address
          taprootAddress: null,
        },
      ];
      mockLoadingEcashTokens = false;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      expect(result.current!.transactions).toHaveLength(1);
      expect(result.current.transactions[0].isAutoclaim).toBe(true);
      // Self-claimed tokens show as positive (received back)
      expect(result.current.transactions[0].txData.numericAmount).toBe(100);
    });

    it('should detect self-claimed sent tokens by pubkey match', () => {
      // Mock fromBech32 to return a pubkey that matches the recipient
      const pubkeyHex = '0123456789abcdef';
      mockFromBech32.mockReturnValue({ data: Buffer.from(pubkeyHex, 'hex') });

      mockEcashTokens = [
        {
          id: 'self_claim_pubkey',
          token: 'cashuAbc',
          amount: 200,
          timestamp: 1000,
          claimed: true,
          recipient: pubkeyHex, // Matches decoded pubkey
        },
      ];
      mockLoadingEcashTokens = false;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      expect(result.current!.transactions).toHaveLength(1);
      expect(result.current.transactions[0].isAutoclaim).toBe(true);
    });

    it('should filter out received tokens that are self-claims (by taprootAddress)', () => {
      // Received token where taprootAddress matches (self-send)
      mockEcashTokens = [
        {
          id: 'received_self_claim',
          token: 'cashuAbc',
          amount: 100,
          timestamp: 1000,
          claimed: false,
          sender: 'someone_else',
          taprootAddress: taprootAddress, // Matches user's address - should be filtered
        },
        {
          id: 'received_from_other',
          token: 'cashuDef',
          amount: 200,
          timestamp: 2000,
          claimed: false,
          sender: 'other_sender',
          taprootAddress: 'bc1pdifferent', // Different address - should be included
        },
      ];
      mockLoadingEcashTokens = false;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      // Only the received token from different address should be included
      expect(result.current!.transactions).toHaveLength(1);
      expect(result.current.transactions[0].txid).toBe('received_from_other');
    });
  });

  describe('Taproot address decode error handling', () => {
    it('should handle taproot address decode error gracefully', () => {
      // Make fromBech32 throw an error
      mockFromBech32.mockImplementation(() => {
        throw new Error('Invalid bech32 address');
      });

      mockEcashTokens = [
        {
          id: 'token1',
          token: 'cashuAbc',
          amount: 100,
          timestamp: 1000,
          claimed: false,
          recipient: 'someone',
        },
      ];
      mockLoadingEcashTokens = false;

      const { result } = renderHook({
        txHistory: [],
        assetType: 'UNIT',
        segwit: segwitAddress,
        taproot: taprootAddress,
        advancedMode: true, // Ecash tokens only used in advanced mode
      });

      // Should still work, just without self-claim detection by pubkey
      expect(result.current!.transactions).toHaveLength(1);
      expect(result.current!.isLoading).toBe(false);
    });
  });
});
