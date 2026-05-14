/**
 * Tests for useAccountSwitcher Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { useAccountSwitcher } from '../useAccountSwitcher';
import { ERRORS, DIALOGS } from '../../utils/messages';

// Helper to render hooks with react-test-renderer
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

// Mock Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

describe('useAccountSwitcher', () => {
  let mockSwitchAccountContext: jest.Mock;
  const mockAddresses = {
    segwitAddress: 'tb1qnewsegwit',
    taprootAddress: 'tb1pnewtaproot',
    segwitPubkey: 'pubkey1',
    taprootPubkey: 'pubkey2',
  };

  beforeEach(() => {
    mockSwitchAccountContext = jest.fn().mockResolvedValue(mockAddresses);
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    expect(result.current!.showAccountPicker).toBe(false);
    expect(result.current!.newAccountIndex).toBe('');
    expect(result.current!.switchingAccount).toBe(false);
  });

  it('should switch account successfully', async () => {
    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    await act(async () => {
      const switchPromise = result.current!.switchAccount(2); // Switch to Account 2
      jest.advanceTimersByTime(0); // Advance past the setTimeout(0)
      await switchPromise;
    });

    // Should call context with correct index (Account 2 = index 1)
    expect(mockSwitchAccountContext).toHaveBeenCalledWith(1);
    expect(result.current!.showAccountPicker).toBe(false);
    expect(result.current!.newAccountIndex).toBe('');
    expect(result.current!.switchingAccount).toBe(false);
  });

  it('should pass wallet profile options when switching', async () => {
    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    await act(async () => {
      const switchPromise = result.current!.switchAccount(2, { walletProfile: 'unisat' });
      jest.advanceTimersByTime(0);
      await switchPromise;
    });

    expect(mockSwitchAccountContext).toHaveBeenCalledWith(1, { walletProfile: 'unisat' });
  });

  it('should convert account number to index correctly', async () => {
    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    await act(async () => {
      const switchPromise = result.current!.switchAccount(1); // Account 1 = index 0
      jest.advanceTimersByTime(0);
      await switchPromise;
    });
    expect(mockSwitchAccountContext).toHaveBeenCalledWith(0);

    await act(async () => {
      const switchPromise = result.current!.switchAccount(5); // Account 5 = index 4
      jest.advanceTimersByTime(0);
      await switchPromise;
    });
    expect(mockSwitchAccountContext).toHaveBeenCalledWith(4);
  });

  it('should set switchingAccount to true during operation until balance loads', async () => {
    let resolveSwitch: () => void;
    let resolveBalance: (value?: unknown) => void;
    mockSwitchAccountContext = jest.fn(
      () => new Promise((resolve) => (resolveSwitch = () => resolve(mockAddresses)))
    );
    const mockFetchBalance = jest.fn(() => new Promise((resolve) => (resolveBalance = resolve)));

    const { result } = renderHook(() =>
      useAccountSwitcher({
        switchAccountContext: mockSwitchAccountContext,
        fetchBalance: mockFetchBalance as jest.Mock,
      })
    );

    // Start switching
    act(() => {
      result.current!.switchAccount(2);
    });

    // Should be switching initially
    expect(result.current!.switchingAccount).toBe(true);

    // Advance past the setTimeout(0) that forces React render
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    // Still switching while waiting for switchAccountContext
    expect(result.current!.switchingAccount).toBe(true);

    // Resolve the switchAccountContext promise (returns addresses)
    await act(async () => {
      resolveSwitch!();
    });

    // Still switching - waiting for balance to load
    expect(result.current!.switchingAccount).toBe(true);

    // Resolve the fetchBalance promise
    await act(async () => {
      resolveBalance!(undefined);
    });

    // Now should no longer be switching
    expect(result.current!.switchingAccount).toBe(false);
  });

  it('should keep switchingAccount true until Cashu account storage is refreshed', async () => {
    let resolveCashu: (() => void) | undefined;
    const mockResetAndRefreshCashu = jest.fn(
      () => new Promise<void>((resolve) => (resolveCashu = resolve))
    );

    const { result } = renderHook(() =>
      useAccountSwitcher({
        switchAccountContext: mockSwitchAccountContext,
        resetAndRefreshCashu: mockResetAndRefreshCashu,
      })
    );

    let switchPromise: Promise<void>;
    act(() => {
      switchPromise = result.current!.switchAccount(2);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockResetAndRefreshCashu).toHaveBeenCalledWith(mockAddresses.taprootAddress);
    expect(result.current!.switchingAccount).toBe(true);

    await act(async () => {
      resolveCashu!();
      await switchPromise!;
    });

    expect(result.current!.switchingAccount).toBe(false);
  });

  it('should show alert on switch error', async () => {
    const mockError = new Error('Switch failed');
    mockSwitchAccountContext = jest.fn().mockRejectedValue(mockError);

    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    await act(async () => {
      const switchPromise = result.current!.switchAccount(2);
      jest.advanceTimersByTime(0);
      await switchPromise;
    });

    expect(Alert.alert).toHaveBeenCalledWith(DIALOGS.ERROR_TITLE, ERRORS.ACCOUNT_SWITCH_FAILED);
    expect(result.current!.switchingAccount).toBe(false);
  });

  it('should handle setShowAccountPicker', () => {
    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    act(() => {
      result.current!.setShowAccountPicker(true);
    });

    expect(result.current!.showAccountPicker).toBe(true);

    act(() => {
      result.current!.setShowAccountPicker(false);
    });

    expect(result.current!.showAccountPicker).toBe(false);
  });

  it('should handle setNewAccountIndex', () => {
    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    act(() => {
      result.current!.setNewAccountIndex('3');
    });

    expect(result.current!.newAccountIndex).toBe('3');

    act(() => {
      result.current!.setNewAccountIndex('');
    });

    expect(result.current!.newAccountIndex).toBe('');
  });

  it('should reset modal state after successful switch', async () => {
    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    // Set up modal state
    act(() => {
      result.current!.setShowAccountPicker(true);
      result.current!.setNewAccountIndex('5');
    });

    expect(result.current!.showAccountPicker).toBe(true);
    expect(result.current!.newAccountIndex).toBe('5');

    // Switch account
    await act(async () => {
      const switchPromise = result.current!.switchAccount(5);
      jest.advanceTimersByTime(0);
      await switchPromise;
    });

    // Modal state should be reset
    expect(result.current!.showAccountPicker).toBe(false);
    expect(result.current!.newAccountIndex).toBe('');
  });

  it('should not reset modal state after failed switch', async () => {
    mockSwitchAccountContext = jest.fn().mockRejectedValue(new Error('Failed'));

    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    // Set up modal state
    act(() => {
      result.current!.setShowAccountPicker(true);
      result.current!.setNewAccountIndex('5');
    });

    // Switch account (will fail)
    await act(async () => {
      const switchPromise = result.current!.switchAccount(5);
      jest.advanceTimersByTime(0);
      await switchPromise;
    });

    // Modal state remains (user might want to retry)
    expect(result.current!.showAccountPicker).toBe(true);
    expect(result.current!.newAccountIndex).toBe('5');
  });

  it('should handle rapid account switches', async () => {
    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    // Switch to multiple accounts rapidly
    await act(async () => {
      const switchPromise = result.current!.switchAccount(2);
      jest.advanceTimersByTime(0);
      await switchPromise;
    });

    await act(async () => {
      const switchPromise = result.current!.switchAccount(3);
      jest.advanceTimersByTime(0);
      await switchPromise;
    });

    await act(async () => {
      const switchPromise = result.current!.switchAccount(1);
      jest.advanceTimersByTime(0);
      await switchPromise;
    });

    // Should have called with correct indices
    expect(mockSwitchAccountContext).toHaveBeenCalledTimes(3);
    expect(mockSwitchAccountContext).toHaveBeenNthCalledWith(1, 1);
    expect(mockSwitchAccountContext).toHaveBeenNthCalledWith(2, 2);
    expect(mockSwitchAccountContext).toHaveBeenNthCalledWith(3, 0);
  });

  describe('data fetching callbacks', () => {
    it('should await fetchBalance with new addresses before hiding loading overlay', async () => {
      const mockFetchBalance = jest.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          fetchBalance: mockFetchBalance,
        })
      );

      await act(async () => {
        const switchPromise = result.current!.switchAccount(2);
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      // Should be called with NEW addresses from switchAccountContext
      expect(mockFetchBalance).toHaveBeenCalledWith(
        mockAddresses.segwitAddress,
        mockAddresses.taprootAddress
      );
      // switchingAccount should be false AFTER fetchBalance completes
      expect(result.current!.switchingAccount).toBe(false);
    });

    it('should call fetchVault in background', async () => {
      const mockFetchVault = jest.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          fetchVault: mockFetchVault,
        })
      );

      await act(async () => {
        const switchPromise = result.current!.switchAccount(2);
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockFetchVault).toHaveBeenCalled();
    });

    it('should call fetchTransactionHistory in background', async () => {
      const mockFetchTransactionHistory = jest.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          fetchTransactionHistory: mockFetchTransactionHistory,
        })
      );

      await act(async () => {
        const switchPromise = result.current!.switchAccount(2);
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockFetchTransactionHistory).toHaveBeenCalled();
    });

    it('should call resetAndRefreshCashu with new taproot address', async () => {
      const mockResetAndRefreshCashu = jest.fn().mockResolvedValue(undefined);
      const newTaprootAddress = 'bc1pnewtaproot';

      mockSwitchAccountContext.mockResolvedValue({
        taprootAddress: newTaprootAddress,
        segwitAddress: 'bc1qnewsegwit',
      });

      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          resetAndRefreshCashu: mockResetAndRefreshCashu,
        })
      );

      await act(async () => {
        const switchPromise = result.current!.switchAccount(2);
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockResetAndRefreshCashu).toHaveBeenCalledWith(newTaprootAddress);
    });

    it('should handle sync fetchBalance callbacks', async () => {
      const mockSyncCallback = jest.fn(); // Synchronous

      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          fetchBalance: mockSyncCallback,
        })
      );

      await act(async () => {
        const switchPromise = result.current!.switchAccount(2);
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      expect(mockSyncCallback).toHaveBeenCalledWith(
        mockAddresses.segwitAddress,
        mockAddresses.taprootAddress
      );
    });

    it('should catch errors in async fire-and-forget callbacks', async () => {
      const mockFetchBalance = jest.fn().mockRejectedValue(new Error('Fetch failed'));

      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          fetchBalance: mockFetchBalance,
        })
      );

      // Should not throw
      await act(async () => {
        const switchPromise = result.current!.switchAccount(2);
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current!.switchingAccount).toBe(false);
    });

    it('should catch synchronous errors in fire-and-forget callbacks', async () => {
      const mockFetchBalance = jest.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });

      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          fetchBalance: mockFetchBalance,
        })
      );

      // Should not throw
      await act(async () => {
        const switchPromise = result.current!.switchAccount(2);
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      expect(result.current!.switchingAccount).toBe(false);
    });

    it('should call onAccountSwitched callback', async () => {
      const mockOnAccountSwitched = jest.fn();

      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          onAccountSwitched: mockOnAccountSwitched,
        })
      );

      await act(async () => {
        const switchPromise = result.current!.switchAccount(3); // Account 3 = index 2
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      expect(mockOnAccountSwitched).toHaveBeenCalledWith(2);
    });
  });

  describe('reset callbacks', () => {
    it('should call resetBalances before switching', async () => {
      const mockResetBalances = jest.fn();

      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          resetBalances: mockResetBalances,
        })
      );

      await act(async () => {
        const switchPromise = result.current!.switchAccount(2);
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      expect(mockResetBalances).toHaveBeenCalled();
    });

    it('should call resetTransactionHistory before switching', async () => {
      const mockResetTransactionHistory = jest.fn();

      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          resetTransactionHistory: mockResetTransactionHistory,
        })
      );

      await act(async () => {
        const switchPromise = result.current!.switchAccount(2);
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      expect(mockResetTransactionHistory).toHaveBeenCalled();
    });

    it('should call resetVaultData before switching', async () => {
      const mockResetVaultData = jest.fn();

      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          resetVaultData: mockResetVaultData,
        })
      );

      await act(async () => {
        const switchPromise = result.current!.switchAccount(2);
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      expect(mockResetVaultData).toHaveBeenCalled();
    });
  });

  describe('error handling in fire-and-forget', () => {
    it('should handle non-Error exceptions in async callbacks', async () => {
      const mockFetchBalance = jest.fn().mockRejectedValue('String error');

      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          fetchBalance: mockFetchBalance,
        })
      );

      // Should not throw
      await act(async () => {
        const switchPromise = result.current!.switchAccount(2);
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current!.switchingAccount).toBe(false);
    });

    it('should handle non-Error exceptions in sync callbacks', async () => {
      const mockFetchBalance = jest.fn().mockImplementation(() => {
        throw 'String sync error';
      });

      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          fetchBalance: mockFetchBalance,
        })
      );

      // Should not throw
      await act(async () => {
        const switchPromise = result.current!.switchAccount(2);
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      expect(result.current!.switchingAccount).toBe(false);
    });

    it('should handle fetchVault failure gracefully', async () => {
      const mockFetchVault = jest.fn().mockRejectedValue(new Error('Vault fetch failed'));

      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          fetchVault: mockFetchVault,
        })
      );

      // Should not throw
      await act(async () => {
        const switchPromise = result.current!.switchAccount(2);
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      expect(result.current!.switchingAccount).toBe(false);
    });

    it('should handle resetAndRefreshCashu failure gracefully', async () => {
      const mockResetAndRefreshCashu = jest
        .fn()
        .mockRejectedValue(new Error('Cashu refresh failed'));

      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          resetAndRefreshCashu: mockResetAndRefreshCashu,
        })
      );

      // Should not throw
      await act(async () => {
        const switchPromise = result.current!.switchAccount(2);
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current!.switchingAccount).toBe(false);
    });

    it('should handle fetchTransactionHistory failure gracefully', async () => {
      const mockFetchTransactionHistory = jest
        .fn()
        .mockRejectedValue(new Error('History fetch failed'));

      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          fetchTransactionHistory: mockFetchTransactionHistory,
        })
      );

      // Should not throw
      await act(async () => {
        const switchPromise = result.current!.switchAccount(2);
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current!.switchingAccount).toBe(false);
    });
  });

  describe('showToast callback', () => {
    it('should call showToast with success message after switch', async () => {
      const mockShowToast = jest.fn();

      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          showToast: mockShowToast,
        })
      );

      await act(async () => {
        const switchPromise = result.current!.switchAccount(3); // Account 3 = index 2
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      expect(mockShowToast).toHaveBeenCalledWith('Switched to Account 3', 'success');
    });

    it('should not call showToast if not provided', async () => {
      const { result } = renderHook(() =>
        useAccountSwitcher({
          switchAccountContext: mockSwitchAccountContext,
          // showToast is not provided
        })
      );

      // Should not throw
      await act(async () => {
        const switchPromise = result.current!.switchAccount(2);
        jest.advanceTimersByTime(0);
        await switchPromise;
      });

      expect(result.current!.switchingAccount).toBe(false);
    });
  });
});
