/**
 * Tests for useWalletActions Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import * as SecureStore from 'expo-secure-store';
import * as biometricService from '../../services/biometricService';
import * as secureStorageService from '../../services/secureStorageService';
import { useWalletActions } from '../useWalletActions';
import { ERRORS, SUCCESS } from '../../utils/messages';
import { notify } from '../../utils/notify';
import type { MutableRefObject } from 'react';

interface MockProps {
  resetAuth: jest.Mock;
  resetWallet: jest.Mock;
  clearVaultCredentials?: jest.Mock;
  walletExistsRef?: MutableRefObject<boolean>;
  setIsAuthenticated: jest.Mock;
}

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

// Mock dependencies
jest.mock('expo-secure-store');
jest.mock('../../services/biometricService');
jest.mock('../../services/secureStorageService');

describe('useWalletActions', () => {
  let mockProps: MockProps;

  beforeEach(() => {
    mockProps = {
      resetAuth: jest.fn(),
      resetWallet: jest.fn(),
      clearVaultCredentials: jest.fn(),
      walletExistsRef: { current: true },
      setIsAuthenticated: jest.fn(),
    };

    jest.clearAllMocks();
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(null);
    (biometricService.authenticateWithBiometrics as jest.Mock).mockResolvedValue({ success: true });
    (secureStorageService.deleteWalletData as jest.Mock).mockResolvedValue(true);
  });

  describe('Initialization', () => {
    it('should initialize with modals hidden', () => {
      const { result } = renderHook(() => useWalletActions(mockProps));

      expect(result.current!.showLogoutModal).toBe(false);
      expect(result.current!.showDeleteModal).toBe(false);
    });

    it('should return all expected properties', () => {
      const { result } = renderHook(() => useWalletActions(mockProps));

      expect(result.current).toHaveProperty('handleLogout');
      expect(result.current).toHaveProperty('handleDeleteWallet');
      expect(result.current).toHaveProperty('handleViewSeedPhrase');
      expect(result.current).toHaveProperty('showLogoutModal');
      expect(result.current).toHaveProperty('showDeleteModal');
      expect(result.current).toHaveProperty('confirmLogout');
      expect(result.current).toHaveProperty('cancelLogout');
      expect(result.current).toHaveProperty('confirmDeleteWallet');
      expect(result.current).toHaveProperty('cancelDeleteWallet');

      expect(typeof result.current!.handleLogout).toBe('function');
      expect(typeof result.current!.handleDeleteWallet).toBe('function');
      expect(typeof result.current!.handleViewSeedPhrase).toBe('function');
      expect(typeof result.current!.confirmLogout).toBe('function');
      expect(typeof result.current!.cancelLogout).toBe('function');
      expect(typeof result.current!.confirmDeleteWallet).toBe('function');
      expect(typeof result.current!.cancelDeleteWallet).toBe('function');
    });
  });

  describe('Logout Flow', () => {
    it('should show logout modal when handleLogout is called', () => {
      const { result } = renderHook(() => useWalletActions(mockProps));

      expect(result.current!.showLogoutModal).toBe(false);

      act(() => {
        result.current!.handleLogout();
      });

      expect(result.current!.showLogoutModal).toBe(true);
    });

    it('should hide modal and set unauthenticated when confirming logout', () => {
      const { result } = renderHook(() => useWalletActions(mockProps));

      act(() => {
        result.current!.handleLogout();
      });
      expect(result.current!.showLogoutModal).toBe(true);

      act(() => {
        result.current!.confirmLogout();
      });

      expect(result.current!.showLogoutModal).toBe(false);
      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(false);
    });

    it('should hide modal when canceling logout', () => {
      const { result } = renderHook(() => useWalletActions(mockProps));

      act(() => {
        result.current!.handleLogout();
      });
      expect(result.current!.showLogoutModal).toBe(true);

      act(() => {
        result.current!.cancelLogout();
      });

      expect(result.current!.showLogoutModal).toBe(false);
      expect(mockProps.setIsAuthenticated).not.toHaveBeenCalled();
    });
  });

  describe('Delete Wallet Flow - Modal', () => {
    it('should show delete modal when handleDeleteWallet is called', () => {
      const { result } = renderHook(() => useWalletActions(mockProps));

      expect(result.current!.showDeleteModal).toBe(false);

      act(() => {
        result.current!.handleDeleteWallet();
      });

      expect(result.current!.showDeleteModal).toBe(true);
    });

    it('should hide modal when canceling delete', () => {
      const { result } = renderHook(() => useWalletActions(mockProps));

      act(() => {
        result.current!.handleDeleteWallet();
      });
      expect(result.current!.showDeleteModal).toBe(true);

      act(() => {
        result.current!.cancelDeleteWallet();
      });

      expect(result.current!.showDeleteModal).toBe(false);
      expect(biometricService.authenticateWithBiometrics).not.toHaveBeenCalled();
    });
  });

  describe('Delete Wallet Flow - Authentication Success', () => {
    it('should delete wallet when biometric auth succeeds', async () => {
      (biometricService.authenticateWithBiometrics as jest.Mock).mockResolvedValue({ success: true });
      (secureStorageService.deleteWalletData as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useWalletActions(mockProps));

      act(() => {
        result.current!.handleDeleteWallet();
      });

      await act(async () => {
        await result.current!.confirmDeleteWallet();
      });

      expect(biometricService.authenticateWithBiometrics).toHaveBeenCalledWith(
        'Authenticate to delete wallet',
        'Use PIN'
      );
      expect(secureStorageService.deleteWalletData).toHaveBeenCalled();
      expect(mockProps.clearVaultCredentials).toHaveBeenCalled();
      expect(mockProps.resetWallet).toHaveBeenCalled();
      expect(mockProps.walletExistsRef!.current).toBe(false);
      expect(mockProps.resetAuth).toHaveBeenCalled();
      expect(notify.wallet.deleted).toHaveBeenCalled();
    });

    it('should handle deletion when clearVaultCredentials is not provided', async () => {
      const propsWithoutClearVault: MockProps = { ...mockProps, clearVaultCredentials: undefined };
      (biometricService.authenticateWithBiometrics as jest.Mock).mockResolvedValue({ success: true });
      (secureStorageService.deleteWalletData as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useWalletActions(propsWithoutClearVault));

      act(() => {
        result.current!.handleDeleteWallet();
      });

      await act(async () => {
        await result.current!.confirmDeleteWallet();
      });

      // Should complete deletion without crashing
      expect(secureStorageService.deleteWalletData).toHaveBeenCalled();
      expect(propsWithoutClearVault.resetWallet).toHaveBeenCalled();
      expect(propsWithoutClearVault.resetAuth).toHaveBeenCalled();
    });

    it('should handle deletion when walletExistsRef is not provided', async () => {
      const propsWithoutRef: MockProps = { ...mockProps, walletExistsRef: undefined };
      (biometricService.authenticateWithBiometrics as jest.Mock).mockResolvedValue({ success: true });
      (secureStorageService.deleteWalletData as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useWalletActions(propsWithoutRef));

      act(() => {
        result.current!.handleDeleteWallet();
      });

      await act(async () => {
        await result.current!.confirmDeleteWallet();
      });

      // Should complete deletion without crashing
      expect(secureStorageService.deleteWalletData).toHaveBeenCalled();
      expect(propsWithoutRef.resetWallet).toHaveBeenCalled();
      expect(propsWithoutRef.resetAuth).toHaveBeenCalled();
    });

    it('should handle deletion when walletExistsRef.current is undefined', async () => {
      const refWithUndefined = { current: undefined } as unknown as MutableRefObject<boolean>;
      const propsWithEmptyRef: MockProps = { ...mockProps, walletExistsRef: refWithUndefined };
      (biometricService.authenticateWithBiometrics as jest.Mock).mockResolvedValue({ success: true });
      (secureStorageService.deleteWalletData as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useWalletActions(propsWithEmptyRef));

      act(() => {
        result.current!.handleDeleteWallet();
      });

      await act(async () => {
        await result.current!.confirmDeleteWallet();
      });

      // Should skip setting ref.current when it's undefined
      expect(refWithUndefined.current).toBe(undefined);
      expect(secureStorageService.deleteWalletData).toHaveBeenCalled();
    });

  });

  describe('Delete Wallet Flow - Authentication Failure', () => {
    it('should redirect to PIN when biometric auth fails', async () => {
      (biometricService.authenticateWithBiometrics as jest.Mock).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useWalletActions(mockProps));

      act(() => {
        result.current!.handleDeleteWallet();
      });

      await act(async () => {
        await result.current!.confirmDeleteWallet();
      });

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pendingWalletDelete', 'true');
      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(false);
      expect(secureStorageService.deleteWalletData).not.toHaveBeenCalled();
    });

    it('should handle biometric authentication errors', async () => {
      (biometricService.authenticateWithBiometrics as jest.Mock).mockRejectedValue(new Error('Auth error'));

      const { result } = renderHook(() => useWalletActions(mockProps));

      act(() => {
        result.current!.handleDeleteWallet();
      });

      await act(async () => {
        await result.current!.confirmDeleteWallet();
      });

      expect(notify.auth.requiredForDeleteWallet).toHaveBeenCalled();
      expect(secureStorageService.deleteWalletData).not.toHaveBeenCalled();
    });
  });

  describe('Delete Wallet Flow - Deletion Errors', () => {
    it('should handle deleteWalletData errors', async () => {
      (biometricService.authenticateWithBiometrics as jest.Mock).mockResolvedValue({ success: true });
      (secureStorageService.deleteWalletData as jest.Mock).mockRejectedValue(new Error('Deletion failed'));

      const { result } = renderHook(() => useWalletActions(mockProps));

      act(() => {
        result.current!.handleDeleteWallet();
      });

      await act(async () => {
        await result.current!.confirmDeleteWallet();
      });

      expect(notify.wallet.deleteFailed).toHaveBeenCalled();
      expect(mockProps.resetWallet).not.toHaveBeenCalled();
      expect(mockProps.resetAuth).not.toHaveBeenCalled();
    });

  });

  describe('View Seed Phrase', () => {
    it('should return request constant when handleViewSeedPhrase is called', () => {
      const { result } = renderHook(() => useWalletActions(mockProps));

      const requestResult = result.current!.handleViewSeedPhrase();

      expect(requestResult).toBe('REQUEST_VIEW_SEED_PHRASE');
    });
  });

  describe('Return value stability', () => {
    it('should memoize return value', () => {
      const { result } = renderHook(() => useWalletActions(mockProps));

      const firstResult = result.current;

      act(() => {
        result.current!.cancelLogout();
      });

      // Functions should remain stable due to useCallback/useMemo
      expect(result.current!.handleLogout).toBe(firstResult!.handleLogout);
      expect(result.current!.handleDeleteWallet).toBe(firstResult!.handleDeleteWallet);
      expect(result.current!.cancelLogout).toBe(firstResult!.cancelLogout);
      expect(result.current!.cancelDeleteWallet).toBe(firstResult!.cancelDeleteWallet);
    });
  });
});
