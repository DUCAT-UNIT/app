/**
 * Tests for useTurboMintCompletion hook
 *
 * Note: This hook uses dynamic imports which are difficult to mock in Jest.
 * These tests focus on the basic state management and condition checking.
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

describe('useTurboMintCompletion', () => {
  let mockProps;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProps = {
      isTurbo: false,
      mintQuoteId: null,
      mintAmount: 0,
      turboRecipient: null,
      skipMint: false,
      fetchTransactionHistory: jest.fn().mockResolvedValue(),
      refreshCashuBalance: jest.fn().mockResolvedValue(),
      showSnackbar: jest.fn(),
      showToast: jest.fn(),
    };
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
  });

  it('should not start completion when skipMint is true', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      isTurbo: true,
      mintQuoteId: 'quote123',
      skipMint: true,
    });

    expect(result.current.isCompletingMint).toBe(false);
  });

  it('should not start completion when mintQuoteId is missing', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      isTurbo: true,
      mintQuoteId: null,
    });

    expect(result.current.isCompletingMint).toBe(false);
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
});
