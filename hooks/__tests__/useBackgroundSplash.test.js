/**
 * Tests for useBackgroundSplash Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { AppState } from 'react-native';
import { useBackgroundSplash } from '../useBackgroundSplash';

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
  return { result, unmount: () => component.unmount() };
}

describe('useBackgroundSplash', () => {
  let mockListeners = {};

  beforeEach(() => {
    mockListeners = {};
    AppState.addEventListener = jest.fn((event, callback) => {
      mockListeners[event] = callback;
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with splash hidden', () => {
    const { result } = renderHook(() => useBackgroundSplash());
    expect(result.current.showBackgroundSplash).toBe(false);
  });

  it('should show splash when app goes to background', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    act(() => {
      mockListeners.change('background');
    });

    expect(result.current.showBackgroundSplash).toBe(true);
  });

  it('should hide splash when app becomes active', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    // Background first
    act(() => {
      mockListeners.change('background');
    });
    expect(result.current.showBackgroundSplash).toBe(true);

    // Then active
    act(() => {
      mockListeners.change('active');
    });
    expect(result.current.showBackgroundSplash).toBe(false);
  });

  it('should hide splash when app becomes inactive', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    // Background first
    act(() => {
      mockListeners.change('background');
    });
    expect(result.current.showBackgroundSplash).toBe(true);

    // Then inactive (during transitions like Face ID)
    act(() => {
      mockListeners.change('inactive');
    });
    expect(result.current.showBackgroundSplash).toBe(false);
  });

  it('should handle rapid state changes', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    act(() => {
      mockListeners.change('background');
    });
    expect(result.current.showBackgroundSplash).toBe(true);

    act(() => {
      mockListeners.change('inactive');
    });
    expect(result.current.showBackgroundSplash).toBe(false);

    act(() => {
      mockListeners.change('active');
    });
    expect(result.current.showBackgroundSplash).toBe(false);

    act(() => {
      mockListeners.change('background');
    });
    expect(result.current.showBackgroundSplash).toBe(true);
  });

  it('should clean up listener on unmount', () => {
    const { unmount } = renderHook(() => useBackgroundSplash());

    // Verify listener was registered
    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    // Unmount should not throw
    expect(() => unmount()).not.toThrow();
  });

  it('should handle unknown app states gracefully', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    // Test an unknown/future app state value
    act(() => {
      mockListeners.change('unknown');
    });

    // Should not change state for unknown values
    expect(result.current.showBackgroundSplash).toBe(false);
  });
});
