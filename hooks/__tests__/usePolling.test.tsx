/**
 * Tests for usePolling hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { usePolling } from '../usePolling';

// Helper to render hooks
function renderHook<T>(hook: () => T) {
  const result: { current: T | null } = { current: null };
  function TestComponent() {
    result.current = hook();
    return null;
  }
  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent />);
  });
  return { result, unmount: component!.unmount };
}

describe('usePolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should call onPoll immediately when immediate is true', () => {
    const onPoll = jest.fn();

    renderHook(() =>
      usePolling({
        onPoll,
        interval: 1000,
        immediate: true,
      })
    );

    expect(onPoll).toHaveBeenCalledTimes(1);
  });

  it('should not call onPoll immediately when immediate is false', () => {
    const onPoll = jest.fn();

    renderHook(() =>
      usePolling({
        onPoll,
        interval: 1000,
        immediate: false,
      })
    );

    expect(onPoll).not.toHaveBeenCalled();
  });

  it('should poll at specified interval', () => {
    const onPoll = jest.fn();

    renderHook(() =>
      usePolling({
        onPoll,
        interval: 1000,
        immediate: false,
      })
    );

    expect(onPoll).toHaveBeenCalledTimes(0);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onPoll).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onPoll).toHaveBeenCalledTimes(2);
  });

  it('should not start polling when enabled is false', () => {
    const onPoll = jest.fn();

    renderHook(() =>
      usePolling({
        onPoll,
        interval: 1000,
        enabled: false,
      })
    );

    expect(onPoll).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(onPoll).not.toHaveBeenCalled();
  });

  it('should cleanup interval on unmount', () => {
    const onPoll = jest.fn();

    const { unmount } = renderHook(() =>
      usePolling({
        onPoll,
        interval: 1000,
        immediate: true,
      })
    );

    expect(onPoll).toHaveBeenCalledTimes(1);

    act(() => {
      unmount();
    });

    // Advancing time after unmount should not call onPoll
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(onPoll).toHaveBeenCalledTimes(1); // Still just the initial call
  });

  it('should update callback without restarting interval', () => {
    let pollCount = 0;
    const onPoll1 = jest.fn(() => { pollCount++; });
    const onPoll2 = jest.fn(() => { pollCount++; });

    function TestComponent({ callback }: { callback: () => void }) {
      usePolling({
        onPoll: callback,
        interval: 1000,
        immediate: false,
      });
      return null;
    }

    let component: ReturnType<typeof create> | undefined;
    act(() => {
      component = create(<TestComponent callback={onPoll1} />);
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onPoll1).toHaveBeenCalledTimes(1);
    expect(pollCount).toBe(1);

    // Update to use new callback
    act(() => {
      component?.update(<TestComponent callback={onPoll2} />);
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // New callback should be called
    expect(onPoll2).toHaveBeenCalledTimes(1);
    expect(pollCount).toBe(2);
  });

});
