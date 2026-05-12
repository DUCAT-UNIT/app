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
const mockGetBalance = jest.fn();
const mockSendP2PKToken = jest.fn();
const mockExtractPubkeyFromTaprootAddress = jest.fn();
const mockSaveSentLockedToken = jest.fn();
const mockGenerateTurboDeeplink = jest.fn();
const mockSavePendingTurboSend = jest.fn();
const mockUpdateTurboSendStage = jest.fn();
const mockClearPendingTurboSend = jest.fn();
const mockLoadPendingTurboSend = jest.fn();
const mockGetMinimumTurboBalanceAfterMint = jest.fn();
const mockGetCurrentCashuAccount = jest.fn();

jest.mock('../../services/cashu/cashuWalletService', () => ({
  checkMintQuote: (...args: any[]) => mockCheckMintQuote(...args),
  completeMint: (...args: any[]) => mockCompleteMint(...args),
  getBalance: (...args: any[]) => mockGetBalance(...args),
  getMintQuoteAvailableAmount: (quote: { amount_paid?: number; amount_issued?: number }) =>
    Math.max(0, (quote.amount_paid ?? 0) - (quote.amount_issued ?? 0)),
  sendP2PKToken: (...args: any[]) => mockSendP2PKToken(...args),
}));

jest.mock('../../services/cashu/cashuProofManager', () => ({
  getCurrentCashuAccount: () => mockGetCurrentCashuAccount(),
}));

jest.mock('../../utils/bitcoin', () => ({
  extractPubkeyFromTaprootAddress: (...args: any[]) => mockExtractPubkeyFromTaprootAddress(...args),
}));

jest.mock('../../services/cashu/cashuLockedTokensService', () => ({
  generateTurboDeeplink: (...args: any[]) => mockGenerateTurboDeeplink(...args),
  saveSentLockedToken: (...args: any[]) => mockSaveSentLockedToken(...args),
}));

jest.mock('../../services/cashu/cashuTurboRecovery', () => ({
  savePendingTurboSend: (...args: unknown[]) => mockSavePendingTurboSend(...args),
  updateTurboSendStage: (...args: unknown[]) => mockUpdateTurboSendStage(...args),
  clearPendingTurboSend: (...args: unknown[]) => mockClearPendingTurboSend(...args),
  loadPendingTurboSend: (...args: unknown[]) => mockLoadPendingTurboSend(...args),
  getMinimumTurboBalanceAfterMint: (...args: unknown[]) =>
    mockGetMinimumTurboBalanceAfterMint(...args),
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

// Helper: exhaust the full 300-iteration polling loop.
const exhaustPollingLoop = async () => {
  await act(async () => {
    for (let i = 0; i < 305; i++) {
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
    mockGetBalance.mockResolvedValue(100);
    mockExtractPubkeyFromTaprootAddress.mockReturnValue('02pubkey123');
    mockSendP2PKToken.mockResolvedValue({ token: 'cashuAtoken123' });
    mockGenerateTurboDeeplink.mockResolvedValue('https://short.url/abc');
    mockSaveSentLockedToken.mockResolvedValue(undefined);
    mockSavePendingTurboSend.mockResolvedValue(undefined);
    mockUpdateTurboSendStage.mockResolvedValue(undefined);
    mockClearPendingTurboSend.mockResolvedValue(undefined);
    mockLoadPendingTurboSend.mockResolvedValue(null);
    mockGetMinimumTurboBalanceAfterMint.mockReturnValue(100);
    mockGetCurrentCashuAccount.mockReturnValue('tb1psender123');
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

      const { result } = renderHookWithProps({
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

      const { result } = renderHookWithProps({
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

      const { result } = renderHookWithProps({
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

      const { result } = renderHookWithProps({
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

    it('should not create P2PK from existing balance when issued top-up proofs are not recovered', async () => {
      mockCheckMintQuote.mockResolvedValue({
        state: 'ISSUED',
        amount_paid: 400,
        amount_issued: 400,
      });
      mockLoadPendingTurboSend.mockResolvedValue({
        quoteId: 'quote123',
        recipient: 'tb1precipient789',
        amount: 1000,
        mintAmount: 400,
        preMintBalance: 700,
        senderTaprootAddress: 'tb1psender123',
        createdAt: Date.now(),
        stage: 'waiting_for_mint',
        unit: 'sat',
      });
      mockGetMinimumTurboBalanceAfterMint.mockReturnValue(1100);
      mockGetBalance.mockResolvedValue(1000);

      const { result } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
        turboRecipient: 'tb1precipient789',
        mintAmount: 1000,
        mintClaimAmount: 400,
        cashuUnit: 'sat',
      });

      await advanceThroughPolling();

      expect(mockCompleteMint).not.toHaveBeenCalled();
      expect(mockSendP2PKToken).not.toHaveBeenCalled();
      expect(mockClearPendingTurboSend).not.toHaveBeenCalled();
      expect(notify.cashu.conversionFailed).toHaveBeenCalledWith(
        expect.stringContaining('recovered Turbo balance is not spendable yet')
      );
    });

    it('should create P2PK token when turboRecipient is provided', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      const { result } = renderHookWithProps({
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
      expect(mockGenerateTurboDeeplink).toHaveBeenCalledWith(
        'cashuAtoken123',
        'tb1precipient789',
        100
      );
      expect(mockSaveSentLockedToken).toHaveBeenCalled();
    });

    it('should persist a P2PK token even if the screen unmounts after token creation starts', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });
      let resolveP2PK: (value: { token: string }) => void = () => undefined;
      mockSendP2PKToken.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveP2PK = resolve;
          })
      );

      const { component } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
        turboRecipient: 'tb1precipient789',
        mintAmount: 100,
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
        await jest.advanceTimersByTimeAsync(2100);
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(mockSendP2PKToken).toHaveBeenCalled();

      act(() => {
        component?.unmount();
      });

      await act(async () => {
        resolveP2PK({ token: 'cashuAfterUnmount' });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockUpdateTurboSendStage).toHaveBeenCalledWith(
        'p2pk_created',
        { token: 'cashuAfterUnmount' },
        expect.objectContaining({ quoteId: 'quote123' })
      );
      expect(mockSaveSentLockedToken).toHaveBeenCalledWith(
        'cashuAfterUnmount',
        'tb1precipient789',
        100,
        null,
        null,
        'tb1psender123'
      );
      expect(mockSaveSentLockedToken).toHaveBeenCalledWith(
        'cashuAfterUnmount',
        'tb1precipient789',
        100,
        null,
        'https://short.url/abc',
        'tb1psender123'
      );
    });

    it('waits for sender address before starting Turbo mint completion', async () => {
      const { result, rerender } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
        turboRecipient: 'tb1precipient789',
        senderTaprootAddress: undefined,
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(mockSavePendingTurboSend).not.toHaveBeenCalled();
      expect(mockCheckMintQuote).not.toHaveBeenCalled();
      expect(mockCompleteMint).not.toHaveBeenCalled();
      expect(mockSendP2PKToken).not.toHaveBeenCalled();
      expect(notify.cashu.conversionFailed).not.toHaveBeenCalled();
      expect(result.current!.processingMessage).toBe('Preparing wallet context...');

      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });
      rerender({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
        turboRecipient: 'tb1precipient789',
        senderTaprootAddress: 'tb1psender123',
      });

      await advanceThroughPolling();

      expect(mockCheckMintQuote).toHaveBeenCalledWith('quote123');
      expect(mockSendP2PKToken).toHaveBeenCalled();
    });

    it('continues polling when a mint status request hangs', async () => {
      mockCheckMintQuote
        .mockImplementationOnce(() => new Promise(() => undefined))
        .mockResolvedValueOnce({ state: 'PAID', amount: 100 });

      renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
        await jest.advanceTimersByTimeAsync(2100);
        await jest.advanceTimersByTimeAsync(20000);
        await jest.advanceTimersByTimeAsync(2100);
        await jest.advanceTimersByTimeAsync(0);
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(mockCheckMintQuote).toHaveBeenCalledTimes(2);
      expect(mockCompleteMint).toHaveBeenCalledWith('quote123', 100);
    });

    it('should not claim or spend when the active Cashu account changed', async () => {
      mockGetCurrentCashuAccount.mockReturnValue('tb1potheraccount');

      renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
        turboRecipient: 'tb1precipient789',
        senderTaprootAddress: 'tb1psender123',
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(mockSavePendingTurboSend).not.toHaveBeenCalled();
      expect(mockCheckMintQuote).not.toHaveBeenCalled();
      expect(mockCompleteMint).not.toHaveBeenCalled();
      expect(mockSendP2PKToken).not.toHaveBeenCalled();
      expect(notify.cashu.conversionFailed).toHaveBeenCalledWith(
        expect.stringContaining('Cashu account changed during Turbo mint recovery setup')
      );
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

      const { result } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
      });

      await exhaustPollingLoop();

      expect(result.current!.processingStage).toBe('awaiting_confirmation');
      expect(result.current!.processingMessage).toContain('Payment sent');
      expect(notify.cashu.paymentSentAwaiting).toHaveBeenCalled();
    }, 30000);

    it('should handle error during mint completion', async () => {
      mockCheckMintQuote.mockRejectedValue(new Error('Network error'));

      const { result } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
      });

      // Poll errors are caught and retried; after maxAttempts the flow times out
      await exhaustPollingLoop();

      // After the polling window, paidQuote is null → awaiting confirmation
      expect(result.current!.processingStage).toBe('awaiting_confirmation');
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

      expect(result.current!.processingStage).toBe('error');
      expect(result.current!.processingMessage).toContain('Failed to extract pubkey');
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

      expect(result.current!.processingStage).toBe('error');
      expect(result.current!.processingMessage).toBe('sendP2PKToken returned no token');
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

      const { result } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
      });

      // Poll errors are caught and retried; after maxAttempts the flow times out
      await exhaustPollingLoop();

      expect(result.current!.processingStage).toBe('awaiting_confirmation');
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

      expect(result.current!.processingStage).toBe('error');
      expect(notify.cashu.conversionFailed).toHaveBeenCalledWith('Storage string error');
      expect(notify.transaction.success).not.toHaveBeenCalledWith('send');
    });
  });
});
