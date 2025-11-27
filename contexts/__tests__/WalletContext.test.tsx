// @ts-nocheck
/**
 * Tests for WalletContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { WalletProvider, useWallet} from '../WalletContext';

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
import * as WalletService from '../../services/walletService';
import * as SecureStore from 'expo-secure-store';
import * as p2pk from '../../services/cashu/p2pk';

jest.mock('../../services/walletService');
jest.mock('expo-secure-store');
jest.mock('../../services/cashu/p2pk');
jest.mock('../NotificationContext', () => ({
  useNotifications: () => ({
    showToast: jest.fn(),
  }),
}));

describe('WalletContext', () => {
  const wrapper = ({ children }) => <WalletProvider>{children}</WalletProvider>;

  const mockAddresses = {
    segwitAddress: 'tb1qtest',
    taprootAddress: 'tb1ptest',
    taprootPubkey: 'pubkey123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock clearP2PKCache to return resolved promise by default
    (p2pk.clearP2PKCache as jest.Mock).mockResolvedValue(undefined);
  });

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useWallet());
    }).toThrow('useWallet must be used within a WalletProvider');

    consoleError.mockRestore();
  });

  it('should provide initial state', () => {
    const { result } = renderHook(() => useWallet(), { wrapper });

    expect(result.current.wallet).toBeNull();
    expect(result.current.currentAccount).toBe(0);
  });

  it('should load wallet from storage successfully', async () => {
    WalletService.loadWalletFromStorage.mockResolvedValueOnce({
      addresses: mockAddresses,
      accountIndex: 0,
    });

    const { result } = renderHook(() => useWallet(), { wrapper });

    let loadResult;
    await act(async () => {
      loadResult = await result.current.loadWallet();
    });

    expect(loadResult).toEqual({
      exists: true,
      addresses: mockAddresses,
    });
    expect(result.current.wallet).toEqual(mockAddresses);
    expect(result.current.currentAccount).toBe(0);
  });

  it('should handle wallet not existing in storage', async () => {
    WalletService.loadWalletFromStorage.mockResolvedValueOnce({
      addresses: null,
      accountIndex: 0,
    });

    const { result } = renderHook(() => useWallet(), { wrapper });

    let loadResult;
    await act(async () => {
      loadResult = await result.current.loadWallet();
    });

    expect(loadResult).toEqual({ exists: false });
    expect(result.current.wallet).toBeNull();
  });

  it('should handle load wallet error', async () => {
    WalletService.loadWalletFromStorage.mockRejectedValueOnce(new Error('Load error'));

    const { result } = renderHook(() => useWallet(), { wrapper });

    let loadResult;
    await act(async () => {
      loadResult = await result.current.loadWallet();
    });

    expect(loadResult).toEqual({ exists: false });
  });

  it('should set wallet addresses', () => {
    const { result } = renderHook(() => useWallet(), { wrapper });

    act(() => {
      result.current.setWalletAddresses(mockAddresses, 2);
    });

    expect(result.current.wallet).toEqual(mockAddresses);
    expect(result.current.currentAccount).toBe(2);
  });

  it('should set wallet addresses with default account index', () => {
    const { result } = renderHook(() => useWallet(), { wrapper });

    act(() => {
      result.current.setWalletAddresses(mockAddresses);
    });

    expect(result.current.currentAccount).toBe(0);
  });

  it('should reset wallet', () => {
    const { result } = renderHook(() => useWallet(), { wrapper });

    // First set wallet
    act(() => {
      result.current.setWalletAddresses(mockAddresses, 5);
    });

    expect(result.current.wallet).toEqual(mockAddresses);

    // Then reset
    act(() => {
      result.current.resetWallet();
    });

    expect(result.current.wallet).toBeNull();
    expect(result.current.currentAccount).toBe(0);
  });

  it('should switch account successfully', async () => {
    const newAddresses = {
      segwitAddress: 'tb1qnewtest',
      taprootAddress: 'tb1pnewtest',
      taprootPubkey: 'newpubkey123',
    };

    WalletService.switchToAccount.mockResolvedValueOnce({
      addresses: newAddresses,
    });
    SecureStore.setItemAsync.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useWallet(), { wrapper });

    let switchResult;
    await act(async () => {
      switchResult = await result.current.switchAccount(1);
    });

    expect(switchResult).toEqual(newAddresses);
    expect(result.current.wallet).toEqual(newAddresses);
    expect(result.current.currentAccount).toBe(1);
    // Note: SecureStore.setItemAsync is now called in WalletService.switchToAccount, not in WalletContext
  });

  it('should throw error when switching to account with no addresses', async () => {
    WalletService.switchToAccount.mockResolvedValueOnce({
      addresses: null,
    });

    const { result } = renderHook(() => useWallet(), { wrapper });

    await expect(
      act(async () => {
        await result.current.switchAccount(1);
      })
    ).rejects.toThrow('No wallet found');
  });

  it('should propagate switch account error', async () => {
    WalletService.switchToAccount.mockRejectedValueOnce(new Error('Switch error'));

    const { result } = renderHook(() => useWallet(), { wrapper });

    await expect(
      act(async () => {
        await result.current.switchAccount(1);
      })
    ).rejects.toThrow('Switch error');
  });

  it('should load wallet with different account index', async () => {
    WalletService.loadWalletFromStorage.mockResolvedValueOnce({
      addresses: mockAddresses,
      accountIndex: 3,
    });

    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await result.current.loadWallet();
    });

    expect(result.current.currentAccount).toBe(3);
  });

  it('should handle P2PK cache clear error in resetWallet', async () => {
    // Mock clearP2PKCache to throw error
    (p2pk.clearP2PKCache as jest.Mock).mockRejectedValueOnce(new Error('Cache clear failed'));

    const { result } = renderHook(() => useWallet(), { wrapper });

    // Should not throw even if clearP2PKCache fails
    await act(async () => {
      await result.current.resetWallet();
    });

    expect(result.current.wallet).toBeNull();
    expect(p2pk.clearP2PKCache).toHaveBeenCalled();
  });

  it('should handle P2PK cache clear error in switchAccount', async () => {
    const newAddresses = {
      segwitAddress: 'tb1qnewtest',
      taprootAddress: 'tb1pnewtest',
      taprootPubkey: 'newpubkey123',
    };

    WalletService.switchToAccount.mockResolvedValueOnce({
      addresses: newAddresses,
    });

    // Mock clearP2PKCache to throw error after switch
    (p2pk.clearP2PKCache as jest.Mock).mockRejectedValueOnce(new Error('Cache clear failed'));

    const { result } = renderHook(() => useWallet(), { wrapper });

    // Should not throw even if clearP2PKCache fails
    let switchResult;
    await act(async () => {
      switchResult = await result.current.switchAccount(1);
      // Wait for the fire-and-forget clearP2PKCache call
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(switchResult).toEqual(newAddresses);
    expect(result.current.wallet).toEqual(newAddresses);
  });
});
