/**
 * Tests for useBalanceData hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useBalanceData } from '../useBalanceData';
import * as balanceService from '../../services/balanceService';

// Mock balance service
jest.mock('../../services/balanceService');

// Helper to render hooks
function renderHook(hook, props) {
  const result = { current: null };
  function TestComponent() {
    result.current = hook(props);
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

describe('useBalanceData', () => {
  const mockWallet = {
    segwitAddress: 'bc1qtest',
    taprootAddress: 'bc1ptest',
  };

  const mockGetUnconfirmedBalance = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUnconfirmedBalance.mockReturnValue({ btc: 0, runes: 0 });
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    expect(result.current.segwitBalance).toBe(0);
    expect(result.current.taprootBalance).toBe(0);
    expect(result.current.runesBalance).toEqual([]);
    expect(result.current.loadingBalance).toBe(false);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.balanceError).toBe(null);
    expect(result.current.utxos).toEqual([]);
    expect(result.current.loadingUtxos).toBe(false);
  });

  it('should fetch balances successfully', async () => {
    const mockBalances = {
      segwitBalance: 100000,
      taprootBalance: 200000,
      runesBalance: [['UNIT•RUNE', 1000]],
    };

    balanceService.fetchWalletBalances.mockResolvedValue(mockBalances);
    mockGetUnconfirmedBalance.mockReturnValue({ btc: 5000, runes: 10 });

    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    await act(async () => {
      await result.current.fetchBalance();
    });

    expect(result.current.segwitBalance).toBe(100000);
    expect(result.current.taprootBalance).toBe(200000);
    expect(result.current.runesBalance).toEqual([['UNIT•RUNE', 1000]]);
    expect(result.current.unconfirmedSegwitBalance).toBe(5000);
    expect(result.current.unconfirmedTaprootBalance).toBe(5000);
    expect(result.current.balanceError).toBe(null);
  });

  it('should handle balance fetch error', async () => {
    balanceService.fetchWalletBalances.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    await act(async () => {
      await result.current.fetchBalance();
    });

    expect(result.current.balanceError).toBe('Failed to fetch balance. Tap to retry.');
  });

  it('should reset balances', () => {
    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    act(() => {
      result.current.resetBalances();
    });

    expect(result.current.segwitBalance).toBe(0);
    expect(result.current.taprootBalance).toBe(0);
    expect(result.current.runesBalance).toEqual([]);
    expect(result.current.utxos).toEqual([]);
  });

  it('should fetch UTXOs successfully', async () => {
    const mockUtxos = [
      { txid: 'abc123', vout: 0, value: 10000 },
      { txid: 'def456', vout: 1, value: 20000 },
    ];

    balanceService.fetchUtxos.mockResolvedValue(mockUtxos);

    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    let returnedUtxos;
    await act(async () => {
      returnedUtxos = await result.current.fetchUtxos('bc1qtest');
    });

    expect(result.current.utxos).toEqual(mockUtxos);
    expect(returnedUtxos).toEqual(mockUtxos);
  });

  it('should handle UTXOs fetch error', async () => {
    balanceService.fetchUtxos.mockRejectedValue(new Error('UTXO fetch failed'));

    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    await expect(
      act(async () => {
        await result.current.fetchUtxos('bc1qtest');
      })
    ).rejects.toThrow('UTXO fetch failed');
  });

  it('should refresh balances using onRefresh', async () => {
    const mockBalances = {
      segwitBalance: 150000,
      taprootBalance: 250000,
      runesBalance: [['REFRESH•RUNE', 2000]],
    };

    balanceService.fetchWalletBalances.mockResolvedValue(mockBalances);
    mockGetUnconfirmedBalance.mockReturnValue({ btc: 3000, runes: 5 });

    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    await act(async () => {
      await result.current.onRefresh();
    });

    expect(result.current.segwitBalance).toBe(150000);
    expect(result.current.taprootBalance).toBe(250000);
    expect(result.current.runesBalance).toEqual([['REFRESH•RUNE', 2000]]);
    expect(result.current.refreshing).toBe(false);
  });
});
