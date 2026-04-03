/**
 * Tests for display preferences and notifications (Zustand stores)
 * Note: Toasts have been consolidated into snackbars
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useDisplayPreferences } from '../../stores/displayPreferencesStore';
import { useNotifications } from '../../stores/notificationStore';
import { resetDisplayPreferencesStore, resetNotificationStore } from '../../stores';

// Helper to render hooks
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
  return { result, rerender: component!.update, unmount: component!.unmount };
}

describe('Display Preferences and Notification Stores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Reset Zustand store state between tests
    resetDisplayPreferencesStore();
    resetNotificationStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should provide initial display preferences state', () => {
    const { result } = renderHook(() => useDisplayPreferences());

    expect(result.current!.showTotalInBTC).toBe(false);
    expect(result.current!.showBTCInBTC).toBe(false);
    expect(result.current!.showUnitInUnit).toBe(false);
  });

  it('should provide display preferences via useDisplayPreferences', () => {
    const { result } = renderHook(() => useDisplayPreferences());

    expect(result.current!.showTotalInBTC).toBe(false);
    expect(result.current!.showBTCInBTC).toBe(false);
    expect(result.current!.showUnitInUnit).toBe(false);
  });

  it('should update showTotalInBTC', () => {
    const { result } = renderHook(() => useDisplayPreferences());

    act(() => {
      result.current!.setShowTotalInBTC(true);
    });

    expect(result.current!.showTotalInBTC).toBe(true);
  });

  it('should update showBTCInBTC', () => {
    const { result } = renderHook(() => useDisplayPreferences());

    act(() => {
      result.current!.setShowBTCInBTC(true);
    });

    expect(result.current!.showBTCInBTC).toBe(true);
  });

  it('should update showUnitInUnit', () => {
    const { result } = renderHook(() => useDisplayPreferences());

    act(() => {
      result.current!.setShowUnitInUnit(true);
    });

    expect(result.current!.showUnitInUnit).toBe(true);
  });

  it('should provide initial notification state', () => {
    const { result } = renderHook(() => useNotifications());

    // Snackbar should be null initially
    expect(result.current!.snackbar).toBeNull();
  });

  it('should show snackbar via showToast (backwards compatible)', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current!.showToast('Test message');
    });

    expect(result.current!.snackbar).not.toBeNull();
    expect(result.current!.snackbar!.title).toBe('Test message');
    expect(result.current!.snackbar!.type).toBe('success');
  });

  it('should show snackbar with error type via showToast', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current!.showToast('Error message', 'error');
    });

    expect(result.current!.snackbar!.type).toBe('error');
  });

  it('should auto-hide success snackbar after default duration', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current!.showToast('Test message', 'success');
    });

    expect(result.current!.snackbar).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current!.snackbar).toBeNull();
  });

  it('should auto-hide error snackbar after error duration', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current!.showToast('Error message', 'error');
    });

    expect(result.current!.snackbar).not.toBeNull();

    // After 3 seconds, snackbar should still be visible
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current!.snackbar).not.toBeNull();

    // After 5 seconds total, snackbar should be hidden
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current!.snackbar).toBeNull();
  });

  it('should replace existing snackbar when showing new one via showToast', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current!.showToast('First message');
    });

    expect(result.current!.snackbar!.title).toBe('First message');

    act(() => {
      result.current!.showToast('Second message');
    });

    expect(result.current!.snackbar!.title).toBe('Second message');
  });

  it('should dismiss snackbar manually', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current!.showToast('Test message');
    });

    expect(result.current!.snackbar).not.toBeNull();

    act(() => {
      result.current!.dismissSnackbar();
    });

    expect(result.current!.snackbar).toBeNull();
  });

  it('should clear timeout when dismissing snackbar manually', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current!.showToast('Test message');
    });

    act(() => {
      result.current!.dismissSnackbar();
    });

    // Advancing time should not cause any errors
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current!.snackbar).toBeNull();
  });

  describe('Snackbar priority logic', () => {
    it('should show snackbar', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current!.showSnackbar({ type: 'success', action: 'send' });
      });

      expect(result.current!.snackbar).not.toBeNull();
      expect(result.current!.snackbar!.type).toBe('success');
    });

    it('should dismiss snackbar', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current!.showSnackbar({ type: 'success', action: 'send' });
      });

      act(() => {
        result.current!.dismissSnackbar();
      });

      expect(result.current!.snackbar).toBeNull();
    });

    it('should not allow backward state transitions', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current!.showSnackbar({ type: 'submitted', action: 'send' });
      });

      expect(result.current!.snackbar!.type).toBe('submitted');

      // Try to go back to pending
      act(() => {
        result.current!.showSnackbar({ type: 'pending', action: 'send' });
      });

      // Should still be submitted
      expect(result.current!.snackbar!.type).toBe('submitted');
    });

    it('should allow forward state transitions', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current!.showSnackbar({ type: 'pending', action: 'send' });
      });

      expect(result.current!.snackbar!.type).toBe('pending');

      // Upgrade to submitted
      act(() => {
        result.current!.showSnackbar({ type: 'submitted', action: 'send' });
      });

      expect(result.current!.snackbar!.type).toBe('submitted');
    });

    it('should always allow errors regardless of state', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current!.showSnackbar({ type: 'success', action: 'send' });
      });

      act(() => {
        result.current!.showSnackbar({ type: 'error', action: 'send' });
      });

      expect(result.current!.snackbar!.type).toBe('error');
    });

    it('should block non-success snackbars during cooldown after dismiss (success snackbars are allowed)', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current!.showSnackbar({ type: 'success', action: 'send' });
      });

      act(() => {
        result.current!.dismissSnackbar();
      });

      // Try to show pending snackbar immediately - should be blocked
      act(() => {
        result.current!.showSnackbar({ type: 'pending', action: 'receive' });
      });

      // Pending should be blocked during cooldown
      expect(result.current!.snackbar).toBeNull();

      // But success snackbars are allowed during cooldown (important confirmations)
      act(() => {
        result.current!.showSnackbar({ type: 'success', action: 'receive' });
      });

      expect(result.current!.snackbar).not.toBeNull();
      expect(result.current!.snackbar!.type).toBe('success');
    });
  });
});
