// @ts-nocheck
/**
 * Tests for VaultContext and vaultStore
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { VaultProvider, useVault } from '../VaultContext';
import { useVaultStore, resetVaultStore } from '../../stores/vaultStore';
import * as bitcoin from '../../utils/bitcoin';
import * as secureStorageService from '../../services/secureStorageService';

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
jest.mock('../../services/secureStorageService');
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

describe('VaultContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetVaultStore();
  });

  const mockAddresses = {
    segwitAddress: 'bc1qsegwit',
    segwitPubkey: 'segwit_pubkey',
    taprootAddress: 'bc1ptaproot',
    taprootPubkey: 'taproot_pubkey',
  };

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
    secureStorageService.withMnemonic.mockImplementation(async (callback) => {
      await callback('test mnemonic');
    });

    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={0}>
        {children}
      </VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });

    // Wait for credentials to load from the useEffect in VaultProvider
    await act(async () => {
      await Promise.resolve();
    });

    expect(bitcoin.deriveAddressesFromMnemonic).toHaveBeenCalledWith('test mnemonic', 0);
    expect(result.current.vaultCredentials).toEqual({
      satsAddress: mockAddresses.segwitAddress,
      satsPubkey: mockAddresses.segwitPubkey,
      runesAddress: mockAddresses.taprootAddress,
      runesPubkey: mockAddresses.taprootPubkey,
      vaultAddress: mockAddresses.taprootAddress,
      vaultPubkey: mockAddresses.taprootPubkey,
    });

    // Now open vault
    act(() => {
      result.current.openVault();
    });

    expect(result.current.activeTab).toBe('vault');
    expect(result.current.autoCreateVaultTrigger).toBe(0);
  });

  it('should open vault with auto-create flag', async () => {
    bitcoin.deriveAddressesFromMnemonic.mockReturnValue(mockAddresses);
    secureStorageService.withMnemonic.mockImplementation(async (callback) => {
      await callback('test mnemonic');
    });

    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={0}>
        {children}
      </VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });

    // Wait for credentials to load
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.openVault(true);
    });

    expect(result.current.autoCreateVaultTrigger).toBe(1);

    // Call again to increment
    act(() => {
      result.current.openVault(true);
    });

    expect(result.current.autoCreateVaultTrigger).toBe(2);
  });

  it('should use different account index', async () => {
    bitcoin.deriveAddressesFromMnemonic.mockReturnValue(mockAddresses);
    secureStorageService.withMnemonic.mockImplementation(async (callback) => {
      await callback('test mnemonic');
    });

    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={5}>
        {children}
      </VaultProvider>
    );
    renderHook(() => useVault(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(bitcoin.deriveAddressesFromMnemonic).toHaveBeenCalledWith('test mnemonic', 5);
  });

  it('should handle errors gracefully', async () => {
    secureStorageService.withMnemonic.mockRejectedValue(new Error('Mnemonic error'));

    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={0}>
        {children}
      </VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    // Credentials should remain null on error
    expect(result.current.vaultCredentials).toBe(null);
  });

  it('should not increment autoCreateVaultTrigger when credentials are null', async () => {
    secureStorageService.withMnemonic.mockRejectedValue(new Error('Mnemonic error'));

    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={0}>
        {children}
      </VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.autoCreateVaultTrigger).toBe(0);

    act(() => {
      result.current.openVault(true);
    });

    // Should not increment when credentials are null
    expect(result.current.autoCreateVaultTrigger).toBe(0);
  });

  it('should open vault without auto-create by default', async () => {
    bitcoin.deriveAddressesFromMnemonic.mockReturnValue(mockAddresses);
    secureStorageService.withMnemonic.mockImplementation(async (callback) => {
      await callback('test mnemonic');
    });

    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={0}>
        {children}
      </VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.openVault(false);
    });

    expect(result.current.autoCreateVaultTrigger).toBe(0);
  });

  it('should clear vault credentials and reset state', async () => {
    bitcoin.deriveAddressesFromMnemonic.mockReturnValue(mockAddresses);
    secureStorageService.withMnemonic.mockImplementation(async (callback) => {
      await callback('test mnemonic');
    });

    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={0}>
        {children}
      </VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });

    // Wait for credentials to load
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.vaultCredentials).not.toBe(null);

    // Open vault first
    act(() => {
      result.current.openVault();
    });
    expect(result.current.activeTab).toBe('vault');

    // Now clear credentials
    act(() => {
      result.current.clearVaultCredentials();
    });

    expect(result.current.vaultCredentials).toBe(null);
    expect(result.current.activeTab).toBe('wallet');
  });

  it('should retry loading credentials when vault tab opened without credentials', async () => {
    // First call fails, second succeeds (simulating retry)
    let callCount = 0;
    secureStorageService.withMnemonic.mockImplementation(async (callback) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Mnemonic not found');
      }
      await callback('test mnemonic');
    });
    bitcoin.deriveAddressesFromMnemonic.mockReturnValue(mockAddresses);

    jest.useFakeTimers();

    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={0}>
        {children}
      </VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });

    // Initial load should fail
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.vaultCredentials).toBe(null);

    // Switch to vault tab (should trigger retry after timeout)
    act(() => {
      result.current.setActiveTab('vault');
    });

    // Advance timers past the 500ms timeout
    await act(async () => {
      jest.advanceTimersByTime(600);
      await Promise.resolve();
    });

    // Credentials should now be loaded from retry
    expect(result.current.vaultCredentials).toEqual({
      satsAddress: mockAddresses.segwitAddress,
      satsPubkey: mockAddresses.segwitPubkey,
      runesAddress: mockAddresses.taprootAddress,
      runesPubkey: mockAddresses.taprootPubkey,
      vaultAddress: mockAddresses.taprootAddress,
      vaultPubkey: mockAddresses.taprootPubkey,
    });

    jest.useRealTimers();
  });

  it('should only retry once when vault tab opened without credentials', async () => {
    secureStorageService.withMnemonic.mockRejectedValue(new Error('Mnemonic not found'));

    jest.useFakeTimers();

    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={0}>
        {children}
      </VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });

    // Initial load fails
    await act(async () => {
      await Promise.resolve();
    });

    // Switch to vault tab
    act(() => {
      result.current.setActiveTab('vault');
    });

    // Advance timers to trigger retry
    await act(async () => {
      jest.advanceTimersByTime(600);
      await Promise.resolve();
    });

    // Clear mocks to track additional calls
    secureStorageService.withMnemonic.mockClear();

    // Switch away and back to vault - should not retry again
    act(() => {
      result.current.setActiveTab('wallet');
    });
    act(() => {
      result.current.setActiveTab('vault');
    });

    await act(async () => {
      jest.advanceTimersByTime(600);
      await Promise.resolve();
    });

    // Should not have retried again (hasRetried flag prevents it)
    expect(secureStorageService.withMnemonic).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should log error when retry fails with non-mnemonic error', async () => {
    const { logger } = require('../../utils/logger');
    secureStorageService.withMnemonic.mockRejectedValue(new Error('Some other error'));

    jest.useFakeTimers();

    const wrapper = ({ children }) => (
      <VaultProvider currentAccount={0}>
        {children}
      </VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });

    // Initial load fails with different error
    await act(async () => {
      await Promise.resolve();
    });

    // Clear logger mocks from initial load
    logger.error.mockClear();

    // Switch to vault tab to trigger retry
    act(() => {
      result.current.setActiveTab('vault');
    });

    // Advance timers to trigger retry
    await act(async () => {
      jest.advanceTimersByTime(600);
      await Promise.resolve();
    });

    // Should have logged the non-mnemonic error
    expect(logger.error).toHaveBeenCalled();

    jest.useRealTimers();
  });
});

describe('vaultStore direct usage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetVaultStore();
  });

  const mockAddresses = {
    segwitAddress: 'bc1qsegwit',
    segwitPubkey: 'segwit_pubkey',
    taprootAddress: 'bc1ptaproot',
    taprootPubkey: 'taproot_pubkey',
  };

  it('should work without provider using Zustand store directly', async () => {
    bitcoin.deriveAddressesFromMnemonic.mockReturnValue(mockAddresses);
    secureStorageService.withMnemonic.mockImplementation(async (callback) => {
      await callback('test mnemonic');
    });

    // Get initial state
    expect(useVaultStore.getState().activeTab).toBe('wallet');
    expect(useVaultStore.getState().vaultCredentials).toBe(null);

    // Load credentials directly
    await act(async () => {
      await useVaultStore.getState().loadCredentials(0);
    });

    expect(useVaultStore.getState().vaultCredentials).not.toBe(null);

    // Open vault
    act(() => {
      useVaultStore.getState().openVault(true);
    });

    expect(useVaultStore.getState().activeTab).toBe('vault');
    expect(useVaultStore.getState().autoCreateVaultTrigger).toBe(1);
  });
});
