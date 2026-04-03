/**
 * Tests for withdrawStore computed values
 */

import React from 'react';
import { create } from 'react-test-renderer';
import { act } from '@testing-library/react-native';
import { useWithdraw, useWithdrawStore } from '../withdrawStore';

const resetWithdrawStore = () => useWithdrawStore.getState().reset();

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/vaultUtils', () => ({
  computeHealthFactor: jest.fn((btcAmount: number, btcPrice: number, unitAmount: number) => {
    if (!btcPrice || btcAmount <= 0 || unitAmount <= 0) return 0;
    return ((btcAmount * btcPrice) / unitAmount) * 100;
  }),
  computeLiquidationPrice: jest.fn((unitAmount: number, btcAmount: number) => {
    if (btcAmount <= 0 || unitAmount <= 0) return 0;
    return unitAmount / btcAmount / 0.6;
  }),
  getHealthStatus: jest.fn((healthFactor: number) => {
    if (healthFactor >= 200) return 'healthy';
    if (healthFactor >= 160) return 'warning';
    return 'danger';
  }),
}));

function renderHook<T>(hook: () => T): { result: { current: T | null }; unmount: () => void } {
  const result: { current: T | null } = { current: null };

  function TestComponent(): null {
    result.current = hook();
    return null;
  }

  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(React.createElement(TestComponent));
  });
  return { result, unmount: component!.unmount };
}

describe('withdrawStore', () => {
  beforeEach(() => {
    resetWithdrawStore();
  });

  it('should allow full withdraw when there is no debt even without price', () => {
    act(() => {
      useWithdrawStore.getState().setCurrentVaultData(0, 0.25);
      useWithdrawStore.getState().setBitcoinPrice(null);
    });

    const { result } = renderHook(() => useWithdraw());
    expect(result.current!.maxWithdrawable).toBe(25_000_000);
  });

  it('should return zero max withdrawable when debt exists and price is missing', () => {
    act(() => {
      useWithdrawStore.getState().setCurrentVaultData(1000, 0.25);
      useWithdrawStore.getState().setBitcoinPrice(null);
    });

    const { result } = renderHook(() => useWithdraw());
    expect(result.current!.maxWithdrawable).toBe(0);
  });

  it('should constrain max withdrawable by health ratio when debt and price exist', () => {
    act(() => {
      useWithdrawStore.getState().setCurrentVaultData(1000, 0.25);
      useWithdrawStore.getState().setBitcoinPrice(100000);
    });

    const { result } = renderHook(() => useWithdraw());
    expect(result.current!.maxWithdrawable).toBe(23_400_000);
  });
});
