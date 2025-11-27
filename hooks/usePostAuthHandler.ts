import { useCallback, MutableRefObject } from 'react';
import * as SecureStore from 'expo-secure-store';
import { notify } from '../utils/notify';

interface UsePostAuthHandlerParams {
  changingPin: boolean;
  setSettingUpPin: (value: boolean) => void;
  setIsAuthenticated: (value: boolean) => void;
  setBiometricEnabled: (value: boolean) => void;
  resetWallet: () => void;
  resetAuth: () => void;
  walletExists: MutableRefObject<boolean> | undefined;
  requestingSeedPhrase: boolean;
  loadSeedPhrase: () => Promise<void>;
}

interface UsePostAuthHandlerReturn {
  handlePostAuth: () => Promise<void>;
}

/**
 * Hook to handle post-authentication actions
 * Checks for pending operations that required authentication and executes them
 */
export function usePostAuthHandler({
  changingPin,
  setSettingUpPin,
  setIsAuthenticated,
  setBiometricEnabled,
  resetWallet,
  resetAuth,
  walletExists,
  requestingSeedPhrase,
  loadSeedPhrase,
}: UsePostAuthHandlerParams): UsePostAuthHandlerReturn {
  const handlePostAuth = useCallback(async (): Promise<void> => {
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
      notify.settings.faceIdEnabled();
      return;
    }

    // Check if user was trying to enable notifications
    const pendingNotifications = await SecureStore.getItemAsync('pendingNotificationsEnable');
    if (pendingNotifications === 'true') {
      await SecureStore.deleteItemAsync('pendingNotificationsEnable');
      await SecureStore.setItemAsync('notificationsEnabled', 'true');
      notify.settings.notificationsEnabled();
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
          notify.wallet.deleted();
        } else {
          notify.wallet.deleteFailed();
        }
      } catch {
        notify.wallet.deleteFailed();
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
    resetWallet,
    resetAuth,
    walletExists,
    requestingSeedPhrase,
    loadSeedPhrase,
  ]);

  return { handlePostAuth };
}
