/**
 * Tests for DisplayPreferencesContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { DisplayPreferencesProvider, useDisplayPreferences } from '../DisplayPreferencesContext';

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
  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useDisplayPreferences());
    }).toThrow('useDisplayPreferences must be used within a DisplayPreferencesProvider');

    consoleError.mockRestore();
  });

  it('should provide initial state with all preferences set to false', () => {
    const wrapper = ({ children }) => <DisplayPreferencesProvider>{children}</DisplayPreferencesProvider>;
    const { result } = renderHook(() => useDisplayPreferences(), { wrapper });

    expect(result.current.showTotalInBTC).toBe(false);
    expect(result.current.showBTCInBTC).toBe(false);
    expect(result.current.showUnitInUnit).toBe(false);
    expect(typeof result.current.setShowTotalInBTC).toBe('function');
    expect(typeof result.current.setShowBTCInBTC).toBe('function');
    expect(typeof result.current.setShowUnitInUnit).toBe('function');
  });

  it('should toggle showTotalInBTC', () => {
    const wrapper = ({ children }) => <DisplayPreferencesProvider>{children}</DisplayPreferencesProvider>;
    const { result } = renderHook(() => useDisplayPreferences(), { wrapper });

    expect(result.current.showTotalInBTC).toBe(false);

    act(() => {
      result.current.setShowTotalInBTC(true);
    });

    expect(result.current.showTotalInBTC).toBe(true);

    act(() => {
      result.current.setShowTotalInBTC(false);
    });

    expect(result.current.showTotalInBTC).toBe(false);
  });

  it('should toggle showBTCInBTC', () => {
    const wrapper = ({ children }) => <DisplayPreferencesProvider>{children}</DisplayPreferencesProvider>;
    const { result } = renderHook(() => useDisplayPreferences(), { wrapper });

    expect(result.current.showBTCInBTC).toBe(false);

    act(() => {
      result.current.setShowBTCInBTC(true);
    });

    expect(result.current.showBTCInBTC).toBe(true);

    act(() => {
      result.current.setShowBTCInBTC(false);
    });

    expect(result.current.showBTCInBTC).toBe(false);
  });

  it('should toggle showUnitInUnit', () => {
    const wrapper = ({ children }) => <DisplayPreferencesProvider>{children}</DisplayPreferencesProvider>;
    const { result } = renderHook(() => useDisplayPreferences(), { wrapper });

    expect(result.current.showUnitInUnit).toBe(false);

    act(() => {
      result.current.setShowUnitInUnit(true);
    });

    expect(result.current.showUnitInUnit).toBe(true);

    act(() => {
      result.current.setShowUnitInUnit(false);
    });

    expect(result.current.showUnitInUnit).toBe(false);
  });

  it('should toggle multiple preferences independently', () => {
    const wrapper = ({ children }) => <DisplayPreferencesProvider>{children}</DisplayPreferencesProvider>;
    const { result } = renderHook(() => useDisplayPreferences(), { wrapper });

    // Toggle all to true
    act(() => {
      result.current.setShowTotalInBTC(true);
      result.current.setShowBTCInBTC(true);
      result.current.setShowUnitInUnit(true);
    });

    expect(result.current.showTotalInBTC).toBe(true);
    expect(result.current.showBTCInBTC).toBe(true);
    expect(result.current.showUnitInUnit).toBe(true);

    // Toggle one back to false
    act(() => {
      result.current.setShowBTCInBTC(false);
    });

    expect(result.current.showTotalInBTC).toBe(true);
    expect(result.current.showBTCInBTC).toBe(false);
    expect(result.current.showUnitInUnit).toBe(true);
  });

  it('should handle functional updates', () => {
    const wrapper = ({ children }) => <DisplayPreferencesProvider>{children}</DisplayPreferencesProvider>;
    const { result } = renderHook(() => useDisplayPreferences(), { wrapper });

    act(() => {
      result.current.setShowTotalInBTC((prev) => !prev);
    });

    expect(result.current.showTotalInBTC).toBe(true);

    act(() => {
      result.current.setShowTotalInBTC((prev) => !prev);
    });

    expect(result.current.showTotalInBTC).toBe(false);
  });
});
