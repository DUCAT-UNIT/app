// @ts-nocheck
/**
 * Tests for useTurboReview hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { useTurboReview } from '../useTurboReview';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

// Mock the cashu wallet service - use module-scoped refs to avoid hoisting issues
let mockGetBalanceImpl = jest.fn().mockResolvedValue(100);
let mockRequestMintImpl = jest.fn().mockResolvedValue({
  quoteId: 'quote123',
  depositAddress: 'bc1qtest',
  amount: 100,
});

jest.mock('../../services/cashu/cashuWalletService', () => ({
  __esModule: true,
  requestMint: jest.fn((...args) => mockRequestMintImpl(...args)),
  getBalance: jest.fn((...args) => mockGetBalanceImpl(...args)),
}));

import { requestMint, getBalance } from '../../services/cashu/cashuWalletService';

// Helper to render hooks with props
function renderHookWithProps(props) {
  const result = { current: null };
  function TestComponent({ hookProps }) {
    result.current = useTurboReview(hookProps);
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

describe('useTurboReview', () => {
  let mockProps;
  const mockNavigation = {
    navigate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBalanceImpl = jest.fn().mockResolvedValue(100);
    mockRequestMintImpl = jest.fn().mockResolvedValue({
      quoteId: 'quote123',
      depositAddress: 'bc1qtest',
      amount: 100,
    });
    mockProps = {
      sendAmount: '100',
      sendAssetType: 'unit',
      sendRecipient: 'bc1qrecipient',
      turboEnabled: false,
      setTurboEnabled: jest.fn(),
      setSendRecipient: jest.fn(),
      setSendAmount: jest.fn(),
      ecashThreshold: 1000,
      navigation: mockNavigation,
      isCashuMint: false,
      cashuQuoteId: null,
    };
  });

  it('should return initial state', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(result.current.isRequestingMint).toBe(false);
    expect(result.current.showInsufficientTurboSheet).toBe(false);
    expect(result.current.insufficientTurboAmount).toBe(0);
    expect(result.current.insufficientTurboBalance).toBe(0);
  });

  it('should expose all expected functions', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(typeof result.current.handleReview).toBe('function');
    expect(typeof result.current.handleUseTurbo).toBe('function');
    expect(typeof result.current.handleSendNormally).toBe('function');
    expect(typeof result.current.setShowInsufficientTurboSheet).toBe('function');
  });

  describe('handleReview', () => {
    it('should return early if sendAmount is empty', async () => {
      mockProps.sendAmount = '';
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current.handleReview();
      });

      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('should navigate to Processing for non-unit asset types', async () => {
      mockProps.sendAssetType = 'btc';
      mockProps.turboEnabled = false;
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current.handleReview();
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Processing', {
        fromScreen: 'AmountInput',
        action: 'create_intent',
        cashuMint: false,
        quoteId: null,
      });
    });

    it('should auto-enable turbo for small amounts below threshold', async () => {
      mockProps.sendAmount = '50';
      mockProps.ecashThreshold = 1000;
      mockProps.turboEnabled = false;
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current.handleReview();
      });

      expect(mockProps.setTurboEnabled).toHaveBeenCalledWith(true);
    });

    it('should not auto-enable turbo when already enabled', async () => {
      mockProps.sendAmount = '50';
      mockProps.ecashThreshold = 1000;
      mockProps.turboEnabled = true;
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current.handleReview();
      });

      // setTurboEnabled should not be called if already true
      expect(mockProps.setTurboEnabled).not.toHaveBeenCalled();
    });

    // Note: Tests for lines 55-77 (ecash balance check) are covered via integration
    // through handleUseTurbo tests which successfully trigger the insufficient balance flow.
    // Direct testing of the dynamic import path is challenging due to Jest's module system.

    it('should show error alert when getBalance fails (line 79-80)', async () => {
      mockGetBalanceImpl.mockRejectedValue(new Error('Balance check failed'));
      mockProps.sendAmount = '50';
      mockProps.turboEnabled = true;
      mockProps.sendAssetType = 'unit';
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current.handleReview();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to initiate Turbo transaction. Please try again.'
      );
      expect(result.current.isRequestingMint).toBe(false);
    });

    it('should navigate to Processing with cashuMint params', async () => {
      mockProps.sendAssetType = 'btc';
      mockProps.isCashuMint = true;
      mockProps.cashuQuoteId = 'quote123';
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current.handleReview();
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Processing', {
        fromScreen: 'AmountInput',
        action: 'create_intent',
        cashuMint: true,
        quoteId: 'quote123',
      });
    });

    it('should not auto-enable turbo when amount equals threshold', async () => {
      mockProps.sendAmount = '1000';
      mockProps.ecashThreshold = 1000;
      mockProps.turboEnabled = false;
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current.handleReview();
      });

      // At threshold (not below), should not auto-enable
      expect(mockProps.setTurboEnabled).not.toHaveBeenCalled();
    });

    it('should not auto-enable turbo when amount is above threshold', async () => {
      mockProps.sendAmount = '2000';
      mockProps.ecashThreshold = 1000;
      mockProps.turboEnabled = false;
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current.handleReview();
      });

      expect(mockProps.setTurboEnabled).not.toHaveBeenCalled();
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Processing', expect.any(Object));
    });

    // Note: Tests for TurboProcessing navigation and insufficient sheet display
    // when turbo is enabled require the getBalance dynamic import to be properly
    // configured. The existing tests in handleUseTurbo cover the mint flow.
  });

  describe('handleSendNormally', () => {
    it('should hide sheet and disable turbo', () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current.handleSendNormally();
      });

      expect(result.current.showInsufficientTurboSheet).toBe(false);
      expect(mockProps.setTurboEnabled).toHaveBeenCalledWith(false);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Processing', {
        fromScreen: 'AmountInput',
        action: 'create_intent',
      });
    });
  });

  describe('handleUseTurbo', () => {
    it('should hide the insufficient sheet when called', async () => {
      const { result } = renderHookWithProps(mockProps);

      // First set the sheet to visible
      act(() => {
        result.current.setShowInsufficientTurboSheet(true);
      });

      expect(result.current.showInsufficientTurboSheet).toBe(true);

      await act(async () => {
        await result.current.handleUseTurbo();
      });

      expect(result.current.showInsufficientTurboSheet).toBe(false);
    });

    it('should request mint and navigate to Processing with turbo params', async () => {
      mockProps.sendRecipient = 'original_recipient';
      const { result, rerender } = renderHookWithProps(mockProps);

      // Simulate state where insufficientTurboAmount is set
      // First trigger the insufficient balance flow
      mockGetBalanceImpl.mockResolvedValue(0.3);
      mockProps.sendAmount = '0.5';
      mockProps.turboEnabled = true;
      rerender(mockProps);

      await act(async () => {
        await result.current.handleReview();
      });

      // Now call handleUseTurbo
      await act(async () => {
        await result.current.handleUseTurbo();
      });

      expect(mockRequestMintImpl).toHaveBeenCalled();
      expect(mockProps.setSendRecipient).toHaveBeenCalledWith('bc1qtest');
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Processing', {
        fromScreen: 'AmountInput',
        action: 'create_intent',
        isTurbo: true,
        mintQuoteId: 'quote123',
        mintAmount: 100,
        turboRecipient: 'original_recipient',
      });
    });

    it('should show error alert when requestMint fails (lines 122-124)', async () => {
      const { logger } = require('../../utils/logger');
      mockRequestMintImpl.mockRejectedValue(new Error('Mint request failed'));
      mockProps.sendRecipient = 'original_recipient';
      const { result, rerender } = renderHookWithProps(mockProps);

      // First trigger the insufficient balance flow to set insufficientTurboAmount
      mockGetBalanceImpl.mockResolvedValue(0.3);
      mockProps.sendAmount = '0.5';
      mockProps.turboEnabled = true;
      rerender(mockProps);

      await act(async () => {
        await result.current.handleReview();
      });

      // Now call handleUseTurbo which will fail
      await act(async () => {
        await result.current.handleUseTurbo();
      });

      expect(result.current.isRequestingMint).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        '[useTurboReview] Failed to request mint quote:',
        { error: 'Mint request failed' }
      );
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to initiate Turbo transaction. Please try again.'
      );
    });

    it('should throw error when mint quote amount is undefined', async () => {
      mockRequestMintImpl.mockResolvedValue({
        quoteId: 'quote123',
        depositAddress: 'bc1qtest',
        amount: undefined, // Missing amount
      });
      mockProps.sendRecipient = 'original_recipient';
      const { result, rerender } = renderHookWithProps(mockProps);

      // First trigger the insufficient balance flow to set insufficientTurboAmount
      mockGetBalanceImpl.mockResolvedValue(0.3);
      mockProps.sendAmount = '0.5';
      mockProps.turboEnabled = true;
      rerender(mockProps);

      await act(async () => {
        await result.current.handleReview();
      });

      // Now call handleUseTurbo which will fail due to undefined amount
      await act(async () => {
        await result.current.handleUseTurbo();
      });

      expect(result.current.isRequestingMint).toBe(false);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to initiate Turbo transaction. Please try again.'
      );
    });
  });

  describe('state updates', () => {
    it('should allow setting showInsufficientTurboSheet', () => {
      const { result } = renderHookWithProps(mockProps);

      expect(result.current.showInsufficientTurboSheet).toBe(false);

      act(() => {
        result.current.setShowInsufficientTurboSheet(true);
      });

      expect(result.current.showInsufficientTurboSheet).toBe(true);

      act(() => {
        result.current.setShowInsufficientTurboSheet(false);
      });

      expect(result.current.showInsufficientTurboSheet).toBe(false);
    });
  });
});
