/**
 * Tests for NotificationContext
 * Note: Toasts have been consolidated into snackbars
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useNotifications } from '../../stores/notificationStore';
import { resetNotificationStore } from '../../stores';

// No-op provider for backwards compatibility (Zustand stores don't need providers)
const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
  },
}));

// Helper to render hooks with react-test-renderer
function renderHook<T>(hook: () => T, { wrapper: Wrapper }: { wrapper?: React.ComponentType<{ children: React.ReactNode }> } = {}) {
  const result: { current: T | null } = { current: null };

  function TestComponent() {
    result.current = hook();
    return null;
  }

  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = Wrapper
      ? create(<Wrapper><TestComponent /></Wrapper>)
      : create(<TestComponent />);
  });

  return { result, unmount: component!.unmount };
}

describe('NotificationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Reset Zustand store state between tests
    resetNotificationStore();
    // Clear global state
    if (typeof global !== 'undefined') {
      delete (global as Record<string, unknown>).pendingTurboSnackbars;
      delete (global as Record<string, unknown>).pendingCashuToken;
    }
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('useNotifications', () => {
    it('should work without provider (Zustand stores are globally accessible)', () => {
      // Zustand stores don't require providers - they're globally accessible
      const { result } = renderHook(() => useNotifications());

      expect(result.current!.showToast).toBeDefined();
      expect(result.current!.showSnackbar).toBeDefined();
      expect(result.current!.snackbar).toBeNull();
    });
  });

  describe('showToast (backwards compatible - maps to snackbar)', () => {
    it('should show snackbar with message when using showToast', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      expect(result.current!.snackbar).toBeNull();

      act(() => {
        result.current!.showToast('Test message', 'success');
      });

      expect(result.current!.snackbar).toBeDefined();
      expect(result.current!.snackbar!.title).toBe('Test message');
      expect(result.current!.snackbar!.type).toBe('success');
    });

    it('should auto-dismiss success snackbar after default duration', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current!.showToast('Test message', 'success');
      });

      expect(result.current!.snackbar).not.toBeNull();

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(result.current!.snackbar).toBeNull();
    });

    it('should auto-dismiss error snackbar after error duration', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current!.showToast('Error message', 'error');
      });

      expect(result.current!.snackbar).not.toBeNull();

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Still visible after 3000ms
      expect(result.current!.snackbar).not.toBeNull();

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // Gone after 5000ms (error duration)
      expect(result.current!.snackbar).toBeNull();
    });

    it('should replace existing snackbar with new one when using showToast', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current!.showToast('First message', 'success');
      });

      act(() => {
        result.current!.showToast('Second message', 'error');
      });

      expect(result.current!.snackbar).not.toBeNull();
      expect(result.current!.snackbar!.title).toBe('Second message');
      expect(result.current!.snackbar!.type).toBe('error');
    });
  });

  describe('Snackbar functionality', () => {
    it('should show snackbar', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      expect(result.current!.snackbar).toBeNull();

      act(() => {
        result.current!.showSnackbar({ type: 'success', action: 'send' });
      });

      expect(result.current!.snackbar).toBeDefined();
      expect(result.current!.snackbar!.type).toBe('success');
      expect(result.current!.snackbar!.action).toBe('send');
    });

    it('should auto-dismiss snackbar after default success duration', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current!.showSnackbar({ type: 'success', action: 'send' });
      });

      expect(result.current!.snackbar).not.toBeNull();

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(result.current!.snackbar).toBeNull();
    });

    it('should not auto-dismiss persistent snackbar', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current!.showSnackbar({ type: 'pending', action: 'send', persistent: true });
      });

      act(() => {
        jest.advanceTimersByTime(60000);
      });

      expect(result.current!.snackbar).not.toBeNull();
    });

    it('should dismiss snackbar manually', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current!.showSnackbar({ type: 'success', action: 'send' });
      });

      act(() => {
        result.current!.dismissSnackbar();
      });

      expect(result.current!.snackbar).toBeNull();
    });

    it('should block non-success snackbars during cooldown period (success snackbars are allowed)', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current!.showSnackbar({ type: 'success', action: 'send' });
      });

      act(() => {
        result.current!.dismissSnackbar();
      });

      // Try to show a pending snackbar immediately after dismiss
      // Pending/submitted/progress should be blocked during cooldown
      act(() => {
        result.current!.showSnackbar({ type: 'pending', action: 'receive' });
      });

      // Pending should be blocked during cooldown
      expect(result.current!.snackbar).toBeNull();

      // But success snackbars should still work during cooldown (they're important confirmations)
      act(() => {
        result.current!.showSnackbar({ type: 'success', action: 'receive' });
      });

      expect(result.current!.snackbar).not.toBeNull();
      expect(result.current!.snackbar!.type).toBe('success');
    });

    it('should ignore backward state transitions', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Show submitted snackbar
      act(() => {
        result.current!.showSnackbar({ type: 'submitted', action: 'send' });
      });

      expect(result.current!.snackbar!.type).toBe('submitted');

      // Try to show pending (lower state) - should be ignored
      act(() => {
        result.current!.showSnackbar({ type: 'pending', action: 'send' });
      });

      expect(result.current!.snackbar!.type).toBe('submitted');
    });

    it('should allow forward state transitions', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Show pending snackbar
      act(() => {
        result.current!.showSnackbar({ type: 'pending', action: 'send' });
      });

      expect(result.current!.snackbar!.type).toBe('pending');

      // Upgrade to submitted (higher state) - should work
      act(() => {
        result.current!.showSnackbar({ type: 'submitted', action: 'send' });
      });

      expect(result.current!.snackbar!.type).toBe('submitted');
    });

    it('should always allow error snackbars', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Show success snackbar
      act(() => {
        result.current!.showSnackbar({ type: 'success', action: 'send' });
      });

      expect(result.current!.snackbar!.type).toBe('success');

      // Error should override
      act(() => {
        result.current!.showSnackbar({ type: 'error', action: 'send' });
      });

      expect(result.current!.snackbar!.type).toBe('error');
    });

    it('should clear turbo snackbars on dismiss but preserve cashu token', () => {
      (global as Record<string, unknown>).pendingTurboSnackbars = ['snackbar1'];
      (global as Record<string, unknown>).pendingCashuToken = 'token123';

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current!.showSnackbar({ type: 'success', action: 'send' });
      });

      act(() => {
        result.current!.dismissSnackbar();
      });

      // Turbo snackbars should be cleared
      expect((global as Record<string, unknown>).pendingTurboSnackbars).toEqual([]);
      // pendingCashuToken should persist through lock/unlock - it's cleared after processing
      expect((global as Record<string, unknown>).pendingCashuToken).toBe('token123');
    });

    it('should support new snackbar types: warning, info, progress', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Test warning
      act(() => {
        result.current!.showSnackbar({ type: 'warning', title: 'Warning message' });
      });
      expect(result.current!.snackbar!.type).toBe('warning');

      act(() => {
        result.current!.dismissSnackbar();
        jest.advanceTimersByTime(500); // Wait for cooldown
      });

      // Test info
      act(() => {
        result.current!.showSnackbar({ type: 'info', title: 'Info message' });
      });
      expect(result.current!.snackbar!.type).toBe('info');

      act(() => {
        result.current!.dismissSnackbar();
        jest.advanceTimersByTime(500); // Wait for cooldown
      });

      // Test progress
      act(() => {
        result.current!.showSnackbar({ type: 'progress', title: 'Loading...' });
      });
      expect(result.current!.snackbar!.type).toBe('progress');
    });

    it('should support custom duration', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationProvider>{children}</NotificationProvider>
      );
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current!.showSnackbar({ type: 'info', title: 'Custom duration', duration: 1000 });
      });

      expect(result.current!.snackbar).not.toBeNull();

      act(() => {
        jest.advanceTimersByTime(900);
      });

      // Still visible before custom duration
      expect(result.current!.snackbar).not.toBeNull();

      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Gone after custom duration
      expect(result.current!.snackbar).toBeNull();
    });
  });
});
