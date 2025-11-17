/**
 * Tests for AppNavigationContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { AppNavigationProvider, useAppNavigation } from '../AppNavigationContext';

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

describe('AppNavigationContext', () => {
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
      renderHook(() => useAppNavigation());
    }).toThrow('useAppNavigation must be used within AppNavigationProvider');

    consoleError.mockRestore();
  });

  it('should provide initial state', () => {
    const wrapper = ({ children }) => (
      <AppNavigationProvider>{children}</AppNavigationProvider>
    );
    const { result } = renderHook(() => useAppNavigation(), { wrapper });

    expect(result.current.activeTab).toBe('wallet');
    expect(result.current.inactivityTimerRef).toBeDefined();
    expect(result.current.inactivityTimerRef.current).toBeNull();
  });

  it('should update activeTab', () => {
    const wrapper = ({ children }) => (
      <AppNavigationProvider>{children}</AppNavigationProvider>
    );
    const { result } = renderHook(() => useAppNavigation(), { wrapper });

    expect(result.current.activeTab).toBe('wallet');

    act(() => {
      result.current.setActiveTab('vault');
    });

    expect(result.current.activeTab).toBe('vault');

    act(() => {
      result.current.setActiveTab('wallet');
    });

    expect(result.current.activeTab).toBe('wallet');
  });

  it('should reset inactivity timer when one exists', () => {
    const wrapper = ({ children }) => (
      <AppNavigationProvider>{children}</AppNavigationProvider>
    );
    const { result } = renderHook(() => useAppNavigation(), { wrapper });

    // Set a timer
    let timerFired = false;
    act(() => {
      result.current.inactivityTimerRef.current = setTimeout(() => {
        timerFired = true;
      }, 5000);
    });

    const timerId = result.current.inactivityTimerRef.current;
    expect(timerId).not.toBeNull();

    // Reset the timer
    act(() => {
      result.current.resetInactivityTimer();
    });

    // Advance time
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Timer should have been cleared, so it shouldn't fire
    expect(timerFired).toBe(false);
  });


  it('should allow setting custom inactivity timeout', () => {
    const customTimeout = 600000; // 10 minutes
    const wrapper = ({ children }) => (
      <AppNavigationProvider _inactivityTimeout={customTimeout}>
        {children}
      </AppNavigationProvider>
    );
    const { result } = renderHook(() => useAppNavigation(), { wrapper });

    // Provider should accept the prop without error
    expect(result.current.activeTab).toBe('wallet');
  });

  it('should allow setting inactivityTimerRef manually', () => {
    const wrapper = ({ children }) => (
      <AppNavigationProvider>{children}</AppNavigationProvider>
    );
    const { result } = renderHook(() => useAppNavigation(), { wrapper });

    const mockTimer = setTimeout(() => {}, 1000);

    act(() => {
      result.current.inactivityTimerRef.current = mockTimer;
    });

    expect(result.current.inactivityTimerRef.current).toBe(mockTimer);
  });

  it('should maintain ref across re-renders', () => {
    const wrapper = ({ children }) => (
      <AppNavigationProvider>{children}</AppNavigationProvider>
    );
    const { result, rerender } = renderHook(() => useAppNavigation(), { wrapper });

    const mockTimer = setTimeout(() => {}, 1000);

    act(() => {
      result.current.inactivityTimerRef.current = mockTimer;
    });

    const firstRef = result.current.inactivityTimerRef;

    act(() => {
      rerender();
    });

    // Ref should be the same object
    expect(result.current.inactivityTimerRef).toBe(firstRef);
    expect(result.current.inactivityTimerRef.current).toBe(mockTimer);
  });
});
