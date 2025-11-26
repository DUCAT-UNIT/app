/**
 * useTurboTokenProcessor Hook
 * Handles processing of pending Cashu tokens after authentication
 */

import React from 'react';
import { logger } from '../utils/logger';
import { markTokenAsProcessed, turboGlobal } from '../services/turbo/turboTokenStorage';

interface SnackbarParams {
  type: string;
  action: string;
  description?: string;
  message?: string;
  persistent?: boolean;
  actionLabel?: string;
  duration?: number;
  onAction?: () => Promise<void>;
}

interface ReceiveResult {
  amount: number;
}

interface WalletData {
  taprootAddress?: string;
  [key: string]: unknown;
}

interface UseTurboTokenProcessorParams {
  isAuthenticated: boolean;
  shouldShowPinOverlay: boolean;
  receive: (token: string) => Promise<ReceiveResult>;
  fetchBalance: () => Promise<void>;
  refreshCashu: () => Promise<void>;
  wallet: WalletData | null;
  showSnackbar: (params: SnackbarParams) => void;
  dismissSnackbar: () => void;
  switchAccount: (accountIndex: number) => Promise<void>;
}

interface UseTurboTokenProcessorReturn {
  isVerifyingToken: boolean;
}

// Extend global to add wallet-related globals (some are also in useTurboSnackbarQueue.ts)
declare global {
  // eslint-disable-next-line no-var
  var pendingCashuToken: string | undefined;
  // eslint-disable-next-line no-var
  var reloadWallet: (() => void) | undefined;
  // eslint-disable-next-line no-var
  var triggerPendingTokenCheck: (() => void) | undefined;
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
  const processToken = React.useCallback(async (token: string) => {
    try {
      setIsVerifyingToken(true);
      const result = await receive(token);

      const amountDisplay = result.amount.toFixed(2);
      logger.debug('[TURBO] Success! Received:', amountDisplay, 'UNIT');

      // Save to transaction history
      try {
        const { saveReceivedToken } = await import('../services/cashu/cashuLockedTokensService');
        await saveReceivedToken(token, 'Turbo Claim', result.amount * 100, wallet?.taprootAddress || '');
        logger.debug('[TURBO] Saved to transaction history');
      } catch (err) {
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

      // Trigger UI refresh
      setTimeout(() => {
        if (global.reloadWallet) {
          global.reloadWallet();
        }
      }, 1000);

      setIsVerifyingToken(false);
    } catch (error) {
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
              logger.error('[TURBO] Failed to switch account:', { error: err instanceof Error ? err.message : String(err) });
              showSnackbar({
                type: 'error',
                action: 'switch',
                description: 'Failed to switch account',
              });
            }
          };
        }
      }

      turboGlobal.pendingTurboSnackbars = [{
        type: snackbarConfig.type,
        message: snackbarConfig.description || errorMessage,
      }];
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
