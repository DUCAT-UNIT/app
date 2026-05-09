/**
 * Tests for useEcashThresholdManager hook
 * Covers threshold selection, conversion flow, and low balance top-up
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useEcashThresholdManager } from '../useEcashThresholdManager';
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

const mockNavigate = jest.fn();
let mockGetParentReturn: ReturnType<typeof jest.fn> | null = null;
const mockGetParent = jest.fn(() => mockGetParentReturn);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    getParent: mockGetParent,
  }),
}));

const mockRequestMint = jest.fn();

jest.mock('../../services/cashu/cashuWalletService', () => ({
  requestMint: (...args: unknown[]) => mockRequestMint(...args),
}));

// Helper to render hooks with props
function renderHookWithProps(props: Record<string, unknown>) {
  const result: { current: ReturnType<typeof useEcashThresholdManager> | null } = { current: null };
  function TestComponent({ hookProps }: { hookProps?: Record<string, unknown> }) {
    result.current = useEcashThresholdManager(hookProps as unknown as Parameters<typeof useEcashThresholdManager>[0]);
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

describe('useEcashThresholdManager', () => {
  let mockProps: {
    cashuBalance: number | null;
    runesBalance: { rune: string; amount: string; divisibility: number }[];
    settingsHandlers: {
      ecashThreshold: number;
      handleEcashThresholdChange: jest.Mock;
    };
    showSnackbar: jest.Mock;
    showSettings: boolean;
    closeSettings: jest.Mock;
    lowBalanceAmountNeeded: number;
    closeLowBalanceModal: jest.Mock;
    [key: string]: unknown;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ legacyFakeTimers: true });
    // Setup root navigator chain (returns null to stop iteration)
    mockGetParentReturn = null;
    mockProps = {
      cashuBalance: 100,
      runesBalance: [{ rune: 'rune1', amount: '500', divisibility: 0 }],
      settingsHandlers: {
        ecashThreshold: 100,
        handleEcashThresholdChange: jest.fn(),
      },
      showSnackbar: jest.fn(),
      showSettings: false,
      closeSettings: jest.fn(),
      lowBalanceAmountNeeded: 50,
      closeLowBalanceModal: jest.fn(),
    };
    mockRequestMint.mockResolvedValue({
      quoteId: 'quote123',
      depositAddress: 'tb1pdeposit123',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return initial state', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(result.current!.showThresholdSheet).toBe(false);
    expect(result.current!.showConversionModal).toBe(false);
    expect(result.current!.conversionAmount).toBe(0);
    expect(result.current!.savedUnitBalance).toBe(0);
    expect(result.current!.pendingThreshold).toBe(null);
  });

  it('should return handler functions', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(typeof result.current!.handleEcashThresholdPress).toBe('function');
    expect(typeof result.current!.handleThresholdSelect).toBe('function');
    expect(typeof result.current!.handleConfirmConversion).toBe('function');
    expect(typeof result.current!.handleLowBalanceTopUp).toBe('function');
    expect(typeof result.current!.setShowThresholdSheet).toBe('function');
    expect(typeof result.current!.setShowConversionModal).toBe('function');
  });

  describe('handleEcashThresholdPress', () => {
    it('should show threshold sheet', () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleEcashThresholdPress();
      });

      expect(result.current!.showThresholdSheet).toBe(true);
    });
  });

  describe('handleThresholdSelect', () => {
    it('should update threshold directly when selecting same value', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleThresholdSelect(100);
      });

      expect(mockProps.settingsHandlers.handleEcashThresholdChange).toHaveBeenCalledWith(100);
      expect(result.current!.showConversionModal).toBe(false);
    });

    it('should update threshold directly when selecting 100', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        settingsHandlers: {
          ...mockProps.settingsHandlers,
          ecashThreshold: 200,
        },
      });

      await act(async () => {
        await result.current!.handleThresholdSelect(100);
      });

      expect(mockProps.settingsHandlers.handleEcashThresholdChange).toHaveBeenCalledWith(100);
    });

    it('should show conversion modal when more ecash needed', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: 50, // Less than threshold
      });

      await act(async () => {
        await result.current!.handleThresholdSelect(200);
      });

      expect(result.current!.showConversionModal).toBe(true);
      expect(result.current!.pendingThreshold).toBe(200);
      expect(result.current!.conversionAmount).toBe(150); // 200 - 50
    });

    it('should limit conversion to available unit balance', async () => {
      // runesBalance amount '1' with divisibility 0 => getRunesAmount returns 1 display unit
      // => currentUnitCents = Math.round(1 * 100) = 100 cents
      // Threshold 500 cents: amountNeededCents = max(0, 500 - 0) = 500
      // actualConversionAmount = min(500, 100) = 100 (limited by unit balance)
      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: 0,
        runesBalance: [{ rune: 'rune1', amount: '1', divisibility: 0 }], // Only 100 cents available
      });

      await act(async () => {
        await result.current!.handleThresholdSelect(500);
      });

      expect(result.current!.conversionAmount).toBe(100); // Limited by unit balance (100 cents)
    });

    it('should update directly when ecash balance is sufficient', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: 300,
      });

      await act(async () => {
        await result.current!.handleThresholdSelect(200);
      });

      expect(mockProps.settingsHandlers.handleEcashThresholdChange).toHaveBeenCalledWith(200);
      expect(result.current!.showConversionModal).toBe(false);
    });

    it('should handle Infinity threshold', async () => {
      // With no UNIT balance, Infinity should update threshold directly
      // (no conversion needed since there's nothing to convert)
      const { result } = renderHookWithProps({
        ...mockProps,
        runesBalance: [], // No UNIT balance to convert
      });

      await act(async () => {
        await result.current!.handleThresholdSelect(Infinity);
      });

      // With no UNIT balance, should update threshold directly
      expect(mockProps.settingsHandlers.handleEcashThresholdChange).toHaveBeenCalledWith(Infinity);
    });

    it('should handle empty runesBalance', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: 50,
        runesBalance: [],
      });

      await act(async () => {
        await result.current!.handleThresholdSelect(200);
      });

      expect(result.current!.conversionAmount).toBe(0);
    });

    it('should handle null cashuBalance', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: null,
      });

      await act(async () => {
        await result.current!.handleThresholdSelect(200);
      });

      // Should use 0 for null cashuBalance
      expect(result.current!.showConversionModal).toBe(true);
      expect(result.current!.conversionAmount).toBe(200);
    });

    it('should close threshold sheet when selecting', async () => {
      const { result } = renderHookWithProps(mockProps);

      // First open the sheet
      act(() => {
        result.current!.handleEcashThresholdPress();
      });
      expect(result.current!.showThresholdSheet).toBe(true);

      // Then select a threshold
      await act(async () => {
        await result.current!.handleThresholdSelect(100);
      });

      expect(result.current!.showThresholdSheet).toBe(false);
    });
  });

  describe('handleConfirmConversion', () => {
    it('should request mint and navigate on success', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: 50,
      });

      // First trigger conversion modal
      await act(async () => {
        await result.current!.handleThresholdSelect(200);
      });

      expect(result.current!.showConversionModal).toBe(true);

      // Now confirm conversion
      await act(async () => {
        await result.current!.handleConfirmConversion();
      });

      expect(mockRequestMint).toHaveBeenCalledWith(150);
      expect(result.current!.showConversionModal).toBe(false);
      expect(mockProps.settingsHandlers.handleEcashThresholdChange).toHaveBeenCalledWith(200);

      // Advance timer for setTimeout navigation
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      expect(mockNavigate).toHaveBeenCalledWith('SendFlow', {
        screen: 'Processing',
        params: expect.objectContaining({
          fromScreen: 'Settings',
          action: 'create_intent',
          cashuMint: true,
          quoteId: 'quote123',
          mintAmount: 150,
          amount: '1.5',
        }),
      });
    });

    it('should fund the mint quote amount when the quote adjusts the conversion', async () => {
      mockRequestMint.mockResolvedValueOnce({
        quoteId: 'quote-adjusted',
        depositAddress: 'tb1padjusted',
        amount: 175,
      });
      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: 50,
      });

      await act(async () => {
        await result.current!.handleThresholdSelect(200);
      });

      await act(async () => {
        await result.current!.handleConfirmConversion();
      });

      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      expect(mockNavigate).toHaveBeenCalledWith('SendFlow', {
        screen: 'Processing',
        params: expect.objectContaining({
          quoteId: 'quote-adjusted',
          mintAmount: 175,
          amount: '1.75',
          recipient: 'tb1padjusted',
        }),
      });
    });

    it('should close settings if open', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: 50,
        showSettings: true,
      });

      await act(async () => {
        await result.current!.handleThresholdSelect(200);
      });

      await act(async () => {
        await result.current!.handleConfirmConversion();
      });

      expect(mockProps.closeSettings).toHaveBeenCalled();
    });

    it('should not close settings if not open', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: 50,
        showSettings: false,
      });

      await act(async () => {
        await result.current!.handleThresholdSelect(200);
      });

      await act(async () => {
        await result.current!.handleConfirmConversion();
      });

      expect(mockProps.closeSettings).not.toHaveBeenCalled();
    });

    it('should handle mint error', async () => {
      mockRequestMint.mockRejectedValue(new Error('Mint failed'));

      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: 50,
      });

      await act(async () => {
        await result.current!.handleThresholdSelect(200);
      });

      await act(async () => {
        await result.current!.handleConfirmConversion();
      });

      expect(notify.cashu.conversionStartFailed).toHaveBeenCalled();
    });

    it('should handle non-Error mint exception', async () => {
      mockRequestMint.mockRejectedValue('String error');

      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: 50,
      });

      await act(async () => {
        await result.current!.handleThresholdSelect(200);
      });

      await act(async () => {
        await result.current!.handleConfirmConversion();
      });

      expect(notify.cashu.conversionStartFailed).toHaveBeenCalled();
    });

    it('should handle navigation error', async () => {
      mockNavigate.mockImplementation(() => {
        throw new Error('Navigation failed');
      });

      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: 50,
      });

      await act(async () => {
        await result.current!.handleThresholdSelect(200);
      });

      await act(async () => {
        await result.current!.handleConfirmConversion();
      });

      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      expect(notify.cashu.navigationFailed).toHaveBeenCalled();
    });

    it('should not update threshold if pendingThreshold is null', async () => {
      const { result } = renderHookWithProps(mockProps);

      // Call confirm directly without setting pending threshold
      await act(async () => {
        await result.current!.handleConfirmConversion();
      });

      expect(mockProps.settingsHandlers.handleEcashThresholdChange).not.toHaveBeenCalled();
    });

    it('should use root navigator via getParent chain', async () => {
      // Set up a mock parent chain
      const mockParentNavigate = jest.fn();
      const mockGrandparent = {
        navigate: mockParentNavigate,
        getParent: jest.fn(() => null), // End of chain
      };
      const mockParent = {
        navigate: jest.fn(),
        getParent: jest.fn(() => mockGrandparent),
      };
      mockGetParent.mockReturnValue(mockParent as unknown as ReturnType<typeof jest.fn> | null);

      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: 50,
      });

      await act(async () => {
        await result.current!.handleThresholdSelect(200);
      });

      await act(async () => {
        await result.current!.handleConfirmConversion();
      });

      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      // Should navigate from the root (grandparent)
      expect(mockParentNavigate).toHaveBeenCalled();
    });
  });

  describe('handleLowBalanceTopUp', () => {
    beforeEach(() => {
      // Reset navigate mock to not throw
      mockNavigate.mockReset();
    });

    it('should request mint and navigate', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleLowBalanceTopUp();
      });

      expect(mockProps.closeLowBalanceModal).toHaveBeenCalled();
      expect(mockRequestMint).toHaveBeenCalledWith(50);
      expect(mockNavigate).toHaveBeenCalledWith('SendFlow', {
        screen: 'Processing',
        params: expect.objectContaining({
          fromScreen: 'Wallet',
          action: 'create_intent',
          cashuMint: true,
          quoteId: 'quote123',
          mintAmount: 50,
          amount: '0.5',
        }),
      });
      expect(notify.transaction.pending).toHaveBeenCalled();
    });

    it('should fund the mint quote amount for low-balance top-up', async () => {
      mockRequestMint.mockResolvedValueOnce({
        quoteId: 'quote-topup-adjusted',
        depositAddress: 'tb1ptopup',
        amount: 75,
      });
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleLowBalanceTopUp();
      });

      expect(mockNavigate).toHaveBeenCalledWith('SendFlow', {
        screen: 'Processing',
        params: expect.objectContaining({
          quoteId: 'quote-topup-adjusted',
          mintAmount: 75,
          amount: '0.75',
          recipient: 'tb1ptopup',
        }),
      });
    });

    it('should handle mint error', async () => {
      mockRequestMint.mockRejectedValue(new Error('Top-up failed'));

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleLowBalanceTopUp();
      });

      expect(notify.cashu.topupStartFailed).toHaveBeenCalled();
    });

    it('should handle non-Error mint exception', async () => {
      mockRequestMint.mockRejectedValue('String top-up error');

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleLowBalanceTopUp();
      });

      expect(notify.cashu.topupStartFailed).toHaveBeenCalled();
    });
  });

  describe('setters', () => {
    it('should allow setting showThresholdSheet', () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.setShowThresholdSheet(true);
      });

      expect(result.current!.showThresholdSheet).toBe(true);

      act(() => {
        result.current!.setShowThresholdSheet(false);
      });

      expect(result.current!.showThresholdSheet).toBe(false);
    });

    it('should allow setting showConversionModal', () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.setShowConversionModal(true);
      });

      expect(result.current!.showConversionModal).toBe(true);
    });
  });

  describe('return type structure', () => {
    it('should return all expected properties', () => {
      const { result } = renderHookWithProps(mockProps);

      expect(result.current).toHaveProperty('showThresholdSheet');
      expect(result.current).toHaveProperty('showConversionModal');
      expect(result.current).toHaveProperty('conversionAmount');
      expect(result.current).toHaveProperty('savedUnitBalance');
      expect(result.current).toHaveProperty('pendingThreshold');
      expect(result.current).toHaveProperty('setShowThresholdSheet');
      expect(result.current).toHaveProperty('setShowConversionModal');
      expect(result.current).toHaveProperty('handleEcashThresholdPress');
      expect(result.current).toHaveProperty('handleThresholdSelect');
      expect(result.current).toHaveProperty('handleConfirmConversion');
      expect(result.current).toHaveProperty('handleLowBalanceTopUp');
    });
  });
});
