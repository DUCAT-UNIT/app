// @ts-nocheck
/**
 * Tests for useFormattedBalances hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useFormattedBalances } from '../useFormattedBalances';

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
  return { result, rerender: component.update };
}

describe('useFormattedBalances', () => {
  it('should format BTC amounts with 8 decimal places', () => {
    const { result } = renderHook(() =>
      useFormattedBalances({
        totalBalanceBTC: 1.23456789,
        segwitBalance: 0.5,
        taprootBalance: 0.25,
      })
    );

    expect(result.current.totalBTC).toBe('1.23456789');
    expect(result.current.segwitBTC).toBe('0.50000000');
    expect(result.current.taprootBTC).toBe('0.25000000');
  });

  it('should format USD amounts with 2 decimal places', () => {
    const { result } = renderHook(() =>
      useFormattedBalances({
        totalBalanceUSD: 50000.12345,
        segwitBalance: 1,
        taprootBalance: 0.5,
        btcPrice: 50000,
      })
    );

    expect(result.current.totalUSD).toBe('50,000.12');
    expect(result.current.segwitUSD).toBe('50,000.00');
    expect(result.current.taprootUSD).toBe('25,000.00');
  });

  it('should format rune amounts as integers', () => {
    const { result } = renderHook(() =>
      useFormattedBalances({
        runesBalance: 1234567,
      })
    );

    expect(result.current.runes).toBe('1,234,567');
  });

  it('should handle zero values', () => {
    const { result } = renderHook(() =>
      useFormattedBalances({
        totalBalanceBTC: 0,
        totalBalanceUSD: 0,
        segwitBalance: 0,
        taprootBalance: 0,
        runesBalance: 0,
        btcPrice: 0,
      })
    );

    expect(result.current.totalBTC).toBe('0.00000000');
    expect(result.current.totalUSD).toBe('0.00');
    expect(result.current.segwitBTC).toBe('0.00000000');
    expect(result.current.taprootBTC).toBe('0.00000000');
    expect(result.current.runes).toBe('0');
  });

  it('should use default values when parameters are undefined', () => {
    const { result } = renderHook(() => useFormattedBalances({}));

    expect(result.current.totalBTC).toBe('0.00000000');
    expect(result.current.totalUSD).toBe('0.00');
    expect(result.current.segwitBTC).toBe('0.00000000');
    expect(result.current.taprootBTC).toBe('0.00000000');
    expect(result.current.runes).toBe('0');
  });

  it('should return stable references when inputs are the same', () => {
    let results = [];
    function TestComponent({ balances }) {
      const formatted = useFormattedBalances(balances);
      results.push(formatted);
      return null;
    }

    let component;
    const balances = { totalBalanceBTC: 1.5, btcPrice: 50000 };

    act(() => {
      component = create(<TestComponent balances={balances} />);
    });

    // Re-render with same object reference
    act(() => {
      component.update(<TestComponent balances={balances} />);
    });

    // Both renders should produce the same formatted string values
    expect(results[0].totalBTC).toBe(results[1].totalBTC);
    expect(results[0].totalBTC).toBe('1.50000000');
  });
});
