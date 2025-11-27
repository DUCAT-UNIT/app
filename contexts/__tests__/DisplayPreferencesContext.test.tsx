// @ts-nocheck
/**
 * Tests for DisplayPreferencesContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { DisplayPreferencesProvider, useDisplayPreferences } from '../DisplayPreferencesContext';
import { resetDisplayPreferencesStore } from '../../stores';

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

describe('DisplayPreferencesContext', () => {
  const wrapper = ({ children }) => <DisplayPreferencesProvider>{children}</DisplayPreferencesProvider>;

  beforeEach(() => {
    // Reset Zustand store state between tests
    resetDisplayPreferencesStore();
  });

  it('should work without provider (Zustand stores are globally accessible)', () => {
    // Zustand stores don't require providers - they're globally accessible
    const { result } = renderHook(() => useDisplayPreferences());

    expect(result.current.showTotalInBTC).toBe(false);
    expect(result.current.setShowTotalInBTC).toBeDefined();
  });

  it('should provide initial state', () => {
    const { result } = renderHook(() => useDisplayPreferences(), { wrapper });

    expect(result.current.showTotalInBTC).toBe(false);
    expect(result.current.showBTCInBTC).toBe(false);
    expect(result.current.showUnitInUnit).toBe(false);
  });

  it('should update showTotalInBTC', () => {
    const { result } = renderHook(() => useDisplayPreferences(), { wrapper });

    act(() => {
      result.current.setShowTotalInBTC(true);
    });

    expect(result.current.showTotalInBTC).toBe(true);
  });

  it('should update showBTCInBTC', () => {
    const { result } = renderHook(() => useDisplayPreferences(), { wrapper });

    act(() => {
      result.current.setShowBTCInBTC(true);
    });

    expect(result.current.showBTCInBTC).toBe(true);
  });

  it('should update showUnitInUnit', () => {
    const { result } = renderHook(() => useDisplayPreferences(), { wrapper });

    act(() => {
      result.current.setShowUnitInUnit(true);
    });

    expect(result.current.showUnitInUnit).toBe(true);
  });

  it('should allow toggling preferences', () => {
    const { result } = renderHook(() => useDisplayPreferences(), { wrapper });

    // Toggle on
    act(() => {
      result.current.setShowTotalInBTC(true);
    });
    expect(result.current.showTotalInBTC).toBe(true);

    // Toggle off
    act(() => {
      result.current.setShowTotalInBTC(false);
    });
    expect(result.current.showTotalInBTC).toBe(false);
  });

  it('should handle multiple preference changes', () => {
    const { result } = renderHook(() => useDisplayPreferences(), { wrapper });

    act(() => {
      result.current.setShowTotalInBTC(true);
      result.current.setShowBTCInBTC(true);
      result.current.setShowUnitInUnit(true);
    });

    expect(result.current.showTotalInBTC).toBe(true);
    expect(result.current.showBTCInBTC).toBe(true);
    expect(result.current.showUnitInUnit).toBe(true);
  });
});
