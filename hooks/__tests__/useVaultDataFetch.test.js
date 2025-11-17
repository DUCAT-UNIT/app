/**
 * Tests for useVaultDataFetch hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useVaultDataFetch } from '../useVaultDataFetch';
import * as vaultService from '../../services/vaultService';

// Mock vault service
jest.mock('../../services/vaultService');

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

describe('useVaultDataFetch', () => {
  const mockWallet = {
    taprootPubkey: 'pubkey123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useVaultDataFetch(mockWallet));

    expect(result.current.vaultData).toBe(null);
    expect(result.current.loadingVault).toBe(false);
    expect(result.current.vaultError).toBe(null);
  });

  it('should fetch vault data successfully', async () => {
    const mockVaultData = {
      vaultTag: 'vault-123',
      totalDebt: 50000,
      totalCollateral: 0.001,
      currentPrice: 50000000,
      healthRatio: 200,
    };

    vaultService.fetchVaultData.mockResolvedValue(mockVaultData);

    const { result } = renderHook(() => useVaultDataFetch(mockWallet));

    await act(async () => {
      await result.current.fetchVault();
    });

    expect(result.current.vaultData).toEqual(mockVaultData);
    expect(result.current.vaultError).toBe(null);
    expect(result.current.loadingVault).toBe(false);
  });

  it('should handle vault fetch error', async () => {
    vaultService.fetchVaultData.mockRejectedValue(new Error('Vault API error'));

    const { result } = renderHook(() => useVaultDataFetch(mockWallet));

    await act(async () => {
      await result.current.fetchVault();
    });

    expect(result.current.vaultError).toBe('Failed to fetch vault data');
    expect(result.current.loadingVault).toBe(false);
  });

  it('should not fetch when wallet is missing', async () => {
    const { result } = renderHook(() => useVaultDataFetch(null));

    await act(async () => {
      await result.current.fetchVault();
    });

    expect(vaultService.fetchVaultData).not.toHaveBeenCalled();
  });

  it('should not fetch when taprootPubkey is missing', async () => {
    const incompleteWallet = {
      segwitAddress: 'bc1qtest',
      // Missing taprootPubkey
    };

    const { result } = renderHook(() => useVaultDataFetch(incompleteWallet));

    await act(async () => {
      await result.current.fetchVault();
    });

    expect(vaultService.fetchVaultData).not.toHaveBeenCalled();
  });

  it('should reset vault data', () => {
    const { result } = renderHook(() => useVaultDataFetch(mockWallet));

    act(() => {
      result.current.resetVaultData();
    });

    expect(result.current.vaultData).toBe(null);
  });

  it('should handle null vault data (no vault exists)', async () => {
    vaultService.fetchVaultData.mockResolvedValue(null);

    const { result } = renderHook(() => useVaultDataFetch(mockWallet));

    await act(async () => {
      await result.current.fetchVault();
    });

    expect(result.current.vaultData).toBe(null);
    expect(result.current.vaultError).toBe(null);
    expect(result.current.loadingVault).toBe(false);
  });
});
