/**
 * Tests for useWalletCreation Hook
 * Validates wallet creation state management, save after PIN, and reset
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useWalletCreation } from '../useWalletCreation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WalletService from '../../services/walletService';

// Mock wallet service
jest.mock('../../services/walletService');

// Mock wallet context
jest.mock('../../contexts/WalletContext', () => ({
  useWallet: () => ({
    setWalletAddresses: jest.fn(),
    resetWallet: jest.fn(),
  }),
}));

// Use fake timers for setTimeout
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

interface UseWalletCreationParams {
  currentAccount: number;
  setIsAuthenticated: (value: boolean) => void;
  setSeedConfirmed: (value: boolean) => void;
  loadWallet: (() => Promise<unknown>) | undefined;
}

describe('useWalletCreation', () => {
  let mockProps: UseWalletCreationParams;
  const mockMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (WalletService.saveWalletToStorage as jest.Mock).mockResolvedValue(undefined);

    mockProps = {
      currentAccount: 0,
      setIsAuthenticated: jest.fn(),
      setSeedConfirmed: jest.fn(),
      loadWallet: jest.fn(),
    };
  });

  describe('Initialization', () => {
    it('should start with walletExistsRef as false', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current!.walletExistsRef.current).toBe(false);
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current).toBeDefined();
    });
  });

  describe('Save Wallet After PIN Setup', () => {
    it('should return false if no temp mnemonic', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        const success = await result.current!.saveWalletAfterPinSetup();
        expect(success).toBe(false);
      });

      expect(WalletService.saveWalletToStorage).not.toHaveBeenCalled();
    });

    it('should save wallet when temp mnemonic exists in persisted state', async () => {
      const savedState = { tempMnemonic: mockMnemonic };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        const success = await result.current!.saveWalletAfterPinSetup();
        expect(success).toBe(true);
      });

      expect(WalletService.saveWalletToStorage).toHaveBeenCalledWith(
        mockMnemonic,
        mockProps.currentAccount
      );
    });

    it('should load wallet into context', async () => {
      const savedState = { tempMnemonic: mockMnemonic };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        await result.current!.saveWalletAfterPinSetup();
      });

      expect(mockProps.loadWallet).toHaveBeenCalled();
    });

    it('should mark wallet as truly existing', async () => {
      const savedState = { tempMnemonic: mockMnemonic };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current!.walletExistsRef.current).toBe(false);

      await act(async () => {
        await result.current!.saveWalletAfterPinSetup();
      });

      expect(result.current!.walletExistsRef.current).toBe(true);
    });

    it('should clear persisted state', async () => {
      const savedState = { tempMnemonic: mockMnemonic };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        await result.current!.saveWalletAfterPinSetup();
      });

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('wallet_creation_state');
    });

    it('should handle save errors gracefully', async () => {
      (WalletService.saveWalletToStorage as jest.Mock).mockRejectedValue(new Error('Save failed'));
      const savedState = { tempMnemonic: mockMnemonic };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        const success = await result.current!.saveWalletAfterPinSetup();
        expect(success).toBe(false);
      });
    });

    it('should work without loadWallet callback', async () => {
      mockProps.loadWallet = undefined;
      const savedState = { tempMnemonic: mockMnemonic };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        const success = await result.current!.saveWalletAfterPinSetup();
        expect(success).toBe(true);
      });
    });
  });

  describe('Reset Creation State', () => {
    it('should reset walletExistsRef', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current!.resetCreationState();
      });

      expect(result.current!.walletExistsRef.current).toBe(false);
    });

    it('should clear persisted state', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current!.resetCreationState();
      });

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('wallet_creation_state');
    });
  });

  describe('Wallet Exists Ref', () => {
    it('should provide walletExistsRef', () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      expect(result.current!.walletExistsRef).toBeDefined();
      expect(result.current!.walletExistsRef.current).toBe(false);
    });
  });
});
