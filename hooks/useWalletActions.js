/**
 * useWalletActions Hook
 * Handles wallet logout and deletion
 */

import { useState, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as AuthService from '../services/authService';
import { ERRORS, SUCCESS } from '../utils/messages';

export function useWalletActions({ resetAuth, resetWallet, walletExistsRef, setIsAuthenticated, showToast }) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleLogout = useCallback(() => {
    setShowLogoutModal(true);
  }, []);

  const confirmLogout = useCallback(() => {
    setShowLogoutModal(false);
    setIsAuthenticated(false);
  }, [setIsAuthenticated]);

  const cancelLogout = useCallback(() => {
    setShowLogoutModal(false);
  }, []);

  const handleDeleteWallet = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const confirmDeleteWallet = useCallback(async () => {
    setShowDeleteModal(false);

    // Require authentication before deleting wallet
    try {
      const result = await AuthService.authenticateWithBiometrics(
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
      const success = await AuthService.deleteWalletData();
      if (success) {
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
  }, [resetAuth, resetWallet, walletExistsRef, setIsAuthenticated, showToast]);

  const cancelDeleteWallet = useCallback(() => {
    setShowDeleteModal(false);
  }, []);

  const handleViewSeedPhrase = useCallback(() => {
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
