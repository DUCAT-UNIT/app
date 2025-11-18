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
function renderHook(hook, options = {}) {
  const result = { current: null };
  let props = options.initialProps || {};

  function TestComponent() {
    result.current = typeof hook === 'function' ? hook(props) : hook;
    return null;
  }

  let component;
  act(() => {
    component = create(<TestComponent />);
  });

  return {
    result,
    unmount: () => component.unmount(),
    rerender: (newProps) => {
      props = newProps || props;
      act(() => {
        component.update(<TestComponent />);
      });
    },
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

  it('should skip fetch when wallet addresses are missing', async () => {
    const walletWithoutAddresses = null;

    const { result } = renderHook(() => useBalanceData(walletWithoutAddresses, mockGetUnconfirmedBalance));

    await act(async () => {
      await result.current.fetchBalance();
    });

    // Should not call the service when addresses are missing
    expect(balanceService.fetchWalletBalances).not.toHaveBeenCalled();
    expect(result.current.loadingBalance).toBe(false);
  });

  it('should skip state update when balances are unchanged', async () => {
    const mockBalances = {
      segwitBalance: 100000,
      taprootBalance: 200000,
      runesBalance: [['UNIT', 1000]],
    };

    balanceService.fetchWalletBalances.mockResolvedValue(mockBalances);
    mockGetUnconfirmedBalance.mockReturnValue({ btc: 0, runes: 0 });

    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    // First fetch - balances should update
    await act(async () => {
      await result.current.fetchBalance();
    });

    expect(result.current.segwitBalance).toBe(100000);
    expect(result.current.taprootBalance).toBe(200000);

    // Clear mock to verify it's called again
    balanceService.fetchWalletBalances.mockClear();
    balanceService.fetchWalletBalances.mockResolvedValue(mockBalances); // Same balances

    // Second fetch with same balances - should fetch but not update state
    await act(async () => {
      await result.current.fetchBalance();
    });

    // Should have called the service
    expect(balanceService.fetchWalletBalances).toHaveBeenCalled();
    // State should remain the same
    expect(result.current.segwitBalance).toBe(100000);
    expect(result.current.taprootBalance).toBe(200000);
  });

  it('should reset prevBalancesRef when wallet address changes', async () => {
    const mockBalances1 = {
      segwitBalance: 100000,
      taprootBalance: 200000,
      runesBalance: [['UNIT', 1000]],
    };

    const mockBalances2 = {
      segwitBalance: 50000,
      taprootBalance: 75000,
      runesBalance: [['UNIT', 500]],
    };

    balanceService.fetchWalletBalances.mockResolvedValue(mockBalances1);
    mockGetUnconfirmedBalance.mockReturnValue({ btc: 0, runes: 0 });

    const { result, rerender } = renderHook(
      ({ wallet }) => useBalanceData(wallet, mockGetUnconfirmedBalance),
      { initialProps: { wallet: mockWallet } }
    );

    // First fetch with first wallet
    await act(async () => {
      await result.current.fetchBalance();
    });

    expect(result.current.segwitBalance).toBe(100000);

    // Change wallet address
    const newWallet = {
      segwitAddress: 'bc1qnewaddress',
      taprootAddress: 'bc1pnewaddress',
    };

    balanceService.fetchWalletBalances.mockResolvedValue(mockBalances2);

    // Rerender with new wallet address
    act(() => {
      rerender({ wallet: newWallet });
    });

    // Fetch with new wallet - should update because prevBalancesRef was reset
    await act(async () => {
      await result.current.fetchBalance();
    });

    expect(result.current.segwitBalance).toBe(50000);
    expect(result.current.taprootBalance).toBe(75000);
  });

  it('should handle undefined runesBalance in balance comparison', async () => {
    const mockBalances = {
      segwitBalance: 100000,
      taprootBalance: 200000,
      runesBalance: undefined, // undefined runesBalance
    };

    balanceService.fetchWalletBalances.mockResolvedValue(mockBalances);
    mockGetUnconfirmedBalance.mockReturnValue({ btc: 0, runes: 0 });

    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    await act(async () => {
      await result.current.fetchBalance();
    });

    // Should handle undefined runesBalance gracefully
    expect(result.current.segwitBalance).toBe(100000);
    expect(result.current.taprootBalance).toBe(200000);
  });
});
