/**
 * Tests for BalanceContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { BalanceProvider, useBalance } from '../BalanceContext';
import { useWallet } from '../WalletContext';
import * as balanceService from '../../services/balanceService';

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

// Mock dependencies
jest.mock('../WalletContext');
jest.mock('../../services/balanceService');

describe('BalanceContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockWallet = {
    segwitAddress: 'bc1qsegwit',
    taprootAddress: 'bc1ptaproot',
  };

  const mockBalances = {
    segwitBalance: 50000,
    taprootBalance: 30000,
    runesBalance: [{ name: 'RUNE', amount: 100 }],
  };

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useBalance());
    }).toThrow('useBalance must be used within a BalanceProvider');

    consoleError.mockRestore();
  });

  it('should provide initial state', () => {
    useWallet.mockReturnValue({ wallet: null });

    const wrapper = ({ children }) => <BalanceProvider>{children}</BalanceProvider>;
    const { result } = renderHook(() => useBalance(), { wrapper });

    expect(result.current.segwitBalance).toBe(0);
    expect(result.current.taprootBalance).toBe(0);
    expect(result.current.runesBalance).toEqual([]);
    expect(result.current.loadingBalance).toBe(false);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.utxos).toEqual([]);
    expect(result.current.loadingUtxos).toBe(false);
  });

  it('should fetch balance on mount when wallet exists', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    balanceService.fetchWalletBalances.mockResolvedValue(mockBalances);

    const wrapper = ({ children }) => <BalanceProvider>{children}</BalanceProvider>;
    const { result } = renderHook(() => useBalance(), { wrapper });

    // Wait for the async effect to complete
    await act(async () => {
      await Promise.resolve();
    });

    expect(balanceService.fetchWalletBalances).toHaveBeenCalledWith(
      mockWallet.segwitAddress,
      mockWallet.taprootAddress
    );
    expect(result.current.segwitBalance).toBe(mockBalances.segwitBalance);
    expect(result.current.taprootBalance).toBe(mockBalances.taprootBalance);
    expect(result.current.runesBalance).toEqual(mockBalances.runesBalance);
  });

  it('should auto-refresh balance every 10 seconds', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    balanceService.fetchWalletBalances.mockResolvedValue(mockBalances);

    const wrapper = ({ children }) => <BalanceProvider>{children}</BalanceProvider>;
    renderHook(() => useBalance(), { wrapper });

    // Initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    expect(balanceService.fetchWalletBalances).toHaveBeenCalledTimes(1);

    // Advance 10 seconds
    await act(async () => {
      jest.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    expect(balanceService.fetchWalletBalances).toHaveBeenCalledTimes(2);

    // Advance another 10 seconds
    await act(async () => {
      jest.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    expect(balanceService.fetchWalletBalances).toHaveBeenCalledTimes(3);
  });

  it('should reset balances when wallet is null', async () => {
    useWallet.mockReturnValue({ wallet: null });

    const wrapper = ({ children }) => <BalanceProvider>{children}</BalanceProvider>;
    const { result } = renderHook(() => useBalance(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    // Should have reset balances
    expect(result.current.segwitBalance).toBe(0);
    expect(result.current.taprootBalance).toBe(0);
    expect(result.current.runesBalance).toEqual([]);
    expect(result.current.utxos).toEqual([]);
  });

  it('should handle fetchBalance with custom addresses', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    balanceService.fetchWalletBalances.mockResolvedValue(mockBalances);

    const wrapper = ({ children }) => <BalanceProvider>{children}</BalanceProvider>;
    const { result } = renderHook(() => useBalance(), { wrapper });

    const customSegwit = 'bc1qcustom';
    const customTaproot = 'bc1pcustom';

    await act(async () => {
      await result.current.fetchBalance(customSegwit, customTaproot);
    });

    expect(balanceService.fetchWalletBalances).toHaveBeenCalledWith(customSegwit, customTaproot);
  });

  it('should handle fetchBalance errors gracefully', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    balanceService.fetchWalletBalances.mockRejectedValue(new Error('Network error'));

    const wrapper = ({ children }) => <BalanceProvider>{children}</BalanceProvider>;
    const { result } = renderHook(() => useBalance(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    // Should reset to 0 on error
    expect(result.current.segwitBalance).toBe(0);
    expect(result.current.taprootBalance).toBe(0);
    expect(result.current.runesBalance).toEqual([]);
    expect(result.current.loadingBalance).toBe(false);
  });

  it('should handle onRefresh', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    balanceService.fetchWalletBalances.mockResolvedValue(mockBalances);

    const wrapper = ({ children }) => <BalanceProvider>{children}</BalanceProvider>;
    const { result } = renderHook(() => useBalance(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    // Clear previous calls
    balanceService.fetchWalletBalances.mockClear();

    await act(async () => {
      await result.current.onRefresh();
    });

    expect(balanceService.fetchWalletBalances).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(false);
  });

  it('should fetch UTXOs successfully', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    const mockUtxos = [
      { txid: 'tx1', vout: 0, value: 10000 },
      { txid: 'tx2', vout: 1, value: 20000 },
    ];
    balanceService.fetchUtxos.mockResolvedValue(mockUtxos);

    const wrapper = ({ children }) => <BalanceProvider>{children}</BalanceProvider>;
    const { result } = renderHook(() => useBalance(), { wrapper });

    let returnedUtxos;
    await act(async () => {
      returnedUtxos = await result.current.fetchUtxos(mockWallet.segwitAddress);
    });

    expect(balanceService.fetchUtxos).toHaveBeenCalledWith(mockWallet.segwitAddress);
    expect(result.current.utxos).toEqual(mockUtxos);
    expect(returnedUtxos).toEqual(mockUtxos);
    expect(result.current.loadingUtxos).toBe(false);
  });

  it('should handle fetchUtxos errors', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    balanceService.fetchUtxos.mockRejectedValue(new Error('UTXO fetch failed'));

    const wrapper = ({ children }) => <BalanceProvider>{children}</BalanceProvider>;
    const { result } = renderHook(() => useBalance(), { wrapper });

    await expect(
      act(async () => {
        await result.current.fetchUtxos(mockWallet.segwitAddress);
      })
    ).rejects.toThrow('UTXO fetch failed');

    expect(result.current.loadingUtxos).toBe(false);
  });

  it('should reset balances manually', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    balanceService.fetchWalletBalances.mockResolvedValue(mockBalances);

    const wrapper = ({ children }) => <BalanceProvider>{children}</BalanceProvider>;
    const { result } = renderHook(() => useBalance(), { wrapper });

    // Wait for initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.segwitBalance).toBe(mockBalances.segwitBalance);

    // Reset balances
    act(() => {
      result.current.resetBalances();
    });

    expect(result.current.segwitBalance).toBe(0);
    expect(result.current.taprootBalance).toBe(0);
    expect(result.current.runesBalance).toEqual([]);
    expect(result.current.utxos).toEqual([]);
  });

  it('should not fetch balance if addresses are missing', async () => {
    useWallet.mockReturnValue({ wallet: { segwitAddress: null, taprootAddress: null } });

    const wrapper = ({ children }) => <BalanceProvider>{children}</BalanceProvider>;
    renderHook(() => useBalance(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(balanceService.fetchWalletBalances).not.toHaveBeenCalled();
  });

  it('should cleanup interval on unmount', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    balanceService.fetchWalletBalances.mockResolvedValue(mockBalances);

    const wrapper = ({ children }) => <BalanceProvider>{children}</BalanceProvider>;
    const { unmount } = renderHook(() => useBalance(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    const callCount = balanceService.fetchWalletBalances.mock.calls.length;

    // Unmount
    act(() => {
      unmount();
    });

    // Advance time
    await act(async () => {
      jest.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    // Should not have called again after unmount
    expect(balanceService.fetchWalletBalances).toHaveBeenCalledTimes(callCount);
  });
});
