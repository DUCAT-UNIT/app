/**
 * Tests for ToastContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { ToastProvider, useToastContext } from '../ToastContext';

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

describe('ToastContext', () => {
  const wrapper = ({ children }) => <ToastProvider>{children}</ToastProvider>;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useToastContext());
    }).toThrow('useToastContext must be used within a ToastProvider');

    consoleError.mockRestore();
  });

  it('should provide initial state', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    expect(result.current.toasts).toEqual([]);
    expect(result.current.toastVisible).toBe(false);
    expect(result.current.toastMessage).toBe('');
    expect(result.current.toastType).toBe('success');
  });

  it('should show success toast', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast('Test message', 'success');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Test message');
    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toastVisible).toBe(true);
    expect(result.current.toastMessage).toBe('Test message');
  });

  it('should show error toast', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast('Error message', 'error');
    });

    expect(result.current.toasts[0].type).toBe('error');
    expect(result.current.toastType).toBe('error');
  });

  it('should auto-hide success toast after 2 seconds', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

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
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast('Error message', 'error');
    });

    expect(result.current.toastVisible).toBe(true);

    act(() => {
      jest.advanceTimersByTime(3500);
    });

    expect(result.current.toastVisible).toBe(false);
  });

  it('should replace existing toast with new one', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast('First message', 'success');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toastMessage).toBe('First message');

    act(() => {
      result.current.showToast('Second message', 'error');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toastMessage).toBe('Second message');
  });

  it('should dismiss toast manually', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast('Test message', 'success');
    });

    const toastId = result.current.toasts[0].id;

    act(() => {
      result.current.dismissToast(toastId);
    });

    expect(result.current.toastVisible).toBe(false);
    expect(result.current.toasts).toHaveLength(0);
  });

  it('should clear timeout when dismissing manually', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast('Test message', 'success');
    });

    const toastId = result.current.toasts[0].id;

    act(() => {
      result.current.dismissToast(toastId);
    });

    // Advance time - should not cause any issues
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should clear previous timeouts when showing new toast', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast('First message', 'success');
    });

    // Don't let the first toast timeout
    act(() => {
      jest.advanceTimersByTime(500);
    });

    act(() => {
      result.current.showToast('Second message', 'success');
    });

    // First toast should be replaced, not both visible
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toastMessage).toBe('Second message');
  });

  it('should handle dismissing non-existent toast', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    // Should not throw error
    act(() => {
      result.current.dismissToast(999);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should default to success type if not specified', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast('Test message');
    });

    expect(result.current.toastType).toBe('success');
  });
});
