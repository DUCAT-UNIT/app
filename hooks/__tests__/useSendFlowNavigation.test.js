/**
 * Tests for useSendFlowNavigation Hook
 * Validates step navigation and state cleanup for send transaction flow
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useSendFlowNavigation } from '../useSendFlowNavigation';

// Mock contexts
const mockSetIntentStep = jest.fn();
const mockSetSendAssetType = jest.fn();
const mockSetSendAmount = jest.fn();
const mockSetSendRecipient = jest.fn();
const mockSetSendIntent = jest.fn();
const mockSetBroadcastedTxid = jest.fn();

jest.mock('../../contexts/SendFlowContext', () => ({
  useSendFlow: () => ({
    setIntentStep: mockSetIntentStep,
    setSendAssetType: mockSetSendAssetType,
    setSendAmount: mockSetSendAmount,
    setSendRecipient: mockSetSendRecipient,
  }),
}));

jest.mock('../../contexts/TransactionBuildContext', () => ({
  useTransactionBuild: () => ({
    setSendIntent: mockSetSendIntent,
  }),
}));

jest.mock('../../contexts/TransactionExecutionContext', () => ({
  useTransactionExecution: () => ({
    setBroadcastedTxid: mockSetBroadcastedTxid,
  }),
}));

// Helper to render hooks
function renderHook(hook) {
  const result = { current: null };
  function TestComponent() {
    result.current = hook();
    return null;
  }
  let component;
  act(() => {
    component = create(<TestComponent />);
  });
  return {
    result,
    unmount: () => component.unmount(),
  };
}

describe('useSendFlowNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should provide all dismiss handlers', () => {
      const { result } = renderHook(() => useSendFlowNavigation());

      expect(result.current.handleAssetSelectorDismiss).toBeDefined();
      expect(result.current.handleAddressInputDismiss).toBeDefined();
      expect(result.current.handleAmountInputDismiss).toBeDefined();
      expect(result.current.handleReviewDismiss).toBeDefined();
      expect(result.current.handleConfirmedDismiss).toBeDefined();
      expect(result.current.handleConfirmedClose).toBeDefined();
      expect(result.current.handleSheetDismiss).toBeDefined();
    });
  });

  describe('Asset Selector Dismiss', () => {
    it('should reset to idle step only', () => {
      const { result } = renderHook(() => useSendFlowNavigation());

      act(() => {
        result.current.handleAssetSelectorDismiss();
      });

      expect(mockSetIntentStep).toHaveBeenCalledWith('idle');
      expect(mockSetSendAssetType).not.toHaveBeenCalled();
      expect(mockSetSendRecipient).not.toHaveBeenCalled();
      expect(mockSetSendAmount).not.toHaveBeenCalled();
    });
  });

  describe('Address Input Dismiss', () => {
    it('should reset step, asset type, and recipient', () => {
      const { result } = renderHook(() => useSendFlowNavigation());

      act(() => {
        result.current.handleAddressInputDismiss();
      });

      expect(mockSetIntentStep).toHaveBeenCalledWith('idle');
      expect(mockSetSendAssetType).toHaveBeenCalledWith(null);
      expect(mockSetSendRecipient).toHaveBeenCalledWith('');
    });
  });

  describe('Amount Input Dismiss', () => {
    it('should reset step, asset type, amount, and recipient', () => {
      const { result } = renderHook(() => useSendFlowNavigation());

      act(() => {
        result.current.handleAmountInputDismiss();
      });

      expect(mockSetIntentStep).toHaveBeenCalledWith('idle');
      expect(mockSetSendAssetType).toHaveBeenCalledWith(null);
      expect(mockSetSendAmount).toHaveBeenCalledWith('');
      expect(mockSetSendRecipient).toHaveBeenCalledWith('');
    });
  });

  describe('Review Dismiss', () => {
    it('should reset step and send intent', () => {
      const { result } = renderHook(() => useSendFlowNavigation());

      act(() => {
        result.current.handleReviewDismiss();
      });

      expect(mockSetIntentStep).toHaveBeenCalledWith('idle');
      expect(mockSetSendIntent).toHaveBeenCalledWith(null);
    });
  });

  describe('Confirmed Dismiss', () => {
    it('should reset all send flow state', () => {
      const { result } = renderHook(() => useSendFlowNavigation());

      act(() => {
        result.current.handleConfirmedDismiss();
      });

      expect(mockSetIntentStep).toHaveBeenCalledWith('idle');
      expect(mockSetSendIntent).toHaveBeenCalledWith(null);
      expect(mockSetSendAmount).toHaveBeenCalledWith('');
      expect(mockSetSendRecipient).toHaveBeenCalledWith('');
      expect(mockSetSendAssetType).toHaveBeenCalledWith(null);
      expect(mockSetBroadcastedTxid).toHaveBeenCalledWith(null);
    });
  });

  describe('Confirmed Close', () => {
    it('should reset all send flow state', () => {
      const { result } = renderHook(() => useSendFlowNavigation());

      act(() => {
        result.current.handleConfirmedClose();
      });

      expect(mockSetSendIntent).toHaveBeenCalledWith(null);
      expect(mockSetIntentStep).toHaveBeenCalledWith('idle');
      expect(mockSetSendAmount).toHaveBeenCalledWith('');
      expect(mockSetSendRecipient).toHaveBeenCalledWith('');
      expect(mockSetSendAssetType).toHaveBeenCalledWith(null);
      expect(mockSetBroadcastedTxid).toHaveBeenCalledWith(null);
    });
  });

  describe('Unified Sheet Dismiss Handler', () => {
    it('should call asset selector dismiss for assetSelector sheet', () => {
      const { result } = renderHook(() => useSendFlowNavigation());

      act(() => {
        result.current.handleSheetDismiss('assetSelector');
      });

      expect(mockSetIntentStep).toHaveBeenCalledWith('idle');
    });

    it('should call address input dismiss for addressInput sheet', () => {
      const { result } = renderHook(() => useSendFlowNavigation());

      act(() => {
        result.current.handleSheetDismiss('addressInput');
      });

      expect(mockSetIntentStep).toHaveBeenCalledWith('idle');
      expect(mockSetSendAssetType).toHaveBeenCalledWith(null);
      expect(mockSetSendRecipient).toHaveBeenCalledWith('');
    });

    it('should call amount input dismiss for amountInput sheet', () => {
      const { result } = renderHook(() => useSendFlowNavigation());

      act(() => {
        result.current.handleSheetDismiss('amountInput');
      });

      expect(mockSetIntentStep).toHaveBeenCalledWith('idle');
      expect(mockSetSendAssetType).toHaveBeenCalledWith(null);
      expect(mockSetSendAmount).toHaveBeenCalledWith('');
      expect(mockSetSendRecipient).toHaveBeenCalledWith('');
    });

    it('should call review dismiss for review sheet', () => {
      const { result } = renderHook(() => useSendFlowNavigation());

      act(() => {
        result.current.handleSheetDismiss('review');
      });

      expect(mockSetIntentStep).toHaveBeenCalledWith('idle');
      expect(mockSetSendIntent).toHaveBeenCalledWith(null);
    });

    it('should call confirmed dismiss for confirmed sheet', () => {
      const { result } = renderHook(() => useSendFlowNavigation());

      act(() => {
        result.current.handleSheetDismiss('confirmed');
      });

      expect(mockSetIntentStep).toHaveBeenCalledWith('idle');
      expect(mockSetSendIntent).toHaveBeenCalledWith(null);
      expect(mockSetBroadcastedTxid).toHaveBeenCalledWith(null);
    });

    it('should handle unknown sheet names gracefully', () => {
      const { result } = renderHook(() => useSendFlowNavigation());

      act(() => {
        result.current.handleSheetDismiss('unknownSheet');
      });

      expect(mockSetIntentStep).not.toHaveBeenCalled();
    });

    it('should handle null sheet names gracefully', () => {
      const { result } = renderHook(() => useSendFlowNavigation());

      act(() => {
        result.current.handleSheetDismiss(null);
      });

      expect(mockSetIntentStep).not.toHaveBeenCalled();
    });

    it('should handle undefined sheet names gracefully', () => {
      const { result } = renderHook(() => useSendFlowNavigation());

      act(() => {
        result.current.handleSheetDismiss(undefined);
      });

      expect(mockSetIntentStep).not.toHaveBeenCalled();
    });
  });

  describe('State Cleanup Consistency', () => {
    it('should ensure confirmed dismiss and close have identical behavior', () => {
      const { result } = renderHook(() => useSendFlowNavigation());

      // Test dismiss
      act(() => {
        result.current.handleConfirmedDismiss();
      });

      const dismissCalls = {
        setIntentStep: mockSetIntentStep.mock.calls.length,
        setSendIntent: mockSetSendIntent.mock.calls.length,
        setSendAmount: mockSetSendAmount.mock.calls.length,
        setSendRecipient: mockSetSendRecipient.mock.calls.length,
        setSendAssetType: mockSetSendAssetType.mock.calls.length,
        setBroadcastedTxid: mockSetBroadcastedTxid.mock.calls.length,
      };

      jest.clearAllMocks();

      // Test close
      act(() => {
        result.current.handleConfirmedClose();
      });

      const closeCalls = {
        setIntentStep: mockSetIntentStep.mock.calls.length,
        setSendIntent: mockSetSendIntent.mock.calls.length,
        setSendAmount: mockSetSendAmount.mock.calls.length,
        setSendRecipient: mockSetSendRecipient.mock.calls.length,
        setSendAssetType: mockSetSendAssetType.mock.calls.length,
        setBroadcastedTxid: mockSetBroadcastedTxid.mock.calls.length,
      };

      expect(dismissCalls).toEqual(closeCalls);
    });
  });

  describe('Progressive State Cleanup', () => {
    it('should clean up progressively more state as user advances through flow', () => {
      const { result } = renderHook(() => useSendFlowNavigation());

      // Asset selector: minimal cleanup
      act(() => {
        result.current.handleAssetSelectorDismiss();
      });
      let totalCalls = Object.values({
        setIntentStep: mockSetIntentStep.mock.calls.length,
        setSendAssetType: mockSetSendAssetType.mock.calls.length,
        setSendRecipient: mockSetSendRecipient.mock.calls.length,
        setSendAmount: mockSetSendAmount.mock.calls.length,
      }).reduce((a, b) => a + b, 0);
      expect(totalCalls).toBe(1); // Only setIntentStep

      jest.clearAllMocks();

      // Address input: more cleanup
      act(() => {
        result.current.handleAddressInputDismiss();
      });
      totalCalls = Object.values({
        setIntentStep: mockSetIntentStep.mock.calls.length,
        setSendAssetType: mockSetSendAssetType.mock.calls.length,
        setSendRecipient: mockSetSendRecipient.mock.calls.length,
      }).reduce((a, b) => a + b, 0);
      expect(totalCalls).toBe(3);

      jest.clearAllMocks();

      // Amount input: even more cleanup
      act(() => {
        result.current.handleAmountInputDismiss();
      });
      totalCalls = Object.values({
        setIntentStep: mockSetIntentStep.mock.calls.length,
        setSendAssetType: mockSetSendAssetType.mock.calls.length,
        setSendRecipient: mockSetSendRecipient.mock.calls.length,
        setSendAmount: mockSetSendAmount.mock.calls.length,
      }).reduce((a, b) => a + b, 0);
      expect(totalCalls).toBe(4);
    });
  });
});
