/**
 * Tests for UIContext (migrated to new split contexts)
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { UIProvider, useDisplayPreferences, useNotifications } from '../UIContext';

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

    expect(result.current.toasts).toEqual([]);
    expect(result.current.toastVisible).toBe(false);
  });

  it('should show toast with default success type', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.showToast('Test message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Test message');
    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toastVisible).toBe(true);
    expect(result.current.toastMessage).toBe('Test message');
    expect(result.current.toastType).toBe('success');
  });

  it('should show toast with error type', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.showToast('Error message', 'error');
    });

    expect(result.current.toasts[0].type).toBe('error');
    expect(result.current.toastType).toBe('error');
  });

  it('should auto-hide success toast after 2 seconds', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.showToast('Test message', 'success');
    });

    expect(result.current.toastVisible).toBe(true);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.toastVisible).toBe(false);
    expect(result.current.toasts).toHaveLength(0);
  });

  it('should auto-hide error toast after 3.5 seconds', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.showToast('Error message', 'error');
    });

    expect(result.current.toastVisible).toBe(true);

    // After 2 seconds, toast should still be visible
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.toastVisible).toBe(true);

    // After 3.5 seconds total, toast should be hidden
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(result.current.toastVisible).toBe(false);
  });

  it('should replace existing toast when showing new one', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.showToast('First message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toastMessage).toBe('First message');

    act(() => {
      result.current.showToast('Second message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toastMessage).toBe('Second message');
  });

  it('should dismiss toast manually', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.showToast('Test message');
    });

    const toastId = result.current.toasts[0].id;
    expect(result.current.toastVisible).toBe(true);

    act(() => {
      result.current.dismissToast(toastId);
    });

    expect(result.current.toastVisible).toBe(false);
    expect(result.current.toasts).toHaveLength(0);
  });

  it('should clear timeout when dismissing toast manually', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.showToast('Test message');
    });

    const toastId = result.current.toasts[0].id;

    act(() => {
      result.current.dismissToast(toastId);
    });

    // Advancing time should not cause any errors
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should handle dismissing non-existent toast', () => {
    const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.showToast('Test message');
    });

    // Try to dismiss with wrong ID
    act(() => {
      result.current.dismissToast(9999);
    });

    // Original toast should still be there
    expect(result.current.toasts).toHaveLength(1);
  });

  describe('Snackbar priority logic', () => {
    it('should show snackbar', () => {
      const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ message: 'Test', type: 'success', action: 'send' });
      });

      expect(result.current.snackbar).toEqual({ message: 'Test', type: 'success', action: 'send' });
    });

    it('should allow state progression (pending -> submitted -> success)', () => {
      const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ message: 'Pending', type: 'pending', action: 'send', txid: 'tx1' });
      });
      expect(result.current.snackbar.type).toBe('pending');

      act(() => {
        result.current.showSnackbar({ message: 'Submitted', type: 'submitted', action: 'send', txid: 'tx1' });
      });
      expect(result.current.snackbar.type).toBe('submitted');

      act(() => {
        result.current.showSnackbar({ message: 'Success', type: 'success', action: 'send', txid: 'tx1' });
      });
      expect(result.current.snackbar.type).toBe('success');
    });

    it('should prevent backward state transitions', () => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
      const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ message: 'Success', type: 'success', action: 'send', txid: 'tx1' });
      });
      expect(result.current.snackbar.type).toBe('success');

      act(() => {
        result.current.showSnackbar({ message: 'Pending', type: 'pending', action: 'send', txid: 'tx1' });
      });
      // Should still be success, not pending
      expect(result.current.snackbar.type).toBe('success');
      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Ignoring backward state transition'),
        'success',
        '->',
        'pending'
      );

      consoleLog.mockRestore();
    });

    it('should always show error messages', () => {
      const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ message: 'Success', type: 'success', action: 'send', txid: 'tx1' });
      });

      act(() => {
        result.current.showSnackbar({ message: 'Error', type: 'error', action: 'send', txid: 'tx1' });
      });
      expect(result.current.snackbar.type).toBe('error');
    });

    it('should allow different transactions to show', () => {
      const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ message: 'TX1 Success', type: 'success', action: 'send', txid: 'tx1' });
      });
      expect(result.current.snackbar.txid).toBe('tx1');

      act(() => {
        result.current.showSnackbar({ message: 'TX2 Pending', type: 'pending', action: 'send', txid: 'tx2' });
      });
      // Different transaction, should show
      expect(result.current.snackbar.txid).toBe('tx2');
    });

    it('should handle snackbars without txid', () => {
      const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ message: 'General message', type: 'success', action: 'general' });
      });
      expect(result.current.snackbar.message).toBe('General message');

      act(() => {
        result.current.showSnackbar({ message: 'Another message', type: 'pending', action: 'general' });
      });
      // Should not show due to backward state transition
      expect(result.current.snackbar.message).toBe('General message');
    });

    it('should handle different action types independently', () => {
      const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ message: 'Send', type: 'success', action: 'send' });
      });
      expect(result.current.snackbar.action).toBe('send');

      act(() => {
        result.current.showSnackbar({ message: 'Receive', type: 'pending', action: 'receive' });
      });
      // Different action, should show
      expect(result.current.snackbar.action).toBe('receive');
    });

    it('should dismiss snackbar', () => {
      const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.showSnackbar({ message: 'Test', type: 'success', action: 'send' });
      });
      expect(result.current.snackbar).not.toBeNull();

      act(() => {
        result.current.dismissSnackbar();
      });
      expect(result.current.snackbar).toBeNull();
    });
  });
});
