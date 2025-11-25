/**
 * Tests for NotificationContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { NotificationProvider, useNotifications } from '../NotificationContext';

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

  return { result, unmount: component.unmount };
}

describe('NotificationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Clear global state
    if (typeof global !== 'undefined') {
      delete global.pendingTurboSnackbars;
      delete global.pendingCashuToken;
    }
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('useNotifications', () => {
    it('should throw error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      function TestComponent() {
        useNotifications();
        return null;
      }

      expect(() => {
        act(() => {
          create(<TestComponent />);
        });
      }).toThrow('useNotifications must be used within a NotificationProvider');

      consoleError.mockRestore();
    });
  });

  describe('Toast functionality', () => {
    it('should show toast with message and type', () => {
      const wrapper = ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      expect(result.current.toasts).toHaveLength(0);

      act(() => {
        result.current.showToast('Test message', 'success');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe('Test message');
      expect(result.current.toasts[0].type).toBe('success');
      expect(result.current.toastMessage).toBe('Test message');
      expect(result.current.toastVisible).toBe(true);
      expect(result.current.toastType).toBe('success');
    });

    it('should auto-dismiss success toast after 2000ms', () => {
      const wrapper = ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showToast('Test message', 'success');
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('should auto-dismiss error toast after 3500ms', () => {
      const wrapper = ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showToast('Error message', 'error');
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // Still visible after 2000ms
      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(1500);
      });

      // Gone after 3500ms
      expect(result.current.toasts).toHaveLength(0);
    });

    it('should dismiss toast manually', () => {
      const wrapper = ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showToast('Test message', 'success');
      });

      const toastId = result.current.toasts[0].id;

      act(() => {
        result.current.dismissToast(toastId);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('should replace existing toast with new one', () => {
      const wrapper = ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showToast('First message', 'success');
      });

      act(() => {
        result.current.showToast('Second message', 'error');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe('Second message');
      expect(result.current.toasts[0].type).toBe('error');
    });
  });

  describe('Snackbar functionality', () => {
    it('should show snackbar', () => {
      const wrapper = ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      expect(result.current.snackbar).toBeNull();

      act(() => {
        result.current.showSnackbar({ type: 'success', action: 'send' });
      });

      expect(result.current.snackbar).toBeDefined();
      expect(result.current.snackbar.type).toBe('success');
      expect(result.current.snackbar.action).toBe('send');
    });

    it('should auto-dismiss snackbar after 7000ms', () => {
      const wrapper = ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ type: 'success', action: 'send' });
      });

      expect(result.current.snackbar).not.toBeNull();

      act(() => {
        jest.advanceTimersByTime(7000);
      });

      expect(result.current.snackbar).toBeNull();
    });

    it('should not auto-dismiss persistent snackbar', () => {
      const wrapper = ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ type: 'pending', action: 'send', persistent: true });
      });

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(result.current.snackbar).not.toBeNull();
    });

    it('should dismiss snackbar manually', () => {
      const wrapper = ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ type: 'success', action: 'send' });
      });

      act(() => {
        result.current.dismissSnackbar();
      });

      expect(result.current.snackbar).toBeNull();
    });

    it('should block new snackbars during cooldown period', () => {
      const wrapper = ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ type: 'success', action: 'send' });
      });

      act(() => {
        result.current.dismissSnackbar();
      });

      // Try to show new snackbar immediately after dismiss
      act(() => {
        result.current.showSnackbar({ type: 'success', action: 'receive' });
      });

      // Should be blocked during cooldown
      expect(result.current.snackbar).toBeNull();

      // After cooldown ends (500ms)
      act(() => {
        jest.advanceTimersByTime(500);
      });

      act(() => {
        result.current.showSnackbar({ type: 'success', action: 'receive' });
      });

      expect(result.current.snackbar).not.toBeNull();
    });

    it('should ignore backward state transitions', () => {
      const wrapper = ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Show submitted snackbar
      act(() => {
        result.current.showSnackbar({ type: 'submitted', action: 'send' });
      });

      expect(result.current.snackbar.type).toBe('submitted');

      // Try to show pending (lower state) - should be ignored
      act(() => {
        result.current.showSnackbar({ type: 'pending', action: 'send' });
      });

      expect(result.current.snackbar.type).toBe('submitted');
    });

    it('should allow forward state transitions', () => {
      const wrapper = ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Show pending snackbar
      act(() => {
        result.current.showSnackbar({ type: 'pending', action: 'send' });
      });

      expect(result.current.snackbar.type).toBe('pending');

      // Upgrade to submitted (higher state) - should work
      act(() => {
        result.current.showSnackbar({ type: 'submitted', action: 'send' });
      });

      expect(result.current.snackbar.type).toBe('submitted');
    });

    it('should always allow error snackbars', () => {
      const wrapper = ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Show success snackbar
      act(() => {
        result.current.showSnackbar({ type: 'success', action: 'send' });
      });

      expect(result.current.snackbar.type).toBe('success');

      // Error should override
      act(() => {
        result.current.showSnackbar({ type: 'error', action: 'send' });
      });

      expect(result.current.snackbar.type).toBe('error');
    });

    it('should clear global pending state on dismiss', () => {
      global.pendingTurboSnackbars = ['snackbar1'];
      global.pendingCashuToken = 'token123';

      const wrapper = ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ type: 'success', action: 'send' });
      });

      act(() => {
        result.current.dismissSnackbar();
      });

      expect(global.pendingTurboSnackbars).toEqual([]);
      expect(global.pendingCashuToken).toBeUndefined();
    });
  });

  describe('Backwards compatibility', () => {
    it('should provide computed toast values', () => {
      const wrapper = ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Initially empty
      expect(result.current.toastMessage).toBe('');
      expect(result.current.toastVisible).toBe(false);
      expect(result.current.toastType).toBe('success');

      act(() => {
        result.current.showToast('Test', 'error');
      });

      expect(result.current.toastMessage).toBe('Test');
      expect(result.current.toastVisible).toBe(true);
      expect(result.current.toastType).toBe('error');
    });
  });
});
