/**
 * useSettings Hook - Unified export
 *
 * This file maintains backward compatibility by composing specialized hooks.
 * New code should import directly from:
 * - hooks/useAuthSettings
 * - hooks/useWalletActions
 * - hooks/useAppSettings
 */

import { useAuthSettings } from './useAuthSettings';
import { useWalletActions } from './useWalletActions';
import { useAppSettings } from './useAppSettings';

export function useSettings(props) {
  const authSettings = useAuthSettings(props);
  const walletActions = useWalletActions(props);
  const appSettings = useAppSettings(props);

  return {
    ...authSettings,
    ...walletActions,
    ...appSettings,
  };
}
