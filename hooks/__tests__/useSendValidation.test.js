/**
 * Tests for useSendValidation Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useSendValidation } from '../useSendValidation';
import * as sendHelpers from '../../utils/sendHelpers';

// Helper to render hooks with react-test-renderer
function renderHook(hook, { initialProps } = {}) {
  const result = { current: null };

  function TestComponent({ hookProps }) {
    result.current = hook(hookProps);
    return null;
  }

  let component;
  act(() => {
    component = create(<TestComponent hookProps={initialProps} />);
  });

  return {
    result,
    rerender: (newProps) => {
      act(() => {
        component.update(<TestComponent hookProps={newProps} />);
      });
    },
    unmount: () => component.unmount(),
  };
}

// Mock sendHelpers
jest.mock('../../utils/sendHelpers');

// Mock timers
jest.useFakeTimers();

describe('useSendValidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendHelpers.validateBitcoinAddress = jest.fn();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() =>
      useSendValidation({
        intentStep: 'idle',
        sendRecipient: '',
        sendAssetType: 'btc',
      })
    );

    expect(result.current.addressError).toBe('');
    expect(result.current.loadingMessageIndex).toBe(0);
  });

  describe('Address Validation', () => {
    it('should validate address when intentStep is entering_address', () => {
      sendHelpers.validateBitcoinAddress.mockReturnValue({
        valid: true,
        error: '',
      });

      renderHook(() =>
        useSendValidation({
          intentStep: 'entering_address',
          sendRecipient: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
          sendAssetType: 'btc',
        })
      );

      expect(sendHelpers.validateBitcoinAddress).toHaveBeenCalledWith(
        'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
      );
    });

    it('should show error for invalid address', () => {
      sendHelpers.validateBitcoinAddress.mockReturnValue({
        valid: false,
        error: 'Invalid Bitcoin address',
      });

      const { result } = renderHook(() =>
        useSendValidation({
          intentStep: 'entering_address',
          sendRecipient: 'invalid_address',
          sendAssetType: 'btc',
        })
      );

      expect(result.current.addressError).toBe('Invalid Bitcoin address');
    });

    it('should clear error for valid address', () => {
      sendHelpers.validateBitcoinAddress.mockReturnValue({
        valid: true,
        error: '',
      });

      const { result } = renderHook(() =>
        useSendValidation({
          intentStep: 'entering_address',
          sendRecipient: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
          sendAssetType: 'btc',
        })
      );

      expect(result.current.addressError).toBe('');
    });

    it('should not validate when not on entering_address step', () => {
      const { result } = renderHook(() =>
        useSendValidation({
          intentStep: 'entering_amount',
          sendRecipient: 'invalid_address',
          sendAssetType: 'btc',
        })
      );

      expect(sendHelpers.validateBitcoinAddress).not.toHaveBeenCalled();
      expect(result.current.addressError).toBe('');
    });
  });

  describe('UNIT Taproot Validation', () => {
    it('should require Taproot address (tb1p) for UNIT on testnet', () => {
      sendHelpers.validateBitcoinAddress.mockReturnValue({
        valid: true,
        error: '',
      });

      const { result } = renderHook(() =>
        useSendValidation({
          intentStep: 'entering_address',
          sendRecipient: 'tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', // SegWit, not Taproot
          sendAssetType: 'unit',
        })
      );

      expect(result.current.addressError).toBe(
        'UNIT transfers require a Taproot address (starting with tb1p)'
      );
    });

    it('should accept Taproot address (tb1p) for UNIT on testnet', () => {
      sendHelpers.validateBitcoinAddress.mockReturnValue({
        valid: true,
        error: '',
      });

      const { result } = renderHook(() =>
        useSendValidation({
          intentStep: 'entering_address',
          sendRecipient: 'tb1pxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxy',
          sendAssetType: 'unit',
        })
      );

      expect(result.current.addressError).toBe('');
    });

    it('should require Taproot address (bc1p) for UNIT on mainnet', () => {
      sendHelpers.validateBitcoinAddress.mockReturnValue({
        valid: true,
        error: '',
      });

      const { result } = renderHook(() =>
        useSendValidation({
          intentStep: 'entering_address',
          sendRecipient: 'bc1pxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxy',
          sendAssetType: 'unit',
        })
      );

      expect(result.current.addressError).toBe('');
    });

    it('should not require Taproot for BTC transfers', () => {
      sendHelpers.validateBitcoinAddress.mockReturnValue({
        valid: true,
        error: '',
      });

      const { result } = renderHook(() =>
        useSendValidation({
          intentStep: 'entering_address',
          sendRecipient: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', // SegWit is fine for BTC
          sendAssetType: 'btc',
        })
      );

      expect(result.current.addressError).toBe('');
    });

    it('should handle address with whitespace', () => {
      sendHelpers.validateBitcoinAddress.mockReturnValue({
        valid: true,
        error: '',
      });

      const { result } = renderHook(() =>
        useSendValidation({
          intentStep: 'entering_address',
          sendRecipient: '  tb1pxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxyxy  ',
          sendAssetType: 'unit',
        })
      );

      // Should trim and accept
      expect(result.current.addressError).toBe('');
    });
  });

  describe('Loading Messages', () => {
    it('should cycle through BTC loading messages', () => {
      const { result } = renderHook(() =>
        useSendValidation({
          intentStep: 'creating',
          sendRecipient: '',
          sendAssetType: 'btc',
        })
      );

      expect(result.current.loadingMessageIndex).toBe(0);

      // Advance 500ms - should be at message 1
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current.loadingMessageIndex).toBe(1);

      // Advance another 500ms - should stay at message 1 (BTC has 2 messages)
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current.loadingMessageIndex).toBe(1);
    });

    it('should cycle through UNIT loading messages', () => {
      const { result } = renderHook(() =>
        useSendValidation({
          intentStep: 'creating',
          sendRecipient: '',
          sendAssetType: 'unit',
        })
      );

      expect(result.current.loadingMessageIndex).toBe(0);

      // Advance 500ms - should be at message 1
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current.loadingMessageIndex).toBe(1);

      // Advance 500ms - should be at message 2
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current.loadingMessageIndex).toBe(2);

      // Advance 500ms - should stay at message 2 (UNIT has 3 messages)
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current.loadingMessageIndex).toBe(2);
    });

    it('should reset loading index when entering creating step', () => {
      const { rerender, result } = renderHook(
        ({ intentStep }) =>
          useSendValidation({
            intentStep,
            sendRecipient: '',
            sendAssetType: 'btc',
          }),
        { initialProps: { intentStep: 'idle' } }
      );

      // Start with some loading progress
      rerender({ intentStep: 'creating' });

      act(() => {
        jest.advanceTimersByTime(1000); // Advance to later message
      });

      expect(result.current.loadingMessageIndex).toBeGreaterThan(0);

      // Go back to idle and then creating again
      rerender({ intentStep: 'idle' });
      rerender({ intentStep: 'creating' });

      // Should reset to 0
      expect(result.current.loadingMessageIndex).toBe(0);
    });

    it('should clean up timer on unmount', () => {
      const { unmount, result } = renderHook(
        () =>
          useSendValidation({
            intentStep: 'creating',
            sendRecipient: '',
            sendAssetType: 'btc',
          }),
        {
          initialProps: {
            intentStep: 'creating',
            sendRecipient: '',
            sendAssetType: 'btc',
          },
        }
      );

      // Hook should be initialized
      expect(result.current.loadingMessageIndex).toBeDefined();

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });

    it('should not start timer when not creating', () => {
      renderHook(() =>
        useSendValidation({
          intentStep: 'entering_address',
          sendRecipient: '',
          sendAssetType: 'btc',
        })
      );

      const timerCount = jest.getTimerCount();

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should not have added any timers
      expect(jest.getTimerCount()).toBe(timerCount);
    });
  });

  describe('Dynamic Updates', () => {
    it('should update validation when recipient changes', () => {
      sendHelpers.validateBitcoinAddress.mockReturnValue({
        valid: true,
        error: '',
      });

      const { rerender } = renderHook(
        ({ sendRecipient }) =>
          useSendValidation({
            intentStep: 'entering_address',
            sendRecipient,
            sendAssetType: 'btc',
          }),
        { initialProps: { sendRecipient: 'address1' } }
      );

      expect(sendHelpers.validateBitcoinAddress).toHaveBeenCalledWith('address1');

      // Change recipient
      rerender({ sendRecipient: 'address2' });

      expect(sendHelpers.validateBitcoinAddress).toHaveBeenCalledWith('address2');
    });

    it('should update validation when asset type changes', () => {
      sendHelpers.validateBitcoinAddress.mockReturnValue({
        valid: true,
        error: '',
      });

      const { rerender, result } = renderHook(
        ({ sendAssetType }) =>
          useSendValidation({
            intentStep: 'entering_address',
            sendRecipient: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
            sendAssetType,
          }),
        { initialProps: { sendAssetType: 'btc' } }
      );

      expect(result.current.addressError).toBe('');

      // Change to UNIT (SegWit address should now be invalid)
      rerender({ sendAssetType: 'unit' });

      expect(result.current.addressError).toBe(
        'UNIT transfers require a Taproot address (starting with tb1p)'
      );
    });
  });
});
