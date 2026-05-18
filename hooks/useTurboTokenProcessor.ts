/**
 * useTurboTokenProcessor Hook
 * Handles processing of pending Cashu tokens after authentication
 */

import React from 'react';
import { logger } from '../utils/logger';
import { markTokenAsProcessed, turboGlobal } from '../services/turbo/turboTokenStorage';
import { saveReceivedToken } from '../services/cashu/cashuLockedTokensService';
import { decodeTokenMetadata } from '../services/cashu/cashuWalletService';
import {
  DEFAULT_CASHU_UNIT,
  cashuUnitTokenSymbol,
  normalizeCashuUnit,
} from '../services/cashu/cashuUnits';
import { useTokenProcessingStore, selectPendingToken } from '../stores/tokenProcessingStore';
import { useSwapDiagnosticsStore } from '../stores/swapDiagnosticsStore';
import type { SnackbarParams } from '../types/notification';
import type { WalletAddresses } from '../contexts/WalletContext';

interface ReceiveResult {
  amount: number;
}

const formatCashuAmount = (amount: number, unit: 'unit' | 'sat'): string =>
  unit === 'sat'
    ? (amount / 100_000_000).toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
    : (amount / 100).toFixed(2);

const isTerminalClaimError = (message: string): boolean =>
  message.includes('already spent') ||
  message.includes('already been spent') ||
  message.includes('already claimed') ||
  message.includes('Token proofs are not spendable') ||
  message.includes('Token already received');

const isUnclaimableByWalletError = (message: string): boolean =>
  message.includes('not locked to any of your accounts') ||
  message.includes('does not belong to any scanned account');

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

type ClaimSnackbarAction = 'claim' | 'btc_claim';

interface PendingSuccessMessage {
  message: string;
  action: ClaimSnackbarAction;
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
  const [pendingSuccessMessage, setPendingSuccessMessage] =
    React.useState<PendingSuccessMessage | null>(null);
  const mountedRef = React.useRef(true);
  const walletReloadTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const diagnosticsPollIdRef = React.useRef<string | null>(null);

  // Use token processing store instead of global variables
  const pendingToken = useTokenProcessingStore(selectPendingToken);
  const hasWallet = !!wallet;
  // Get stable references to store actions to avoid re-renders
  const consumePendingToken = useTokenProcessingStore((state) => state.consumePendingToken);
  const hydratePendingToken = useTokenProcessingStore((state) => state.hydratePendingToken);
  const clearPendingToken = useTokenProcessingStore((state) => state.clearPendingToken);
  const registerTokenCheckCallback = useTokenProcessingStore(
    (state) => state.registerTokenCheckCallback
  );
  const unregisterTokenCheckCallback = useTokenProcessingStore(
    (state) => state.unregisterTokenCheckCallback
  );
  const triggerWalletReload = useTokenProcessingStore((state) => state.triggerWalletReload);
  const setPendingToken = useTokenProcessingStore((state) => state.setPendingToken);
  const markTokenProcessed = useTokenProcessingStore((state) => state.markTokenProcessed);
  const pauseProcessingToken = useTokenProcessingStore((state) => state.pauseProcessingToken);

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
        action: pendingSuccessMessage.action,
        description: pendingSuccessMessage.message,
      });
      setPendingSuccessMessage(null);
    }
  }, [isVerifyingToken, pendingSuccessMessage, showSnackbar]);

  // Process token
  const processToken = React.useCallback(
    async (token: string) => {
      const pollId = diagnosticsPollIdRef.current;
      let unit: 'unit' | 'sat' = DEFAULT_CASHU_UNIT;
      try {
        if (mountedRef.current) {
          setIsVerifyingToken(true);
        }
        try {
          const metadata = decodeTokenMetadata(token);
          unit = normalizeCashuUnit(metadata.unit ?? DEFAULT_CASHU_UNIT);
        } catch (decodeError) {
          const decodeMessage =
            decodeError instanceof Error ? decodeError.message : String(decodeError);
          if (decodeMessage.includes('Unsupported Cashu unit')) {
            throw decodeError;
          }
          logger.warn('[TURBO] Could not decode token unit before receive; defaulting to UNIT', {
            error: decodeMessage,
          });
        }
        const unitSymbol = cashuUnitTokenSymbol(unit);
        const result = await receive(token);

        const amountDisplay = formatCashuAmount(result.amount, unit);
        logger.info(`[E2E_TX] cashu_token_claimed amount=${result.amount} cashuUnit=${unit}`);
        logger.debug('[TURBO] Success! Received:', amountDisplay, unitSymbol);
        if (pollId) {
          useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
            lastStatus: 'processed_token',
            lastMessage: `Successfully received ${amountDisplay} ${unitSymbol}`,
            metadata: {
              receivedAmount: amountDisplay,
              cashuUnit: unit,
            },
          });
        }

        // Save to transaction history
        try {
          if (unit === DEFAULT_CASHU_UNIT) {
            await saveReceivedToken(
              token,
              'Turbo Claim',
              result.amount,
              wallet?.taprootAddress || ''
            );
          } else {
            await saveReceivedToken(
              token,
              'Turbo Claim',
              result.amount,
              wallet?.taprootAddress || '',
              unit
            );
          }
          logger.debug('[TURBO] Saved to transaction history');
        } catch (err: unknown) {
          logger.warn('[TURBO] Failed to save to history:', {
            message: err instanceof Error ? err.message : String(err),
          });
        }

        // Mark as processed
        await markTokenAsProcessed(token);
        await markTokenProcessed(token);
        clearPendingToken(token);

        // Set success message
        if (mountedRef.current) {
          setPendingSuccessMessage({
            message: `Successfully received ${amountDisplay} ${unitSymbol}`,
            action: unit === 'sat' ? 'btc_claim' : 'claim',
          });
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
          action: unit === 'sat' ? 'btc_claim' : 'claim',
          description: errorMessage,
        };

        if (isTerminalClaimError(errorMessage)) {
          snackbarConfig.description = 'Token already claimed';
          try {
            await markTokenAsProcessed(token);
            await markTokenProcessed(token);
            clearPendingToken(token);
          } catch (markError) {
            logger.warn('[TURBO] Failed to mark terminal token as processed', {
              error: markError instanceof Error ? markError.message : String(markError),
            });
          }
        } else if (isUnclaimableByWalletError(errorMessage)) {
          snackbarConfig.description = errorMessage;
          snackbarConfig.duration = 8000;
          clearPendingToken(token);
        } else {
          pauseProcessingToken(token);
        }

        if (!isTerminalClaimError(errorMessage)) {
          if (errorMessage.includes('P2PK verification failed')) {
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
              snackbarConfig.actionButtons = [
                {
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

                        await new Promise((resolve) => setTimeout(resolve, 1000));
                        // Set pending token via store for retry
                        await setPendingToken(tokenToRetry);
                      } catch (err: unknown) {
                        logger.error('[TURBO] Failed to switch account:', {
                          error: err instanceof Error ? err.message : String(err),
                        });
                        showSnackbar({
                          type: 'error',
                          action: 'switch',
                          description: 'Failed to switch account',
                        });
                      }
                    })();
                  },
                },
              ];
            }
          }
        }

        turboGlobal.pendingTurboSnackbars = [
          {
            type: snackbarConfig.type,
            message: snackbarConfig.description || errorMessage,
          },
        ];
      }
    },
    [
      receive,
      wallet,
      fetchBalance,
      refreshCashu,
      dismissSnackbar,
      switchAccount,
      showSnackbar,
      scheduleWalletReload,
      triggerWalletReload,
      setPendingToken,
      clearPendingToken,
      markTokenProcessed,
      pauseProcessingToken,
    ]
  );

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
        useSwapDiagnosticsStore
          .getState()
          .stopPoll(diagnosticsPollIdRef.current, 'Turbo token polling paused by auth state');
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

    const checkPendingToken = async () => {
      if (isVerifyingToken) {
        useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
          lastStatus: 'busy',
          lastMessage: 'Token verification already in progress',
          metadata: {
            hasPendingToken: !!pendingToken,
            hasTurboGlobalToken: !!turboGlobal.pendingCashuToken,
          },
        });
        checkQueuedSnackbars?.();
        return;
      }

      // First check the Zustand store
      let token = consumePendingToken();
      let tokenSource = 'store';
      if (token && turboGlobal.pendingCashuToken === token) {
        turboGlobal.pendingCashuToken = undefined;
      }

      // Also check turboGlobal (used by deep link handler)
      if (!token && turboGlobal.pendingCashuToken) {
        const globalToken = turboGlobal.pendingCashuToken;
        tokenSource = 'turbo_global';
        try {
          await setPendingToken(globalToken);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('[TURBO] Failed to persist pending turboGlobal token', {
            error: errorMessage,
          });
          useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
            lastStatus: 'queue_error',
            lastError: errorMessage,
          });
          return;
        }
        token = globalToken;
        consumePendingToken();
        turboGlobal.pendingCashuToken = undefined; // Clear it
        logger.debug('[TURBO] Found pending token from turboGlobal', {
          tokenLength: token?.length,
        });
      }

      if (token) {
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
          lastStatus: 'idle',
          lastMessage: 'No pending Turbo token',
          metadata: {
            isVerifyingToken,
            hasTurboGlobalToken: !!turboGlobal.pendingCashuToken,
          },
        });
      }

      // Also check queued snackbars (consolidated from useTurboSnackbarQueue)
      checkQueuedSnackbars?.();
    };

    let cancelled = false;

    // Check immediately after hydrating any token queued before app exit.
    logger.debug('[TURBO] Starting token polling');
    hydratePendingToken()
      .catch((error) => {
        logger.error('[TURBO] Failed to hydrate pending token:', {
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        if (!cancelled) {
          void checkPendingToken();
        }
      });
    // 2s poll interval — balances responsiveness with CPU usage
    const interval = setInterval(() => {
      void checkPendingToken();
    }, 2000);
    (interval as { unref?: () => void }).unref?.();

    // Register callback for external triggering via store
    registerTokenCheckCallback(() => {
      void checkPendingToken();
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      unregisterTokenCheckCallback();
      if (diagnosticsPollIdRef.current === pollId) {
        useSwapDiagnosticsStore.getState().stopPoll(pollId, 'Turbo token polling stopped');
        diagnosticsPollIdRef.current = null;
      }
    };
  }, [
    isAuthenticated,
    shouldShowPinOverlay,
    isVerifyingToken,
    processToken,
    consumePendingToken,
    hydratePendingToken,
    registerTokenCheckCallback,
    unregisterTokenCheckCallback,
    checkQueuedSnackbars,
    hasWallet,
    setPendingToken,
  ]);

  return { isVerifyingToken };
}
