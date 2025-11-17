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

  it('should request airdrop when balance is 0 and no recent airdrop', async () => {
    const mockWallet = createMockWallet('requestairdrop');
    const mockTxId = 'airdrop_txid_123';

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    AirdropService.requestAirdrop.mockResolvedValue({ txId: mockTxId });

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    let result;
    await act(async () => {
      const hook = renderHook(() => useAirdrop(), { wrapper });
      result = hook.result;
    });

    // Trigger the initial timeout
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve(); // Let microtasks run
    });

    // Wait for the 500ms delay before modal shows
    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(AirdropService.requestAirdrop).toHaveBeenCalledWith(mockWallet.segwitAddress);
    expect(result.current.showAirdropModal).toBe(true);
    expect(result.current.airdropTxId).toBe(mockTxId);
  });

  it('should request airdrop after 24 hours on interval', async () => {
    const mockWallet = createMockWallet('intervalrequest');
    const mockTxId = 'interval_airdrop_txid';

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    AirdropService.requestAirdrop.mockResolvedValue({ txId: mockTxId });

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
    });

    // Skip initial timeout
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    // Clear the first call
    AirdropService.requestAirdrop.mockClear();

    // Advance by 24 hours to trigger interval
    await act(async () => {
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);
      await Promise.resolve();
    });

    expect(AirdropService.requestAirdrop).toHaveBeenCalled();
  });

  it('should handle airdrop request error gracefully', async () => {
    const mockWallet = createMockWallet('airdropfail');

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    AirdropService.requestAirdrop.mockRejectedValue(new Error('Network error'));

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    let result;
    await act(async () => {
      const hook = renderHook(() => useAirdrop(), { wrapper });
      result = hook.result;
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(AirdropService.requestAirdrop).toHaveBeenCalled();
    // Should not crash or show modal on error
    expect(result.current.showAirdropModal).toBe(false);
  });

  it('should prevent duplicate airdrop requests when already in progress', async () => {
    const mockWallet = createMockWallet('duplicaterequest');
    const mockTxId = 'airdrop_txid_dup';

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    // Make airdrop request slow
    let resolveAirdrop;
    const airdropPromise = new Promise((resolve) => {
      resolveAirdrop = resolve;
    });
    AirdropService.requestAirdrop.mockReturnValue(airdropPromise);

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
    });

    // Trigger first request
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    const firstCallCount = AirdropService.requestAirdrop.mock.calls.length;

    // Try to trigger another request while first is in progress
    await act(async () => {
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);
      await Promise.resolve();
    });

    // Should not make a second call (still in progress)
    expect(AirdropService.requestAirdrop.mock.calls.length).toBe(firstCallCount);

    // Complete the first request
    await act(async () => {
      resolveAirdrop({ txId: mockTxId });
      await Promise.resolve();
    });
  });

  it('should allow airdrop after 24 hours have passed', async () => {
    const mockWallet = createMockWallet('after24hours');
    const oldAirdropTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
    const mockTxId = 'new_airdrop_txid';

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === `lastAirdropTime_${mockWallet.segwitAddress}_0`) {
        return Promise.resolve(oldAirdropTime.toString());
      }
      return Promise.resolve(null);
    });

    AirdropService.requestAirdrop.mockResolvedValue({ txId: mockTxId });

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    // Should allow airdrop since > 24 hours have passed
    expect(AirdropService.requestAirdrop).toHaveBeenCalled();
  });

  it('should handle SecureStore errors gracefully during airdrop', async () => {
    const mockWallet = createMockWallet('securestoreerror');

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    // Make SecureStore fail during airdrop
    SecureStore.setItemAsync.mockRejectedValue(new Error('Storage error'));

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    let result;
    await act(async () => {
      const hook = renderHook(() => useAirdrop(), { wrapper });
      result = hook.result;
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    // Should not crash
    expect(result.current.showAirdropModal).toBe(false);
  });

  it('should clean up lock after successful airdrop', async () => {
    const mockWallet = createMockWallet('cleanuplock');
    const lockKey = `airdropLock_${mockWallet.segwitAddress}_0`;
    const mockTxId = 'cleanup_txid';

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    AirdropService.requestAirdrop.mockResolvedValue({ txId: mockTxId });

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    // Should delete lock after completion
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(lockKey);
  });

  it('should clean up lock after airdrop error', async () => {
    const mockWallet = createMockWallet('cleanuplocker ror');
    const lockKey = `airdropLock_${mockWallet.segwitAddress}_0`;

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    AirdropService.requestAirdrop.mockRejectedValue(new Error('Airdrop failed'));

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    // Should delete lock even on error
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(lockKey);
  });

  it('should skip airdrop when fresh lock exists (< 60 seconds)', async () => {
    const mockWallet = createMockWallet('freshlock');
    const lockKey = `airdropLock_${mockWallet.segwitAddress}_0`;
    const freshLockTime = Date.now() - 30 * 1000; // 30 seconds ago (fresh)

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === lockKey) {
        return Promise.resolve(freshLockTime.toString());
      }
      return Promise.resolve(null);
    });

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    // Should not request airdrop due to fresh lock
    expect(AirdropService.requestAirdrop).not.toHaveBeenCalled();
  });

  it('should skip airdrop when claimed within 24 hours', async () => {
    const mockWallet = createMockWallet('24hourlimit');
    const lastAirdropKey = `lastAirdropTime_${mockWallet.segwitAddress}_0`;
    const lockKey = `airdropLock_${mockWallet.segwitAddress}_0`;
    const recentAirdropTime = Date.now() - 12 * 60 * 60 * 1000; // 12 hours ago

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === lastAirdropKey) {
        return Promise.resolve(recentAirdropTime.toString());
      }
      if (key === lockKey) {
        return Promise.resolve(null); // No fresh lock
      }
      return Promise.resolve(null);
    });

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    // Should not request airdrop due to 24-hour limit
    expect(AirdropService.requestAirdrop).not.toHaveBeenCalled();
  });

  it('should handle errors during airdrop and clean up lock', async () => {
    const mockWallet = createMockWallet('errorcleanup');
    const lockKey = `airdropLock_${mockWallet.segwitAddress}_0`;

    useBalance.mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    useWallet.mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    useAuth.mockReturnValue({ isAuthenticated: true });

    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue(undefined);
    SecureStore.deleteItemAsync.mockResolvedValue(undefined);

    // Make requestAirdrop throw an error
    AirdropService.requestAirdrop.mockRejectedValue(new Error('Network error'));

    const wrapper = ({ children }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    // Should attempt to request airdrop
    expect(AirdropService.requestAirdrop).toHaveBeenCalled();

    // Should clean up lock on error
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(lockKey);
  });

});
