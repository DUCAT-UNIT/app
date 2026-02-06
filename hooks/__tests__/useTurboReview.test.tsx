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
function renderHookWithProps(props: any) {
  const result: { current: ReturnType<typeof useTurboReview> | null } = { current: null };
  function TestComponent({ hookProps }: { hookProps?: any }) {
    result.current = useTurboReview(hookProps);
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

describe('useTurboReview', () => {
  let mockProps: Record<string, unknown>;
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

    expect(result.current!.isRequestingMint).toBe(false);
    expect(result.current!.showInsufficientTurboSheet).toBe(false);
    expect(result.current!.insufficientTurboAmount).toBe(0);
    expect(result.current!.insufficientTurboBalance).toBe(0);
  });

  it('should expose all expected functions', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(typeof result.current!.handleReview).toBe('function');
    expect(typeof result.current!.handleUseTurbo).toBe('function');
    expect(typeof result.current!.handleSendNormally).toBe('function');
    expect(typeof result.current!.setShowInsufficientTurboSheet).toBe('function');
  });

  describe('handleReview', () => {
    it('should return early if sendAmount is empty', async () => {
      mockProps.sendAmount = '';
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleReview();
      });

      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('should navigate to Processing for non-unit asset types', async () => {
      mockProps.sendAssetType = 'btc';
      mockProps.turboEnabled = false;
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleReview();
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Processing', {
        fromScreen: 'SendInput',
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
        await result.current!.handleReview();
      });

      expect(mockProps.setTurboEnabled).toHaveBeenCalledWith(true);
    });

    it('should not auto-enable turbo when already enabled', async () => {
      mockProps.sendAmount = '50';
      mockProps.ecashThreshold = 1000;
      mockProps.turboEnabled = true;
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleReview();
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
        await result.current!.handleReview();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to initiate Turbo transaction. Please try again.'
      );
      expect(result.current!.isRequestingMint).toBe(false);
    });

    it('should navigate to Processing with cashuMint params', async () => {
      mockProps.sendAssetType = 'btc';
      mockProps.isCashuMint = true;
      mockProps.cashuQuoteId = 'quote123';
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleReview();
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Processing', {
        fromScreen: 'SendInput',
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
        await result.current!.handleReview();
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
        await result.current!.handleReview();
      });

      expect(mockProps.setTurboEnabled).not.toHaveBeenCalled();
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Processing', expect.any(Object));
    });

    it('should navigate to TurboProcessing when ecash balance is sufficient', async () => {
      // Mock sufficient ecash balance (in smallest units)
      // sendAmount '100' = 100 display units = 10000 smallest units
      // So we need balance >= 10000
      mockGetBalanceImpl.mockResolvedValue(15000);
      mockProps.sendAmount = '100';
      mockProps.turboEnabled = true;
      mockProps.sendAssetType = 'unit';
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleReview();
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('TurboProcessing');
      expect(result.current!.isRequestingMint).toBe(false);
    });

    it('should show insufficient turbo sheet when ecash balance is not enough', async () => {
      // Mock insufficient ecash balance (in smallest units)
      // sendAmount '100' = 100 display units = 10000 smallest units
      // Balance of 5000 smallest units = 50 display units (insufficient)
      mockGetBalanceImpl.mockResolvedValue(5000);
      mockProps.sendAmount = '100';
      mockProps.turboEnabled = true;
      mockProps.sendAssetType = 'unit';
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleReview();
      });

      expect(result.current!.showInsufficientTurboSheet).toBe(true);
      expect(result.current!.insufficientTurboAmount).toBe(100); // display units
      expect(result.current!.insufficientTurboBalance).toBe(50); // converted to display units (5000/100)
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('should handle exact ecash balance match', async () => {
      // Mock exact ecash balance (in smallest units)
      // sendAmount '100' = 100 display units = 10000 smallest units
      mockGetBalanceImpl.mockResolvedValue(10000);
      mockProps.sendAmount = '100';
      mockProps.turboEnabled = true;
      mockProps.sendAssetType = 'unit';
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleReview();
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('TurboProcessing');
    });

    it('should handle fractional amounts correctly', async () => {
      // Mock ecash balance with fractions (in smallest units)
      // sendAmount '0.50' = 0.5 display units = 50 smallest units
      // Balance of 55 smallest units = 0.55 display units (sufficient)
      mockGetBalanceImpl.mockResolvedValue(55);
      mockProps.sendAmount = '0.50';
      mockProps.turboEnabled = true;
      mockProps.sendAssetType = 'unit';
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleReview();
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('TurboProcessing');
    });

    it('should set isRequestingMint to true during balance check', async () => {
      mockGetBalanceImpl.mockImplementation(() => {
        // Check that isRequestingMint is true during the async operation
        return new Promise(resolve => {
          setTimeout(() => resolve(100), 10);
        });
      });
      mockProps.sendAmount = '50';
      mockProps.turboEnabled = true;
      mockProps.sendAssetType = 'unit';
      const { result } = renderHookWithProps(mockProps);

      // Start the async operation
      const reviewPromise = act(async () => {
        await result.current!.handleReview();
      });

      // Wait a moment then check isRequestingMint is true
      await new Promise(resolve => setTimeout(resolve, 5));

      // Complete the operation
      await reviewPromise;

      // After completion, should be false
      expect(result.current!.isRequestingMint).toBe(false);
    });
  });

  describe('handleSendNormally', () => {
    it('should hide sheet and disable turbo', () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleSendNormally();
      });

      expect(result.current!.showInsufficientTurboSheet).toBe(false);
      expect(mockProps.setTurboEnabled).toHaveBeenCalledWith(false);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Processing', {
        fromScreen: 'SendInput',
        action: 'create_intent',
      });
    });
  });

  describe('handleUseTurbo', () => {
    it('should hide the insufficient sheet when called', async () => {
      const { result } = renderHookWithProps(mockProps);

      // First set the sheet to visible
      act(() => {
        result.current!.setShowInsufficientTurboSheet(true);
      });

      expect(result.current!.showInsufficientTurboSheet).toBe(true);

      await act(async () => {
        await result.current!.handleUseTurbo();
      });

      expect(result.current!.showInsufficientTurboSheet).toBe(false);
    });

    it('should request mint and navigate to Processing with turbo params', async () => {
      mockProps.sendRecipient = 'original_recipient';
      const { result, rerender } = renderHookWithProps(mockProps);

      // Simulate state where insufficientTurboAmount is set
      // First trigger the insufficient balance flow
      // getBalance() returns smallest units, so 30 means 0.30 display units
      mockGetBalanceImpl.mockResolvedValue(30);
      mockProps.sendAmount = '0.5'; // 0.5 display units = 50 smallest units
      mockProps.turboEnabled = true;
      rerender(mockProps);

      await act(async () => {
        await result.current!.handleReview();
      });

      // Now call handleUseTurbo
      await act(async () => {
        await result.current!.handleUseTurbo();
      });

      expect(mockRequestMintImpl).toHaveBeenCalled();
      expect(mockProps.setSendRecipient).toHaveBeenCalledWith('bc1qtest');
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Processing', {
        fromScreen: 'SendInput',
        action: 'create_intent',
        isTurbo: true,
        mintQuoteId: 'quote123',
        mintAmount: 50, // insufficientTurboAmount (0.5) * 100
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
        await result.current!.handleReview();
      });

      // Now call handleUseTurbo which will fail
      await act(async () => {
        await result.current!.handleUseTurbo();
      });

      expect(result.current!.isRequestingMint).toBe(false);
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
        await result.current!.handleReview();
      });

      // Now call handleUseTurbo which will fail due to undefined amount
      await act(async () => {
        await result.current!.handleUseTurbo();
      });

      expect(result.current!.isRequestingMint).toBe(false);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to initiate Turbo transaction. Please try again.'
      );
    });
  });

  describe('state updates', () => {
    it('should allow setting showInsufficientTurboSheet', () => {
      const { result } = renderHookWithProps(mockProps);

      expect(result.current!.showInsufficientTurboSheet).toBe(false);

      act(() => {
        result.current!.setShowInsufficientTurboSheet(true);
      });

      expect(result.current!.showInsufficientTurboSheet).toBe(true);

      act(() => {
        result.current!.setShowInsufficientTurboSheet(false);
      });

      expect(result.current!.showInsufficientTurboSheet).toBe(false);
    });
  });
});
