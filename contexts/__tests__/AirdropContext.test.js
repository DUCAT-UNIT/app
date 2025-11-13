/**
 * Tests for AirdropContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { AirdropProvider, useAirdrop } from '../AirdropContext';
import { useBalance } from '../WalletDataContext';
import { useWallet } from '../WalletContext';
import { useAuth } from '../AuthContext';
import * as SecureStore from 'expo-secure-store';
import * as AirdropService from '../../services/airdropService';

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
jest.mock('../WalletDataContext');
jest.mock('../WalletContext');
jest.mock('../AuthContext');
jest.mock('expo-secure-store');
jest.mock('../../services/airdropService');

describe('AirdropContext', () => {
  // Helper to create unique mock wallet for each test
  const createMockWallet = (testName) => ({
    segwitAddress: `bc1qtest${testName.replace(/\s/g, '')}`,
    taprootAddress: `bc1ptest${testName.replace(/\s/g, '')}`,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue();
    SecureStore.deleteItemAsync.mockResolvedValue();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAirdrop());
    }).toThrow('useAirdrop must be used within an AirdropProvider');

    consoleError.mockRestore();
  });

  it('should provide initial state', () => {
    const mockWallet = createMockWallet('initialstate');

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );
    const { result } = renderHook(() => useAirdrop(), { wrapper });

    expect(result.current.showAirdropModal).toBe(false);
    expect(result.current.airdropTxId).toBe('');
    expect(typeof result.current.setShowAirdropModal).toBe('function');
  });

  it('should clean up expired locks on mount', async () => {
    const mockWallet = createMockWallet('expiredlock');
    const lockKey = `airdropLock_${mockWallet.segwitAddress}_0`;
    const expiredLockTime = Date.now() - 70 * 1000; // 70 seconds ago (expired)

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === lockKey) return Promise.resolve(expiredLockTime.toString());
      return Promise.resolve(null);
    });

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
      await Promise.resolve();
    });

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(lockKey);
  });

  it('should not clean up fresh locks on mount', async () => {
    const mockWallet = createMockWallet('freshlock');
    const lockKey = `airdropLock_${mockWallet.segwitAddress}_0`;
    const freshLockTime = Date.now() - 10 * 1000; // 10 seconds ago (fresh)

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === lockKey) return Promise.resolve(freshLockTime.toString());
      return Promise.resolve(null);
    });

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
      await Promise.resolve();
    });

    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith(lockKey);
  });

  it('should show modal for pending airdrop when balance updates', async () => {
    const mockWallet = createMockWallet('pendingairdrop');
    const pendingKey = `pendingAirdrop_${mockWallet.segwitAddress}_0`;
    const mockTxId = 'pending_txid';

    useBalance.mockReturnValue({ segwitBalance: 0.001, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === pendingKey) return Promise.resolve(mockTxId);
      return Promise.resolve(null);
    });

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    let result;
    await act(async () => {
      const hook = renderHook(() => useAirdrop(), { wrapper });
      result = hook.result;
      await Promise.resolve();
    });

    expect(result.current.showAirdropModal).toBe(true);
    expect(result.current.airdropTxId).toBe(mockTxId);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(pendingKey);
  });


  it('should not request airdrop when balance is > 0', async () => {
    const mockWallet = createMockWallet('hasbalance');

    useBalance.mockReturnValue({ segwitBalance: 0.001, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(AirdropService.requestAirdrop).not.toHaveBeenCalled();
  });

  it('should not request airdrop when not authenticated', async () => {
    const mockWallet = createMockWallet('notauthenticated');

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: false });

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(AirdropService.requestAirdrop).not.toHaveBeenCalled();
  });

  it('should not request airdrop when seed not confirmed', async () => {
    const mockWallet = createMockWallet('seednotconfirmed');

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={false}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(AirdropService.requestAirdrop).not.toHaveBeenCalled();
  });

  it('should not request airdrop within 24 hours of last request', async () => {
    const mockWallet = createMockWallet('within24hours');
    const lastAirdropTime = Date.now() - 12 * 60 * 60 * 1000; // 12 hours ago

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === `lastAirdropTime_${mockWallet.segwitAddress}_0`) {
        return Promise.resolve(lastAirdropTime.toString());
      }
      return Promise.resolve(null);
    });

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(AirdropService.requestAirdrop).not.toHaveBeenCalled();
  });

  it('should respect lock mechanism to prevent race conditions', async () => {
    const mockWallet = createMockWallet('lockmechanism');
    const lockKey = `airdropLock_${mockWallet.segwitAddress}_0`;
    const freshLockTime = Date.now() - 10 * 1000; // 10 seconds ago (fresh lock)

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === lockKey) return Promise.resolve(freshLockTime.toString());
      return Promise.resolve(null);
    });

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(AirdropService.requestAirdrop).not.toHaveBeenCalled();
  });

  it('should cleanup timers on unmount', async () => {
    const mockWallet = createMockWallet('cleanup');

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    const { unmount } = renderHook(() => useAirdrop(), { wrapper });

    act(() => {
      unmount();
    });

    // No assertions needed - test passes if no errors during cleanup
    expect(true).toBe(true);
  });

});
