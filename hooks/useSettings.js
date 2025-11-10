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
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as AuthService from '../services/authService';
import { ERRORS, SUCCESS, WARNINGS, DIALOGS } from '../utils/messages';

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
      } catch (error) {
      }
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

  const handleFaceIdToggle = async () => {
    const newValue = !biometricEnabled;

    // If disabling, just turn it off immediately without modal
    if (!newValue) {
      setBiometricEnabled(false);
      try {
        await SecureStore.setItemAsync('biometricEnabled', 'false');
        if (showToast) {
          showToast('Face ID disabled', 'success');
        }
      } catch (error) {
        if (showToast) {
          showToast('Failed to update Face ID setting', 'error');
        }
      }
      return;
    }

    // If enabling, show modal
    setPendingFaceIdValue(newValue);
    setShowFaceIdModal(true);
  };

  const confirmFaceIdToggle = async () => {
    setShowFaceIdModal(false);
    const newValue = pendingFaceIdValue;

    // If enabling, require authentication first
    if (newValue) {
      try {
        // Try biometric auth first if available
        const result = await AuthService.authenticateWithBiometrics(
          'Authenticate to enable Face ID',
          'Use PIN'
        );

        if (!result.success) {
          // Biometric failed or not available, fall back to PIN
          // Set a flag to indicate we're enabling Face ID after PIN verification
          await SecureStore.setItemAsync('pendingFaceIdEnable', 'true');
          // Set flag to return to settings after PIN entry
          await SecureStore.setItemAsync('returnToSettingsAfterAuth', 'true');
          // Lock wallet to trigger PIN entry
          setIsAuthenticated(false);
          return;
        }

        // Set flag to return to settings after Face ID is enabled (component might remount)
        await SecureStore.setItemAsync('returnToSettingsAfterAuth', 'true');
      } catch (error) {
        if (showToast) {
          showToast('Authentication required to enable Face ID', 'error');
        }
        return;
      }
    }

    // Authentication successful or disabling, proceed with toggle
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

  const handleNotificationsToggle = async () => {
    const newValue = !notificationsEnabled;

    // If disabling, just turn it off immediately without modal
    if (!newValue) {
      setNotificationsEnabled(false);
      try {
        await SecureStore.setItemAsync('notificationsEnabled', 'false');
        if (showToast) {
          showToast('Notifications disabled', 'success');
        }
      } catch (error) {
        if (showToast) {
          showToast('Failed to update notifications setting', 'error');
        }
      }
      return;
    }

    // If enabling, show modal
    setPendingNotificationsValue(newValue);
    setShowNotificationsModal(true);
  };

  const confirmNotificationsToggle = async () => {
    setShowNotificationsModal(false);
    const newValue = pendingNotificationsValue;

    // If enabling, require authentication first
    if (newValue) {
      try {
        // Try biometric auth first if available
        const result = await AuthService.authenticateWithBiometrics(
          'Authenticate to enable notifications',
          'Use PIN'
        );

        if (!result.success) {
          // Biometric failed or not available, fall back to PIN
          // Set a flag to indicate we're enabling notifications after PIN verification
          await SecureStore.setItemAsync('pendingNotificationsEnable', 'true');
          // Set flag to return to settings after PIN entry
          await SecureStore.setItemAsync('returnToSettingsAfterAuth', 'true');
          // Lock wallet to trigger PIN entry
          setIsAuthenticated(false);
          return;
        }

        // Biometric auth succeeded, set flag to return to settings after toggle (component might remount)
        await SecureStore.setItemAsync('returnToSettingsAfterAuth', 'true');
      } catch (error) {
        if (showToast) {
          showToast('Authentication required to enable notifications', 'error');
        }
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
