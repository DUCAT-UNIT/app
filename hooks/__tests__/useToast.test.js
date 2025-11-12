/**
 * Tests for useToast Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useToast } from '../useToast';

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

// Mock timers
jest.useFakeTimers();

describe('useToast', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should initialize with empty toasts', () => {
    const { result } = renderHook(() => useToast());

    expect(result.current.toasts).toEqual([]);
    expect(result.current.toastVisible).toBe(false);
    expect(result.current.toastMessage).toBe('');
    expect(result.current.toastType).toBe('success');
  });

  it('should show a success toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test message', 'success');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Test message');
    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toastVisible).toBe(true);
    expect(result.current.toastMessage).toBe('Test message');
    expect(result.current.toastType).toBe('success');
  });

  it('should show an error toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Error message', 'error');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Error message');
    expect(result.current.toasts[0].type).toBe('error');
    expect(result.current.toastType).toBe('error');
  });

  it('should auto-hide success toast after 2 seconds', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test message', 'success');
    });

    expect(result.current.toasts).toHaveLength(1);

    // Fast-forward 2 seconds
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.toasts).toHaveLength(0);
    expect(result.current.toastVisible).toBe(false);
  });

  it('should auto-hide error toast after 3.5 seconds', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Error message', 'error');
    });

    expect(result.current.toasts).toHaveLength(1);

    // Fast-forward 2 seconds (should still be visible)
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.toasts).toHaveLength(1);

    // Fast-forward another 1.5 seconds (total 3.5s)
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should replace existing toast with new one', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('First message', 'success');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('First message');

    act(() => {
      result.current.showToast('Second message', 'error');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Second message');
    expect(result.current.toasts[0].type).toBe('error');
  });

  it('should dismiss toast manually', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test message', 'success');
    });

    const toastId = result.current.toasts[0].id;
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.dismissToast(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);
    expect(result.current.toastVisible).toBe(false);
  });

  it('should clear timeout when dismissing manually', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test message', 'success');
    });

    const toastId = result.current.toasts[0].id;

    act(() => {
      result.current.dismissToast(toastId);
    });

    // Fast-forward past the auto-hide duration
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // Should still be 0 (not cause any issues)
    expect(result.current.toasts).toHaveLength(0);
  });

  it('should handle dismissing non-existent toast gracefully', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test message', 'success');
    });

    expect(result.current.toasts).toHaveLength(1);

    // Try to dismiss a toast with wrong ID
    act(() => {
      result.current.dismissToast(9999);
    });

    // Original toast should still be there
    expect(result.current.toasts).toHaveLength(1);
  });

  it('should default to success type when type is not specified', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test message');
    });

    expect(result.current.toasts[0].type).toBe('success');
  });

  it('should clear all existing timeouts when showing new toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('First message', 'success');
    });

    // Fast-forward 1 second (halfway through duration)
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.toasts).toHaveLength(1);

    // Show new toast (should clear the old timeout)
    act(() => {
      result.current.showToast('Second message', 'success');
    });

    // Fast-forward 1 second (old toast would have hidden by now if timeout wasn't cleared)
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // New toast should still be visible (not hidden by old timeout)
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Second message');
  });
});
