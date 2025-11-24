/**
 * useClaimNotifications - Hook for handling claim success/error notifications
 * Extracts claim notification logic from WalletPage
 */

import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { logger } from '../utils/logger';

/**
 * Hook for handling P2PK token claim notifications
 * @param {Object} params
 * @param {Object} params.route - Route object with claim params
 * @param {Function} params.showSnackbar - Function to show snackbar
 * @param {Function} params.dismissSnackbar - Function to dismiss snackbar
 * @param {Function} params.switchAccount - Function to switch accounts
 */
export function useClaimNotifications({
  route,
  showSnackbar,
  dismissSnackbar,
  switchAccount,
}) {
  const navigation = useNavigation();

  useEffect(() => {
    logger.debug('🎯 useClaimNotifications effect triggered:', {
      claimSuccess: route?.params?.claimSuccess,
      claimError: route?.params?.claimError,
    });

    if (route?.params?.claimSuccess) {
      logger.debug('🎯 Showing success snackbar for claim');
      showSnackbar({
        type: 'success',
        action: 'claim',
      });
      // Clear the param so it doesn't trigger again
      navigation.setParams({ claimSuccess: undefined });
    } else if (route?.params?.claimError) {
      logger.debug('🎯 Showing error snackbar for claim');

      const errorMessage = route.params.claimError;
      const snackbarConfig = {
        type: 'error',
        action: 'claim',
        description: errorMessage,
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
              logger.info('[useClaimNotifications] Target account:', targetAccountIndex);
              logger.info('[useClaimNotifications] Has token to retry:', !!tokenToRetry);
              logger.info('[useClaimNotifications] Token length:', tokenToRetry?.length);
              logger.info('[useClaimNotifications] dismissSnackbar type:', typeof dismissSnackbar);
              logger.info('[useClaimNotifications] ========================================');

              if (!switchAccount) {
                logger.error('[useClaimNotifications] switchAccount is not available!');
                showSnackbar({
                  type: 'error',
                  action: 'switch',
                  description: 'Account switching not available',
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

              if (global.reloadWallet) {
                logger.info('[useClaimNotifications] Reloading wallet...');
                global.reloadWallet();
              }

              // Clear the error params
              logger.info('[useClaimNotifications] Clearing route params...');
              navigation.setParams({ claimError: undefined, claimToken: undefined });

              // If we have a token, automatically retry claiming it
              if (tokenToRetry) {
                logger.info('[useClaimNotifications] Will retry token claim after delay');
                // Small delay to ensure wallet state is updated
                setTimeout(() => {
                  logger.info('[useClaimNotifications] Navigating to TurboClaiming with token...');
                  navigation.navigate('TurboClaiming', {
                    tokenString: tokenToRetry,
                  });
                }, 100);
              } else {
                logger.warn('[useClaimNotifications] No token to retry!');
                showSnackbar({
                  type: 'success',
                  action: 'switch',
                  description: `Switched to Account ${targetAccount}`,
                });
              }
            } catch (err) {
              logger.error('[useClaimNotifications] Failed to switch account:', err);
              showSnackbar({
                type: 'error',
                action: 'switch',
                description: 'Failed to switch account',
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
  }, [route?.params?.claimSuccess, route?.params?.claimError, showSnackbar, navigation, switchAccount, dismissSnackbar]);
}
