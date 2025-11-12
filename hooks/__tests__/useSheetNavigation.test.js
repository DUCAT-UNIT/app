/**
 * Tests for useSheetNavigation Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useSheetNavigation } from '../useSheetNavigation';

// Helper to render hooks
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
  return { result, unmount: () => component.unmount() };
}

describe('useSheetNavigation', () => {
  it('should initialize with sheets hidden', () => {
    const { result } = renderHook(() => useSheetNavigation());

    expect(result.current.showReceiveSheet).toBe(false);
    expect(result.current.showTxHistory).toBe(false);
  });

  it('should provide setters for receive sheet', () => {
    const { result } = renderHook(() => useSheetNavigation());

    expect(result.current.setShowReceiveSheet).toBeDefined();
    expect(typeof result.current.setShowReceiveSheet).toBe('function');
  });

  it('should provide setters for transaction history', () => {
    const { result } = renderHook(() => useSheetNavigation());

    expect(result.current.setShowTxHistory).toBeDefined();
    expect(typeof result.current.setShowTxHistory).toBe('function');
  });

  it('should toggle receive sheet', () => {
    const { result } = renderHook(() => useSheetNavigation());

    act(() => {
      result.current.setShowReceiveSheet(true);
    });
    expect(result.current.showReceiveSheet).toBe(true);

    act(() => {
      result.current.setShowReceiveSheet(false);
    });
    expect(result.current.showReceiveSheet).toBe(false);
  });

  it('should toggle transaction history', () => {
    const { result } = renderHook(() => useSheetNavigation());

    act(() => {
      result.current.setShowTxHistory(true);
    });
    expect(result.current.showTxHistory).toBe(true);

    act(() => {
      result.current.setShowTxHistory(false);
    });
    expect(result.current.showTxHistory).toBe(false);
  });

  it('should handle both sheets independently', () => {
    const { result } = renderHook(() => useSheetNavigation());

    act(() => {
      result.current.setShowReceiveSheet(true);
    });
    expect(result.current.showReceiveSheet).toBe(true);
    expect(result.current.showTxHistory).toBe(false);

    act(() => {
      result.current.setShowTxHistory(true);
    });
    expect(result.current.showReceiveSheet).toBe(true);
    expect(result.current.showTxHistory).toBe(true);

    act(() => {
      result.current.setShowReceiveSheet(false);
    });
    expect(result.current.showReceiveSheet).toBe(false);
    expect(result.current.showTxHistory).toBe(true);
  });
});
