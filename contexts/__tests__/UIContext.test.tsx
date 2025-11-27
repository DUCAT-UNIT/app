// @ts-nocheck
/**
 * Tests for UIContext (migrated to new split contexts)
 * Note: Toasts have been consolidated into snackbars
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { UIProvider, useDisplayPreferences, useNotifications } from '../UIContext';
import { resetDisplayPreferencesStore, resetNotificationStore } from '../../stores';

// Helper to render hooks
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

describe('UIContext', () => {
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
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useDisplayPreferences(), { wrapper });

    expect(result.current.showTotalInBTC).toBe(false);
    expect(result.current.showBTCInBTC).toBe(false);
    expect(result.current.showUnitInUnit).toBe(false);
  });

  it('should provide display preferences via useDisplayPreferences', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useDisplayPreferences(), { wrapper });

    expect(result.current.showTotalInBTC).toBe(false);
    expect(result.current.showBTCInBTC).toBe(false);
    expect(result.current.showUnitInUnit).toBe(false);
  });

  it('should update showTotalInBTC', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useDisplayPreferences(), { wrapper });

    act(() => {
      result.current.setShowTotalInBTC(true);
    });

    expect(result.current.showTotalInBTC).toBe(true);
  });

  it('should update showBTCInBTC', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useDisplayPreferences(), { wrapper });

    act(() => {
      result.current.setShowBTCInBTC(true);
    });

    expect(result.current.showBTCInBTC).toBe(true);
  });

  it('should update showUnitInUnit', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useDisplayPreferences(), { wrapper });

    act(() => {
      result.current.setShowUnitInUnit(true);
    });

    expect(result.current.showUnitInUnit).toBe(true);
  });

  it('should provide initial notification state', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useNotifications(), { wrapper });

    // Snackbar should be null initially
    expect(result.current.snackbar).toBeNull();
  });

  it('should show snackbar via showToast (backwards compatible)', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.showToast('Test message');
    });

    expect(result.current.snackbar).not.toBeNull();
    expect(result.current.snackbar.title).toBe('Test message');
    expect(result.current.snackbar.type).toBe('success');
  });

  it('should show snackbar with error type via showToast', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.showToast('Error message', 'error');
    });

    expect(result.current.snackbar.type).toBe('error');
  });

  it('should auto-hide success snackbar after default duration', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.showToast('Test message', 'success');
    });

    expect(result.current.snackbar).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.snackbar).toBeNull();
  });

  it('should auto-hide error snackbar after error duration', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.showToast('Error message', 'error');
    });

    expect(result.current.snackbar).not.toBeNull();

    // After 3 seconds, snackbar should still be visible
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.snackbar).not.toBeNull();

    // After 5 seconds total, snackbar should be hidden
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.snackbar).toBeNull();
  });

  it('should replace existing snackbar when showing new one via showToast', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.showToast('First message');
    });

    expect(result.current.snackbar.title).toBe('First message');

    act(() => {
      result.current.showToast('Second message');
    });

    expect(result.current.snackbar.title).toBe('Second message');
  });

  it('should dismiss snackbar manually', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.showToast('Test message');
    });

    expect(result.current.snackbar).not.toBeNull();

    act(() => {
      result.current.dismissSnackbar();
    });

    expect(result.current.snackbar).toBeNull();
  });

  it('should clear timeout when dismissing snackbar manually', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.showToast('Test message');
    });

    act(() => {
      result.current.dismissSnackbar();
    });

    // Advancing time should not cause any errors
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.snackbar).toBeNull();
  });

  describe('Snackbar priority logic', () => {
    it('should show snackbar', () => {
      const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ type: 'success', action: 'send' });
      });

      expect(result.current.snackbar).not.toBeNull();
      expect(result.current.snackbar.type).toBe('success');
    });

    it('should dismiss snackbar', () => {
      const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ type: 'success', action: 'send' });
      });

      act(() => {
        result.current.dismissSnackbar();
      });

      expect(result.current.snackbar).toBeNull();
    });

    it('should not allow backward state transitions', () => {
      const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ type: 'submitted', action: 'send' });
      });

      expect(result.current.snackbar.type).toBe('submitted');

      // Try to go back to pending
      act(() => {
        result.current.showSnackbar({ type: 'pending', action: 'send' });
      });

      // Should still be submitted
      expect(result.current.snackbar.type).toBe('submitted');
    });

    it('should allow forward state transitions', () => {
      const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ type: 'pending', action: 'send' });
      });

      expect(result.current.snackbar.type).toBe('pending');

      // Upgrade to submitted
      act(() => {
        result.current.showSnackbar({ type: 'submitted', action: 'send' });
      });

      expect(result.current.snackbar.type).toBe('submitted');
    });

    it('should always allow errors regardless of state', () => {
      const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ type: 'success', action: 'send' });
      });

      act(() => {
        result.current.showSnackbar({ type: 'error', action: 'send' });
      });

      expect(result.current.snackbar.type).toBe('error');
    });

    it('should block snackbars during cooldown after dismiss', () => {
      const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ type: 'success', action: 'send' });
      });

      act(() => {
        result.current.dismissSnackbar();
      });

      // Try to show immediately
      act(() => {
        result.current.showSnackbar({ type: 'success', action: 'receive' });
      });

      // Should be blocked
      expect(result.current.snackbar).toBeNull();

      // After cooldown
      act(() => {
        jest.advanceTimersByTime(500);
      });

      act(() => {
        result.current.showSnackbar({ type: 'success', action: 'receive' });
      });

      expect(result.current.snackbar).not.toBeNull();
    });
  });
});
