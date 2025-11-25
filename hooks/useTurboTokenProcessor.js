/**
 * useTurboTokenProcessor Hook
 * Handles processing of pending Cashu tokens after authentication
 */

import React from 'react';
import { logger } from '../utils/logger';
import { markTokenAsProcessed } from '../services/turbo/turboTokenStorage';

/**
 * Hook to process pending Turbo tokens after user authentication
 */
export function useTurboTokenProcessor({
  isAuthenticated,
  shouldShowPinOverlay,
  receive,
  fetchBalance,
  refreshCashu,
  wallet,
  showSnackbar,
  dismissSnackbar,
  switchAccount,
}) {
  const [isVerifyingToken, setIsVerifyingToken] = React.useState(false);
  const [pendingSuccessMessage, setPendingSuccessMessage] = React.useState(null);

  // Debug: Log authentication state changes
  React.useEffect(() => {
    logger.debug('[TURBO AUTH] State changed:', {
      isAuthenticated,
      showPinEntry: shouldShowPinOverlay,
      hasPendingToken: !!global.pendingCashuToken,
    });
  }, [isAuthenticated, shouldShowPinOverlay]);

  // Show success snackbar when loading finishes
  React.useEffect(() => {
    if (!isVerifyingToken && pendingSuccessMessage) {
      logger.debug('[TURBO] Loading cleared, showing success snackbar');
      showSnackbar({
        type: 'success',
        action: 'claim',
        description: pendingSuccessMessage,
      });
      setPendingSuccessMessage(null);
    }
  }, [isVerifyingToken, pendingSuccessMessage, showSnackbar]);

  // Process token
  const processToken = React.useCallback(async (token) => {
    try {
      setIsVerifyingToken(true);
      const result = await receive(token);

      const amountDisplay = result.amount.toFixed(2);
      logger.debug('[TURBO] Success! Received:', amountDisplay, 'UNIT');

      // Save to transaction history
      try {
        const { saveReceivedToken } = await import('../services/cashu/cashuLockedTokensService');
        await saveReceivedToken(token, 'Turbo Claim', result.amount * 100, wallet?.taprootAddress);
        logger.debug('[TURBO] Saved to transaction history');
      } catch (err) {
        logger.warn('[TURBO] Failed to save to history:', { message: err.message });
      }

      // Mark as processed
      await markTokenAsProcessed(token);

      // Set success message
      setPendingSuccessMessage(`Successfully received ${amountDisplay} UNIT`);

      // Refresh balance
      logger.debug('[TURBO] Refreshing balance');
      await fetchBalance();
      await refreshCashu();

      // Trigger UI refresh
      setTimeout(() => {
        if (global.reloadWallet) {
          global.reloadWallet();
        }
      }, 1000);

      setIsVerifyingToken(false);
    } catch (error) {
      logger.error('[TURBO] Failed:', { message: error.message });
      setIsVerifyingToken(false);

      const errorMessage = error.message || 'Failed to receive token';
      const snackbarConfig = {
        type: 'error',
        action: 'claim',
        description: errorMessage,
      };

      if (errorMessage.includes('already spent') || errorMessage.includes('already been spent')) {
        snackbarConfig.description = 'Token already claimed';
      } else if (errorMessage.includes('P2PK verification failed')) {
        snackbarConfig.description = errorMessage;
        snackbarConfig.duration = 8000;
      } else if (errorMessage.includes('Swap failed')) {
        snackbarConfig.description = errorMessage;
        snackbarConfig.duration = 8000;
      } else if (errorMessage.includes('This proof belongs to account')) {
        // Handle account switch
        const accountMatch = errorMessage.match(/account (\d+)/);
        if (accountMatch) {
          const targetAccountIndex = parseInt(accountMatch[1], 10) - 1;
          const tokenToRetry = token;

          snackbarConfig.description = errorMessage;
          snackbarConfig.persistent = true;
          snackbarConfig.actionLabel = 'Switch & Claim';
          snackbarConfig.onAction = async () => {
            try {
              logger.debug('[TURBO] Switching to account:', targetAccountIndex);
              dismissSnackbar();
              await switchAccount(targetAccountIndex);

              if (global.reloadWallet) {
                global.reloadWallet();
              }

              await new Promise(resolve => setTimeout(resolve, 1000));
              global.pendingCashuToken = tokenToRetry;
            } catch (err) {
              logger.error('[TURBO] Failed to switch account:', err);
              showSnackbar({
                type: 'error',
                action: 'switch',
                description: 'Failed to switch account',
              });
            }
          };
        }
      }

      global.pendingTurboSnackbars = [snackbarConfig];
    }
  }, [receive, wallet, fetchBalance, refreshCashu, dismissSnackbar, switchAccount, showSnackbar]);

  // Poll for pending tokens
  React.useEffect(() => {
    if (!isAuthenticated || shouldShowPinOverlay) {
      return;
    }

    const checkPendingToken = () => {
      if (global.pendingCashuToken && !isVerifyingToken) {
        const token = global.pendingCashuToken;
        logger.debug('[TURBO] Processing pending token');
        delete global.pendingCashuToken;
        processToken(token);
      }
    };

    // Check immediately and poll
    checkPendingToken();
    const interval = setInterval(checkPendingToken, 500);

    // Expose for external triggering
    global.triggerPendingTokenCheck = checkPendingToken;

    return () => {
      clearInterval(interval);
      delete global.triggerPendingTokenCheck;
    };
  }, [isAuthenticated, shouldShowPinOverlay, isVerifyingToken, processToken]);

  return { isVerifyingToken };
}
