/**
 * useSettings Hook
 * Manages settings-related functionality including:
 * - Wallet lock/logout
 * - Wallet deletion
 * - View seed phrase with authentication
 * - PIN change
 * - Privacy mode (screenshot protection)
 */

import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as AuthService from '../services/authService';
import { ERRORS, SUCCESS,  } from '../utils/messages';

export function useSettings({
  biometricEnabled,
  setBiometricEnabled,
  resetAuth,
  resetWallet,
  startPinChange,
  walletExistsRef,
  setIsAuthenticated,
  showToast,
}) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showZeroAssets, setShowZeroAssets] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFaceIdModal, setShowFaceIdModal] = useState(false);
  const [pendingFaceIdValue, setPendingFaceIdValue] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [pendingNotificationsValue, setPendingNotificationsValue] = useState(false);

  // Load privacy mode and notifications settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedNotificationsEnabled = await SecureStore.getItemAsync('notificationsEnabled');
        if (savedNotificationsEnabled !== null) {
          setNotificationsEnabled(savedNotificationsEnabled === 'true');
        }

        const savedShowZeroAssets = await SecureStore.getItemAsync('showZeroAssets');
        if (savedShowZeroAssets !== null) {
          setShowZeroAssets(savedShowZeroAssets === 'true');
        }
      } catch (error) {}
    };
    loadSettings();
  }, []);

  const handleLogout = () => {
    // Show confirmation modal
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    // Lock the wallet
    setShowLogoutModal(false);
    setIsAuthenticated(false);
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  const handleDeleteWallet = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteWallet = async () => {
    setShowDeleteModal(false);

    // Require authentication before deleting wallet
    try {
      // Try biometric auth first if available
      const result = await AuthService.authenticateWithBiometrics(
        'Authenticate to delete wallet',
        'Use PIN'
      );

      if (!result.success) {
        // Biometric failed or not available, fall back to PIN
        // Set a flag to indicate we're deleting wallet after PIN verification
        await SecureStore.setItemAsync('pendingWalletDelete', 'true');
        // Lock wallet to trigger PIN entry
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
        resetWallet(); // Reset context wallet state
        if (walletExistsRef && walletExistsRef.current !== undefined) {
          walletExistsRef.current = false;
        }
        resetAuth(); // Reset all auth state

        // Show success toast instead of Alert
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
  };

  const cancelDeleteWallet = () => {
    setShowDeleteModal(false);
  };

  // View seed phrase - returns a callback that parent can wire up
  const handleViewSeedPhrase = () => {
    // Return callback that tells parent to trigger seed phrase flow
    // Parent should handle: requestViewSeedPhrase() from SeedPhraseContext
    return 'REQUEST_VIEW_SEED_PHRASE';
  };

  const handleChangePin = () => {
    // Trigger PIN change flow
    // This will lock the wallet, which triggers authentication
    // If Face ID is enabled, it will be shown automatically
    // After authentication (Face ID or PIN), the PIN setup screen will be shown
    startPinChange();
  };

  const handleFaceIdToggle = () => {
    const newValue = !biometricEnabled;

    // Set pending value and show modal for both enabling and disabling
    setPendingFaceIdValue(newValue);
    setShowFaceIdModal(true);
  };

  const confirmFaceIdToggle = async () => {
    setShowFaceIdModal(false);
    const newValue = pendingFaceIdValue;

    // Simply toggle Face ID setting without authentication
    setBiometricEnabled(newValue);
    try {
      await SecureStore.setItemAsync('biometricEnabled', String(newValue));
      if (showToast) {
        showToast(`Face ID ${newValue ? 'enabled' : 'disabled'}`, 'success');
      }
    } catch (error) {
      if (showToast) {
        showToast('Failed to update Face ID setting', 'error');
      }
    }
  };

  const cancelFaceIdToggle = () => {
    setShowFaceIdModal(false);
  };

  const handleShowZeroAssetsToggle = async () => {
    const newValue = !showZeroAssets;
    setShowZeroAssets(newValue);
    await SecureStore.setItemAsync('showZeroAssets', newValue.toString());
  };

  const handleNotificationsToggle = () => {
    const newValue = !notificationsEnabled;

    // Set pending value and show modal for both enabling and disabling
    setPendingNotificationsValue(newValue);
    setShowNotificationsModal(true);
  };

  const confirmNotificationsToggle = async () => {
    setShowNotificationsModal(false);
    const newValue = pendingNotificationsValue;

    // If enabling, require authentication first
    if (newValue) {
      // Only try biometric if it's enabled in settings
      if (biometricEnabled) {
        try {
          const result = await AuthService.authenticateWithBiometrics(
            'Authenticate to enable notifications',
            'Use PIN'
          );

          if (!result.success) {
            // Biometric failed, fall back to PIN
            await SecureStore.setItemAsync('pendingNotificationsEnable', 'true');
            await SecureStore.setItemAsync('returnToSettingsAfterAuth', 'true');
            setIsAuthenticated(false);
            return;
          }

          // Biometric auth succeeded, set flag to return to settings
          await SecureStore.setItemAsync('returnToSettingsAfterAuth', 'true');
        } catch (error) {
          if (showToast) {
            showToast('Authentication required to enable notifications', 'error');
          }
          return;
        }
      } else {
        // Biometric disabled, go straight to PIN
        await SecureStore.setItemAsync('pendingNotificationsEnable', 'true');
        await SecureStore.setItemAsync('returnToSettingsAfterAuth', 'true');
        setIsAuthenticated(false);
        return;
      }
    }

    // Authentication successful or disabling, proceed with toggle
    setNotificationsEnabled(newValue);
    try {
      await SecureStore.setItemAsync('notificationsEnabled', String(newValue));
      if (showToast) {
        showToast(`Notifications ${newValue ? 'enabled' : 'disabled'}`, 'success');
      }
    } catch (error) {
      if (showToast) {
        showToast('Failed to update notifications setting', 'error');
      }
    }
  };

  const cancelNotificationsToggle = () => {
    setShowNotificationsModal(false);
  };

  return {
    notificationsEnabled,
    handleLogout,
    handleDeleteWallet,
    handleViewSeedPhrase,
    handleChangePin,
    handleFaceIdToggle,
    handleNotificationsToggle,
    handleShowZeroAssetsToggle,
    showZeroAssets,
    // Modal state
    showLogoutModal,
    showDeleteModal,
    showFaceIdModal,
    showNotificationsModal,
    // Modal handlers
    confirmLogout,
    cancelLogout,
    confirmDeleteWallet,
    cancelDeleteWallet,
    confirmFaceIdToggle,
    cancelFaceIdToggle,
    confirmNotificationsToggle,
    cancelNotificationsToggle,
  };
}
