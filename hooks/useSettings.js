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
  const [privacyMode, setPrivacyMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showZeroAssets, setShowZeroAssets] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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

        const savedShowZeroAssets = await SecureStore.getItemAsync('showZeroAssets');
        if (savedShowZeroAssets !== null) {
          setShowZeroAssets(savedShowZeroAssets === 'true');
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
    const newValue = !biometricEnabled;

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
          setRequestingSeedPhrase(false);
          setShowSettings(false);
          setShowPinEntry(true);
          // Set a flag to indicate we're enabling Face ID after PIN verification
          await SecureStore.setItemAsync('pendingFaceIdEnable', 'true');
          return;
        }
      } catch (error) {
        console.error('Authentication failed:', error);
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
      console.error('Failed to save Face ID setting:', error);
      if (showToast) {
        showToast('Failed to update Face ID setting', 'error');
      }
    }
  };

  const handleShowZeroAssetsToggle = async () => {
    const newValue = !showZeroAssets;
    setShowZeroAssets(newValue);
    await SecureStore.setItemAsync('showZeroAssets', newValue.toString());
  };

  const handleNotificationsToggle = async () => {
    const newValue = !notificationsEnabled;

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
          setRequestingSeedPhrase(false);
          setShowSettings(false);
          setShowPinEntry(true);
          // Set a flag to indicate we're enabling notifications after PIN verification
          await SecureStore.setItemAsync('pendingNotificationsEnable', 'true');
          return;
        }
      } catch (error) {
        console.error('Authentication failed:', error);
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
      console.error('Failed to save notifications setting:', error);
      if (showToast) {
        showToast('Failed to update notifications setting', 'error');
      }
    }
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
    handleShowZeroAssetsToggle,
    showZeroAssets,
    // Modal state
    showLogoutModal,
    showDeleteModal,
    // Modal handlers
    confirmLogout,
    cancelLogout,
    confirmDeleteWallet,
    cancelDeleteWallet,
  };
}
