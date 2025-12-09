/**
 * useTurboTokenProcessor Hook
 * Handles processing of pending Cashu tokens after authentication
 */

import React from 'react';
import { logger } from '../utils/logger';
import { markTokenAsProcessed, turboGlobal } from '../services/turbo/turboTokenStorage';
import { saveReceivedToken } from '../services/cashu/cashuLockedTokensService';
import { useTokenProcessingStore, selectPendingToken } from '../stores/tokenProcessingStore';
import type { SnackbarParams } from '../types/notification';
import type { WalletAddresses } from '../contexts/WalletContext';

interface ReceiveResult {
  amount: number;
}

interface UseTurboTokenProcessorParams {
  isAuthenticated: boolean;
  shouldShowPinOverlay: boolean;
  receive: (token: string) => Promise<ReceiveResult>;
  fetchBalance: () => Promise<void>;
  refreshCashu: () => Promise<void>;
  wallet: WalletAddresses | null;
  showSnackbar: (params: SnackbarParams) => void;
  dismissSnackbar: () => void;
  switchAccount: (accountIndex: number) => Promise<WalletAddresses>;
}

interface UseTurboTokenProcessorReturn {
  isVerifyingToken: boolean;
}

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
}: UseTurboTokenProcessorParams): UseTurboTokenProcessorReturn {
  const [isVerifyingToken, setIsVerifyingToken] = React.useState(false);
  const [pendingSuccessMessage, setPendingSuccessMessage] = React.useState<string | null>(null);

  // Use token processing store instead of global variables
  const pendingToken = useTokenProcessingStore(selectPendingToken);
  const tokenStore = useTokenProcessingStore();

  // Debug: Log authentication state changes
  React.useEffect(() => {
    logger.debug('[TURBO AUTH] State changed:', {
      isAuthenticated,
      showPinEntry: shouldShowPinOverlay,
      hasPendingToken: !!pendingToken,
    });
  }, [isAuthenticated, shouldShowPinOverlay, pendingToken]);

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
  const processToken = React.useCallback(async (token: string) => {
    try {
      setIsVerifyingToken(true);
      const result = await receive(token);

      const amountDisplay = result.amount.toFixed(2);
      logger.debug('[TURBO] Success! Received:', amountDisplay, 'UNIT');

      // Save to transaction history
      try {
        await saveReceivedToken(token, 'Turbo Claim', result.amount * 100, wallet?.taprootAddress || '');
        logger.debug('[TURBO] Saved to transaction history');
      } catch (err: unknown) {
        logger.warn('[TURBO] Failed to save to history:', { message: err instanceof Error ? err.message : String(err) });
      }

      // Mark as processed
      await markTokenAsProcessed(token);

      // Set success message
      setPendingSuccessMessage(`Successfully received ${amountDisplay} UNIT`);

      // Refresh balance
      logger.debug('[TURBO] Refreshing balance');
      await fetchBalance();
      await refreshCashu();

      // Trigger UI refresh via store
      setTimeout(() => {
        tokenStore.triggerWalletReload();
      }, 1000);

      setIsVerifyingToken(false);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('[TURBO] Failed:', { message: errMsg });
      setIsVerifyingToken(false);

      const errorMessage = errMsg || 'Failed to receive token';
      const snackbarConfig: SnackbarParams = {
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
          snackbarConfig.actionButtons = [{
            label: 'Switch & Claim',
            variant: 'primary',
            onPress: () => {
              (async () => {
                try {
                  logger.debug('[TURBO] Switching to account:', targetAccountIndex);
                  dismissSnackbar();
                  await switchAccount(targetAccountIndex);

                  // Trigger wallet reload via store
                  tokenStore.triggerWalletReload();

                  await new Promise(resolve => setTimeout(resolve, 1000));
                  // Set pending token via store for retry
                  tokenStore.setPendingToken(tokenToRetry);
                } catch (err: unknown) {
                  logger.error('[TURBO] Failed to switch account:', { error: err instanceof Error ? err.message : String(err) });
                  showSnackbar({
                    type: 'error',
                    action: 'switch',
                    description: 'Failed to switch account',
                  });
                }
              })();
            },
          }];
        }
      }

      turboGlobal.pendingTurboSnackbars = [{
        type: snackbarConfig.type,
        message: snackbarConfig.description || errorMessage,
      }];
    }
  }, [receive, wallet, fetchBalance, refreshCashu, dismissSnackbar, switchAccount, showSnackbar, tokenStore]);

  // Poll for pending tokens using the store
  React.useEffect(() => {
    if (!isAuthenticated || shouldShowPinOverlay) {
      return;
    }

    const checkPendingToken = () => {
      const token = tokenStore.consumePendingToken();
      if (token && !isVerifyingToken) {
        logger.debug('[TURBO] Processing pending token from store');
        processToken(token);
      }
    };

    // Check immediately and poll
    checkPendingToken();
    const interval = setInterval(checkPendingToken, 500);

    // Register callback for external triggering via store
    tokenStore.registerTokenCheckCallback(checkPendingToken);

    return () => {
      clearInterval(interval);
      tokenStore.unregisterTokenCheckCallback();
    };
  }, [isAuthenticated, shouldShowPinOverlay, isVerifyingToken, processToken, tokenStore]);

  return { isVerifyingToken };
}
