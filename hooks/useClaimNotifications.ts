/**
 * useClaimNotifications - Hook for handling claim success/error notifications
 * Extracts claim notification logic from WalletPage
 */

import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { logger } from '../utils/logger';
import { useTokenProcessingStore } from '../stores/tokenProcessingStore';
import type { SnackbarParams } from '../stores/notificationStore';

// Navigation type for this hook
type ClaimNavigationType = {
  setParams: (params: Record<string, unknown>) => void;
  navigate: (screen: string, params?: Record<string, unknown>) => void;
};

interface ClaimRouteParams {
  claimSuccess?: boolean;
  claimError?: string;
  claimToken?: string;
}

interface RouteWithParams {
  params?: ClaimRouteParams;
}

interface ExtendedSnackbarParams extends SnackbarParams {
  actionLabel?: string;
  onAction?: () => Promise<void>;
}

interface UseClaimNotificationsParams {
  route: RouteWithParams | undefined;
  showSnackbar: (params: ExtendedSnackbarParams) => void;
  dismissSnackbar: () => void;
  switchAccount?: (accountIndex: number) => Promise<void>;
}

/**
 * Hook for handling P2PK token claim notifications
 */
export function useClaimNotifications({
  route,
  showSnackbar,
  dismissSnackbar,
  switchAccount,
}: UseClaimNotificationsParams): void {
  const navigation = useNavigation() as ClaimNavigationType;
  // Get stable reference to triggerWalletReload to avoid re-renders
  const triggerWalletReload = useTokenProcessingStore((state) => state.triggerWalletReload);
  const setPendingToken = useTokenProcessingStore((state) => state.setPendingToken);
  const triggerTokenCheck = useTokenProcessingStore((state) => state.triggerTokenCheck);

  useEffect(() => {
    logger.debug('🎯 useClaimNotifications effect triggered:', {
      claimSuccess: route?.params?.claimSuccess,
      claimError: route?.params?.claimError,
    });

    if (route?.params?.claimSuccess) {
      logger.debug('🎯 Showing success snackbar for claim');
      showSnackbar({
        message: 'Token claimed successfully',
        type: 'success',
        action: 'claim',
      });
      // Clear the param so it doesn't trigger again
      navigation.setParams({ claimSuccess: undefined });
    } else if (route?.params?.claimError) {
      logger.debug('🎯 Showing error snackbar for claim');

      const errorMessage = route.params.claimError;
      const snackbarConfig: ExtendedSnackbarParams = {
        message: errorMessage,
        type: 'error',
        action: 'claim',
      };

      // Check if error is about wrong account - add switch button
      if (errorMessage.includes('This proof belongs to account')) {
        const accountMatch = errorMessage.match(/account (\d+)/);
        if (accountMatch) {
          const targetAccount = parseInt(accountMatch[1], 10);
          const targetAccountIndex = targetAccount - 1;
          const tokenToRetry = route.params.claimToken;

          snackbarConfig.persistent = true;
          snackbarConfig.actionLabel = `Switch & Claim`;
          snackbarConfig.onAction = async () => {
            try {
              logger.info('[useClaimNotifications] ========================================');
              logger.info('[useClaimNotifications] Switch & Claim button clicked!');
              logger.info('[useClaimNotifications] Target account:', { targetAccountIndex });
              logger.info('[useClaimNotifications] Has token to retry:', { hasToken: !!tokenToRetry });
              logger.info('[useClaimNotifications] Token length:', { length: tokenToRetry?.length });
              logger.info('[useClaimNotifications] dismissSnackbar type:', { type: typeof dismissSnackbar });
              logger.info('[useClaimNotifications] ========================================');

              if (!switchAccount) {
                logger.error('[useClaimNotifications] switchAccount is not available!');
                showSnackbar({
                  message: 'Account switching not available',
                  type: 'error',
                  action: 'switch',
                });
                return;
              }

              // Dismiss the error snackbar immediately
              logger.info('[useClaimNotifications] Calling dismissSnackbar...');
              dismissSnackbar();
              logger.info('[useClaimNotifications] dismissSnackbar called');

              logger.info('[useClaimNotifications] Switching account...');
              await switchAccount(targetAccountIndex);
              logger.info('[useClaimNotifications] Account switched successfully');

              // Trigger wallet reload via store
              logger.info('[useClaimNotifications] Reloading wallet via store...');
              triggerWalletReload();

              // Clear the error params
              logger.info('[useClaimNotifications] Clearing route params...');
              navigation.setParams({ claimError: undefined, claimToken: undefined });

              // If we have a token, automatically retry claiming it
              if (tokenToRetry) {
                logger.info('[useClaimNotifications] Will retry token claim after delay');
                // Small delay to ensure wallet state is updated
                setTimeout(() => {
                  logger.info('[useClaimNotifications] Queueing token retry in Turbo processor...');
                  setPendingToken(tokenToRetry);
                  triggerTokenCheck();
                }, 100);
              } else {
                logger.warn('[useClaimNotifications] No token to retry!');
                showSnackbar({
                  message: `Switched to Account ${targetAccount}`,
                  type: 'success',
                  action: 'switch',
                });
              }
            } catch (err: unknown) {
              logger.error('[useClaimNotifications] Failed to switch account:', { error: err instanceof Error ? err.message : String(err) });
              showSnackbar({
                message: 'Failed to switch account',
                type: 'error',
                action: 'switch',
              });
            }
          };
        }
      }

      showSnackbar(snackbarConfig);
      // Clear the params so they don't trigger again (unless we're retrying)
      if (!errorMessage.includes('This proof belongs to account')) {
        navigation.setParams({ claimError: undefined, claimToken: undefined });
      }
    }
  }, [route?.params?.claimSuccess, route?.params?.claimError, route?.params?.claimToken, showSnackbar, navigation, switchAccount, dismissSnackbar, triggerWalletReload, setPendingToken, triggerTokenCheck]);
}
