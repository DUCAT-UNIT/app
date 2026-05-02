/**
 * useWalletActions Hook
 * Handles wallet logout and deletion
 */

import { useState, useCallback, useMemo, MutableRefObject } from 'react';
import { authenticateWithBiometrics } from '../services/biometricService';
import { deleteSetting, setBoolean, SettingKeys } from '../services/settingsService';
import { performFullWalletReset } from '../services/walletResetService';
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

    const requestPinConfirmation = async () => {
      const pendingFlagSet = await setBoolean(SettingKeys.PENDING_WALLET_DELETE, true);
      if (!pendingFlagSet) {
        logger.error('[useWalletActions] Failed to persist pending wallet delete flag');
      }
      setIsAuthenticated(false);
      notify.auth.requiredForDeleteWallet();
    };

    try {
      const authResult = await authenticateWithBiometrics(
        'Authenticate to delete wallet',
        'Use PIN'
      );

      if (!authResult.success) {
        await requestPinConfirmation();
        return;
      }

      await deleteSetting(SettingKeys.PENDING_WALLET_DELETE);
      await performFullWalletReset({
        clearVaultCredentials,
        resetWallet,
        resetAuth,
      });
      if (walletExistsRef && walletExistsRef.current !== undefined) {
        walletExistsRef.current = false;
      }

      notify.wallet.deleted();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[useWalletActions] Failed to delete wallet', { error: message });

      if (message.toLowerCase().includes('auth')) {
        await requestPinConfirmation();
        return;
      }

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
