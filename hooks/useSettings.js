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
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Load privacy mode setting on mount
  useEffect(() => {
    const loadPrivacyMode = async () => {
      try {
        const savedPrivacyMode = await SecureStore.getItemAsync('privacyMode');
        if (savedPrivacyMode !== null) {
          setPrivacyMode(savedPrivacyMode === 'true');
        }
      } catch (error) {
        console.error('Failed to load privacy mode:', error);
      }
    };
    loadPrivacyMode();
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

  return {
    privacyMode,
    handleLogout,
    handleDeleteWallet,
    handleViewSeedPhrase,
    handleChangePin,
    handlePrivacyModeToggle,
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
