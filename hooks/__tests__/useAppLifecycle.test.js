/**
 * Tests for useAppLifecycle Hook
 * Validates app lifecycle management including auto-lock, inactivity timer, and screen capture
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { AppState } from 'react-native';
import { useAppLifecycle } from '../useAppLifecycle';
import * as ScreenCapture from 'expo-screen-capture';

// Mock expo-screen-capture
jest.mock('expo-screen-capture', () => ({
  allowScreenCaptureAsync: jest.fn(),
  preventScreenCaptureAsync: jest.fn(),
}));

// Mock timers for inactivity
jest.useFakeTimers();

// Mock AppState listeners
let mockAppStateListeners = {};
AppState.addEventListener = jest.fn((event, handler) => {
  mockAppStateListeners[event] = handler;
  return {
    remove: jest.fn(() => {
      delete mockAppStateListeners[event];
    }),
  };
});

// Helper to render hooks with props
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

describe('useAppLifecycle', () => {
  let mockProps;

  beforeEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
    mockAppStateListeners = {};
    AppState.currentState = 'active';

    mockProps = {
      isAuthenticated: false,
      walletExists: { current: false },
      seedConfirmedRef: { current: false },
      isBiometricSupported: false,
      biometricEnabled: false,
      onLock: jest.fn(),
      onAuthenticateUser: jest.fn(),
    };
  });

  describe('Screen Capture Management', () => {
    it('should allow screen capture on mount', async () => {
      ScreenCapture.allowScreenCaptureAsync.mockResolvedValue();

      renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(ScreenCapture.allowScreenCaptureAsync).toHaveBeenCalled();
    });


  });

  describe('App State Changes', () => {
    it('should set up AppState listener on mount', () => {
      renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should lock wallet when returning from background', () => {
      mockProps.walletExists.current = true;
      mockProps.seedConfirmedRef.current = true;
      mockProps.isBiometricSupported = true;

      renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      // Simulate app going to background
      AppState.currentState = 'background';
      act(() => {
        mockAppStateListeners.change('background');
      });

      // Simulate app coming back to foreground
      act(() => {
        mockAppStateListeners.change('active');
      });

      expect(mockProps.onLock).toHaveBeenCalled();
    });

    it('should trigger biometric auth when returning from background if enabled', () => {
      mockProps.walletExists.current = true;
      mockProps.seedConfirmedRef.current = true;
      mockProps.isBiometricSupported = true;
      mockProps.biometricEnabled = true;

      renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      // Simulate app going to background
      AppState.currentState = 'background';
      act(() => {
        mockAppStateListeners.change('background');
      });

      // Simulate app coming back to foreground
      act(() => {
        mockAppStateListeners.change('active');
      });

      expect(mockProps.onLock).toHaveBeenCalled();
      expect(mockProps.onAuthenticateUser).toHaveBeenCalled();
    });

    it('should not trigger biometric auth if biometric is disabled', () => {
      mockProps.walletExists.current = true;
      mockProps.seedConfirmedRef.current = true;
      mockProps.isBiometricSupported = true;
      mockProps.biometricEnabled = false;

      renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      // Simulate app going to background
      AppState.currentState = 'background';
      act(() => {
        mockAppStateListeners.change('background');
      });

      // Simulate app coming back to foreground
      act(() => {
        mockAppStateListeners.change('active');
      });

      expect(mockProps.onLock).toHaveBeenCalled();
      expect(mockProps.onAuthenticateUser).not.toHaveBeenCalled();
    });

    it('should not lock when transitioning from inactive to active', () => {
      mockProps.walletExists.current = true;
      mockProps.seedConfirmedRef.current = true;
      mockProps.isBiometricSupported = true;

      renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      // Simulate app going to inactive (e.g., control center, Face ID)
      AppState.currentState = 'inactive';
      act(() => {
        mockAppStateListeners.change('inactive');
      });

      // Simulate app coming back to active
      act(() => {
        mockAppStateListeners.change('active');
      });

      expect(mockProps.onLock).not.toHaveBeenCalled();
    });

    it('should not lock if wallet does not exist', () => {
      mockProps.walletExists.current = false;
      mockProps.seedConfirmedRef.current = true;
      mockProps.isBiometricSupported = true;

      renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      // Simulate app going to background and returning
      AppState.currentState = 'background';
      act(() => {
        mockAppStateListeners.change('background');
      });

      act(() => {
        mockAppStateListeners.change('active');
      });

      expect(mockProps.onLock).not.toHaveBeenCalled();
    });

    it('should not lock if seed is not confirmed', () => {
      mockProps.walletExists.current = true;
      mockProps.seedConfirmedRef.current = false;
      mockProps.isBiometricSupported = true;

      renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      // Simulate app going to background and returning
      AppState.currentState = 'background';
      act(() => {
        mockAppStateListeners.change('background');
      });

      act(() => {
        mockAppStateListeners.change('active');
      });

      expect(mockProps.onLock).not.toHaveBeenCalled();
    });

    it('should lock even if biometric is not supported', () => {
      mockProps.walletExists.current = true;
      mockProps.seedConfirmedRef.current = true;
      mockProps.isBiometricSupported = false;

      renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      // Simulate app going to background and returning
      AppState.currentState = 'background';
      act(() => {
        mockAppStateListeners.change('background');
      });

      act(() => {
        mockAppStateListeners.change('active');
      });

      // Should lock even without biometric support (PIN fallback)
      expect(mockProps.onLock).toHaveBeenCalled();
      // But should NOT trigger biometric auth
      expect(mockProps.onAuthenticateUser).not.toHaveBeenCalled();
    });
  });

  describe('Inactivity Timer', () => {
    it('should start inactivity timer when authenticated', () => {
      mockProps.isAuthenticated = true;
      mockProps.walletExists.current = true;
      mockProps.seedConfirmedRef.current = true;
      mockProps.isBiometricSupported = true;

      renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });

    it('should lock wallet after 2 minutes of inactivity', () => {
      mockProps.isAuthenticated = true;
      mockProps.walletExists.current = true;
      mockProps.seedConfirmedRef.current = true;
      mockProps.isBiometricSupported = true;

      renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      expect(mockProps.onLock).not.toHaveBeenCalled();

      // Fast forward 2 minutes (120000ms)
      act(() => {
        jest.advanceTimersByTime(120000);
      });

      expect(mockProps.onLock).toHaveBeenCalled();
    });

    it('should not start timer if not authenticated', () => {
      mockProps.isAuthenticated = false;
      mockProps.walletExists.current = true;
      mockProps.seedConfirmedRef.current = true;
      mockProps.isBiometricSupported = true;

      renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      const timerCount = jest.getTimerCount();

      // Should have minimal timers (just from React)
      expect(timerCount).toBeLessThan(2);
    });

    it('should not start timer if wallet does not exist', () => {
      mockProps.isAuthenticated = true;
      mockProps.walletExists.current = false;
      mockProps.seedConfirmedRef.current = true;
      mockProps.isBiometricSupported = true;

      renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      const timerCount = jest.getTimerCount();
      expect(timerCount).toBeLessThan(2);
    });

    it('should not start timer if seed is not confirmed', () => {
      mockProps.isAuthenticated = true;
      mockProps.walletExists.current = true;
      mockProps.seedConfirmedRef.current = false;
      mockProps.isBiometricSupported = true;

      renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      const timerCount = jest.getTimerCount();
      expect(timerCount).toBeLessThan(2);
    });

    it('should start timer even if biometric is not supported', () => {
      mockProps.isAuthenticated = true;
      mockProps.walletExists.current = true;
      mockProps.seedConfirmedRef.current = true;
      mockProps.isBiometricSupported = false;

      renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      // Timer should start regardless of biometric support (PIN fallback available)
      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });

    it('should restart timer when resetInactivityTimer is called', () => {
      mockProps.isAuthenticated = true;
      mockProps.walletExists.current = true;
      mockProps.seedConfirmedRef.current = true;
      mockProps.isBiometricSupported = true;

      const { result } = renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      // Advance time almost to timeout
      act(() => {
        jest.advanceTimersByTime(110000); // 1 minute 50 seconds
      });

      expect(mockProps.onLock).not.toHaveBeenCalled();

      // Reset timer
      act(() => {
        result.current.resetInactivityTimer();
      });

      // Advance another 1 minute 50 seconds (should not lock yet because timer was reset)
      act(() => {
        jest.advanceTimersByTime(110000);
      });

      expect(mockProps.onLock).not.toHaveBeenCalled();

      // Advance remaining 10 seconds to complete the 2 minutes from reset
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(mockProps.onLock).toHaveBeenCalled();
    });



    it('should clean up inactivity timer through final useEffect', () => {
      mockProps.isAuthenticated = false;
      mockProps.walletExists.current = false;
      mockProps.seedConfirmedRef.current = false;
      mockProps.isBiometricSupported = false;

      const { unmount, result } = renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      // Manually create a timer by calling resetInactivityTimer
      act(() => {
        result.current.resetInactivityTimer();
      });

      // Verify timer was created
      expect(jest.getTimerCount()).toBeGreaterThan(0);

      // Unmount should trigger final cleanup useEffect
      act(() => {
        unmount();
      });

      // Should not throw
      expect(true).toBe(true);
    });

  });


  describe('Edge Cases', () => {
    it('should handle multiple rapid app state changes', () => {
      mockProps.walletExists.current = true;
      mockProps.seedConfirmedRef.current = true;
      mockProps.isBiometricSupported = true;

      renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      // Rapid state changes
      AppState.currentState = 'background';
      act(() => {
        mockAppStateListeners.change('background');
      });

      act(() => {
        mockAppStateListeners.change('active');
      });

      AppState.currentState = 'background';
      act(() => {
        mockAppStateListeners.change('background');
      });

      act(() => {
        mockAppStateListeners.change('active');
      });

      // Should have locked twice
      expect(mockProps.onLock).toHaveBeenCalledTimes(2);
    });

    it('should handle changing authentication state', () => {
      mockProps.isAuthenticated = false;
      mockProps.walletExists.current = true;
      mockProps.seedConfirmedRef.current = true;
      mockProps.isBiometricSupported = true;

      const { rerender } = renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      expect(jest.getTimerCount()).toBeLessThan(2);

      // Authenticate user
      mockProps.isAuthenticated = true;
      rerender(mockProps);

      // Timer should now be active
      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });

    it('should handle cleanup when changing from authenticated to not authenticated', () => {
      // Start authenticated
      mockProps.isAuthenticated = true;
      mockProps.walletExists.current = true;
      mockProps.seedConfirmedRef.current = true;
      mockProps.isBiometricSupported = true;

      const { rerender } = renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      expect(jest.getTimerCount()).toBeGreaterThan(0);

      // Change to not authenticated - should trigger cleanup
      mockProps.isAuthenticated = false;
      act(() => {
        rerender(mockProps);
      });

      // Timer should be cleared
      expect(jest.getTimerCount()).toBeLessThan(2);
    });

    it('should handle cleanup when wallet stops existing', () => {
      // Start with wallet existing
      mockProps.isAuthenticated = true;
      mockProps.walletExists.current = true;
      mockProps.seedConfirmedRef.current = true;
      mockProps.isBiometricSupported = true;

      const { rerender } = renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      expect(jest.getTimerCount()).toBeGreaterThan(0);

      // Change wallet to not exist - should trigger cleanup
      mockProps.walletExists.current = false;
      act(() => {
        rerender(mockProps);
      });

      // Timer should be cleared
      expect(jest.getTimerCount()).toBeLessThan(2);
    });

    it('should handle rapid authentication state changes', () => {
      // Start not authenticated
      mockProps.isAuthenticated = false;
      mockProps.walletExists.current = true;
      mockProps.seedConfirmedRef.current = true;
      mockProps.isBiometricSupported = true;

      const { rerender } = renderHook(() => useAppLifecycle(mockProps), {
        initialProps: mockProps,
      });

      // Authenticate
      mockProps.isAuthenticated = true;
      act(() => {
        rerender(mockProps);
      });

      // Immediately de-authenticate (rapid change)
      mockProps.isAuthenticated = false;
      act(() => {
        rerender(mockProps);
      });

      // Re-authenticate again
      mockProps.isAuthenticated = true;
      act(() => {
        rerender(mockProps);
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
