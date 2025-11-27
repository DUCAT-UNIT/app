// @ts-nocheck
/**
 * Tests for SendFlowContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { SendFlowProvider, useSendFlow } from '../SendFlowContext';
import { resetSendFlowStore } from '../../stores';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
  },
}));

// Helper to render hooks with react-test-renderer
function renderHook(hook, { wrapper: Wrapper } = {}) {
  const result = { current: null };

  function TestComponent() {
    result.current = hook();
    return null;
  }

  let component;
  act(() => {
    component = Wrapper
      ? create(<Wrapper><TestComponent /></Wrapper>)
      : create(<TestComponent />);
  });

  return { result, rerender: component.update, unmount: component.unmount };
}

describe('SendFlowContext', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
    // Reset Zustand store state between tests
    resetSendFlowStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should work without provider (Zustand stores are globally accessible)', () => {
    // Zustand stores don't require providers - they're globally accessible
    const { result } = renderHook(() => useSendFlow());

    expect(result.current.intentStep).toBe('idle');
    expect(result.current.setIntentStep).toBeDefined();
  });

  it('should provide initial state', () => {
    const wrapper = ({ children }) => <SendFlowProvider>{children}</SendFlowProvider>;
    const { result } = renderHook(() => useSendFlow(), { wrapper });

    expect(result.current.intentStep).toBe('idle');
    expect(result.current.sendAssetType).toBe(null);
    expect(result.current.sendAmount).toBe('');
    expect(result.current.sendRecipient).toBe('');
    expect(result.current.sendAddressType).toBe('taproot');
  });

  it('should update intentStep', () => {
    const wrapper = ({ children }) => <SendFlowProvider>{children}</SendFlowProvider>;
    const { result } = renderHook(() => useSendFlow(), { wrapper });

    act(() => {
      result.current.setIntentStep('selecting_asset');
    });

    expect(result.current.intentStep).toBe('selecting_asset');

    act(() => {
      result.current.setIntentStep('entering_address');
    });

    expect(result.current.intentStep).toBe('entering_address');
  });

  it('should update sendAssetType', () => {
    const wrapper = ({ children }) => <SendFlowProvider>{children}</SendFlowProvider>;
    const { result } = renderHook(() => useSendFlow(), { wrapper });

    act(() => {
      result.current.setSendAssetType('btc');
    });

    expect(result.current.sendAssetType).toBe('btc');

    act(() => {
      result.current.setSendAssetType('unit');
    });

    expect(result.current.sendAssetType).toBe('unit');
  });

  it('should update sendAmount', () => {
    const wrapper = ({ children }) => <SendFlowProvider>{children}</SendFlowProvider>;
    const { result } = renderHook(() => useSendFlow(), { wrapper });

    act(() => {
      result.current.setSendAmount('0.001');
    });

    expect(result.current.sendAmount).toBe('0.001');
  });

  it('should update sendRecipient', () => {
    const wrapper = ({ children }) => <SendFlowProvider>{children}</SendFlowProvider>;
    const { result } = renderHook(() => useSendFlow(), { wrapper });

    act(() => {
      result.current.setSendRecipient('bc1qrecipient');
    });

    expect(result.current.sendRecipient).toBe('bc1qrecipient');
  });

  it('should update sendAddressType', () => {
    const wrapper = ({ children }) => <SendFlowProvider>{children}</SendFlowProvider>;
    const { result } = renderHook(() => useSendFlow(), { wrapper });

    expect(result.current.sendAddressType).toBe('taproot');

    act(() => {
      result.current.setSendAddressType('segwit');
    });

    expect(result.current.sendAddressType).toBe('segwit');
  });

  it('should auto-clear transaction fields when confirmed', () => {
    const wrapper = ({ children }) => <SendFlowProvider>{children}</SendFlowProvider>;
    const { result } = renderHook(() => useSendFlow(), { wrapper });

    // Set up transaction data
    act(() => {
      result.current.setSendAssetType('btc');
      result.current.setSendAmount('0.001');
      result.current.setSendRecipient('bc1qrecipient');
    });

    expect(result.current.sendAssetType).toBe('btc');
    expect(result.current.sendAmount).toBe('0.001');
    expect(result.current.sendRecipient).toBe('bc1qrecipient');

    // Set to confirmed
    act(() => {
      result.current.setIntentStep('confirmed');
    });

    // Should clear fields immediately
    expect(result.current.sendRecipient).toBe('');
    expect(result.current.sendAmount).toBe('');
    expect(result.current.sendAssetType).toBe(null);
    expect(result.current.intentStep).toBe('confirmed');
  });

  it('should auto-reset to idle after 10 seconds when confirmed', () => {
    const wrapper = ({ children }) => <SendFlowProvider>{children}</SendFlowProvider>;
    const { result } = renderHook(() => useSendFlow(), { wrapper });

    // Set to confirmed
    act(() => {
      result.current.setIntentStep('confirmed');
    });

    expect(result.current.intentStep).toBe('confirmed');

    // Advance time by 10 seconds
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(result.current.intentStep).toBe('idle');
  });

  it('should cancel auto-reset timer if step changes before 10 seconds', () => {
    const wrapper = ({ children }) => <SendFlowProvider>{children}</SendFlowProvider>;
    const { result } = renderHook(() => useSendFlow(), { wrapper });

    // Set to confirmed
    act(() => {
      result.current.setIntentStep('confirmed');
    });

    expect(result.current.intentStep).toBe('confirmed');

    // Change step before timer fires
    act(() => {
      jest.advanceTimersByTime(5000);
      result.current.setIntentStep('reviewing');
    });

    expect(result.current.intentStep).toBe('reviewing');

    // Advance remaining time
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Should still be 'reviewing', not reset to 'idle'
    expect(result.current.intentStep).toBe('reviewing');
  });

  it('should cleanup timer on unmount', () => {
    const wrapper = ({ children }) => <SendFlowProvider>{children}</SendFlowProvider>;
    const { result, unmount } = renderHook(() => useSendFlow(), { wrapper });

    // Set to confirmed
    act(() => {
      result.current.setIntentStep('confirmed');
    });

    // Unmount before timer fires
    act(() => {
      unmount();
    });

    // Should not throw error when timer tries to fire
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // No assertion needed - we're just testing that unmount cleanup works
  });

  it('should reset all send flow state', () => {
    const wrapper = ({ children }) => <SendFlowProvider>{children}</SendFlowProvider>;
    const { result } = renderHook(() => useSendFlow(), { wrapper });

    // Set up transaction data
    act(() => {
      result.current.setIntentStep('reviewing');
      result.current.setSendAssetType('btc');
      result.current.setSendAmount('0.001');
      result.current.setSendRecipient('bc1qrecipient');
      result.current.setSendAddressType('segwit');
      result.current.setRequireConfirmedUtxos(true);
      result.current.setTurboEnabled(true);
    });

    // Verify state was set
    expect(result.current.intentStep).toBe('reviewing');
    expect(result.current.sendAssetType).toBe('btc');
    expect(result.current.sendAmount).toBe('0.001');
    expect(result.current.sendRecipient).toBe('bc1qrecipient');
    expect(result.current.sendAddressType).toBe('segwit');
    expect(result.current.requireConfirmedUtxos).toBe(true);
    expect(result.current.turboEnabled).toBe(true);

    // Reset all state
    act(() => {
      result.current.resetSendFlow();
    });

    // All state should be reset to initial values
    expect(result.current.intentStep).toBe('idle');
    expect(result.current.sendAssetType).toBe(null);
    expect(result.current.sendAmount).toBe('');
    expect(result.current.sendRecipient).toBe('');
    expect(result.current.sendAddressType).toBe('taproot');
    expect(result.current.requireConfirmedUtxos).toBe(false);
    expect(result.current.turboEnabled).toBe(false);
  });

  describe('Setters with function updaters', () => {
    it('should support function updater for setSendAssetType', () => {
      const wrapper = ({ children }) => <SendFlowProvider>{children}</SendFlowProvider>;
      const { result } = renderHook(() => useSendFlow(), { wrapper });

      // Set initial value
      act(() => {
        result.current.setSendAssetType('btc');
      });
      expect(result.current.sendAssetType).toBe('btc');

      // Use function updater
      act(() => {
        result.current.setSendAssetType((prev) => prev === 'btc' ? 'unit' : 'btc');
      });
      expect(result.current.sendAssetType).toBe('unit');
    });

    it('should support function updater for setSendAmount', () => {
      const wrapper = ({ children }) => <SendFlowProvider>{children}</SendFlowProvider>;
      const { result } = renderHook(() => useSendFlow(), { wrapper });

      // Set initial value
      act(() => {
        result.current.setSendAmount('100');
      });
      expect(result.current.sendAmount).toBe('100');

      // Use function updater
      act(() => {
        result.current.setSendAmount((prev) => prev + '0');
      });
      expect(result.current.sendAmount).toBe('1000');
    });

    it('should support function updater for setSendRecipient', () => {
      const wrapper = ({ children }) => <SendFlowProvider>{children}</SendFlowProvider>;
      const { result } = renderHook(() => useSendFlow(), { wrapper });

      // Set initial value
      act(() => {
        result.current.setSendRecipient('bc1q');
      });
      expect(result.current.sendRecipient).toBe('bc1q');

      // Use function updater
      act(() => {
        result.current.setSendRecipient((prev) => prev + 'test');
      });
      expect(result.current.sendRecipient).toBe('bc1qtest');
    });

    it('should support function updater for setSendAddressType', () => {
      const wrapper = ({ children }) => <SendFlowProvider>{children}</SendFlowProvider>;
      const { result } = renderHook(() => useSendFlow(), { wrapper });

      expect(result.current.sendAddressType).toBe('taproot');

      // Use function updater
      act(() => {
        result.current.setSendAddressType((prev) => prev === 'taproot' ? 'segwit' : 'taproot');
      });
      expect(result.current.sendAddressType).toBe('segwit');
    });

    it('should support function updater for setRequireConfirmedUtxos', () => {
      const wrapper = ({ children }) => <SendFlowProvider>{children}</SendFlowProvider>;
      const { result } = renderHook(() => useSendFlow(), { wrapper });

      expect(result.current.requireConfirmedUtxos).toBe(false);

      // Use function updater
      act(() => {
        result.current.setRequireConfirmedUtxos((prev) => !prev);
      });
      expect(result.current.requireConfirmedUtxos).toBe(true);
    });

    it('should support function updater for setTurboEnabled', () => {
      const wrapper = ({ children }) => <SendFlowProvider>{children}</SendFlowProvider>;
      const { result } = renderHook(() => useSendFlow(), { wrapper });

      expect(result.current.turboEnabled).toBe(false);

      // Use function updater
      act(() => {
        result.current.setTurboEnabled((prev) => !prev);
      });
      expect(result.current.turboEnabled).toBe(true);
    });
  });
});
