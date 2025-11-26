/**
 * useWalletActions Hook
 * Handles wallet logout and deletion
 */

import { useState, useCallback, useMemo, MutableRefObject } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authenticateWithBiometrics } from '../services/biometricService';
import { deleteWalletData } from '../services/secureStorageService';
import { ERRORS, SUCCESS } from '../utils/messages';
import type { ToastType } from '../types/notification';

interface UseWalletActionsParams {
  resetAuth: () => void;
  resetWallet: () => void;
  clearVaultCredentials?: () => void;
  walletExistsRef?: MutableRefObject<boolean>;
  setIsAuthenticated: (value: boolean) => void;
  showToast?: (message: string, type: ToastType) => void;
}

interface UseWalletActionsReturn {
  handleLogout: () => void;
  handleDeleteWallet: () => void;
  handleViewSeedPhrase: () => string;
  showLogoutModal: boolean;
  showDeleteModal: boolean;
  confirmLogout: () => void;
  cancelLogout: () => void;
  confirmDeleteWallet: () => Promise<void>;
  cancelDeleteWallet: () => void;
}

export function useWalletActions({ resetAuth, resetWallet, clearVaultCredentials, walletExistsRef, setIsAuthenticated, showToast }: UseWalletActionsParams): UseWalletActionsReturn {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleLogout = useCallback((): void => {
    setShowLogoutModal(true);
  }, []);

  const confirmLogout = useCallback((): void => {
    setShowLogoutModal(false);
    setIsAuthenticated(false);
  }, [setIsAuthenticated]);

  const cancelLogout = useCallback((): void => {
    setShowLogoutModal(false);
  }, []);

  const handleDeleteWallet = useCallback((): void => {
    setShowDeleteModal(true);
  }, []);

  const confirmDeleteWallet = useCallback(async (): Promise<void> => {
    setShowDeleteModal(false);

    // Require authentication before deleting wallet
    try {
      const result = await authenticateWithBiometrics(
        'Authenticate to delete wallet',
        'Use PIN'
      );

      if (!result.success) {
        await SecureStore.setItemAsync('pendingWalletDelete', 'true');
        setIsAuthenticated(false);
        return;
      }
    } catch (error) {
      if (showToast) {
        showToast('Authentication required to delete wallet', 'error');
      }
      return;
    }

    // Authentication successful, proceed with deletion
    try {
      const success = await deleteWalletData();
      if (success) {
        // Clear vault credentials and data
        if (clearVaultCredentials) {
          clearVaultCredentials();
        }

        resetWallet();
        if (walletExistsRef && walletExistsRef.current !== undefined) {
          walletExistsRef.current = false;
        }
        resetAuth();

        if (showToast) {
          showToast(SUCCESS.WALLET_DELETED, 'success');
        }
      } else {
        if (showToast) {
          showToast(ERRORS.WALLET_DELETE_FAILED, 'error');
        }
      }
    } catch (error) {
      if (showToast) {
        showToast(ERRORS.WALLET_DELETE_FAILED, 'error');
      }
    }
  }, [resetAuth, resetWallet, clearVaultCredentials, walletExistsRef, setIsAuthenticated, showToast]);

  const cancelDeleteWallet = useCallback((): void => {
    setShowDeleteModal(false);
  }, []);

  const handleViewSeedPhrase = useCallback((): string => {
    return 'REQUEST_VIEW_SEED_PHRASE';
  }, []);

  return useMemo(
    () => ({
      handleLogout,
      handleDeleteWallet,
      handleViewSeedPhrase,
      showLogoutModal,
      showDeleteModal,
      confirmLogout,
      cancelLogout,
      confirmDeleteWallet,
      cancelDeleteWallet,
    }),
    [
      handleLogout,
      handleDeleteWallet,
      handleViewSeedPhrase,
      showLogoutModal,
      showDeleteModal,
      confirmLogout,
      cancelLogout,
      confirmDeleteWallet,
      cancelDeleteWallet,
    ]
  );
}
