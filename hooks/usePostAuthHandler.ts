import { useCallback, MutableRefObject } from 'react';
import { setBiometricEnabled as persistBiometricEnabled } from '../services/biometricService';
import { notify } from '../utils/notify';
import { deleteWalletData } from '../services/secureStorageService';
import { logger } from '../utils/logger';
import {
  deleteSetting,
  getBoolean,
  setBoolean,
  SettingKeys,
} from '../services/settingsService';

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
    const pendingFaceId = await getBoolean(SettingKeys.PENDING_FACE_ID_ENABLE, false);

    if (pendingFaceId) {
      try {
        await deleteSetting(SettingKeys.PENDING_FACE_ID_ENABLE);
        setBiometricEnabled(true);
        if (!await persistBiometricEnabled(true)) {
          throw new Error('Failed to persist biometric preference');
        }
        notify.settings.faceIdEnabled();
      } catch (error: unknown) {
        setBiometricEnabled(false);
        logger.error('[usePostAuthHandler] Failed to enable Face ID after auth', {
          error: error instanceof Error ? error.message : String(error),
        });
        notify.settings.faceIdFailed();
      }
      return;
    }

    // Check if user was trying to enable notifications
    const pendingNotifications = await getBoolean(SettingKeys.PENDING_NOTIFICATIONS_ENABLE, false);
    if (pendingNotifications) {
      await deleteSetting(SettingKeys.PENDING_NOTIFICATIONS_ENABLE);
      if (await setBoolean(SettingKeys.NOTIFICATIONS_ENABLED, true)) {
        notify.settings.notificationsEnabled();
      } else {
        logger.error('[usePostAuthHandler] Failed to enable notifications after auth');
        notify.settings.notificationsFailed();
      }
      return;
    }

    // Check if user was trying to delete wallet
    const pendingWalletDelete = await getBoolean(SettingKeys.PENDING_WALLET_DELETE, false);
    if (pendingWalletDelete) {
      await deleteSetting(SettingKeys.PENDING_WALLET_DELETE);
      // Trigger wallet deletion
      try {
        await deleteWalletData();
        resetWallet();
        if (walletExists && walletExists.current !== undefined) {
          walletExists.current = false;
        }
        resetAuth();
        notify.wallet.deleted();
      } catch (error: unknown) {
        logger.error('[usePostAuthHandler] Failed to delete wallet', { error: error instanceof Error ? error.message : String(error) });
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
