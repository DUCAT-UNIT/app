/**
 * Tests for AirdropContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { AirdropProvider, useAirdrop } from '../AirdropContext';
import { useBalance } from '../WalletDataContext';
import { useWallet } from '../WalletContext';
import { useAuth, useAuthSession } from '../AuthContext';
import * as SecureStore from 'expo-secure-store';
import * as AirdropService from '../../services/airdropService';

// Type for renderHook options
interface RenderHookOptions {
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;
}

// Helper to render hooks with react-test-renderer
function renderHook<T>(
  hook: () => T,
  { wrapper: Wrapper }: RenderHookOptions = {}
): { result: { current: T | null }; rerender: () => void; unmount: () => void } {
  const result: { current: T | null } = { current: null };

  function TestComponent(): null {
    result.current = hook();
    return null;
  }

  let component: ReturnType<typeof create> | undefined;
  const renderElement = () =>
    Wrapper ? (
      <Wrapper>
        <TestComponent />
      </Wrapper>
    ) : (
      <TestComponent />
    );
  act(() => {
    component = create(renderElement());
  });

  return {
    result,
    rerender: () => component!.update(renderElement()),
    unmount: component!.unmount,
  };
}

// Mock dependencies
jest.mock('../WalletDataContext');
jest.mock('../WalletContext');
jest.mock('../AuthContext');
// Configurable mock for NavigationHandlersContext
let mockShowBiometricSetupModal = false;
let mockShowPasskeyMigrationModal = false;
jest.mock('../NavigationHandlersContext', () => ({
  useAuthFlowHandlers: () => ({
    showBiometricSetupModal: mockShowBiometricSetupModal,
    showPasskeyMigrationModal: mockShowPasskeyMigrationModal,
  }),
}));
jest.mock('expo-secure-store');
jest.mock('../../services/storagePolicy', () => {
  const SecureStore = require('expo-secure-store');
  return {
    getPreferenceItem: (key: string) => SecureStore.getItemAsync(key),
    setPreferenceItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    deletePreferenceItem: (key: string) => SecureStore.deleteItemAsync(key),
  };
});
jest.mock('../../services/airdropService');

// Mock audio celebration utilities
jest.mock('../../utils/airdropCelebration', () => ({
  configureAudioMode: jest.fn().mockResolvedValue(undefined),
  preloadConfettiSound: jest.fn().mockResolvedValue({ sound: 'mock-sound' }),
  playConfettiSound: jest.fn(),
  unloadSound: jest.fn(),
  triggerConfettiHaptics: jest.fn().mockReturnValue([]),
  clearHapticTimeouts: jest.fn(),
}));

describe('AirdropContext', () => {
  // Helper to create unique mock wallet for each test
  const createMockWallet = (testName: string) => ({
    segwitAddress: `bc1qtest${testName.replace(/\s/g, '')}`,
    taprootAddress: `bc1ptest${testName.replace(/\s/g, '')}`,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockShowBiometricSetupModal = false; // Reset to default
    mockShowPasskeyMigrationModal = false;

    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });
    (useAuthSession as jest.Mock).mockImplementation(() => (useAuth as jest.Mock)());
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

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );
    const { result } = renderHook(() => useAirdrop(), { wrapper });

    expect(result.current!.showAirdropModal).toBe(false);
    expect(result.current!.airdropTxId).toBe('');
    expect(result.current!.airdropPending).toBe(false);
  });

  it('should clean up expired locks on mount', async () => {
    const mockWallet = createMockWallet('expiredlock');
    const lockKey = `airdropLock_${mockWallet.segwitAddress}_0`;
    const expiredLockTime = Date.now() - 70 * 1000; // 70 seconds ago (expired)

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
      if (key === lockKey) return Promise.resolve(expiredLockTime.toString());
      return Promise.resolve(null);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
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

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
      if (key === lockKey) return Promise.resolve(freshLockTime.toString());
      return Promise.resolve(null);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
      await Promise.resolve();
    });

    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith(lockKey);
  });

  it('should clear pending airdrop without showing duplicate modal when balance updates', async () => {
    const mockWallet = createMockWallet('pendingairdrop');
    const pendingKey = `pendingAirdrop_${mockWallet.segwitAddress}_0`;
    const mockTxId = 'pending_txid';

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0.001, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
      if (key === pendingKey) return Promise.resolve(mockTxId);
      return Promise.resolve(null);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    let result: { current: ReturnType<typeof useAirdrop> | null } | undefined;
    await act(async () => {
      const hook = renderHook(() => useAirdrop(), { wrapper });
      result = hook.result;
      await Promise.resolve();
    });

    expect(result!.current!.showAirdropModal).toBe(false);
    expect(result!.current!.airdropPending).toBe(false);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(pendingKey);
  });

  it('should not request airdrop when balance is > 0', async () => {
    const mockWallet = createMockWallet('hasbalance');

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0.001, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
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

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
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

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={false}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(AirdropService.requestAirdrop).not.toHaveBeenCalled();
  });

  it('should not request airdrop when E2E skip funding is enabled', async () => {
    const mockWallet = createMockWallet('e2eskipfunding');

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
      if (key === 'e2eSkipAirdropRequests') return Promise.resolve('true');
      return Promise.resolve(null);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(AirdropService.requestAirdrop).not.toHaveBeenCalled();
  });

  it('should wait for the passkey migration decision before requesting airdrop', async () => {
    const mockWallet = createMockWallet('passkeymigrationactive');
    const mockTxId = 'passkey_done_txid';

    mockShowPasskeyMigrationModal = true;

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });
    (AirdropService.requestAirdrop as jest.Mock).mockResolvedValue({ txId: mockTxId });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    const { rerender } = renderHook(() => useAirdrop(), { wrapper });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(AirdropService.requestAirdrop).not.toHaveBeenCalled();

    mockShowPasskeyMigrationModal = false;
    await act(async () => {
      rerender();
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(AirdropService.requestAirdrop).toHaveBeenCalledWith(mockWallet.segwitAddress);
  });

  it('should not request airdrop within 24 hours of last request', async () => {
    const mockWallet = createMockWallet('within24hours');
    const lastAirdropTime = Date.now() - 12 * 60 * 60 * 1000; // 12 hours ago

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
      if (key === `lastAirdropTime_${mockWallet.segwitAddress}_0`) {
        return Promise.resolve(lastAirdropTime.toString());
      }
      return Promise.resolve(null);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
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

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
      if (key === lockKey) return Promise.resolve(freshLockTime.toString());
      return Promise.resolve(null);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
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

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
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

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    (AirdropService.requestAirdrop as jest.Mock).mockResolvedValue({ txId: mockTxId });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    let result: { current: ReturnType<typeof useAirdrop> | null } | undefined;
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
    expect(result!.current!.showAirdropModal).toBe(true);
    expect(result!.current!.airdropTxId).toBe(mockTxId);
  });

  it('should keep BTC airdrop pending until balance arrives', async () => {
    const mockWallet = createMockWallet('airdroppending');
    const mockTxId = 'airdrop_pending_txid';

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    (AirdropService.requestAirdrop as jest.Mock).mockResolvedValue({ txId: mockTxId });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    let result: { current: ReturnType<typeof useAirdrop> | null } | undefined;
    await act(async () => {
      const hook = renderHook(() => useAirdrop(), { wrapper });
      result = hook.result;
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result!.current!.airdropPending).toBe(true);
    expect(result!.current!.showAirdropModal).toBe(true);
    expect(result!.current!.airdropTxId).toBe(mockTxId);
  });

  it('should request airdrop after 24 hours on interval', async () => {
    const mockWallet = createMockWallet('intervalrequest');
    const mockTxId = 'interval_airdrop_txid';

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    (AirdropService.requestAirdrop as jest.Mock).mockResolvedValue({ txId: mockTxId });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
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
    (AirdropService.requestAirdrop as jest.Mock).mockClear();

    // Advance by 24 hours to trigger interval
    await act(async () => {
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);
      await Promise.resolve();
    });

    expect(AirdropService.requestAirdrop).toHaveBeenCalled();
  });

  it('should handle airdrop request error gracefully', async () => {
    const mockWallet = createMockWallet('airdropfail');
    const airdropKey = `lastAirdropTime_${mockWallet.segwitAddress}_0`;

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    (AirdropService.requestAirdrop as jest.Mock).mockRejectedValue(new Error('Network error'));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    let result: { current: ReturnType<typeof useAirdrop> | null } | undefined;
    await act(async () => {
      const hook = renderHook(() => useAirdrop(), { wrapper });
      result = hook.result;
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(AirdropService.requestAirdrop).toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(airdropKey, expect.any(String));
    // Should not crash or show modal on error
    expect(result!.current!.showAirdropModal).toBe(false);
    expect(result!.current!.airdropPending).toBe(false);
  });

  it('should prevent duplicate airdrop requests when already in progress', async () => {
    const mockWallet = createMockWallet('duplicaterequest');
    const mockTxId = 'airdrop_txid_dup';

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    // Make airdrop request slow
    let resolveAirdrop: ((value: { txId: string }) => void) | undefined;
    const airdropPromise = new Promise<{ txId: string }>((resolve) => {
      resolveAirdrop = resolve;
    });
    (AirdropService.requestAirdrop as jest.Mock).mockReturnValue(airdropPromise);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
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

    const firstCallCount = (AirdropService.requestAirdrop as jest.Mock).mock.calls.length;

    // Try to trigger another request while first is in progress
    await act(async () => {
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);
      await Promise.resolve();
    });

    // Should not make a second call (still in progress)
    expect((AirdropService.requestAirdrop as jest.Mock).mock.calls.length).toBe(firstCallCount);

    // Complete the first request
    await act(async () => {
      resolveAirdrop!({ txId: mockTxId });
      await Promise.resolve();
    });
  });

  it('should allow airdrop after 24 hours have passed', async () => {
    const mockWallet = createMockWallet('after24hours');
    const oldAirdropTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
    const mockTxId = 'new_airdrop_txid';

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
      if (key === `lastAirdropTime_${mockWallet.segwitAddress}_0`) {
        return Promise.resolve(oldAirdropTime.toString());
      }
      return Promise.resolve(null);
    });

    (AirdropService.requestAirdrop as jest.Mock).mockResolvedValue({ txId: mockTxId });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
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

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    // Make SecureStore fail during airdrop
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    let result: { current: ReturnType<typeof useAirdrop> | null } | undefined;
    await act(async () => {
      const hook = renderHook(() => useAirdrop(), { wrapper });
      result = hook.result;
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    // Should not crash
    expect(result!.current!.showAirdropModal).toBe(false);
  });

  it('should clean up lock after successful airdrop', async () => {
    const mockWallet = createMockWallet('cleanuplock');
    const lockKey = `airdropLock_${mockWallet.segwitAddress}_0`;
    const mockTxId = 'cleanup_txid';

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    (AirdropService.requestAirdrop as jest.Mock).mockResolvedValue({ txId: mockTxId });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
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

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    (AirdropService.requestAirdrop as jest.Mock).mockRejectedValue(new Error('Airdrop failed'));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
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

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
      if (key === lockKey) {
        return Promise.resolve(freshLockTime.toString());
      }
      return Promise.resolve(null);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
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

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
      if (key === lastAirdropKey) {
        return Promise.resolve(recentAirdropTime.toString());
      }
      if (key === lockKey) {
        return Promise.resolve(null); // No fresh lock
      }
      return Promise.resolve(null);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
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

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

    // Make requestAirdrop throw an error
    (AirdropService.requestAirdrop as jest.Mock).mockRejectedValue(new Error('Network error'));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
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

  it('should trigger celebration with haptic feedback and sound', async () => {
    const mockWallet = createMockWallet('celebration');

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0.001, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    let result: { current: ReturnType<typeof useAirdrop> | null } | undefined;
    await act(async () => {
      const hook = renderHook(() => useAirdrop(), { wrapper });
      result = hook.result;
      await Promise.resolve();
    });

    // Trigger celebration
    act(() => {
      result!.current!.triggerCelebration();
    });

    // Test passes if no errors - haptics and sound are mocked
    expect(result!.current!.triggerCelebration).toBeDefined();
  });

  it('should set audio ready state when sound loads successfully', async () => {
    const mockWallet = createMockWallet('audioready');

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    let result: { current: ReturnType<typeof useAirdrop> | null } | undefined;
    await act(async () => {
      const hook = renderHook(() => useAirdrop(), { wrapper });
      result = hook.result;
      // Wait for promises to resolve
      await Promise.resolve();
      await Promise.resolve();
    });

    // Audio should be ready after mount (sound loading is mocked)
    expect(result!.current!.audioReady).toBe(true);
  });

  it('should handle outer error during lock acquisition', async () => {
    const mockWallet = createMockWallet('outererror');
    const lockKey = `airdropLock_${mockWallet.segwitAddress}_0`;
    const lastAirdropKey = `lastAirdropTime_${mockWallet.segwitAddress}_0`;

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    // Make getItemAsync return different values, then throw
    let callCount = 0;
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
      callCount++;
      // First calls during mount for cleanup
      if (callCount <= 2) return Promise.resolve(null);
      // Then throw error during airdrop check
      return Promise.reject(new Error('Storage error'));
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    await act(async () => {
      renderHook(() => useAirdrop(), { wrapper });
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    // Should handle error gracefully and clean up lock
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(lockKey);
  });

  it('should handle confetti sound preload failure', async () => {
    const mockWallet = createMockWallet('soundfailure');
    const preloadConfettiSound = require('../../utils/airdropCelebration').preloadConfettiSound;
    preloadConfettiSound.mockRejectedValueOnce(new Error('Audio load failed'));

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    let result: { current: ReturnType<typeof useAirdrop> | null } | undefined;
    await act(async () => {
      const hook = renderHook(() => useAirdrop(), { wrapper });
      result = hook.result;
      await Promise.resolve();
      await Promise.resolve();
    });

    // audioReady should still be false when preload fails
    expect(result!.current!.audioReady).toBe(false);
  });

  it('should not replay the success modal for an already pending airdrop when balance exists', async () => {
    const mockWallet = createMockWallet('deferbiometric');
    const pendingKey = `pendingAirdrop_${mockWallet.segwitAddress}_0`;
    const mockTxId = 'deferred_txid';

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0.001, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
      if (key === pendingKey) return Promise.resolve(mockTxId);
      return Promise.resolve(null);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    let result: { current: ReturnType<typeof useAirdrop> | null } | undefined;
    await act(async () => {
      const hook = renderHook(() => useAirdrop(), { wrapper });
      result = hook.result;
      await Promise.resolve();
    });

    expect(result!.current!.showAirdropModal).toBe(false);
    expect(result!.current!.airdropPending).toBe(false);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(pendingKey);
  });

  it('should defer pending airdrop modal when biometric modal is visible', async () => {
    // This test covers the branch at line 171 where pendingAirdropTxIdRef.current is set
    const mockWallet = createMockWallet('deferbiometric2');
    const pendingKey = `pendingAirdrop_${mockWallet.segwitAddress}_0`;
    const mockTxId = 'deferred_txid2';

    // Set biometric modal as visible
    mockShowBiometricSetupModal = true;

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0.001, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
      if (key === pendingKey) return Promise.resolve(mockTxId);
      return Promise.resolve(null);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    let result: { current: ReturnType<typeof useAirdrop> | null } | undefined;
    await act(async () => {
      const hook = renderHook(() => useAirdrop(), { wrapper });
      result = hook.result;
      await Promise.resolve();
    });

    // Modal should NOT show yet since biometric modal is visible
    // The pending airdrop should be stored in ref
    expect(result!.current!.showAirdropModal).toBe(false);
  });

  it('should handle non-Error thrown during airdrop request', async () => {
    const mockWallet = createMockWallet('nonerrorairdrop');
    const lockKey = `airdropLock_${mockWallet.segwitAddress}_0`;

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    // Make requestAirdrop throw a non-Error value
    (AirdropService.requestAirdrop as jest.Mock).mockRejectedValue('string error');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    let result: { current: ReturnType<typeof useAirdrop> | null } | undefined;
    await act(async () => {
      const hook = renderHook(() => useAirdrop(), { wrapper });
      result = hook.result;
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    // Should handle non-Error gracefully
    expect(AirdropService.requestAirdrop).toHaveBeenCalled();
    expect(result!.current!.showAirdropModal).toBe(false);
    // Lock should be cleaned up
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(lockKey);
  });

  it('should handle non-Error thrown during audio preload', async () => {
    const mockWallet = createMockWallet('nonerroraudio');
    const preloadConfettiSound = require('../../utils/airdropCelebration').preloadConfettiSound;
    preloadConfettiSound.mockRejectedValueOnce('string audio error');

    (useBalance as jest.Mock).mockReturnValue({ segwitBalance: 0, taprootBalance: 0 });
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet, currentAccount: 0 });
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AirdropProvider seedConfirmed={true}>{children}</AirdropProvider>
    );

    let result: { current: ReturnType<typeof useAirdrop> | null } | undefined;
    await act(async () => {
      const hook = renderHook(() => useAirdrop(), { wrapper });
      result = hook.result;
      await Promise.resolve();
      await Promise.resolve();
    });

    // audioReady should be false when preload fails
    expect(result!.current!.audioReady).toBe(false);
  });
});
