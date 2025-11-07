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
}) {
  const [privacyMode, setPrivacyMode] = useState(true);

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
    Alert.alert(
      DIALOGS.LOGOUT_TITLE,
      WARNINGS.WALLET_LOGOUT_WARNING,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            setIsAuthenticated(false);
            setShowSettings(false);
          }
        }
      ]
    );
  };

  const handleDeleteWallet = async () => {
    Alert.alert(
      DIALOGS.DELETE_WALLET_TITLE,
      WARNINGS.WALLET_DELETE_WARNING,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await AuthService.deleteWalletData();
              if (success) {
                resetWallet(); // Reset context wallet state
                if (walletExistsRef && walletExistsRef.current !== undefined) {
                  walletExistsRef.current = false;
                }
                resetAuth(); // Reset all auth state
                setShowSettings(false);

                Alert.alert('Success', SUCCESS.WALLET_DELETED);
              } else {
                Alert.alert(DIALOGS.ERROR_TITLE, ERRORS.WALLET_DELETE_FAILED);
              }
            } catch (error) {
              Alert.alert(DIALOGS.ERROR_TITLE, ERRORS.WALLET_DELETE_FAILED);
            }
          }
        }
      ]
    );
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
  };
}
