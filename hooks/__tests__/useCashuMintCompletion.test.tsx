/**
 * Tests for useCashuMintCompletion hook
 * Covers mint completion registration and tracking via app-level CashuContext
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

// Mock CashuContext
const mockAddPendingMint = jest.fn();
const mockAddPendingBtcMint = jest.fn();
let mockPendingMints: { quoteId: string; amount: number }[] = [];
let mockPendingBtcMints: { quoteId: string; amount: number }[] = [];

jest.mock('../../contexts/CashuContext', () => ({
  useCashuBalanceState: () => ({
    pendingMints: mockPendingMints,
    pendingBtcMints: mockPendingBtcMints,
  }),
  useCashuOperations: () => ({
    addPendingMint: mockAddPendingMint,
    addPendingBtcMint: mockAddPendingBtcMint,
  }),
}));

// Helper to render hooks with props
function renderHookWithProps(props: Record<string, unknown>) {
  const result: { current: ReturnType<typeof useCashuMintCompletion> | null } = { current: null };
  function TestComponent({ hookProps }: { hookProps?: Record<string, unknown> }) {
    result.current = useCashuMintCompletion(hookProps as unknown as Parameters<typeof useCashuMintCompletion>[0]);
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
    rerender: (newProps?: Record<string, unknown>) => {
      act(() => {
        component?.update(<TestComponent hookProps={newProps} />);
      });
    },
  };
}

describe('useCashuMintCompletion', () => {
  let mockProps: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPendingMints = [];
    mockPendingBtcMints = [];

    mockProps = {
      cashuMint: false,
      quoteId: undefined,
      mintAmount: undefined,
      fetchTransactionHistory: jest.fn().mockResolvedValue(undefined),
      refreshCashuBalance: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('should return initial state', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(result.current!.isCompletingMint).toBe(false);
  });

  it('should not register mint when cashuMint is false', () => {
    renderHookWithProps({
      ...mockProps,
      cashuMint: false,
      quoteId: 'quote123',
      mintAmount: 100,
    });

    expect(mockAddPendingMint).not.toHaveBeenCalled();
  });

  it('should not register mint when cashuMint is undefined', () => {
    renderHookWithProps({
      ...mockProps,
      cashuMint: undefined,
      quoteId: 'quote123',
      mintAmount: 100,
    });

    expect(mockAddPendingMint).not.toHaveBeenCalled();
  });

  it('should not register mint when quoteId is missing', () => {
    renderHookWithProps({
      ...mockProps,
      cashuMint: true,
      quoteId: undefined,
      mintAmount: 100,
    });

    expect(mockAddPendingMint).not.toHaveBeenCalled();
  });

  it('should not register mint when mintAmount is missing', () => {
    renderHookWithProps({
      ...mockProps,
      cashuMint: true,
      quoteId: 'quote123',
      mintAmount: undefined,
    });

    expect(mockAddPendingMint).not.toHaveBeenCalled();
  });

  it('should have correct return type structure', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(result.current).toHaveProperty('isCompletingMint');
    expect(typeof result.current!.isCompletingMint).toBe('boolean');
  });

  describe('Mint registration', () => {
    it('should register pending mint when all params provided', () => {
      renderHookWithProps({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
        mintAmount: 100,
        senderTaprootAddress: 'tb1psender',
      });

      expect(mockAddPendingMint).toHaveBeenCalledWith('quote123', 100, 'tb1psender');
    });

    it('should register BTC pending mint with the sender account', () => {
      renderHookWithProps({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote-btc',
        mintAmount: 1000,
        cashuUnit: 'sat',
        senderTaprootAddress: 'tb1psender',
      });

      expect(mockAddPendingBtcMint).toHaveBeenCalledWith('quote-btc', 1000, 'tb1psender');
    });

    it('should set isCompletingMint to true after registration', async () => {
      // Mock that the mint will be added to pending (simulating what addPendingMint does)
      mockPendingMints = [{ quoteId: 'quote123', amount: 100 }];

      const { result } = renderHookWithProps({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
        mintAmount: 100,
      });

      // Wait for effect to run
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current!.isCompletingMint).toBe(true);
    });

    it('should only register once even on rerender', () => {
      const { rerender } = renderHookWithProps({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
        mintAmount: 100,
      });

      rerender({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
        mintAmount: 100,
      });

      expect(mockAddPendingMint).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mint completion tracking', () => {
    it('should track when mint is still pending', () => {
      mockPendingMints = [{ quoteId: 'quote123', amount: 100 }];

      const { result } = renderHookWithProps({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
        mintAmount: 100,
      });

      // Mint is still pending, so isCompletingMint should remain true
      expect(result.current!.isCompletingMint).toBe(true);
    });

    it('should detect when mint completes (removed from pendingMints)', () => {
      // Start with pending mint
      mockPendingMints = [{ quoteId: 'quote123', amount: 100 }];

      const { result, rerender } = renderHookWithProps({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
        mintAmount: 100,
      });

      expect(result.current!.isCompletingMint).toBe(true);

      // Simulate mint completion by removing from pendingMints
      mockPendingMints = [];

      rerender({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
        mintAmount: 100,
      });

      expect(result.current!.isCompletingMint).toBe(false);
    });

    it('should only track completion for its own quoteId', () => {
      // Start with our pending mint
      mockPendingMints = [
        { quoteId: 'quote123', amount: 100 },
        { quoteId: 'other456', amount: 200 },
      ];

      const { result, rerender } = renderHookWithProps({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
        mintAmount: 100,
      });

      expect(result.current!.isCompletingMint).toBe(true);

      // Remove only other quote, ours still pending
      mockPendingMints = [{ quoteId: 'quote123', amount: 100 }];

      rerender({
        ...mockProps,
        cashuMint: true,
        quoteId: 'quote123',
        mintAmount: 100,
      });

      // Should still be completing since our quote is still pending
      expect(result.current!.isCompletingMint).toBe(true);
    });
  });
});
