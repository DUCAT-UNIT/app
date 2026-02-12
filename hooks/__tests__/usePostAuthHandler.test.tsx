/**
 * Tests for usePostAuthHandler Hook
 * Validates post-authentication routing for PIN changes, Face ID, notifications, wallet deletion, and seed phrase
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { usePostAuthHandler } from '../usePostAuthHandler';
import * as SecureStore from 'expo-secure-store';
import { notify } from '../../utils/notify';
import type { MutableRefObject } from 'react';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock secureStorageService
jest.mock('../../services/secureStorageService', () => ({
  deleteWalletData: jest.fn(),
}));

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

describe('usePostAuthHandler', () => {
  let mockProps: {
    changingPin: boolean;
    setSettingUpPin: jest.Mock;
    setIsAuthenticated: jest.Mock;
    setBiometricEnabled: jest.Mock;
    resetWallet: jest.Mock;
    resetAuth: jest.Mock;
    walletExists: MutableRefObject<boolean>;
    requestingSeedPhrase: boolean;
    loadSeedPhrase: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockProps = {
      changingPin: false,
      setSettingUpPin: jest.fn(),
      setIsAuthenticated: jest.fn(),
      setBiometricEnabled: jest.fn(),
      resetWallet: jest.fn(),
      resetAuth: jest.fn(),
      walletExists: { current: true },
      requestingSeedPhrase: false,
      loadSeedPhrase: jest.fn(),
    };
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  });

  describe('PIN Change Flow', () => {
    it('should handle PIN change request', async () => {
      mockProps.changingPin = true;

      const { result } = renderHook(() => usePostAuthHandler(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current!.handlePostAuth();
      });

      expect(mockProps.setSettingUpPin).toHaveBeenCalledWith(true);
      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(true);
    });

    it('should prioritize PIN change over other pending operations', async () => {
      mockProps.changingPin = true;
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true'); // Simulate pending Face ID

      const { result } = renderHook(() => usePostAuthHandler(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current!.handlePostAuth();
      });

      expect(mockProps.setSettingUpPin).toHaveBeenCalledWith(true);
      expect(mockProps.setBiometricEnabled).not.toHaveBeenCalled();
    });
  });

  describe('Face ID Enable Flow', () => {
    it('should enable Face ID when pending flag is set', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === 'pendingFaceIdEnable') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => usePostAuthHandler(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current!.handlePostAuth();
      });

      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(true);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('pendingFaceIdEnable');
      expect(mockProps.setBiometricEnabled).toHaveBeenCalledWith(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('biometricEnabled', 'true');
      expect(notify.settings.faceIdEnabled).toHaveBeenCalled();
    });

    it('should not enable Face ID when pending flag is not set', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => usePostAuthHandler(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current!.handlePostAuth();
      });

      expect(mockProps.setBiometricEnabled).not.toHaveBeenCalled();
    });
  });

  describe('Notifications Enable Flow', () => {
    it('should enable notifications when pending flag is set', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === 'pendingNotificationsEnable') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => usePostAuthHandler(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current!.handlePostAuth();
      });

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('pendingNotificationsEnable');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('notificationsEnabled', 'true');
      expect(notify.settings.notificationsEnabled).toHaveBeenCalled();
    });

    it('should prioritize Face ID over notifications', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === 'pendingFaceIdEnable') return Promise.resolve('true');
        if (key === 'pendingNotificationsEnable') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => usePostAuthHandler(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current!.handlePostAuth();
      });

      expect(notify.settings.faceIdEnabled).toHaveBeenCalled();
      expect(notify.settings.notificationsEnabled).not.toHaveBeenCalled();
    });
  });

  describe('Wallet Deletion Flow', () => {
    it('should delete wallet when pending flag is set', async () => {
      const SecureStorageService = require('../../services/secureStorageService');
      (SecureStorageService.deleteWalletData as jest.Mock).mockResolvedValue(true);

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === 'pendingWalletDelete') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => usePostAuthHandler(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current!.handlePostAuth();
      });

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('pendingWalletDelete');
      expect(SecureStorageService.deleteWalletData).toHaveBeenCalled();
      expect(mockProps.resetWallet).toHaveBeenCalled();
      expect(mockProps.walletExists.current).toBe(false);
      expect(mockProps.resetAuth).toHaveBeenCalled();
      expect(notify.wallet.deleted).toHaveBeenCalled();
    });

    it('should handle wallet deletion errors', async () => {
      const SecureStorageService = require('../../services/secureStorageService');
      (SecureStorageService.deleteWalletData as jest.Mock).mockRejectedValue(new Error('Deletion error'));

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === 'pendingWalletDelete') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => usePostAuthHandler(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current!.handlePostAuth();
      });

      expect(notify.wallet.deleteFailed).toHaveBeenCalled();
    });

    it('should handle walletExists ref being undefined', async () => {
      const SecureStorageService = require('../../services/secureStorageService');
      (SecureStorageService.deleteWalletData as jest.Mock).mockResolvedValue(true);
      mockProps.walletExists = { current: undefined } as any;

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === 'pendingWalletDelete') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => usePostAuthHandler(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current!.handlePostAuth();
      });

      expect(mockProps.resetWallet).toHaveBeenCalled();
      expect(notify.wallet.deleted).toHaveBeenCalled();
    });
  });

  describe('Seed Phrase View Flow', () => {
    it('should load seed phrase when requesting', async () => {
      mockProps.requestingSeedPhrase = true;
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => usePostAuthHandler(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current!.handlePostAuth();
      });

      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(true);
      expect(mockProps.loadSeedPhrase).toHaveBeenCalled();
    });

    it('should not load seed phrase when not requesting', async () => {
      mockProps.requestingSeedPhrase = false;
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => usePostAuthHandler(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current!.handlePostAuth();
      });

      expect(mockProps.loadSeedPhrase).not.toHaveBeenCalled();
    });
  });

  describe('Priority Order', () => {
    it('should execute in correct priority: PIN > Face ID > Notifications > Wallet Delete > Seed Phrase', async () => {
      // All operations pending
      mockProps.changingPin = true;
      mockProps.requestingSeedPhrase = true;
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');

      const { result } = renderHook(() => usePostAuthHandler(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current!.handlePostAuth();
      });

      // Should only execute PIN change (highest priority)
      expect(mockProps.setSettingUpPin).toHaveBeenCalled();
      expect(mockProps.setBiometricEnabled).not.toHaveBeenCalled();
      expect(mockProps.loadSeedPhrase).not.toHaveBeenCalled();
    });
  });

  describe('Authentication State', () => {
    it('should always set authenticated when not changing PIN', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => usePostAuthHandler(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current!.handlePostAuth();
      });

      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(true);
    });

    it('should set authenticated before checking pending operations', async () => {
      const callOrder: string[] = [];
      mockProps.setIsAuthenticated = jest.fn(() => callOrder.push('setAuth'));
      mockProps.setBiometricEnabled = jest.fn(() => callOrder.push('setBiometric'));

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === 'pendingFaceIdEnable') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => usePostAuthHandler(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current!.handlePostAuth();
      });

      expect(callOrder[0]).toBe('setAuth');
      expect(callOrder[1]).toBe('setBiometric');
    });
  });

  describe('Edge Cases', () => {
    it('should handle no pending operations gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      mockProps.requestingSeedPhrase = false;
      mockProps.changingPin = false;

      const { result } = renderHook(() => usePostAuthHandler(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current!.handlePostAuth();
      });

      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(true);
      expect(notify.settings.faceIdEnabled).not.toHaveBeenCalled();
    });

    it('should handle SecureStore errors gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('SecureStore error'));

      const { result } = renderHook(() => usePostAuthHandler(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await expect(result.current!.handlePostAuth()).rejects.toThrow('SecureStore error');
      });
    });
  });
});
