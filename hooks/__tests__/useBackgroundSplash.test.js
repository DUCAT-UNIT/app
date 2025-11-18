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

    expect(result.current.showBackgroundSplash).toBe(false);
  });

  it('should set up AppState listener on mount', () => {
    renderHook(() => useBackgroundSplash());

    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should show splash when app goes to background', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    expect(result.current.showBackgroundSplash).toBe(false);

    act(() => {
      mockEventListener('background');
    });

    expect(result.current.showBackgroundSplash).toBe(true);
  });

  it('should hide splash when app becomes active', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    // First, show splash
    act(() => {
      mockEventListener('background');
    });
    expect(result.current.showBackgroundSplash).toBe(true);

    // Then, go to active
    act(() => {
      mockEventListener('active');
    });
    expect(result.current.showBackgroundSplash).toBe(false);
  });

  it('should hide splash when app becomes inactive', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    // First, show splash
    act(() => {
      mockEventListener('background');
    });
    expect(result.current.showBackgroundSplash).toBe(true);

    // Then, go to inactive (e.g., during Face ID)
    act(() => {
      mockEventListener('inactive');
    });
    expect(result.current.showBackgroundSplash).toBe(false);
  });

  it('should handle background -> inactive -> active transition correctly', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    // Go to background
    act(() => {
      mockEventListener('background');
    });
    expect(result.current.showBackgroundSplash).toBe(true);

    // Transition to inactive (iOS common pattern)
    act(() => {
      mockEventListener('inactive');
    });
    expect(result.current.showBackgroundSplash).toBe(false);

    // Finally to active
    act(() => {
      mockEventListener('active');
    });
    expect(result.current.showBackgroundSplash).toBe(false);
  });

  it('should not show splash for inactive state without background first', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    // App goes inactive (e.g., Face ID prompt, notification, control center)
    act(() => {
      mockEventListener('inactive');
    });

    // Should NOT show splash for inactive state
    expect(result.current.showBackgroundSplash).toBe(false);
  });

  it('should handle multiple background/active cycles', () => {
    const { result } = renderHook(() => useBackgroundSplash());

    // Cycle 1: background -> active
    act(() => {
      mockEventListener('background');
    });
    expect(result.current.showBackgroundSplash).toBe(true);

    act(() => {
      mockEventListener('active');
    });
    expect(result.current.showBackgroundSplash).toBe(false);

    // Cycle 2: background -> active
    act(() => {
      mockEventListener('background');
    });
    expect(result.current.showBackgroundSplash).toBe(true);

    act(() => {
      mockEventListener('active');
    });
    expect(result.current.showBackgroundSplash).toBe(false);
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
