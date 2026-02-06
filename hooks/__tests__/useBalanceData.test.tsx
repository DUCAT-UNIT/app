/**
 * Tests for useBalanceData hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useBalanceData } from '../useBalanceData';
import * as balanceService from '../../services/balanceService';
import type { WalletAddresses } from '../../contexts/WalletContext';

// Mock balance service
jest.mock('../../services/balanceService');

// Helper to render hooks
function renderHook<T>(hook: (props: any) => T, options: { initialProps?: any } = {}) {
  const result: { current: T | null } = { current: null };
  let props = options.initialProps || {};

  function TestComponent() {
    result.current = typeof hook === 'function' ? hook(props) : hook;
    return null;
  }

  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent />);
  });

  return {
    result,
    unmount: () => component?.unmount(),
    rerender: (newProps?: unknown) => {
      props = newProps || props;
      act(() => {
        component?.update(<TestComponent />);
      });
    },
  };
}

describe('useBalanceData', () => {
  const mockWallet = {
    segwitAddress: 'bc1qtest',
    taprootAddress: 'bc1ptest',
    segwitPubkey: 'pubkey1',
    taprootPubkey: 'pubkey2',
  } as WalletAddresses;

  const mockGetUnconfirmedBalance = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUnconfirmedBalance.mockReturnValue({ btc: 0, runes: 0 });
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    expect(result.current!.segwitBalance).toBe(0);
    expect(result.current!.taprootBalance).toBe(0);
    expect(result.current!.runesBalance).toEqual([]);
    expect(result.current!.loadingBalance).toBe(false);
    expect(result.current!.refreshing).toBe(false);
    expect(result.current!.balanceError).toBe(null);
    expect(result.current!.utxos).toEqual([]);
    expect(result.current!.loadingUtxos).toBe(false);
  });

  it('should fetch balances successfully', async () => {
    const mockBalances = {
      segwitBalance: 100000,
      taprootBalance: 200000,
      runesBalance: [['UNIT•RUNE', 1000]],
    };

    (balanceService.fetchWalletBalances as jest.Mock).mockResolvedValue(mockBalances);
    mockGetUnconfirmedBalance.mockReturnValue({ btc: 5000, runes: 10 });

    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    await act(async () => {
      await result.current!.fetchBalance();
    });

    expect(result.current!.segwitBalance).toBe(100000);
    expect(result.current!.taprootBalance).toBe(200000);
    expect(result.current!.runesBalance).toEqual([['UNIT•RUNE', 1000]]);
    expect(result.current!.unconfirmedSegwitBalance).toBe(5000);
    expect(result.current!.unconfirmedTaprootBalance).toBe(5000);
    expect(result.current!.balanceError).toBe(null);
  });

  it('should handle balance fetch error', async () => {
    (balanceService.fetchWalletBalances as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    await act(async () => {
      await result.current!.fetchBalance();
    });

    expect(result.current!.balanceError).toBe('Failed to fetch balance. Tap to retry.');
  });

  it('should reset balances', () => {
    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    act(() => {
      result.current!.resetBalances();
    });

    expect(result.current!.segwitBalance).toBe(0);
    expect(result.current!.taprootBalance).toBe(0);
    expect(result.current!.runesBalance).toEqual([]);
    expect(result.current!.utxos).toEqual([]);
  });

  it('should fetch UTXOs successfully', async () => {
    const mockUtxos = [
      { txid: 'abc123', vout: 0, value: 10000 },
      { txid: 'def456', vout: 1, value: 20000 },
    ];

    (balanceService.fetchUtxos as jest.Mock).mockResolvedValue(mockUtxos);

    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    let returnedUtxos;
    await act(async () => {
      returnedUtxos = await result.current!.fetchUtxos('bc1qtest');
    });

    expect(result.current!.utxos).toEqual(mockUtxos);
    expect(returnedUtxos).toEqual(mockUtxos);
  });

  it('should handle UTXOs fetch error', async () => {
    (balanceService.fetchUtxos as jest.Mock).mockRejectedValue(new Error('UTXO fetch failed'));

    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    await expect(
      act(async () => {
        await result.current!.fetchUtxos('bc1qtest');
      })
    ).rejects.toThrow('UTXO fetch failed');
  });

  it('should refresh balances using onRefresh', async () => {
    const mockBalances = {
      segwitBalance: 150000,
      taprootBalance: 250000,
      runesBalance: [['REFRESH•RUNE', 2000]],
    };

    (balanceService.fetchWalletBalances as jest.Mock).mockResolvedValue(mockBalances);
    mockGetUnconfirmedBalance.mockReturnValue({ btc: 3000, runes: 5 });

    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    await act(async () => {
      await result.current!.onRefresh();
    });

    expect(result.current!.segwitBalance).toBe(150000);
    expect(result.current!.taprootBalance).toBe(250000);
    expect(result.current!.runesBalance).toEqual([['REFRESH•RUNE', 2000]]);
    expect(result.current!.refreshing).toBe(false);
  });

  it('should skip fetch when wallet addresses are missing', async () => {
    const walletWithoutAddresses = null;

    const { result } = renderHook(() => useBalanceData(walletWithoutAddresses, mockGetUnconfirmedBalance));

    await act(async () => {
      await result.current!.fetchBalance();
    });

    // Should not call the service when addresses are missing
    expect(balanceService.fetchWalletBalances).not.toHaveBeenCalled();
    expect(result.current!.loadingBalance).toBe(false);
  });

  it('should skip state update when balances are unchanged', async () => {
    const mockBalances = {
      segwitBalance: 100000,
      taprootBalance: 200000,
      runesBalance: [['UNIT', 1000]],
    };

    (balanceService.fetchWalletBalances as jest.Mock).mockResolvedValue(mockBalances);
    mockGetUnconfirmedBalance.mockReturnValue({ btc: 0, runes: 0 });

    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    // First fetch - balances should update
    await act(async () => {
      await result.current!.fetchBalance();
    });

    expect(result.current!.segwitBalance).toBe(100000);
    expect(result.current!.taprootBalance).toBe(200000);

    // Clear mock to verify it's called again
    (balanceService.fetchWalletBalances as jest.Mock).mockClear();
    (balanceService.fetchWalletBalances as jest.Mock).mockResolvedValue(mockBalances); // Same balances

    // Second fetch with same balances - should fetch but not update state
    await act(async () => {
      await result.current!.fetchBalance();
    });

    // Should have called the service
    expect(balanceService.fetchWalletBalances).toHaveBeenCalled();
    // State should remain the same
    expect(result.current!.segwitBalance).toBe(100000);
    expect(result.current!.taprootBalance).toBe(200000);
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

    (balanceService.fetchWalletBalances as jest.Mock).mockResolvedValue(mockBalances1);
    mockGetUnconfirmedBalance.mockReturnValue({ btc: 0, runes: 0 });

    const { result, rerender } = renderHook(
      ({ wallet }: { wallet: WalletAddresses }) => useBalanceData(wallet, mockGetUnconfirmedBalance),
      { initialProps: { wallet: mockWallet } }
    );

    // First fetch with first wallet
    await act(async () => {
      await result.current!.fetchBalance();
    });

    expect(result.current!.segwitBalance).toBe(100000);

    // Change wallet address
    const newWallet = {
      segwitAddress: 'bc1qnewaddress',
      taprootAddress: 'bc1pnewaddress',
    };

    (balanceService.fetchWalletBalances as jest.Mock).mockResolvedValue(mockBalances2);

    // Rerender with new wallet address
    act(() => {
      rerender({ wallet: newWallet });
    });

    // Fetch with new wallet - should update because prevBalancesRef was reset
    await act(async () => {
      await result.current!.fetchBalance();
    });

    expect(result.current!.segwitBalance).toBe(50000);
    expect(result.current!.taprootBalance).toBe(75000);
  });

  it('should handle undefined runesBalance in balance comparison', async () => {
    const mockBalances = {
      segwitBalance: 100000,
      taprootBalance: 200000,
      runesBalance: undefined, // undefined runesBalance
    };

    (balanceService.fetchWalletBalances as jest.Mock).mockResolvedValue(mockBalances);
    mockGetUnconfirmedBalance.mockReturnValue({ btc: 0, runes: 0 });

    const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

    await act(async () => {
      await result.current!.fetchBalance();
    });

    // Should handle undefined runesBalance gracefully
    expect(result.current!.segwitBalance).toBe(100000);
    expect(result.current!.taprootBalance).toBe(200000);
  });

  describe('getUnconfirmedUTXOs branch', () => {
    it('should filter out already-confirmed UTXOs from unconfirmed balance', async () => {
      const mockBalances = {
        segwitBalance: 100000,
        taprootBalance: 200000,
        runesBalance: [],
      };

      // Confirmed UTXOs returned by fetchUtxos
      const confirmedSegwitUtxos = [
        { txid: 'confirmed1', vout: 0, value: 50000 },
      ];
      const confirmedTaprootUtxos = [
        { txid: 'confirmed2', vout: 1, value: 60000 },
      ];

      // Unconfirmed UTXOs from pending transactions (includes some already confirmed)
      const mockGetUnconfirmedUTXOs = jest.fn((type: 'segwit' | 'taproot') => {
        if (type === 'segwit') {
          return [
            { txid: 'confirmed1', vout: 0, value: 50000000, address: 'addr1', status: { confirmed: false } },
            { txid: 'new1', vout: 0, value: 10000000, address: 'addr2', status: { confirmed: false } },
          ];
        }
        return [
          { txid: 'confirmed2', vout: 1, value: 60000000, address: 'addr3', status: { confirmed: false } },
          { txid: 'new2', vout: 0, value: 20000000, runeAmount: 500, address: 'addr4', status: { confirmed: false } },
        ];
      });

      (balanceService.fetchWalletBalances as jest.Mock).mockResolvedValue(mockBalances);
      (balanceService.fetchUtxos as jest.Mock)
        .mockResolvedValueOnce(confirmedSegwitUtxos)
        .mockResolvedValueOnce(confirmedTaprootUtxos);

      const { result } = renderHook(() =>
        useBalanceData(mockWallet, mockGetUnconfirmedBalance, mockGetUnconfirmedUTXOs as any)
      );

      await act(async () => {
        await result.current!.fetchBalance();
      });

      // Only unconfirmed UTXOs that aren't already confirmed should be counted
      // Segwit: 10000000 sats = 0.1 BTC
      expect(result.current!.unconfirmedSegwitBalance).toBe(0.1);
      // Taproot: 20000000 sats = 0.2 BTC
      expect(result.current!.unconfirmedTaprootBalance).toBe(0.2);
      // Runes: 500 / 100 = 5
      expect(result.current!.unconfirmedRunesBalance).toBe(5);
    });

    it('should handle empty unconfirmed UTXOs', async () => {
      const mockBalances = {
        segwitBalance: 100000,
        taprootBalance: 200000,
        runesBalance: [],
      };

      const mockGetUnconfirmedUTXOs = jest.fn(() => [] as any);

      (balanceService.fetchWalletBalances as jest.Mock).mockResolvedValue(mockBalances);
      (balanceService.fetchUtxos as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useBalanceData(mockWallet, mockGetUnconfirmedBalance, mockGetUnconfirmedUTXOs as any)
      );

      await act(async () => {
        await result.current!.fetchBalance();
      });

      expect(result.current!.unconfirmedSegwitBalance).toBe(0);
      expect(result.current!.unconfirmedTaprootBalance).toBe(0);
      expect(result.current!.unconfirmedRunesBalance).toBe(0);
    });

    it('should handle UTXOs with undefined value', async () => {
      const mockBalances = {
        segwitBalance: 100000,
        taprootBalance: 200000,
        runesBalance: [],
      };

      const mockGetUnconfirmedUTXOs = jest.fn((type: string) => {
        if (type === 'segwit') {
          return [{ txid: 'test1', vout: 0, value: undefined }];
        }
        return [{ txid: 'test2', vout: 0, value: undefined, runeAmount: undefined }];
      });

      (balanceService.fetchWalletBalances as jest.Mock).mockResolvedValue(mockBalances);
      (balanceService.fetchUtxos as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useBalanceData(mockWallet, mockGetUnconfirmedBalance, mockGetUnconfirmedUTXOs as any)
      );

      await act(async () => {
        await result.current!.fetchBalance();
      });

      // Should handle undefined values gracefully
      expect(result.current!.unconfirmedSegwitBalance).toBe(0);
      expect(result.current!.unconfirmedTaprootBalance).toBe(0);
      expect(result.current!.unconfirmedRunesBalance).toBe(0);
    });

    it('should use addresses passed as parameters over wallet addresses', async () => {
      const mockBalances = {
        segwitBalance: 300000,
        taprootBalance: 400000,
        runesBalance: [],
      };

      (balanceService.fetchWalletBalances as jest.Mock).mockResolvedValue(mockBalances);

      const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

      await act(async () => {
        await result.current!.fetchBalance('custom_segwit_addr', 'custom_taproot_addr');
      });

      expect(balanceService.fetchWalletBalances).toHaveBeenCalledWith(
        'custom_segwit_addr',
        'custom_taproot_addr'
      );
    });

    it('should skip fetch when only segwit address is provided but taproot is missing', async () => {
      const walletWithPartialAddresses = {
        segwitAddress: 'bc1qtest',
        taprootAddress: null,
        segwitPubkey: 'pubkey1',
        taprootPubkey: 'pubkey2',
      } as unknown as WalletAddresses;

      const { result } = renderHook(() =>
        useBalanceData(walletWithPartialAddresses, mockGetUnconfirmedBalance)
      );

      await act(async () => {
        await result.current!.fetchBalance();
      });

      expect(balanceService.fetchWalletBalances).not.toHaveBeenCalled();
    });
  });

  describe('areRunesBalancesEqual edge cases', () => {
    it('should detect runes balance changes', async () => {
      const mockBalances1 = {
        segwitBalance: 100000,
        taprootBalance: 200000,
        runesBalance: [{ runeid: 'UNIT', amount: 1000 }],
      };

      const mockBalances2 = {
        segwitBalance: 100000,
        taprootBalance: 200000,
        runesBalance: [{ runeid: 'UNIT', amount: 2000 }], // Changed amount
      };

      (balanceService.fetchWalletBalances as jest.Mock).mockResolvedValue(mockBalances1);
      mockGetUnconfirmedBalance.mockReturnValue({ btc: 0, runes: 0 });

      const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

      await act(async () => {
        await result.current!.fetchBalance();
      });

      expect(result.current!.runesBalance).toEqual([{ runeid: 'UNIT', amount: 1000 }]);

      // Now return different runes balance
      (balanceService.fetchWalletBalances as jest.Mock).mockResolvedValue(mockBalances2);

      await act(async () => {
        await result.current!.fetchBalance();
      });

      expect(result.current!.runesBalance).toEqual([{ runeid: 'UNIT', amount: 2000 }]);
    });

    it('should detect runes length changes', async () => {
      const mockBalances1 = {
        segwitBalance: 100000,
        taprootBalance: 200000,
        runesBalance: [{ runeid: 'UNIT', amount: 1000 }],
      };

      const mockBalances2 = {
        segwitBalance: 100000,
        taprootBalance: 200000,
        runesBalance: [
          { runeid: 'UNIT', amount: 1000 },
          { runeid: 'OTHER', amount: 500 },
        ], // Added a new rune
      };

      (balanceService.fetchWalletBalances as jest.Mock).mockResolvedValue(mockBalances1);
      mockGetUnconfirmedBalance.mockReturnValue({ btc: 0, runes: 0 });

      const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

      await act(async () => {
        await result.current!.fetchBalance();
      });

      expect(result.current!.runesBalance).toHaveLength(1);

      (balanceService.fetchWalletBalances as jest.Mock).mockResolvedValue(mockBalances2);

      await act(async () => {
        await result.current!.fetchBalance();
      });

      expect(result.current!.runesBalance).toHaveLength(2);
    });

    it('should treat empty array as equal to undefined', async () => {
      // First fetch with empty runesBalance
      const mockBalances1 = {
        segwitBalance: 100000,
        taprootBalance: 200000,
        runesBalance: [],
      };

      (balanceService.fetchWalletBalances as jest.Mock).mockResolvedValue(mockBalances1);
      mockGetUnconfirmedBalance.mockReturnValue({ btc: 0, runes: 0 });

      const { result } = renderHook(() => useBalanceData(mockWallet, mockGetUnconfirmedBalance));

      // Initial prevBalancesRef has empty runes: []
      // First fetch should update because segwit/taproot change from 0
      await act(async () => {
        await result.current!.fetchBalance();
      });

      expect(result.current!.runesBalance).toEqual([]);
      expect(result.current!.segwitBalance).toBe(100000);

      // Second fetch with same balances - should not trigger state update
      // This tests the areRunesBalancesEqual([], []) case
      (balanceService.fetchWalletBalances as jest.Mock).mockClear();
      (balanceService.fetchWalletBalances as jest.Mock).mockResolvedValue(mockBalances1);

      await act(async () => {
        await result.current!.fetchBalance();
      });

      expect(balanceService.fetchWalletBalances).toHaveBeenCalled();
    });
  });
});
