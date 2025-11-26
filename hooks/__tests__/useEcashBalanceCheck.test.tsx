// @ts-nocheck
/**
 * Tests for useEcashBalanceCheck hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useEcashBalanceCheck } from '../useEcashBalanceCheck';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock logger by adding it to the module scope
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Add logger to global scope for the hook
global.logger = mockLogger;

import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper to render hooks with props
function renderHookWithProps(cashuBalance, ecashThreshold, unitBalance) {
  const result = { current: null };
  function TestComponent({ balance, threshold, unit }) {
    result.current = useEcashBalanceCheck(balance, threshold, unit);
    return null;
  }
  let component;
  act(() => {
    component = create(
      <TestComponent balance={cashuBalance} threshold={ecashThreshold} unit={unitBalance} />
    );
  });
  return {
    result,
    unmount: component.unmount,
    component,
    rerender: (newBalance, newThreshold, newUnit) => {
      act(() => {
        component.update(
          <TestComponent balance={newBalance} threshold={newThreshold} unit={newUnit} />
        );
      });
    },
  };
}

describe('useEcashBalanceCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue();
  });

  it('should return initial state', () => {
    const { result } = renderHookWithProps(100, 100, 1000);

    expect(result.current.showLowBalanceModal).toBe(false);
    expect(result.current.amountNeeded).toBe(0);
    expect(result.current.currentBalance).toBe(100);
    expect(result.current.defaultThreshold).toBe(100);
    expect(typeof result.current.closeModal).toBe('function');
  });

  it('should handle null cashuBalance', () => {
    const { result } = renderHookWithProps(null, 100, 1000);

    expect(result.current.currentBalance).toBe(0);
    expect(result.current.showLowBalanceModal).toBe(false);
  });

  it('should handle undefined cashuBalance', () => {
    const { result } = renderHookWithProps(undefined, 100, 1000);

    expect(result.current.currentBalance).toBe(0);
  });

  it('should use default threshold when ecashThreshold is null', () => {
    const { result } = renderHookWithProps(100, null, 1000);

    expect(result.current.defaultThreshold).toBe(100);
  });

  it('should show modal when balance is low and unit balance sufficient', async () => {
    // Balance is 10, threshold is 100, 25% of 100 = 25
    // 10 <= 25, so should trigger
    const { result } = renderHookWithProps(10, 100, 1000);

    // Wait for async effect
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.showLowBalanceModal).toBe(true);
    expect(result.current.amountNeeded).toBe(90); // 100 - 10
  });

  it('should not show modal when balance is above threshold', async () => {
    // Balance is 50, threshold is 100, 25% = 25
    // 50 > 25, so should not trigger
    const { result } = renderHookWithProps(50, 100, 1000);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.showLowBalanceModal).toBe(false);
  });

  it('should not show modal when unit balance is insufficient', async () => {
    // Balance is 10, threshold is 100, need 90
    // Unit balance is only 50, insufficient
    const { result } = renderHookWithProps(10, 100, 50);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.showLowBalanceModal).toBe(false);
  });

  it('should not show modal during cooldown period', async () => {
    // Mock that we checked recently (1 hour ago)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    AsyncStorage.getItem.mockResolvedValue(oneHourAgo.toString());

    const { result } = renderHookWithProps(10, 100, 1000);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.showLowBalanceModal).toBe(false);
  });

  it('should show modal after cooldown expires', async () => {
    // Mock that we checked 25 hours ago (cooldown is 24 hours)
    const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;
    AsyncStorage.getItem.mockResolvedValue(twentyFiveHoursAgo.toString());

    const { result } = renderHookWithProps(10, 100, 1000);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.showLowBalanceModal).toBe(true);
  });

  it('should save check time when showing modal', async () => {
    const { result } = renderHookWithProps(10, 100, 1000);

    await act(async () => {
      await Promise.resolve();
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@ecash_balance_last_check',
      expect.any(String)
    );
  });

  it('should close modal when closeModal is called', async () => {
    const { result } = renderHookWithProps(10, 100, 1000);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.showLowBalanceModal).toBe(true);

    act(() => {
      result.current.closeModal();
    });

    expect(result.current.showLowBalanceModal).toBe(false);
  });

  it('should only check once per session', async () => {
    const { result, rerender } = renderHookWithProps(10, 100, 1000);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.showLowBalanceModal).toBe(true);

    // Close modal
    act(() => {
      result.current.closeModal();
    });

    // Rerender - should not check again
    rerender(5, 100, 1000);

    await act(async () => {
      await Promise.resolve();
    });

    // Should not show again in same session
    expect(result.current.showLowBalanceModal).toBe(false);
  });

  it('should handle AsyncStorage.getItem error gracefully', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

    const { result } = renderHookWithProps(10, 100, 1000);

    await act(async () => {
      await Promise.resolve();
    });

    // Should still show modal despite error
    expect(result.current.showLowBalanceModal).toBe(true);
  });

  it('should handle AsyncStorage.setItem error gracefully', async () => {
    AsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

    const { result } = renderHookWithProps(10, 100, 1000);

    await act(async () => {
      await Promise.resolve();
    });

    // Should still show modal despite error
    expect(result.current.showLowBalanceModal).toBe(true);
  });

  it('should calculate correct amount needed', async () => {
    // Balance is 25, threshold is 200, need 175
    const { result } = renderHookWithProps(25, 200, 500);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.amountNeeded).toBe(175);
  });

  it('should show modal when balance is exactly at threshold boundary', async () => {
    // Balance is 25, threshold is 100, 25% = 25
    // 25 <= 25, should trigger
    const { result } = renderHookWithProps(25, 100, 1000);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.showLowBalanceModal).toBe(true);
  });

  it('should not show modal when balance is 0 and unit balance is 0', async () => {
    const { result } = renderHookWithProps(0, 100, 0);

    await act(async () => {
      await Promise.resolve();
    });

    // Unit balance insufficient
    expect(result.current.showLowBalanceModal).toBe(false);
  });
});
