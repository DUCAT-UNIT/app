// @ts-nocheck
/**
 * Tests for useCashuMintCompletion hook
 * Covers mint completion polling and error handling
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useCashuMintCompletion } from '../useCashuMintCompletion';

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

jest.mock('../../services/cashu/cashuWalletService', () => ({
  completeMint: (...args) => mockCompleteMint(...args),
}));

jest.mock('../../services/cashu/cashuMintClient', () => ({
  checkMintQuote: (...args) => mockCheckMintQuote(...args),
}));

// Helper to render hooks with props
function renderHookWithProps(props) {
  const result = { current: null };
  function TestComponent({ hookProps }) {
    result.current = useCashuMintCompletion(hookProps);
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

describe('useCashuMintCompletion', () => {
  let mockProps;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockProps = {
      cashuMint: false,
      quoteId: undefined,
      fetchTransactionHistory: jest.fn().mockResolvedValue(),
      refreshCashuBalance: jest.fn().mockResolvedValue(),
      showSnackbar: jest.fn(),
      showToast: jest.fn(),
    };

    // Default mocks
    mockCheckMintQuote.mockResolvedValue({ state: 'PENDING', amount: 100 });
    mockCompleteMint.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return initial state', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(result.current.isCompletingMint).toBe(false);
  });

  it('should not start completion when cashuMint is false', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      cashuMint: false,
      quoteId: 'quote123',
    });

    expect(result.current.isCompletingMint).toBe(false);
    expect(mockCheckMintQuote).not.toHaveBeenCalled();
  });

  it('should not start completion when cashuMint is undefined', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      cashuMint: undefined,
      quoteId: 'quote123',
    });

    expect(result.current.isCompletingMint).toBe(false);
    expect(mockCheckMintQuote).not.toHaveBeenCalled();
  });

  it('should not start completion when quoteId is missing', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      cashuMint: true,
      quoteId: undefined,
    });

    expect(result.current.isCompletingMint).toBe(false);
    expect(mockCheckMintQuote).not.toHaveBeenCalled();
  });

  it('should have correct return type structure', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(result.current).toHaveProperty('isCompletingMint');
    expect(typeof result.current.isCompletingMint).toBe('boolean');
  });

  describe('Mint completion flow', () => {
    it('should poll for payment and complete mint on PAID state', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      const { result } = renderHookWithProps({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
      });

      await act(async () => {
        await Promise.resolve();
      });

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
        cashuMint: true,
        quoteId: 'quote456',
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

    it('should show snackbar on successful completion', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      const { result } = renderHookWithProps({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        message: 'Conversion complete',
        type: 'success',
        action: 'convert',
      });
    });

    it('should refresh transaction history if provided', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      const { result } = renderHookWithProps({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
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
    });

    it('should work without fetchTransactionHistory', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      const props = {
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
        fetchTransactionHistory: undefined,
      };

      const { result } = renderHookWithProps(props);

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockCompleteMint).toHaveBeenCalled();
      expect(mockProps.refreshCashuBalance).toHaveBeenCalled();
    });

    it('should refresh cashu balance after completion', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      const { result } = renderHookWithProps({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockProps.refreshCashuBalance).toHaveBeenCalled();
    });

    it('should show toast when payment not confirmed after timeout', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PENDING', amount: 100 });

      const { result } = renderHookWithProps({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
      });

      await act(async () => {
        await Promise.resolve();
      });

      for (let i = 0; i < 35; i++) {
        await act(async () => {
          jest.advanceTimersByTime(1000);
          await Promise.resolve();
        });
      }

      expect(mockProps.showToast).toHaveBeenCalledWith(
        'Payment sent. Ecash will be available once confirmed.',
        'info'
      );
    });

    it('should handle error during mint completion', async () => {
      mockCheckMintQuote.mockRejectedValue(new Error('Network error'));

      const { result } = renderHookWithProps({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
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

    it('should handle non-Error exception during completion', async () => {
      mockCheckMintQuote.mockRejectedValue('String error');

      const { result } = renderHookWithProps({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
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

    it('should not restart completion if already completed', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      const { result, rerender } = renderHookWithProps({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      const callCount = mockCheckMintQuote.mock.calls.length;

      rerender({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      expect(mockCheckMintQuote.mock.calls.length).toBe(callCount);
    });

    it('should skip when hasCashuMintCompleted ref is true after rerender with new callback', async () => {
      mockCheckMintQuote.mockResolvedValue({ state: 'PAID', amount: 100 });

      const { result, rerender } = renderHookWithProps({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
      });

      // Run first completion
      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();
      });

      const callCount = mockCheckMintQuote.mock.calls.length;

      // Rerender with a NEW showToast function (different reference)
      // This will cause the effect to run again, hitting the hasCashuMintCompleted check
      rerender({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
        showToast: jest.fn(), // new reference
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      // Should not have made additional calls
      expect(mockCheckMintQuote.mock.calls.length).toBe(callCount);
    });
  });
});
