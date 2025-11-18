/**
 * Tests for useSheetNavigation Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useSheetNavigation } from '../useSheetNavigation';

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

describe('useSheetNavigation', () => {
  it('should initialize with all sheets hidden', () => {
    const { result } = renderHook(() => useSheetNavigation());

    expect(result.current.showReceiveSheet).toBe(false);
    expect(result.current.showTxHistory).toBe(false);
  });

  it('should expose setShowReceiveSheet function', () => {
    const { result } = renderHook(() => useSheetNavigation());

    expect(typeof result.current.setShowReceiveSheet).toBe('function');
  });

  it('should expose setShowTxHistory function', () => {
    const { result } = renderHook(() => useSheetNavigation());

    expect(typeof result.current.setShowTxHistory).toBe('function');
  });

  it('should toggle receive sheet visibility', () => {
    const { result } = renderHook(() => useSheetNavigation());

    expect(result.current.showReceiveSheet).toBe(false);

    act(() => {
      result.current.setShowReceiveSheet(true);
    });

    expect(result.current.showReceiveSheet).toBe(true);

    act(() => {
      result.current.setShowReceiveSheet(false);
    });

    expect(result.current.showReceiveSheet).toBe(false);
  });

  it('should toggle transaction history sheet visibility', () => {
    const { result } = renderHook(() => useSheetNavigation());

    expect(result.current.showTxHistory).toBe(false);

    act(() => {
      result.current.setShowTxHistory(true);
    });

    expect(result.current.showTxHistory).toBe(true);

    act(() => {
      result.current.setShowTxHistory(false);
    });

    expect(result.current.showTxHistory).toBe(false);
  });

  it('should independently manage both sheets', () => {
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

  it('should return all expected properties', () => {
    const { result } = renderHook(() => useSheetNavigation());

    expect(result.current).toHaveProperty('showReceiveSheet');
    expect(result.current).toHaveProperty('setShowReceiveSheet');
    expect(result.current).toHaveProperty('showTxHistory');
    expect(result.current).toHaveProperty('setShowTxHistory');
    expect(Object.keys(result.current)).toHaveLength(4);
  });
});
