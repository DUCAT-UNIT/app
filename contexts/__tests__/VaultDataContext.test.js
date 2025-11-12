/**
 * Tests for VaultDataContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { VaultDataProvider, useVaultData } from '../VaultDataContext';
import { useWallet } from '../WalletContext';
import * as vaultService from '../../services/vaultService';

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
jest.mock('../../services/vaultService');

describe('VaultDataContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockWallet = {
    taprootPubkey: 'taproot_pubkey_test',
    taprootAddress: 'bc1ptaproot',
  };

  const mockVaultData = {
    balance: 100000,
    transactions: [],
    status: 'active',
  };

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useVaultData());
    }).toThrow('useWalletData must be used within a WalletDataProvider');

    consoleError.mockRestore();
  });

  it('should provide initial state', () => {
    useWallet.mockReturnValue({ wallet: null });

    const wrapper = ({ children }) => <VaultDataProvider>{children}</VaultDataProvider>;
    const { result } = renderHook(() => useVaultData(), { wrapper });

    expect(result.current.vaultData).toBe(null);
    expect(result.current.loadingVault).toBe(false);
    expect(typeof result.current.fetchVault).toBe('function');
    expect(typeof result.current.resetVaultData).toBe('function');
  });

  it('should fetch vault data on mount when wallet exists', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    vaultService.fetchVaultData.mockResolvedValue(mockVaultData);

    const wrapper = ({ children }) => <VaultDataProvider>{children}</VaultDataProvider>;
    const { result } = renderHook(() => useVaultData(), { wrapper });

    // Wait for the async effect to complete
    await act(async () => {
      await Promise.resolve();
    });

    expect(vaultService.fetchVaultData).toHaveBeenCalledWith(mockWallet.taprootPubkey);
    expect(result.current.vaultData).toEqual(mockVaultData);
    expect(result.current.loadingVault).toBe(false);
  });

  it('should auto-refresh vault data every 10 seconds', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    vaultService.fetchVaultData.mockResolvedValue(mockVaultData);

    const wrapper = ({ children }) => <VaultDataProvider>{children}</VaultDataProvider>;
    renderHook(() => useVaultData(), { wrapper });

    // Initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    expect(vaultService.fetchVaultData).toHaveBeenCalledTimes(1);

    // Advance 10 seconds
    await act(async () => {
      jest.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    expect(vaultService.fetchVaultData).toHaveBeenCalledTimes(2);

    // Advance another 10 seconds
    await act(async () => {
      jest.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    expect(vaultService.fetchVaultData).toHaveBeenCalledTimes(3);
  });

  it('should reset vault data when wallet is null', async () => {
    useWallet.mockReturnValue({ wallet: null });

    const wrapper = ({ children }) => <VaultDataProvider>{children}</VaultDataProvider>;
    const { result } = renderHook(() => useVaultData(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.vaultData).toBe(null);
    expect(vaultService.fetchVaultData).not.toHaveBeenCalled();
  });

  it('should handle fetchVault errors gracefully', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    vaultService.fetchVaultData.mockRejectedValue(new Error('Network error'));

    const wrapper = ({ children }) => <VaultDataProvider>{children}</VaultDataProvider>;
    const { result } = renderHook(() => useVaultData(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    // Should set vault data to null on error
    expect(result.current.vaultData).toBe(null);
    expect(result.current.loadingVault).toBe(false);
  });

  it('should manually fetch vault data', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    const newVaultData = { ...mockVaultData, balance: 200000 };
    vaultService.fetchVaultData
      .mockResolvedValueOnce(mockVaultData)
      .mockResolvedValueOnce(newVaultData);

    const wrapper = ({ children }) => <VaultDataProvider>{children}</VaultDataProvider>;
    const { result } = renderHook(() => useVaultData(), { wrapper });

    // Wait for initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.vaultData).toEqual(mockVaultData);

    // Clear previous calls
    vaultService.fetchVaultData.mockClear();

    // Manual fetch
    await act(async () => {
      await result.current.fetchVault();
    });

    expect(vaultService.fetchVaultData).toHaveBeenCalledTimes(1);
    expect(result.current.vaultData).toEqual(newVaultData);
  });

  it('should reset vault data manually', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    vaultService.fetchVaultData.mockResolvedValue(mockVaultData);

    const wrapper = ({ children }) => <VaultDataProvider>{children}</VaultDataProvider>;
    const { result } = renderHook(() => useVaultData(), { wrapper });

    // Wait for initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.vaultData).toEqual(mockVaultData);

    // Reset vault data
    act(() => {
      result.current.resetVaultData();
    });

    expect(result.current.vaultData).toBe(null);
  });

  it('should not fetch vault data if taprootPubkey is missing', async () => {
    useWallet.mockReturnValue({ wallet: { taprootPubkey: null } });

    const wrapper = ({ children }) => <VaultDataProvider>{children}</VaultDataProvider>;
    renderHook(() => useVaultData(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(vaultService.fetchVaultData).not.toHaveBeenCalled();
  });

  it('should cleanup interval on unmount', async () => {
    useWallet.mockReturnValue({ wallet: mockWallet });
    vaultService.fetchVaultData.mockResolvedValue(mockVaultData);

    const wrapper = ({ children }) => <VaultDataProvider>{children}</VaultDataProvider>;
    const { unmount } = renderHook(() => useVaultData(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    const callCount = vaultService.fetchVaultData.mock.calls.length;

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
    expect(vaultService.fetchVaultData).toHaveBeenCalledTimes(callCount);
  });
});
