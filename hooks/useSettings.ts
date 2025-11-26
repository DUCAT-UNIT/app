/**
 * useSettings Hook - Unified export
 *
 * This file maintains backward compatibility by composing specialized hooks.
 * New code should import directly from:
 * - hooks/useAuthSettings
 * - hooks/useWalletActions
 * - hooks/useAppSettings
 */

import { useMemo, MutableRefObject } from 'react';
import { useAuthSettings } from './useAuthSettings';
import { useWalletActions } from './useWalletActions';
import { useAppSettings } from './useAppSettings';
import type { SnackbarParams } from '../contexts/NotificationContext';
import type { ToastType } from '../types/notification';

interface UseSettingsParams {
  biometricEnabled: boolean;
  setBiometricEnabled: (value: boolean) => void;
  setIsAuthenticated: (value: boolean) => void;
  startPinChange: () => void;
  resetAuth: () => void;
  resetWallet: () => void;
  clearVaultCredentials?: () => void;
  walletExistsRef?: MutableRefObject<boolean>;
  showToast?: (message: string, type: ToastType) => void;
  showSnackbar?: (params: SnackbarParams) => void;
}

export function useSettings(props: UseSettingsParams) {
  const authSettings = useAuthSettings(props);
  const walletActions = useWalletActions(props);
  const appSettings = useAppSettings(props);

  // Memoize the return object to prevent recreating on every render
  return useMemo(
    () => ({
      ...authSettings,
      ...walletActions,
      ...appSettings,
    }),
    [authSettings, walletActions, appSettings]
  );
}
