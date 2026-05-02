/**
 * Tests for useVaultDataFetch hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useVaultDataFetch } from '../useVaultDataFetch';
import * as vaultService from '../../services/vaultService';
import type { WalletAddresses } from '../../contexts/WalletContext';

// Mock vault service
jest.mock('../../services/vaultService');

const mockSetFallbackBtcPrice = jest.fn();
jest.mock('../../stores/priceStore', () => ({
  usePriceStore: {
    getState: () => ({ setFallbackBtcPrice: mockSetFallbackBtcPrice }),
  },
}));

// Helper to render hooks
function renderHook<T>(hook: () => T) {
  const result: { current: T | null } = { current: null };
  function TestComponent() {
    result.current = hook();
    return null;
  }
  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent />);
  });
  return {
    result,
    unmount: () => component?.unmount(),
  };
}

describe('useVaultDataFetch', () => {
  const mockWallet = {
    segwitAddress: 'bc1qtest',
    taprootAddress: 'bc1ptest',
    segwitPubkey: 'segpub123',
    taprootPubkey: 'pubkey123',
  } as WalletAddresses;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetFallbackBtcPrice.mockReset();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useVaultDataFetch(mockWallet));

    expect(result.current!.vaultData).toBe(null);
    expect(result.current!.loadingVault).toBe(false);
    expect(result.current!.vaultIsRefreshing).toBe(false);
    expect(result.current!.vaultLastUpdated).toBe(null);
    expect(result.current!.vaultIsStale).toBe(false);
    expect(result.current!.vaultError).toBe(null);
  });

  it('should fetch vault data successfully', async () => {
    const mockVaultData = {
      vaultTag: 'vault-123',
      totalDebt: 50000,
      totalCollateral: 0.001,
      currentPrice: 50000000,
      healthRatio: 200,
    };

    (vaultService.fetchVaultData as jest.Mock).mockResolvedValue(mockVaultData);

    const { result } = renderHook(() => useVaultDataFetch(mockWallet));

    await act(async () => {
      await result.current!.fetchVault();
    });

    expect(result.current!.vaultData).toEqual(mockVaultData);
    expect(result.current!.vaultError).toBe(null);
    expect(result.current!.loadingVault).toBe(false);
    expect(result.current!.vaultLastUpdated).toEqual(expect.any(Number));
    expect(result.current!.vaultIsStale).toBe(false);
    expect(mockSetFallbackBtcPrice).toHaveBeenCalledWith(50000000);
  });

  it('preserves last good vault data when a background refresh fails', async () => {
    const mockVaultData = {
      vaultTag: 'vault-123',
      totalDebt: 50000,
      totalCollateral: 0.001,
      currentPrice: 50000000,
    };

    (vaultService.fetchVaultData as jest.Mock).mockResolvedValueOnce(mockVaultData);

    const { result } = renderHook(() => useVaultDataFetch(mockWallet));

    await act(async () => {
      await result.current!.fetchVault();
    });

    const lastUpdated = result.current!.vaultLastUpdated;
    (vaultService.fetchVaultData as jest.Mock).mockRejectedValueOnce(new Error('background error'));

    await act(async () => {
      await result.current!.fetchVault();
    });

    expect(result.current!.vaultData).toEqual(mockVaultData);
    expect(result.current!.vaultError).toBe('Failed to fetch vault data');
    expect(result.current!.vaultLastUpdated).toBe(lastUpdated);
    expect(result.current!.vaultIsRefreshing).toBe(false);
  });

  it('preserves last good vault data when a background refresh returns null', async () => {
    const mockVaultData = {
      vaultTag: 'vault-123',
      totalDebt: 50000,
      totalCollateral: 0.001,
      currentPrice: 50000000,
    };

    (vaultService.fetchVaultData as jest.Mock).mockResolvedValueOnce(mockVaultData);

    const { result } = renderHook(() => useVaultDataFetch(mockWallet));

    await act(async () => {
      await result.current!.fetchVault();
    });

    (vaultService.fetchVaultData as jest.Mock).mockResolvedValueOnce(null);

    await act(async () => {
      await result.current!.fetchVault();
    });

    expect(result.current!.vaultData).toEqual(mockVaultData);
    expect(result.current!.vaultError).toBe('Failed to fetch vault data');
  });

  it('should handle vault fetch error', async () => {
    (vaultService.fetchVaultData as jest.Mock).mockRejectedValue(new Error('Vault API error'));

    const { result } = renderHook(() => useVaultDataFetch(mockWallet));

    await act(async () => {
      await result.current!.fetchVault();
    });

    expect(result.current!.vaultError).toBe('Failed to fetch vault data');
    expect(result.current!.loadingVault).toBe(false);
  });

  it('should not fetch when wallet is missing', async () => {
    const { result } = renderHook(() => useVaultDataFetch(null));

    await act(async () => {
      await result.current!.fetchVault();
    });

    expect(vaultService.fetchVaultData).not.toHaveBeenCalled();
  });

  it('should not fetch when taprootPubkey is missing', async () => {
    const incompleteWallet = {
      segwitAddress: 'bc1qtest',
      // Missing taprootPubkey
    } as unknown as WalletAddresses;

    const { result } = renderHook(() => useVaultDataFetch(incompleteWallet));

    await act(async () => {
      await result.current!.fetchVault();
    });

    expect(vaultService.fetchVaultData).not.toHaveBeenCalled();
  });

  it('should reset vault data', () => {
    const { result } = renderHook(() => useVaultDataFetch(mockWallet));

    act(() => {
      result.current!.resetVaultData();
    });

    expect(result.current!.vaultData).toBe(null);
  });

  it('should handle null vault data (no vault exists)', async () => {
    (vaultService.fetchVaultData as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useVaultDataFetch(mockWallet));

    await act(async () => {
      await result.current!.fetchVault();
    });

    expect(result.current!.vaultData).toBe(null);
    expect(result.current!.vaultError).toBe(null);
    expect(result.current!.loadingVault).toBe(false);
  });

  it('should not update state when vault data has not changed', async () => {
    const mockVaultData = {
      vaultTag: 'vault-123',
      totalDebt: 50000,
      totalCollateral: 0.001,
      currentPrice: 50000000,
    };

    (vaultService.fetchVaultData as jest.Mock).mockResolvedValue(mockVaultData);

    const { result } = renderHook(() => useVaultDataFetch(mockWallet));

    // First fetch
    await act(async () => {
      await result.current!.fetchVault();
    });

    expect(result.current!.vaultData).toEqual(mockVaultData);

    // Second fetch with same data - should not trigger re-render
    await act(async () => {
      await result.current!.fetchVault();
    });

    expect(result.current!.vaultData).toEqual(mockVaultData);
    expect(vaultService.fetchVaultData).toHaveBeenCalledTimes(2);
  });

  describe('fetchVaultTransactions', () => {
    const mockTransactions = [
      { timestamp: 1000, action: 'borrow', amount_borrowed: 100, vault_amount: 500, btc_amt: 0.01, unit_amt: 100, oracle_price: 50000 },
      { timestamp: 900, action: 'deposit', amount_borrowed: 0, vault_amount: 400, btc_amt: 0.02, unit_amt: 0, oracle_price: 50000 },
    ];

    it('should initialize with empty transactions', () => {
      const { result } = renderHook(() => useVaultDataFetch(mockWallet));

      expect(result.current!.vaultTransactions).toEqual([]);
      expect(result.current!.loadingVaultTransactions).toBe(false);
      expect(result.current!.vaultTransactionsIsRefreshing).toBe(false);
      expect(result.current!.vaultTransactionsLastUpdated).toBe(null);
      expect(result.current!.vaultTransactionsIsStale).toBe(false);
    });

    it('should fetch vault transactions successfully', async () => {
      (vaultService.fetchVaultHistory as jest.Mock).mockResolvedValue(mockTransactions);

      const { result } = renderHook(() => useVaultDataFetch(mockWallet));

      await act(async () => {
        await result.current!.fetchVaultTransactions();
      });

      expect(result.current!.vaultTransactions).toEqual(mockTransactions);
      expect(result.current!.loadingVaultTransactions).toBe(false);
      expect(result.current!.vaultTransactionsLastUpdated).toEqual(expect.any(Number));
      expect(result.current!.vaultTransactionsIsStale).toBe(false);
    });

    it('should show loading only on initial fetch', async () => {
      // Create a deferred promise to control when the fetch resolves
      let resolvePromise: (value: unknown) => void;
      const deferredPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (vaultService.fetchVaultHistory as jest.Mock).mockReturnValue(deferredPromise);

      const { result } = renderHook(() => useVaultDataFetch(mockWallet));

      // Start fetch but don't await yet
      let fetchPromise: Promise<void>;
      act(() => {
        fetchPromise = result.current!.fetchVaultTransactions();
      });

      // Loading should be true during initial fetch
      expect(result.current!.loadingVaultTransactions).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise(mockTransactions);
        await fetchPromise;
      });

      expect(result.current!.loadingVaultTransactions).toBe(false);
    });

    it('should not show loading on background refresh', async () => {
      (vaultService.fetchVaultHistory as jest.Mock).mockResolvedValue(mockTransactions);

      const { result } = renderHook(() => useVaultDataFetch(mockWallet));

      // First fetch
      await act(async () => {
        await result.current!.fetchVaultTransactions();
      });

      // Second fetch (background refresh) - should not show loading
      let loadingDuringRefresh = true;
      (vaultService.fetchVaultHistory as jest.Mock).mockImplementation(async () => {
        loadingDuringRefresh = result.current!.loadingVaultTransactions;
        return mockTransactions;
      });

      await act(async () => {
        await result.current!.fetchVaultTransactions();
      });

      expect(loadingDuringRefresh).toBe(false);
    });

    it('marks transaction background refreshes without showing the first-load loader', async () => {
      (vaultService.fetchVaultHistory as jest.Mock).mockResolvedValueOnce(mockTransactions);

      const { result } = renderHook(() => useVaultDataFetch(mockWallet));

      await act(async () => {
        await result.current!.fetchVaultTransactions();
      });

      let resolvePromise: (value: unknown) => void;
      const deferredPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      (vaultService.fetchVaultHistory as jest.Mock).mockReturnValueOnce(deferredPromise);

      let fetchPromise: Promise<void>;
      act(() => {
        fetchPromise = result.current!.fetchVaultTransactions();
      });

      expect(result.current!.loadingVaultTransactions).toBe(false);
      expect(result.current!.vaultTransactionsIsRefreshing).toBe(true);

      await act(async () => {
        resolvePromise(mockTransactions);
        await fetchPromise;
      });

      expect(result.current!.vaultTransactionsIsRefreshing).toBe(false);
    });

    it('should not fetch transactions when wallet is missing', async () => {
      const { result } = renderHook(() => useVaultDataFetch(null));

      await act(async () => {
        await result.current!.fetchVaultTransactions();
      });

      expect(vaultService.fetchVaultHistory).not.toHaveBeenCalled();
    });

    it('should not fetch transactions when taprootPubkey is missing', async () => {
      const incompleteWallet = { segwitAddress: 'bc1qtest' } as unknown as WalletAddresses;

      const { result } = renderHook(() => useVaultDataFetch(incompleteWallet));

      await act(async () => {
        await result.current!.fetchVaultTransactions();
      });

      expect(vaultService.fetchVaultHistory).not.toHaveBeenCalled();
    });

    it('should handle fetch transactions error gracefully', async () => {
      (vaultService.fetchVaultHistory as jest.Mock).mockRejectedValue(new Error('API error'));

      const { result } = renderHook(() => useVaultDataFetch(mockWallet));

      await act(async () => {
        await result.current!.fetchVaultTransactions();
      });

      // Should not throw, just log error
      expect(result.current!.vaultTransactions).toEqual([]);
      expect(result.current!.loadingVaultTransactions).toBe(false);
    });

    it('should update transactions when they have changed', async () => {
      const initialTransactions = [
        { timestamp: 1000, action: 'borrow', amount_borrowed: 100, vault_amount: 500, btc_amt: 0.01, unit_amt: 100, oracle_price: 50000 },
      ];
      const updatedTransactions = [
        { timestamp: 1100, action: 'repay', amount_borrowed: 50, vault_amount: 450, btc_amt: 0, unit_amt: 50, oracle_price: 51000 },
        { timestamp: 1000, action: 'borrow', amount_borrowed: 100, vault_amount: 500, btc_amt: 0.01, unit_amt: 100, oracle_price: 50000 },
      ];

      (vaultService.fetchVaultHistory as jest.Mock).mockResolvedValue(initialTransactions);

      const { result } = renderHook(() => useVaultDataFetch(mockWallet));

      await act(async () => {
        await result.current!.fetchVaultTransactions();
      });

      expect(result.current!.vaultTransactions).toEqual(initialTransactions);

      // Update with new transactions
      (vaultService.fetchVaultHistory as jest.Mock).mockResolvedValue(updatedTransactions);

      await act(async () => {
        await result.current!.fetchVaultTransactions();
      });

      expect(result.current!.vaultTransactions).toEqual(updatedTransactions);
    });

    it('should not update transactions when unchanged', async () => {
      (vaultService.fetchVaultHistory as jest.Mock).mockResolvedValue(mockTransactions);

      const { result } = renderHook(() => useVaultDataFetch(mockWallet));

      // First fetch
      await act(async () => {
        await result.current!.fetchVaultTransactions();
      });

      const firstResult = result.current!.vaultTransactions;

      // Second fetch with same data
      await act(async () => {
        await result.current!.fetchVaultTransactions();
      });

      // Should be the same reference (no update)
      expect(result.current!.vaultTransactions).toBe(firstResult);
    });

    it('should reset transactions when resetVaultData is called', async () => {
      (vaultService.fetchVaultHistory as jest.Mock).mockResolvedValue(mockTransactions);

      const { result } = renderHook(() => useVaultDataFetch(mockWallet));

      await act(async () => {
        await result.current!.fetchVaultTransactions();
      });

      expect(result.current!.vaultTransactions).toEqual(mockTransactions);

      act(() => {
        result.current!.resetVaultData();
      });

      expect(result.current!.vaultTransactions).toEqual([]);
    });
  });
});
