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
      'Logout',
      'This will lock your wallet. You can unlock it again with Face ID or PIN.',
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
      'Delete Wallet',
      'WARNING: This will permanently delete your wallet from this device. Make sure you have your recovery phrase backed up!',
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
                walletExistsRef.current = false;
                resetAuth(); // Reset all auth state
                setShowSettings(false);

                Alert.alert('Success', 'Wallet has been deleted from this device.');
              } else {
                Alert.alert('Error', 'Failed to delete wallet.');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete wallet: ' + error.message);
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
          Alert.alert('Error', 'Recovery phrase not found.');
        }
      } else {
        Alert.alert('Authentication Failed', 'You must authenticate to view your recovery phrase.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to retrieve recovery phrase: ' + error.message);
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
