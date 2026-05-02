/**
 * useTurboTokenProcessor Hook
 * Handles processing of pending Cashu tokens after authentication
 */

import React from 'react';
import { logger } from '../utils/logger';
import { markTokenAsProcessed, turboGlobal } from '../services/turbo/turboTokenStorage';
import { saveReceivedToken } from '../services/cashu/cashuLockedTokensService';
import { useTokenProcessingStore, selectPendingToken } from '../stores/tokenProcessingStore';
import { useSwapDiagnosticsStore } from '../stores/swapDiagnosticsStore';
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
  checkQueuedSnackbars?: () => void;
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
  checkQueuedSnackbars,
}: UseTurboTokenProcessorParams): UseTurboTokenProcessorReturn {
  const [isVerifyingToken, setIsVerifyingToken] = React.useState(false);
  const [pendingSuccessMessage, setPendingSuccessMessage] = React.useState<string | null>(null);
  const mountedRef = React.useRef(true);
  const walletReloadTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const diagnosticsPollIdRef = React.useRef<string | null>(null);

  // Use token processing store instead of global variables
  const pendingToken = useTokenProcessingStore(selectPendingToken);
  const hasWallet = !!wallet;
  // Get stable references to store actions to avoid re-renders
  const consumePendingToken = useTokenProcessingStore((state) => state.consumePendingToken);
  const registerTokenCheckCallback = useTokenProcessingStore((state) => state.registerTokenCheckCallback);
  const unregisterTokenCheckCallback = useTokenProcessingStore((state) => state.unregisterTokenCheckCallback);
  const triggerWalletReload = useTokenProcessingStore((state) => state.triggerWalletReload);
  const setPendingToken = useTokenProcessingStore((state) => state.setPendingToken);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (walletReloadTimerRef.current) {
        clearTimeout(walletReloadTimerRef.current);
        walletReloadTimerRef.current = null;
      }
    };
  }, []);

  const scheduleWalletReload = React.useCallback(() => {
    if (walletReloadTimerRef.current) {
      clearTimeout(walletReloadTimerRef.current);
    }
    walletReloadTimerRef.current = setTimeout(() => {
      walletReloadTimerRef.current = null;
      if (mountedRef.current) {
        triggerWalletReload();
      }
    }, 1000);
    (walletReloadTimerRef.current as { unref?: () => void }).unref?.();
  }, [triggerWalletReload]);

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
    const pollId = diagnosticsPollIdRef.current;
    try {
      if (mountedRef.current) {
        setIsVerifyingToken(true);
      }
      const result = await receive(token);

      const amountDisplay = (result.amount / 100).toFixed(2);
      logger.debug('[TURBO] Success! Received:', amountDisplay, 'UNIT');
      if (pollId) {
        useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
          lastStatus: 'processed_token',
          lastMessage: `Successfully received ${amountDisplay} UNIT`,
          metadata: {
            receivedUnit: amountDisplay,
          },
        });
      }

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
      if (mountedRef.current) {
        setPendingSuccessMessage(`Successfully received ${amountDisplay} UNIT`);
      }

      // Refresh balance
      logger.debug('[TURBO] Refreshing balance');
      await fetchBalance();
      await refreshCashu();

      // Trigger UI refresh via store
      if (mountedRef.current) {
        scheduleWalletReload();
      }

      if (mountedRef.current) {
        setIsVerifyingToken(false);
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('[TURBO] Failed:', { message: errMsg });
      if (pollId) {
        useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
          lastStatus: 'processing_error',
          lastError: errMsg,
        });
      }
      if (mountedRef.current) {
        setIsVerifyingToken(false);
      }

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
                  triggerWalletReload();

                  await new Promise(resolve => setTimeout(resolve, 1000));
                  // Set pending token via store for retry
                  setPendingToken(tokenToRetry);
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
  }, [receive, wallet, fetchBalance, refreshCashu, dismissSnackbar, switchAccount, showSnackbar, scheduleWalletReload, triggerWalletReload, setPendingToken]);

  // Poll for pending tokens using the store AND global turboGlobal
  React.useEffect(() => {
    logger.debug('[TURBO] Token processor effect running', {
      isAuthenticated,
      shouldShowPinOverlay,
      isVerifyingToken,
      hasTurboGlobalToken: !!turboGlobal.pendingCashuToken,
    });

    if (!isAuthenticated || shouldShowPinOverlay) {
      logger.debug('[TURBO] Token processor skipping - not authenticated or pin overlay showing');
      if (diagnosticsPollIdRef.current) {
        useSwapDiagnosticsStore.getState().stopPoll(
          diagnosticsPollIdRef.current,
          'Turbo token polling paused by auth state',
        );
        diagnosticsPollIdRef.current = null;
      }
      return;
    }

    const pollId = useSwapDiagnosticsStore.getState().startPoll({
      id: 'turbo-token-processor',
      kind: 'turbo_token_processor',
      label: 'Turbo token processor',
      intervalMs: 2000,
      metadata: {
        isAuthenticated,
        shouldShowPinOverlay,
        hasWallet,
      },
    });
    diagnosticsPollIdRef.current = pollId;

    const checkPendingToken = () => {
      // First check the Zustand store
      let token = consumePendingToken();
      let tokenSource = 'store';

      // Also check turboGlobal (used by deep link handler)
      if (!token && turboGlobal.pendingCashuToken) {
        token = turboGlobal.pendingCashuToken;
        tokenSource = 'turbo_global';
        turboGlobal.pendingCashuToken = undefined; // Clear it
        logger.debug('[TURBO] Found pending token from turboGlobal', { tokenLength: token?.length });
      }

      if (token && !isVerifyingToken) {
        useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
          lastStatus: 'token_found',
          lastMessage: 'Processing pending Turbo token',
          metadata: {
            tokenLength: token.length,
            source: tokenSource,
          },
        });
        logger.debug('[TURBO] Processing pending token', { tokenLength: token.length });
        processToken(token);
      } else {
        useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
          lastStatus: token ? 'busy' : 'idle',
          lastMessage: token
            ? 'Pending token found while another token is verifying'
            : 'No pending Turbo token',
          metadata: {
            isVerifyingToken,
            hasTurboGlobalToken: !!turboGlobal.pendingCashuToken,
          },
        });
      }

      // Also check queued snackbars (consolidated from useTurboSnackbarQueue)
      checkQueuedSnackbars?.();
    };

    // Check immediately and poll
    logger.debug('[TURBO] Starting token polling');
    checkPendingToken();
    // 2s poll interval — balances responsiveness with CPU usage
    const interval = setInterval(checkPendingToken, 2000);
    (interval as { unref?: () => void }).unref?.();

    // Register callback for external triggering via store
    registerTokenCheckCallback(checkPendingToken);

    return () => {
      clearInterval(interval);
      unregisterTokenCheckCallback();
      if (diagnosticsPollIdRef.current === pollId) {
        useSwapDiagnosticsStore.getState().stopPoll(pollId, 'Turbo token polling stopped');
        diagnosticsPollIdRef.current = null;
      }
    };
  }, [isAuthenticated, shouldShowPinOverlay, isVerifyingToken, processToken, consumePendingToken, registerTokenCheckCallback, unregisterTokenCheckCallback, checkQueuedSnackbars, hasWallet]);

  return { isVerifyingToken };
}
