import { useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

/**
 * Hook to handle post-authentication actions
 * Checks for pending operations that required authentication and executes them
 */
export function usePostAuthHandler({
  changingPin,
  setSettingUpPin,
  setIsAuthenticated,
  setBiometricEnabled,
  showToast,
  resetWallet,
  resetAuth,
  walletExists,
  requestingSeedPhrase,
  loadSeedPhrase,
}) {
  const handlePostAuth = useCallback(async () => {
    // Check if user was trying to change PIN
    if (changingPin) {
      // User authenticated to change PIN, proceed to PIN setup
      setSettingUpPin(true);
      setIsAuthenticated(true);
      return;
    }

    // Set authenticated first
    setIsAuthenticated(true);

    // Check if user was trying to enable Face ID
    const pendingFaceId = await SecureStore.getItemAsync('pendingFaceIdEnable');

    if (pendingFaceId === 'true') {
      await SecureStore.deleteItemAsync('pendingFaceIdEnable');
      setBiometricEnabled(true);
      await SecureStore.setItemAsync('biometricEnabled', 'true');
      showToast('Face ID enabled', 'success');
      return;
    }

    // Check if user was trying to enable notifications
    const pendingNotifications = await SecureStore.getItemAsync('pendingNotificationsEnable');
    if (pendingNotifications === 'true') {
      await SecureStore.deleteItemAsync('pendingNotificationsEnable');
      await SecureStore.setItemAsync('notificationsEnabled', 'true');
      showToast('Notifications enabled', 'success');
      return;
    }

    // Check if user was trying to delete wallet
    const pendingWalletDelete = await SecureStore.getItemAsync('pendingWalletDelete');
    if (pendingWalletDelete === 'true') {
      await SecureStore.deleteItemAsync('pendingWalletDelete');
      // Trigger wallet deletion
      try {
        const SecureStorageService = require('../services/secureStorageService');
        const success = await SecureStorageService.deleteWalletData();
        if (success) {
          resetWallet();
          if (walletExists && walletExists.current !== undefined) {
            walletExists.current = false;
          }
          resetAuth();
          showToast('Wallet deleted successfully', 'success');
        } else {
          showToast('Failed to delete wallet', 'error');
        }
      } catch (error) {
        showToast('Failed to delete wallet', 'error');
      }
      return;
    }

    // Check if user was trying to view seed phrase
    if (requestingSeedPhrase) {
      await loadSeedPhrase();
    }
  }, [
    changingPin,
    setSettingUpPin,
    setIsAuthenticated,
    setBiometricEnabled,
    showToast,
    resetWallet,
    resetAuth,
    walletExists,
    requestingSeedPhrase,
    loadSeedPhrase,
  ]);

  return { handlePostAuth };
}
