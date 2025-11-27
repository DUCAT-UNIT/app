// @ts-nocheck
/**
 * Tests for useTurboMintCompletion hook
 * Covers mint completion polling, P2PK token creation, and error handling
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useTurboMintCompletion } from '../useTurboMintCompletion';

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
  completeMint: (...args) => mockCompleteMint(...args),
}));

jest.mock('../../services/cashu/cashuMintClient', () => ({
  checkMintQuote: (...args) => mockCheckMintQuote(...args),
}));

jest.mock('../../services/cashu/operations/cashuSendP2PK', () => ({
  sendP2PKToken: (...args) => mockSendP2PKToken(...args),
}));

jest.mock('../../utils/bitcoin', () => ({
  extractPubkeyFromTaprootAddress: (...args) => mockExtractPubkeyFromTaprootAddress(...args),
}));

jest.mock('../../services/cashu/cashuLockedTokensService', () => ({
  saveSentLockedToken: (...args) => mockSaveSentLockedToken(...args),
}));

jest.mock('../../services/urlShortener', () => ({
  shortenCashuToken: (...args) => mockShortenCashuToken(...args),
}));

// Helper to render hooks with props
function renderHookWithProps(props) {
  const result = { current: null };
  function TestComponent({ hookProps }) {
    result.current = useTurboMintCompletion(hookProps);
    return null;
  }
  let component;
  act(() => {
    component = create(<TestComponent hookProps={props} />);
  });
  return {
    result,
    unmount: component.unmount,
    component,
    rerender: (newProps) => {
      act(() => {
        component.update(<TestComponent hookProps={newProps} />);
      });
    },
  };
}

// Helper to flush promises and timers
const flushPromisesAndTimers = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
    jest.runAllTimers();
  });
};

describe('useTurboMintCompletion', () => {
  let mockProps;

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
      fetchTransactionHistory: jest.fn().mockResolvedValue(),
      refreshCashuBalance: jest.fn().mockResolvedValue(),
      showSnackbar: jest.fn(),
      showToast: jest.fn(),
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

    expect(result.current.turboToken).toBe(null);
    expect(result.current.turboDeeplink).toBe(null);
    expect(result.current.processingStage).toBe('ready');
    expect(result.current.isCompletingMint).toBe(false);
  });

  it('should set processingStage to ready when skipMint is true', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      isTurbo: true,
      skipMint: true,
    });

    expect(result.current.processingStage).toBe('ready');
  });

  it('should set processingStage to ready when isTurbo is false', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      isTurbo: false,
    });

    expect(result.current.processingStage).toBe('ready');
  });

  it('should set processingStage to converting when isTurbo is true and not skipped', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      isTurbo: true,
      skipMint: false,
    });

    expect(result.current.processingStage).toBe('converting');
  });

  it('should not start completion when isTurbo is false', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      isTurbo: false,
      mintQuoteId: 'quote123',
    });

    expect(result.current.isCompletingMint).toBe(false);
    expect(mockCheckMintQuote).not.toHaveBeenCalled();
  });

  it('should not start completion when skipMint is true', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      isTurbo: true,
      mintQuoteId: 'quote123',
      skipMint: true,
    });

    expect(result.current.isCompletingMint).toBe(false);
    expect(mockCheckMintQuote).not.toHaveBeenCalled();
  });

  it('should not start completion when mintQuoteId is missing', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      isTurbo: true,
      mintQuoteId: null,
    });

    expect(result.current.isCompletingMint).toBe(false);
    expect(mockCheckMintQuote).not.toHaveBeenCalled();
  });

  it('should return stable state across rerenders when conditions not met', () => {
    const props = {
      ...mockProps,
      isTurbo: false,
    };

    const { result, rerender } = renderHookWithProps(props);
    const firstToken = result.current.turboToken;
    const firstDeeplink = result.current.turboDeeplink;

    rerender(props);

    expect(result.current.turboToken).toBe(firstToken);
    expect(result.current.turboDeeplink).toBe(firstDeeplink);
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
    expect(result.current.processingStage).toBe('converting');
  });

  it('should handle different mintAmount values', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      isTurbo: true,
      mintAmount: 500,
    });

    expect(result.current.processingStage).toBe('converting');
  });

  describe('Mint completion flow', () => {
    it('should poll for payment and complete mint on PAID state', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      const { result } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
      });

      // Run effect and initial timer
      await act(async () => {
        await Promise.resolve();
      });

      // Fast forward timer for polling
      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      expect(mockCheckMintQuote).toHaveBeenCalledWith('quote123');
      expect(mockCompleteMint).toHaveBeenCalledWith('quote123', 100);
    });

    it('should poll for payment and complete mint on ISSUED state', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'ISSUED', amount: 200 });

      const { result } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote456',
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      expect(mockCompleteMint).toHaveBeenCalledWith('quote456', 200);
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

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      // Wait for all async operations
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockExtractPubkeyFromTaprootAddress).toHaveBeenCalledWith('tb1precipient789');
      expect(mockSendP2PKToken).toHaveBeenCalledWith(100, '02pubkey123', {});
      expect(mockShortenCashuToken).toHaveBeenCalledWith('cashuAtoken123');
      expect(mockSaveSentLockedToken).toHaveBeenCalled();
    });

    it('should show send snackbar when turboRecipient is provided', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      const { result } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
        turboRecipient: 'tb1precipient789',
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockProps.showSnackbar).toHaveBeenCalledWith({ type: 'success', action: 'send' });
    });

    it('should show convert snackbar when no turboRecipient', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      const { result } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
        turboRecipient: null,
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockProps.showSnackbar).toHaveBeenCalledWith({ type: 'success', action: 'convert' });
    });

    it('should show toast when payment not confirmed after timeout', async () => {
      // Always return pending state
      mockCheckMintQuote.mockResolvedValue({ state: 'PENDING', amount: 100 });

      const { result } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
      });

      await act(async () => {
        await Promise.resolve();
      });

      // Fast forward all 30 polling attempts
      for (let i = 0; i < 35; i++) {
        await act(async () => {
          jest.advanceTimersByTime(1000);
          await Promise.resolve();
        });
      }

      expect(mockProps.showToast).toHaveBeenCalledWith(
        'Payment sent. E-cash will be available once confirmed.',
        'info'
      );
    });

    it('should handle error during mint completion', async () => {
      mockCheckMintQuote.mockRejectedValue(new Error('Network error'));

      const { result } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      expect(mockProps.showToast).toHaveBeenCalledWith(
        'Failed to complete conversion: Network error',
        'error'
      );
    });

    it('should handle error when pubkey extraction fails', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });
      mockExtractPubkeyFromTaprootAddress.mockReturnValue(null);

      const { result } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
        turboRecipient: 'tb1precipient789',
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should still transition to ready on error
      expect(result.current.processingStage).toBe('ready');
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

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should still transition to ready on error
      expect(result.current.processingStage).toBe('ready');
    });

    it('should refresh transaction history after successful mint', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      const { result } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();
      });

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

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      const callCount = mockCheckMintQuote.mock.calls.length;

      // Rerender with same props
      rerender({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });

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

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      expect(mockProps.showToast).toHaveBeenCalledWith(
        'Failed to complete conversion: String error',
        'error'
      );
    });

    it('should handle non-Error exception in storage error path', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });
      mockSaveSentLockedToken.mockRejectedValue('Storage string error');

      const { result } = renderHookWithProps({
        ...mockProps,
        isTurbo: true,
        mintQuoteId: 'quote123',
        turboRecipient: 'tb1precipient789',
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should still transition to ready on error
      expect(result.current.processingStage).toBe('ready');
    });
  });
});
