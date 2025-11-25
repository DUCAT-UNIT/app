/**
 * Tests for useEcashThresholdManager hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useEcashThresholdManager } from '../useEcashThresholdManager';

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
let mockGetParentReturn = null;
const mockGetParent = jest.fn(() => mockGetParentReturn);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    getParent: mockGetParent,
  }),
}));

// Mock cashu wallet service
const mockRequestMint = jest.fn();

jest.mock('../../services/cashu/cashuWalletService', () => ({
  requestMint: (...args) => mockRequestMint(...args),
}));

// Helper to render hooks with props
function renderHookWithProps(props) {
  const result = { current: null };
  function TestComponent({ hookProps }) {
    result.current = useEcashThresholdManager(hookProps);
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

describe('useEcashThresholdManager', () => {
  let mockProps;

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup root navigator chain (returns null to stop iteration)
    mockGetParentReturn = null;
    mockProps = {
      cashuBalance: 100,
      runesBalance: [['rune1', '500']],
      settingsHandlers: {
        ecashThreshold: 100,
        handleEcashThresholdChange: jest.fn().mockResolvedValue(),
      },
      showToast: jest.fn(),
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

  it('should return initial state', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(result.current.showThresholdSheet).toBe(false);
    expect(result.current.showConversionModal).toBe(false);
    expect(result.current.conversionAmount).toBe(0);
    expect(result.current.savedUnitBalance).toBe(0);
    expect(result.current.pendingThreshold).toBe(null);
  });

  it('should return handler functions', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(typeof result.current.handleEcashThresholdPress).toBe('function');
    expect(typeof result.current.handleThresholdSelect).toBe('function');
    expect(typeof result.current.handleConfirmConversion).toBe('function');
    expect(typeof result.current.handleLowBalanceTopUp).toBe('function');
    expect(typeof result.current.setShowThresholdSheet).toBe('function');
    expect(typeof result.current.setShowConversionModal).toBe('function');
  });

  describe('handleEcashThresholdPress', () => {
    it('should show threshold sheet', () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current.handleEcashThresholdPress();
      });

      expect(result.current.showThresholdSheet).toBe(true);
    });
  });

  describe('handleThresholdSelect', () => {
    it('should update threshold directly when selecting same value', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current.handleThresholdSelect(100);
      });

      expect(mockProps.settingsHandlers.handleEcashThresholdChange).toHaveBeenCalledWith(100);
      expect(result.current.showConversionModal).toBe(false);
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
        await result.current.handleThresholdSelect(100);
      });

      expect(mockProps.settingsHandlers.handleEcashThresholdChange).toHaveBeenCalledWith(100);
    });

    it('should show conversion modal when more ecash needed', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: 50, // Less than threshold
      });

      await act(async () => {
        await result.current.handleThresholdSelect(200);
      });

      expect(result.current.showConversionModal).toBe(true);
      expect(result.current.pendingThreshold).toBe(200);
      expect(result.current.conversionAmount).toBe(150); // 200 - 50
    });

    it('should limit conversion to available unit balance', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: 0,
        runesBalance: [['rune1', '100']], // Only 100 available
      });

      await act(async () => {
        await result.current.handleThresholdSelect(500);
      });

      expect(result.current.conversionAmount).toBe(100); // Limited by unit balance
    });

    it('should update directly when ecash balance is sufficient', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: 300,
      });

      await act(async () => {
        await result.current.handleThresholdSelect(200);
      });

      expect(mockProps.settingsHandlers.handleEcashThresholdChange).toHaveBeenCalledWith(200);
      expect(result.current.showConversionModal).toBe(false);
    });

    it('should handle Infinity threshold', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current.handleThresholdSelect(Infinity);
      });

      // Infinity means no required amount
      expect(mockProps.settingsHandlers.handleEcashThresholdChange).toHaveBeenCalledWith(Infinity);
    });

    it('should handle empty runesBalance', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: 50,
        runesBalance: [],
      });

      await act(async () => {
        await result.current.handleThresholdSelect(200);
      });

      expect(result.current.conversionAmount).toBe(0);
    });

    it('should handle null cashuBalance', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        cashuBalance: null,
      });

      await act(async () => {
        await result.current.handleThresholdSelect(200);
      });

      // Should use 0 for null cashuBalance
      expect(result.current.showConversionModal).toBe(true);
      expect(result.current.conversionAmount).toBe(200);
    });
  });

  // Note: handleConfirmConversion and handleLowBalanceTopUp tests that involve
  // dynamic imports are tested through integration/e2e tests since Jest doesn't
  // support dynamic imports without experimental VM modules. The basic hook
  // structure and state management is covered by the tests above.

  describe('setters', () => {
    it('should allow setting showThresholdSheet', () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current.setShowThresholdSheet(true);
      });

      expect(result.current.showThresholdSheet).toBe(true);

      act(() => {
        result.current.setShowThresholdSheet(false);
      });

      expect(result.current.showThresholdSheet).toBe(false);
    });

    it('should allow setting showConversionModal', () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current.setShowConversionModal(true);
      });

      expect(result.current.showConversionModal).toBe(true);
    });
  });

});
