/**
 * Tests for VaultContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { VaultProvider, useVault } from '../VaultContext';
import * as bitcoin from '../../utils/bitcoin';
import * as authService from '../../services/authService';

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
jest.mock('../../utils/bitcoin');
jest.mock('../../services/authService');

describe('VaultContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockAddresses = {
    segwitAddress: 'bc1qsegwit',
    segwitPubkey: 'segwit_pubkey',
    taprootAddress: 'bc1ptaproot',
    taprootPubkey: 'taproot_pubkey',
  };

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useVault());
    }).toThrow('useVault must be used within a VaultProvider');

    consoleError.mockRestore();
  });

  it('should provide initial state', () => {
    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={0}>
        {children}
      </VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });

    expect(result.current.vaultCredentials).toBe(null);
    expect(result.current.autoCreateVaultTrigger).toBe(0);
    expect(result.current.activeTab).toBe('wallet');
  });

  it('should set active tab', () => {
    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={0}>
        {children}
      </VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });

    expect(result.current.activeTab).toBe('wallet');

    act(() => {
      result.current.setActiveTab('vault');
    });

    expect(result.current.activeTab).toBe('vault');
  });

  it('should open vault and set credentials', async () => {
    bitcoin.deriveAddressesFromMnemonic.mockReturnValue(mockAddresses);
    authService.withMnemonic.mockImplementation(async (callback) => {
      await callback('test mnemonic');
    });

    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={0}>
        {children}
      </VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });

    await act(async () => {
      await result.current.openVault();
    });

    expect(result.current.activeTab).toBe('vault');
    expect(bitcoin.deriveAddressesFromMnemonic).toHaveBeenCalledWith('test mnemonic', 0);
    expect(result.current.vaultCredentials).toEqual({
      satsAddress: mockAddresses.segwitAddress,
      satsPubkey: mockAddresses.segwitPubkey,
      runesAddress: mockAddresses.taprootAddress,
      runesPubkey: mockAddresses.taprootPubkey,
      vaultAddress: mockAddresses.taprootAddress,
      vaultPubkey: mockAddresses.taprootPubkey,
    });
    expect(result.current.autoCreateVaultTrigger).toBe(0);
  });

  it('should open vault with auto-create flag', async () => {
    bitcoin.deriveAddressesFromMnemonic.mockReturnValue(mockAddresses);
    authService.withMnemonic.mockImplementation(async (callback) => {
      await callback('test mnemonic');
    });

    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={0}>
        {children}
      </VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });

    await act(async () => {
      await result.current.openVault(true);
    });

    expect(result.current.autoCreateVaultTrigger).toBe(1);

    // Call again to increment
    await act(async () => {
      await result.current.openVault(true);
    });

    expect(result.current.autoCreateVaultTrigger).toBe(2);
  });

  it('should use different account index', async () => {
    bitcoin.deriveAddressesFromMnemonic.mockReturnValue(mockAddresses);
    authService.withMnemonic.mockImplementation(async (callback) => {
      await callback('test mnemonic');
    });

    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={5}>
        {children}
      </VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });

    await act(async () => {
      await result.current.openVault();
    });

    expect(bitcoin.deriveAddressesFromMnemonic).toHaveBeenCalledWith('test mnemonic', 5);
  });

  it('should handle errors gracefully and still switch to vault tab', async () => {
    authService.withMnemonic.mockRejectedValue(new Error('Mnemonic error'));

    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={0}>
        {children}
      </VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });

    await act(async () => {
      await result.current.openVault();
    });

    // Should still switch to vault tab even on error
    expect(result.current.activeTab).toBe('vault');
    // Credentials should remain null on error
    expect(result.current.vaultCredentials).toBe(null);
  });

  it('should not increment autoCreateVaultTrigger on error', async () => {
    authService.withMnemonic.mockRejectedValue(new Error('Mnemonic error'));

    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={0}>
        {children}
      </VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });

    expect(result.current.autoCreateVaultTrigger).toBe(0);

    await act(async () => {
      await result.current.openVault(true);
    });

    // Should not increment on error
    expect(result.current.autoCreateVaultTrigger).toBe(0);
  });

  it('should open vault without auto-create by default', async () => {
    bitcoin.deriveAddressesFromMnemonic.mockReturnValue(mockAddresses);
    authService.withMnemonic.mockImplementation(async (callback) => {
      await callback('test mnemonic');
    });

    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={0}>
        {children}
      </VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });

    await act(async () => {
      await result.current.openVault(false);
    });

    expect(result.current.autoCreateVaultTrigger).toBe(0);
  });
});
