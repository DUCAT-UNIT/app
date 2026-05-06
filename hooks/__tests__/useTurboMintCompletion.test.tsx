/**
 * Tests for useTurboMintCompletion hook
 * Covers mint completion polling, P2PK token creation, and error handling
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useTurboMintCompletion } from '../useTurboMintCompletion';
import { notify } from '../../utils/notify';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock service functions
const mockCompleteMint = jest.fn();
const mockCheckMintQuote = jest.fn();
const mockSendP2PKToken = jest.fn();
const mockExtractPubkeyFromTaprootAddress = jest.fn();
const mockSaveSentLockedToken = jest.fn();
const mockShortenCashuToken = jest.fn();

jest.mock('../../services/cashu/cashuWalletService', () => ({
  checkMintQuote: (...args: any[]) => mockCheckMintQuote(...args),
  completeMint: (...args: any[]) => mockCompleteMint(...args),
  getMintQuoteAvailableAmount: (quote: { amount_paid?: number; amount_issued?: number }) =>
    Math.max(0, (quote.amount_paid ?? 0) - (quote.amount_issued ?? 0)),
  sendP2PKToken: (...args: any[]) => mockSendP2PKToken(...args),
}));

jest.mock('../../utils/bitcoin', () => ({
  extractPubkeyFromTaprootAddress: (...args: any[]) => mockExtractPubkeyFromTaprootAddress(...args),
}));

jest.mock('../../services/cashu/cashuLockedTokensService', () => ({
  saveSentLockedToken: (...args: any[]) => mockSaveSentLockedToken(...args),
}));

jest.mock('../../services/urlShortener', () => ({
  shortenCashuToken: (...args: any[]) => mockShortenCashuToken(...args),
}));

jest.mock('../../services/cashu/cashuTurboRecovery', () => ({
  savePendingTurboSend: jest.fn().mockResolvedValue(undefined),
  updateTurboSendStage: jest.fn().mockResolvedValue(undefined),
  clearPendingTurboSend: jest.fn().mockResolvedValue(undefined),
}));

// Helper to render hooks with props
function renderHookWithProps(props: any) {
  const result: { current: ReturnType<typeof useTurboMintCompletion> | null } = { current: null };
  function TestComponent({ hookProps }: { hookProps?: any }) {
    result.current = useTurboMintCompletion(hookProps);
    return null;
  }
  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent hookProps={props} />);
  });
  return {
    result,
    unmount: component!.unmount,
    component,
    rerender: (newProps?: unknown) => {
      act(() => {
        component?.update(<TestComponent hookProps={newProps} />);
      });
    },
  };
}

// Helper: advance through the async polling loop.
// jest.advanceTimersByTimeAsync resolves setTimeout AND flushes the microtask queue.
const advanceThroughPolling = async () => {
  await act(async () => {
    // Flush pending microtasks from effect + savePendingTurboSend
    await jest.advanceTimersByTimeAsync(0);
    // Advance past the 2000ms setTimeout in the polling loop
    await jest.advanceTimersByTimeAsync(2100);
    // Flush downstream awaits (completeMint, updateTurboSendStage, P2PK, etc.)
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(0);
    // Flush fetchTransactionHistory + fetchBalance + refreshCashuBalance + notify
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(0);
  });
};

// Helper: exhaust the full 120-iteration polling loop.
const exhaustPollingLoop = async () => {
  await act(async () => {
    for (let i = 0; i < 125; i++) {
      await jest.advanceTimersByTimeAsync(2100);
    }
    // Final flushes for post-loop code
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(0);
  });
};

describe('useTurboMintCompletion', () => {
  let mockProps: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockProps = {
      isTurbo: false,
      mintQuoteId: null,
      mintAmount: 100,
      turboRecipient: null,
      skipMint: false,
      senderTaprootAddress: 'tb1psender123',
      fetchTransactionHistory: jest.fn().mockResolvedValue(undefined),
      fetchBalance: jest.fn().mockResolvedValue(undefined),
      refreshCashuBalance: jest.fn().mockResolvedValue(undefined),
    };

    // Default mocks
    mockCheckMintQuote.mockResolvedValue({ state: 'PENDING', amount: 100 });
    mockCompleteMint.mockResolvedValue([{ amount: 100 }]);
    mockExtractPubkeyFromTaprootAddress.mockReturnValue('02pubkey123');
    mockSendP2PKToken.mockResolvedValue({ token: 'cashuAtoken123' });
    mockShortenCashuToken.mockResolvedValue('https://short.url/abc');
    mockSaveSentLockedToken.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return initial state', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(result.current!.turboToken).toBe(null);
    expect(result.current!.turboDeeplink).toBe(null);
    expect(result.current!.processingStage).toBe('ready');
    expect(result.current!.isCompletingMint).toBe(false);
  });

  it('should set processingStage to ready when skipMint is true', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      isTurbo: true,
      skipMint: true,
    });

    expect(result.current!.processingStage).toBe('ready');
  });

  it('should set processingStage to ready when isTurbo is false', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      isTurbo: false,
    });

    expect(result.current!.processingStage).toBe('ready');
  });

  it('should set processingStage to converting when isTurbo is true and not skipped', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      isTurbo: true,
      skipMint: false,
    });

    expect(result.current!.processingStage).toBe('converting');
  });

  it('should not start completion when isTurbo is false', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      isTurbo: false,
      mintQuoteId: 'quote123',
    });

    expect(result.current!.isCompletingMint).toBe(false);
    expect(mockCheckMintQuote).not.toHaveBeenCalled();
  });

  it('should not start completion when skipMint is true', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      isTurbo: true,
      mintQuoteId: 'quote123',
      skipMint: true,
    });

    expect(result.current!.isCompletingMint).toBe(false);
    expect(mockCheckMintQuote).not.toHaveBeenCalled();
  });

  it('should not start completion when mintQuoteId is missing', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      isTurbo: true,
      mintQuoteId: null,
    });

    expect(result.current!.isCompletingMint).toBe(false);
    expect(mockCheckMintQuote).not.toHaveBeenCalled();
  });

  it('should return stable state across rerenders when conditions not met', () => {
    const props = {
      ...mockProps,
      isTurbo: false,
    };

    const { result, rerender } = renderHookWithProps(props);
    const firstToken = result.current!.turboToken;
    const firstDeeplink = result.current!.turboDeeplink;

    rerender(props);

    expect(result.current!.turboToken).toBe(firstToken);
    expect(result.current!.turboDeeplink).toBe(firstDeeplink);
  });

  it('should have correct return type structure', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(result.current).toHaveProperty('turboToken');
    expect(result.current).toHaveProperty('turboDeeplink');
    expect(result.current).toHaveProperty('processingStage');
    expect(result.current).toHaveProperty('isCompletingMint');
  });

  it('should handle turboRecipient in props', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      isTurbo: true,
      turboRecipient: 'tb1precipient456',
    });

    // Should still set converting stage
    expect(result.current!.processingStage).toBe('converting');
  });

  it('should handle different mintAmount values', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      isTurbo: true,
      mintAmount: 500,
    });

    expect(result.current!.processingStage).toBe('converting');
  });

  describe('Mint completion flow', () => {
    it('should poll for payment and complete mint on PAID state', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
      });

      await advanceThroughPolling();

      expect(mockCheckMintQuote).toHaveBeenCalledWith('quote123');
      expect(mockCompleteMint).toHaveBeenCalledWith('quote123', 100);
    });

    it('should complete mint when live UNIT quote reports amount_paid without amount', async () => {
      mockCheckMintQuote.mockResolvedValue({
        quote: 'quote123',
        amount_paid: 125,
        amount_issued: 25,
      });

      renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
        mintAmount: 100,
      });

      await advanceThroughPolling();

      expect(mockCheckMintQuote).toHaveBeenCalledWith('quote123');
      expect(mockCompleteMint).toHaveBeenCalledWith('quote123', 100);
      expect(notify.transaction.success).toHaveBeenCalledWith('convert');
    });

    it('should poll for payment and complete mint on ISSUED state', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'ISSUED', amount: 200 });

      renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote456',
      });

      await advanceThroughPolling();

      expect(mockCompleteMint).toHaveBeenCalledWith('quote456', 200);
    });

    it('should continue to P2PK when accounting says quote is already issued', async () => {
      mockCheckMintQuote.mockResolvedValue({
        state: 'ISSUED',
        amount_paid: 100,
        amount_issued: 100,
      });

      renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
        turboRecipient: 'tb1precipient789',
        mintAmount: 100,
      });

      await advanceThroughPolling();

      expect(mockCompleteMint).not.toHaveBeenCalled();
      expect(mockSendP2PKToken).toHaveBeenCalledWith(
        100,
        '02pubkey123',
        {},
        undefined,
        'tb1precipient789'
      );
    });

    it('should create P2PK token when turboRecipient is provided', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
        turboRecipient: 'tb1precipient789',
        mintAmount: 100,
      });

      await advanceThroughPolling();

      expect(mockExtractPubkeyFromTaprootAddress).toHaveBeenCalledWith('tb1precipient789');
      expect(mockSendP2PKToken).toHaveBeenCalledWith(
        100,
        '02pubkey123',
        {},
        undefined,
        'tb1precipient789'
      );
      expect(mockShortenCashuToken).toHaveBeenCalledWith('cashuAtoken123');
      expect(mockSaveSentLockedToken).toHaveBeenCalled();
    });

    it('should show send notification when turboRecipient is provided', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
        turboRecipient: 'tb1precipient789',
      });

      await advanceThroughPolling();

      expect(notify.transaction.success).toHaveBeenCalledWith('send');
    });

    it('should show convert notification when no turboRecipient', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
        turboRecipient: null,
      });

      await advanceThroughPolling();

      expect(notify.transaction.success).toHaveBeenCalledWith('convert');
    });

    it('should show toast when payment not confirmed after timeout', async () => {
      // Always return pending state
      mockCheckMintQuote.mockResolvedValue({ state: 'PENDING', amount: 100 });

      renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
      });

      await exhaustPollingLoop();

      expect(notify.cashu.paymentSentAwaiting).toHaveBeenCalled();
    }, 30000);

    it('should handle error during mint completion', async () => {
      mockCheckMintQuote.mockRejectedValue(new Error('Network error'));

      renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
      });

      // Poll errors are caught and retried; after maxAttempts the flow times out
      await exhaustPollingLoop();

      // After 120 failed polls, paidQuote is null → paymentSentAwaiting
      expect(notify.cashu.paymentSentAwaiting).toHaveBeenCalled();
    }, 30000);

    it('should handle error when pubkey extraction fails', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });
      mockExtractPubkeyFromTaprootAddress.mockReturnValue(null);

      const { result } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
        turboRecipient: 'tb1precipient789',
      });

      await advanceThroughPolling();

      // Should still transition to ready on error
      expect(result.current!.processingStage).toBe('ready');
    });

    it('should handle error when sendP2PKToken returns no token', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });
      mockSendP2PKToken.mockResolvedValue({ token: null });

      const { result } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
        turboRecipient: 'tb1precipient789',
      });

      await advanceThroughPolling();

      // Should still transition to ready on error
      expect(result.current!.processingStage).toBe('ready');
    });

    it('should refresh transaction history after successful mint', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
      });

      await advanceThroughPolling();

      expect(mockProps.fetchTransactionHistory).toHaveBeenCalled();
      expect(mockProps.refreshCashuBalance).toHaveBeenCalled();
    });

    it('should not restart completion if already completed', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      const { result, rerender } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
      });

      await advanceThroughPolling();

      const callCount = mockCheckMintQuote.mock.calls.length;

      // Rerender with same props
      rerender({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
      });

      await advanceThroughPolling();

      // Should not have called again due to hasMintCompleted ref
      expect(mockCheckMintQuote.mock.calls.length).toBe(callCount);
    });

    it('should handle non-Error exception during completion', async () => {
      mockCheckMintQuote.mockRejectedValue('String error');

      renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
      });

      // Poll errors are caught and retried; after maxAttempts the flow times out
      await exhaustPollingLoop();

      expect(notify.cashu.paymentSentAwaiting).toHaveBeenCalled();
    }, 30000);

    it('should handle non-Error exception in storage error path', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });
      mockSaveSentLockedToken.mockRejectedValue('Storage string error');

      const { result } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
        turboRecipient: 'tb1precipient789',
      });

      await advanceThroughPolling();

      // Should still transition to ready on error
      expect(result.current!.processingStage).toBe('ready');
      expect(notify.cashu.conversionFailed).toHaveBeenCalledWith('Storage string error');
      expect(notify.transaction.success).not.toHaveBeenCalledWith('send');
    });
  });
});
