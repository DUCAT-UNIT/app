/**
 * Tests for useBackgroundSplash Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { AppState } from 'react-native';
import { useBackgroundSplash } from '../useBackgroundSplash';

// Helper to render hooks with react-test-renderer
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

// Mock AppState
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

describe('useBackgroundSplash', () => {
  let mockEventListener;
  let mockSubscription;

  beforeEach(() => {
    mockEventListener = null;
    mockSubscription = { remove: jest.fn() };

    AppState.addEventListener.mockImplementation((event, listener) => {
      mockEventListener = listener;
      return mockSubscription;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with splash hidden', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    expect(result.current.opacityRef._value).toBe(0);
  });

  it('should set up AppState listener on mount', () => {
    renderHook(() => useBackgroundSplash());

    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should show splash when app goes to background', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    expect(result.current.opacityRef._value).toBe(0);

    act(() => {
      mockEventListener('background');
    });

    expect(result.current.opacityRef._value).toBe(1);
  });

  it('should hide splash when app becomes active', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    // First, show splash
    act(() => {
      mockEventListener('background');
    });
    expect(result.current.opacityRef._value).toBe(1);

    // Then, go to active - animation starts to 0
    act(() => {
      mockEventListener('active');
    });
    // Note: Animated.timing is mocked to call callback immediately, so value should be 0
    expect(result.current.opacityRef._value).toBe(0);
  });

  it('should show splash when app becomes inactive', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    // First, ensure starting hidden
    expect(result.current.opacityRef._value).toBe(0);

    // Go to inactive (e.g., during Face ID) - should show splash
    act(() => {
      mockEventListener('inactive');
    });
    expect(result.current.opacityRef._value).toBe(1);
  });

  it('should handle background -> inactive -> active transition correctly', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    // Go to background
    act(() => {
      mockEventListener('background');
    });
    expect(result.current.opacityRef._value).toBe(1);

    // Transition to inactive - splash should stay shown
    act(() => {
      mockEventListener('inactive');
    });
    expect(result.current.opacityRef._value).toBe(1);

    // Finally to active - should hide
    act(() => {
      mockEventListener('active');
    });
    expect(result.current.opacityRef._value).toBe(0);
  });

  it('should show splash for inactive state', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    // App goes inactive (e.g., Face ID prompt, notification, control center)
    act(() => {
      mockEventListener('inactive');
    });

    // SHOULD show splash for inactive state to protect sensitive info
    expect(result.current.opacityRef._value).toBe(1);
  });

  it('should handle multiple background/active cycles', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    // Cycle 1: background -> active
    act(() => {
      mockEventListener('background');
    });
    expect(result.current.opacityRef._value).toBe(1);

    act(() => {
      mockEventListener('active');
    });
    expect(result.current.opacityRef._value).toBe(0);

    // Cycle 2: background -> active
    act(() => {
      mockEventListener('background');
    });
    expect(result.current.opacityRef._value).toBe(1);

    act(() => {
      mockEventListener('active');
    });
    expect(result.current.opacityRef._value).toBe(0);
  });

  it('should remove listener on unmount', () => {
    const { unmount } = renderHook(() => useBackgroundSplash());

    expect(mockSubscription.remove).not.toHaveBeenCalled();

    act(() => {
      unmount();
    });

    expect(mockSubscription.remove).toHaveBeenCalled();
  });

  it('should only set up listener once', () => {
    renderHook(() => useBackgroundSplash());

    expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
  });
});
