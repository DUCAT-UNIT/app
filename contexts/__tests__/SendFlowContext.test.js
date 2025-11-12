/**
 * Tests for SendFlowContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { SendFlowProvider, useSendFlow } from '../SendFlowContext';

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
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useSendFlow());
    }).toThrow('useSendFlow must be used within a SendFlowProvider');

    consoleError.mockRestore();
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
});
