/**
 * useWalletActions Hook
 * Handles wallet logout and deletion
 */

import { useState, useCallback, useMemo, MutableRefObject } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authenticateWithBiometrics } from '../services/biometricService';
import { deleteWalletData } from '../services/secureStorageService';
import { notify } from '../utils/notify';
import { logger } from '../utils/logger';

interface UseWalletActionsParams {
  resetAuth: () => void;
  resetWallet: () => void;
  clearVaultCredentials?: () => void;
  walletExistsRef?: MutableRefObject<boolean>;
  setIsAuthenticated: (value: boolean) => void;
  onLock?: () => void;
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

export function useWalletActions({ resetAuth, resetWallet, clearVaultCredentials, walletExistsRef, setIsAuthenticated, onLock }: UseWalletActionsParams): UseWalletActionsReturn {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleLogout = useCallback((): void => {
    setShowLogoutModal(true);
  }, []);

  const confirmLogout = useCallback((): void => {
    setShowLogoutModal(false);
    // Call onLock to dismiss modals, keyboard, and reset navigation
    if (onLock) {
      onLock();
    } else {
      // Fallback if onLock not provided
      setIsAuthenticated(false);
    }
  }, [setIsAuthenticated, onLock]);

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
    } catch (error: unknown) {
      logger.error('[useWalletActions] Biometric auth failed for wallet delete', { error: error instanceof Error ? error.message : String(error) });
      notify.auth.requiredForDeleteWallet();
      return;
    }

    // Authentication successful, proceed with deletion
    try {
      await deleteWalletData();
      // Clear vault credentials and data
      if (clearVaultCredentials) {
        clearVaultCredentials();
      }

      resetWallet();
      if (walletExistsRef && walletExistsRef.current !== undefined) {
        walletExistsRef.current = false;
      }
      resetAuth();

      notify.wallet.deleted();
    } catch (error: unknown) {
      logger.error('[useWalletActions] Failed to delete wallet', { error: error instanceof Error ? error.message : String(error) });
      notify.wallet.deleteFailed();
    }
  }, [resetAuth, resetWallet, clearVaultCredentials, walletExistsRef, setIsAuthenticated]);

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
