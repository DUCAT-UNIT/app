/**
 * Tests for useConfirmationParams hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useConfirmationParams } from '../useConfirmationParams';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Helper to render hooks with props
function renderHookWithProps<T>(hook: (route: any) => T, route: any) {
  const result: { current: T | null } = { current: null };
  function TestComponent({ routeProp }: { routeProp: any }) {
    result.current = hook(routeProp);
    return null;
  }
  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent routeProp={route} />);
  });
  return {
    result,
    unmount: component!.unmount,
    component,
    rerender: (newRoute: any) => {
      act(() => {
        component?.update(<TestComponent routeProp={newRoute} />);
      });
    },
  };
}

describe('useConfirmationParams', () => {
  it('should return default values when route has no params', () => {
    const route = {};

    const { result } = renderHookWithProps(useConfirmationParams, route);

    expect(result.current).toEqual({
      isTurbo: false,
      mintQuoteId: undefined,
      mintAmount: undefined,
      mintClaimAmount: undefined,
      turboRecipient: undefined,
      senderTaprootAddress: undefined,
      cashuUnit: undefined,
      skipMint: false,
      cashuMint: false,
      quoteId: undefined,
      broadcastedTxid: undefined,
    });
  });

  it('should return default values when params is null', () => {
    const route = { params: null };

    const { result } = renderHookWithProps(useConfirmationParams, route);

    expect(result.current!.isTurbo).toBe(false);
    expect(result.current!.skipMint).toBe(false);
    expect(result.current!.cashuMint).toBe(false);
  });

  it('should extract Turbo transaction params', () => {
    const route = {
      params: {
        isTurbo: true,
        mintQuoteId: 'quote123',
        mintAmount: 100,
        turboRecipient: 'tb1p...',
        skipMint: true,
      },
    };

    const { result } = renderHookWithProps(useConfirmationParams, route);

    expect(result.current!.isTurbo).toBe(true);
    expect(result.current!.mintQuoteId).toBe('quote123');
    expect(result.current!.mintAmount).toBe(100);
    expect(result.current!.turboRecipient).toBe('tb1p...');
    expect(result.current!.skipMint).toBe(true);
  });

  it('should extract Cashu mint params', () => {
    const route = {
      params: {
        cashuMint: true,
        quoteId: 'cashu-quote123',
      },
    };

    const { result } = renderHookWithProps(useConfirmationParams, route);

    expect(result.current!.cashuMint).toBe(true);
    expect(result.current!.quoteId).toBe('cashu-quote123');
  });

  it('should extract regular transaction params', () => {
    const route = {
      params: {
        broadcastedTxid: 'txid123abc',
      },
    };

    const { result } = renderHookWithProps(useConfirmationParams, route);

    expect(result.current!.broadcastedTxid).toBe('txid123abc');
  });

  it('should convert isTurbo string to boolean false', () => {
    const route = {
      params: {
        isTurbo: 'true', // string instead of boolean
      },
    };

    const { result } = renderHookWithProps(useConfirmationParams, route);

    expect(result.current!.isTurbo).toBe(false); // Only true for === true
  });

  it('should convert skipMint string to boolean false', () => {
    const route = {
      params: {
        skipMint: 'true',
      },
    };

    const { result } = renderHookWithProps(useConfirmationParams, route);

    expect(result.current!.skipMint).toBe(false);
  });

  it('should convert cashuMint string to boolean false', () => {
    const route = {
      params: {
        cashuMint: 'true',
      },
    };

    const { result } = renderHookWithProps(useConfirmationParams, route);

    expect(result.current!.cashuMint).toBe(false);
  });

  it('should memoize params object', () => {
    const route = {
      params: {
        isTurbo: true,
        mintQuoteId: 'quote123',
      },
    };

    const { result, rerender } = renderHookWithProps(useConfirmationParams, route);
    const firstParams = result.current;

    // Rerender with same values
    rerender({
      params: {
        isTurbo: true,
        mintQuoteId: 'quote123',
      },
    });

    expect(result.current).toBe(firstParams);
  });

  it('should update params when route changes', () => {
    const route1 = {
      params: {
        isTurbo: true,
        mintQuoteId: 'quote123',
      },
    };

    const { result, rerender } = renderHookWithProps(useConfirmationParams, route1);
    expect(result.current!.mintQuoteId).toBe('quote123');

    // Update with new values
    rerender({
      params: {
        isTurbo: true,
        mintQuoteId: 'quote456',
      },
    });

    expect(result.current!.mintQuoteId).toBe('quote456');
  });

  it('should handle all params together', () => {
    const route = {
      params: {
        isTurbo: true,
        mintQuoteId: 'turbo-quote',
        mintAmount: 500,
        mintClaimAmount: 250,
        turboRecipient: 'tb1paddr...',
        senderTaprootAddress: 'tb1psender...',
        skipMint: false,
        cashuMint: false,
        quoteId: 'other-quote',
        broadcastedTxid: 'some-txid',
      },
    };

    const { result } = renderHookWithProps(useConfirmationParams, route);

    expect(result.current).toEqual({
      isTurbo: true,
      mintQuoteId: 'turbo-quote',
      mintAmount: 500,
      mintClaimAmount: 250,
      turboRecipient: 'tb1paddr...',
      senderTaprootAddress: 'tb1psender...',
      cashuUnit: undefined,
      skipMint: false,
      cashuMint: false,
      quoteId: 'other-quote',
      broadcastedTxid: 'some-txid',
    });
  });
});
