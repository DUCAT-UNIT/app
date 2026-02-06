/**
 * Tests for useWalletInitialization Hook
 * Validates wallet loading and initialization on app start
 */

import React, { MutableRefObject } from 'react';
import { create, act } from 'react-test-renderer';
import { useWalletInitialization } from '../useWalletInitialization';

// Mock timers for setTimeout
jest.useFakeTimers();

// Helper to render hooks with props
function renderHook<T>(hook: (props?: unknown) => T, { initialProps }: { initialProps?: unknown } = {}) {
  const result: { current: T | null } = { current: null };
  function TestComponent({ hookProps }: { hookProps?: unknown }) {
    result.current = hook(hookProps);
    return null;
  }
  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent hookProps={initialProps} />);
  });
  return {
    result,
    rerender: (newProps?: unknown) => {
      act(() => {
        component?.update(<TestComponent hookProps={newProps} />);
      });
    },
    unmount: () => component?.unmount(),
  };
}

interface MockProps {
  loadWallet: jest.Mock;
  loadBiometricPreference: jest.Mock;
  setSeedConfirmed: jest.Mock;
  setIsAuthenticated: jest.Mock;
  walletExistsRef: MutableRefObject<boolean>;
}

describe('useWalletInitialization', () => {
  let mockProps: MockProps;

  beforeEach(() => {
    jest.clearAllTimers();
    mockProps = {
      loadWallet: jest.fn(),
      loadBiometricPreference: jest.fn(),
      setSeedConfirmed: jest.fn(),
      setIsAuthenticated: jest.fn(),
      walletExistsRef: { current: false },
    };
  });

  describe('Initialization', () => {
    it('should start with isLoading true', () => {
      mockProps.loadWallet.mockResolvedValue({ exists: false });
      mockProps.loadBiometricPreference.mockResolvedValue(undefined);

      const { result } = renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      expect(result.current!.isLoading).toBe(true);
    });

    it('should call loadBiometricPreference on mount', async () => {
      mockProps.loadWallet.mockResolvedValue({ exists: false });
      mockProps.loadBiometricPreference.mockResolvedValue(undefined);

      renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockProps.loadBiometricPreference).toHaveBeenCalled();
    });

    it('should call loadWallet on mount', async () => {
      mockProps.loadWallet.mockResolvedValue({ exists: false });
      mockProps.loadBiometricPreference.mockResolvedValue(undefined);

      renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockProps.loadWallet).toHaveBeenCalled();
    });
  });

  describe('Existing Wallet Flow', () => {
    it('should set up auth flow when wallet exists', async () => {
      mockProps.loadWallet.mockResolvedValue({ exists: true });
      mockProps.loadBiometricPreference.mockResolvedValue(undefined);

      renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockProps.setSeedConfirmed).toHaveBeenCalledWith(true);
      expect(mockProps.walletExistsRef.current).toBe(true);
      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(false);
    });

    it('should show locked screen when wallet exists', async () => {
      mockProps.loadWallet.mockResolvedValue({ exists: true });
      mockProps.loadBiometricPreference.mockResolvedValue(undefined);

      renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(false);
    });
  });

  describe('New Wallet Flow', () => {
    it('should allow access to create/import screen when no wallet exists', async () => {
      mockProps.loadWallet.mockResolvedValue({ exists: false });
      mockProps.loadBiometricPreference.mockResolvedValue(undefined);

      renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockProps.walletExistsRef.current).toBe(false);
      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(true);
    });

    it('should not call setSeedConfirmed when no wallet exists', async () => {
      mockProps.loadWallet.mockResolvedValue({ exists: false });
      mockProps.loadBiometricPreference.mockResolvedValue(undefined);

      renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockProps.setSeedConfirmed).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should set isLoading to false immediately after initialization completes', async () => {
      mockProps.loadWallet.mockResolvedValue({ exists: false });
      mockProps.loadBiometricPreference.mockResolvedValue(undefined);

      const { result } = renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      // Initially loading
      expect(result.current!.isLoading).toBe(true);

      // After async operations complete, loading should be false
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current!.isLoading).toBe(false);
    });

    it('should set isLoading to false immediately when wallet exists', async () => {
      mockProps.loadWallet.mockResolvedValue({ exists: true });
      mockProps.loadBiometricPreference.mockResolvedValue(undefined);

      const { result } = renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      // No artificial delay - loading is false immediately after init
      expect(result.current!.isLoading).toBe(false);
    });

    it('should set isLoading to false even if loadWallet is fast', async () => {
      mockProps.loadWallet.mockResolvedValue({ exists: true });
      mockProps.loadBiometricPreference.mockResolvedValue(undefined);

      const { result } = renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve(); // loadWallet completes immediately
      });

      // No artificial delay - immediately done
      expect(result.current!.isLoading).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle loadWallet errors gracefully', async () => {
      mockProps.loadWallet.mockRejectedValue(new Error('Load wallet error'));
      mockProps.loadBiometricPreference.mockResolvedValue(undefined);

      const { result } = renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      // Should set isLoading to false immediately even on error
      expect(result.current!.isLoading).toBe(false);
    });

    it('should handle loadBiometricPreference errors gracefully', async () => {
      mockProps.loadWallet.mockResolvedValue({ exists: false });
      mockProps.loadBiometricPreference.mockRejectedValue(new Error('Biometric error'));

      const { result } = renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      // Should set isLoading to false immediately even on error
      expect(result.current!.isLoading).toBe(false);
    });

    it('should always hide loading screen immediately even on errors', async () => {
      mockProps.loadWallet.mockRejectedValue(new Error('Error'));
      mockProps.loadBiometricPreference.mockRejectedValue(new Error('Error'));

      const { result } = renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      // No artificial delay - loading is false immediately after errors
      expect(result.current!.isLoading).toBe(false);
    });
  });

  describe('Ref Updates', () => {
    it('should update walletExistsRef when wallet exists', async () => {
      mockProps.loadWallet.mockResolvedValue({ exists: true });
      mockProps.loadBiometricPreference.mockResolvedValue(undefined);

      renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockProps.walletExistsRef.current).toBe(true);
    });

    it('should update walletExistsRef when wallet does not exist', async () => {
      mockProps.loadWallet.mockResolvedValue({ exists: false });
      mockProps.loadBiometricPreference.mockResolvedValue(undefined);

      renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockProps.walletExistsRef.current).toBe(false);
    });

    it('should not modify walletExistsRef on error', async () => {
      // Use type assertion to test edge case with undefined
      const testRef = { current: undefined } as unknown as MutableRefObject<boolean>;
      const testProps = { ...mockProps, walletExistsRef: testRef };
      testProps.loadWallet.mockRejectedValue(new Error('Error'));
      testProps.loadBiometricPreference.mockResolvedValue(undefined);

      renderHook(() => useWalletInitialization(testProps), {
        initialProps: testProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(testRef.current).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle loadWallet returning null', async () => {
      mockProps.loadWallet.mockResolvedValue(null);
      mockProps.loadBiometricPreference.mockResolvedValue(undefined);

      const { result } = renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1500);
        await Promise.resolve();
      });

      expect(result.current!.isLoading).toBe(false);
    });

    it('should handle loadWallet returning undefined', async () => {
      mockProps.loadWallet.mockResolvedValue(undefined);
      mockProps.loadBiometricPreference.mockResolvedValue(undefined);

      const { result } = renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1500);
        await Promise.resolve();
      });

      expect(result.current!.isLoading).toBe(false);
    });

    it('should only initialize once on mount', async () => {
      mockProps.loadWallet.mockResolvedValue({ exists: false });
      mockProps.loadBiometricPreference.mockResolvedValue(undefined);

      const { rerender } = renderHook(() => useWalletInitialization(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockProps.loadWallet).toHaveBeenCalledTimes(1);

      // Rerender should not trigger another initialization
      rerender(mockProps);

      expect(mockProps.loadWallet).toHaveBeenCalledTimes(1);
    });
  });
});
