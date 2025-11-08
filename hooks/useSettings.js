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
  seedPhraseTranslateX,
  setIsAuthenticated,
  setShowSettings,
  setShowPinEntry,
  setRequestingSeedPhrase,
  setSeedPhraseWords,
  setSeedPhraseVisible,
  setViewingSeedPhrase,
  showToast,
}) {
  const [privacyMode, setPrivacyMode] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFaceIdModal, setShowFaceIdModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Load privacy mode and notifications settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedPrivacyMode = await SecureStore.getItemAsync('privacyMode');
        if (savedPrivacyMode !== null) {
          setPrivacyMode(savedPrivacyMode === 'true');
        }

        const savedNotificationsEnabled = await SecureStore.getItemAsync('notificationsEnabled');
        if (savedNotificationsEnabled !== null) {
          setNotificationsEnabled(savedNotificationsEnabled === 'true');
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    setIsAuthenticated(false);
    setShowSettings(false);
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  const handleDeleteWallet = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteWallet = async () => {
    setShowDeleteModal(false);
    try {
      const success = await AuthService.deleteWalletData();
      if (success) {
        resetWallet(); // Reset context wallet state
        if (walletExistsRef && walletExistsRef.current !== undefined) {
          walletExistsRef.current = false;
        }
        resetAuth(); // Reset all auth state
        setShowSettings(false);

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

  const handleViewSeedPhrase = async () => {
    try {
      // If biometric is not enabled, show PIN entry instead
      if (!biometricEnabled) {
        setRequestingSeedPhrase(true);
        setShowSettings(false);
        setShowPinEntry(true);
        return;
      }

      // Biometric is enabled, use biometric auth
      const result = await AuthService.authenticateWithBiometrics(
        'Authenticate to view your recovery phrase',
        'Use PIN'
      );

      if (result.success) {
        const mnemonic = await AuthService.getMnemonic();
        if (mnemonic) {
          setSeedPhraseWords(mnemonic.split(' '));
          setSeedPhraseVisible(false); // Start with words hidden for security
          seedPhraseTranslateX.setValue(0);
          setViewingSeedPhrase(true);
          setShowSettings(false);
        } else {
          Alert.alert(DIALOGS.ERROR_TITLE, ERRORS.SEED_PHRASE_NOT_FOUND);
        }
      } else {
        Alert.alert(DIALOGS.AUTH_FAILED_TITLE, ERRORS.AUTH_REQUIRED);
      }
    } catch (error) {
      Alert.alert(DIALOGS.ERROR_TITLE, ERRORS.SEED_PHRASE_RETRIEVAL_FAILED);
    }
  };

  const handleChangePin = () => {
    // Close settings and show lock screen to verify current PIN
    setShowSettings(false);
    startPinChange();
  };

  const handlePrivacyModeToggle = async () => {
    const newPrivacyMode = !privacyMode;
    setPrivacyMode(newPrivacyMode);
    try {
      await SecureStore.setItemAsync('privacyMode', String(newPrivacyMode));
    } catch (error) {
      console.error('Failed to save privacy mode:', error);
    }
  };

  const handleFaceIdToggle = async () => {
    if (biometricEnabled) {
      // Disable Face ID
      const newValue = false;
      setBiometricEnabled(newValue);
      try {
        await SecureStore.setItemAsync('biometricEnabled', String(newValue));
        if (showToast) {
          showToast('Face ID disabled', 'success');
        }
      } catch (error) {
        console.error('Failed to save Face ID setting:', error);
      }
    } else {
      // Show modal to enable Face ID (directs to system settings)
      setShowFaceIdModal(true);
    }
  };

  const confirmEnableFaceId = () => {
    setShowFaceIdModal(false);
    // This will be handled in the modal - open system settings
  };

  const cancelFaceIdModal = () => {
    setShowFaceIdModal(false);
  };

  const handleNotificationsToggle = async () => {
    if (notificationsEnabled) {
      // Disable notifications
      const newValue = false;
      setNotificationsEnabled(newValue);
      try {
        await SecureStore.setItemAsync('notificationsEnabled', String(newValue));
        if (showToast) {
          showToast('Notifications disabled', 'success');
        }
      } catch (error) {
        console.error('Failed to save notifications setting:', error);
      }
    } else {
      // Show modal to enable notifications (directs to system settings)
      setShowNotificationsModal(true);
    }
  };

  const confirmEnableNotifications = () => {
    setShowNotificationsModal(false);
    // This will be handled in the modal - open system settings
  };

  const cancelNotificationsModal = () => {
    setShowNotificationsModal(false);
  };

  return {
    privacyMode,
    notificationsEnabled,
    handleLogout,
    handleDeleteWallet,
    handleViewSeedPhrase,
    handleChangePin,
    handlePrivacyModeToggle,
    handleFaceIdToggle,
    handleNotificationsToggle,
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
    confirmEnableFaceId,
    cancelFaceIdModal,
    confirmEnableNotifications,
    cancelNotificationsModal,
  };
}
