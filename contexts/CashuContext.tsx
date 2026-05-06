/**
 * CashuContext - Cashu e-cash wallet state management
 * Split into separate contexts for better performance:
 * - CashuBalanceContext: balance, loading, error (frequently read)
 * - CashuOperationsContext: operations (stable references)
 */

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, InteractionManager } from 'react-native';
import { useCashuBalance } from '../hooks/useCashuBalance';
import { useCashuMelt } from '../hooks/useCashuMelt';
import { useCashuMint } from '../hooks/useCashuMint';
import { useCashuSendReceive } from '../hooks/useCashuSendReceive';
import { saveSentLockedToken } from '../services/cashu/cashuLockedTokensService';
import { recoverUnclaimedMintQuotes } from '../services/cashu/cashuMintQuoteRecovery';
import { recoverFailedProofSaves } from '../services/cashu/cashuProofRecoveryQueue';
import {
  checkAndRecoverSwaps,
  clearRecoveredOutgoingSwapToken,
  loadRecoveredOutgoingSwapTokens,
} from '../services/cashu/cashuSwapRecovery';
import { recoverPendingTurboSend } from '../services/cashu/cashuTurboRecovery';
import {
  clearWallet,
  removeProofs,
  removeSpentProofs,
  sendP2PKToken,
  setCurrentAccount,
} from '../services/cashu/cashuWalletService';
import { refreshPersistedTurboMintSettlementStatus } from '../services/vaultSettlementService';
import type {
  MeltQuoteResult,
  MeltResult,
  MintQuoteResult,
  ReceiveTokenResult,
  SendTokenResult,
} from '../services/cashu/cashuWalletService';
import { shortenCashuToken } from '../services/urlShortener';
import { extractPubkeyFromTaprootAddress } from '../utils/bitcoin';
import { logger } from '../utils/logger';
import { notify } from '../utils/notify';
import { analytics } from '../services/analyticsService';
import { CASHU_EVENTS } from '../constants/analyticsEvents';
import { useAuthSession } from './AuthContext';
import { useWallet } from './WalletContext';

export interface PendingMint {
  quoteId: string;
  amount: number;
  createdAt: number;
  [key: string]: unknown;
}

export interface CashuBalanceValue {
  balance: number;
  isLoading: boolean;
  error: string | null;
  pendingMints: PendingMint[];
}

export interface MintCheckResult {
  completed: boolean;
  proofs?: unknown[];
  amount?: number;
  state?: string;
}

interface AutoMintSuccessData {
  address: string;
  amount: number;
  quoteId: string;
}

export interface CashuOperationsValue {
  startMint: (amount: number) => Promise<MintQuoteResult>;
  checkAndCompleteMint: (quoteId: string) => Promise<MintCheckResult>;
  removePendingMint: (quoteId: string) => void;
  addPendingMint: (quoteId: string, amount: number) => void;
  autoMint: (
    amountSats: number,
    onSuccess?: (data: AutoMintSuccessData) => void
  ) => Promise<MintQuoteResult>;
  receive: (token: string) => Promise<ReceiveTokenResult>;
  send: (amount: number) => Promise<SendTokenResult>;
  startMelt: (address: string, amount: number) => Promise<MeltQuoteResult>;
  finishMelt: (quoteId: string, totalAmount: number) => Promise<MeltResult>;
  refresh: () => Promise<void>;
  resetAndRefresh: (newTaprootAddress?: string) => Promise<void>;
  reset: () => Promise<void>;
}

export type CashuContextValue = CashuBalanceValue & CashuOperationsValue;

// Separate contexts for different update frequencies
const CashuBalanceContext = createContext<CashuBalanceValue | undefined>(undefined);
const CashuOperationsContext = createContext<CashuOperationsValue | undefined>(undefined);

/**
 * Hook for balance-related state (frequently updated)
 */
export const useCashuBalanceState = (): CashuBalanceValue => {
  const context = useContext(CashuBalanceContext);
  if (!context) {
    throw new Error('useCashuBalanceState must be used within a CashuProvider');
  }
  return context;
};

/**
 * Hook for operations (stable references, rarely changes)
 */
export const useCashuOperations = (): CashuOperationsValue => {
  const context = useContext(CashuOperationsContext);
  if (!context) {
    throw new Error('useCashuOperations must be used within a CashuProvider');
  }
  return context;
};

/**
 * Combined hook - returns all context values
 * Use useCashuBalanceState or useCashuOperations for better performance
 */
export const useCashu = (): CashuContextValue => {
  const balance = useCashuBalanceState();
  const operations = useCashuOperations();
  return { ...balance, ...operations };
};

interface CashuProviderProps {
  children: ReactNode;
}

export const CashuProvider: React.FC<CashuProviderProps> = ({ children }) => {
  const { wallet } = useWallet();
  const { isAuthenticated } = useAuthSession();
  const activeWallet = isAuthenticated ? wallet : null;
  const [isLoading, setIsLoading] = useState(false);
  const prevWalletRef = useRef<typeof wallet | null>(null);

  // Balance management
  const { balance, setBalance, error, setError, fetchBalance } = useCashuBalance({
    wallet: activeWallet,
  });

  // Mint operations
  const {
    pendingMints,
    startMint,
    checkAndCompleteMint,
    removePendingMint,
    autoMint,
    setPendingMints,
  } = useCashuMint({ fetchBalance, setIsLoading, setError });

  // Melt operations
  const { startMelt, finishMelt } = useCashuMelt({ setIsLoading, setError, setBalance });

  // Send/Receive operations
  const { receive, send } = useCashuSendReceive({
    setIsLoading,
    setError,
    setBalance,
    fetchBalance,
    taprootAddress: activeWallet?.taprootAddress,
  });

  /**
   * Add an externally-created mint quote to the pending mints list.
   * Used by the threshold conversion flow which creates its own quote
   * via useEcashThresholdManager but needs app-level polling to complete it.
   */
  const addPendingMint = useCallback(
    (quoteId: string, amount: number) => {
      setPendingMints((prev) => {
        // Don't add duplicates
        if (prev.some((m) => m.quoteId === quoteId)) {
          logger.debug('[CashuContext] addPendingMint: already exists', {
            quoteId: quoteId.substring(0, 8),
          });
          return prev;
        }
        logger.debug('[CashuContext] addPendingMint: adding to pending mints', {
          quoteId: quoteId.substring(0, 8),
          amount,
        });
        return [
          ...prev,
          {
            quoteId,
            amount,
            depositAddress: '', // Not needed for completion polling
            state: 'UNPAID',
            createdAt: Date.now(),
          },
        ];
      });
    },
    [setPendingMints]
  );

  // Track wallet for reference (account switch reset is handled by useAccountSwitcher)
  useEffect(() => {
    prevWalletRef.current = activeWallet;
  }, [activeWallet]);

  // Check for and recover any pending swap/mint/turbo transactions on startup
  const recoveryChecked = useRef(false);
  const foregroundRecoveryInFlightRef = useRef(false);
  const hasSeenAuthenticatedWalletRef = useRef(false);

  const recoverOutgoingSwapTokens = useCallback(
    async (source: string): Promise<number> => {
      const recoveredTokens = await loadRecoveredOutgoingSwapTokens();
      if (recoveredTokens.length === 0) {
        return 0;
      }

      let recovered = 0;
      for (const recoveredToken of recoveredTokens) {
        const recipient =
          recoveredToken.recipient ||
          (recoveredToken.kind === 'send' ? 'Recovered Cashu token' : 'Recovered P2PK token');

        try {
          await saveSentLockedToken(
            recoveredToken.token,
            recipient,
            recoveredToken.amount,
            null,
            null,
            recoveredToken.taprootAddress ?? activeWallet?.taprootAddress ?? null
          );
          if (recoveredToken.proofsToRemove?.length) {
            await removeProofs(recoveredToken.proofsToRemove);
          }
          await clearRecoveredOutgoingSwapToken(recoveredToken.token);
          recovered += 1;
          logger.info('[CashuContext] Recovered outgoing Cashu token from swap journal', {
            source,
            kind: recoveredToken.kind,
            amount: recoveredToken.amount,
            hasRecipient: Boolean(recoveredToken.recipient),
          });
        } catch (error) {
          logger.error('[CashuContext] Failed to recover outgoing Cashu token', {
            source,
            kind: recoveredToken.kind,
            amount: recoveredToken.amount,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return recovered;
    },
    [activeWallet?.taprootAddress]
  );

  const runTurboMintForegroundRecovery = useCallback(
    async (source: string) => {
      if (!activeWallet?.taprootAddress || foregroundRecoveryInFlightRef.current) {
        return;
      }

      foregroundRecoveryInFlightRef.current = true;
      try {
        logger.info('[CashuContext] Checking TurboUNIT mint recovery after foreground', { source });
        const proofSaveRecovery = await recoverFailedProofSaves();
        const mintRecovery = await recoverUnclaimedMintQuotes();
        const turboMintSettlement = await refreshPersistedTurboMintSettlementStatus();
        const outgoingTokenRecovery = await recoverOutgoingSwapTokens(source);

        if (
          proofSaveRecovery.recovered > 0 ||
          mintRecovery.recovered > 0 ||
          turboMintSettlement.status === 'settled' ||
          outgoingTokenRecovery > 0
        ) {
          await fetchBalance();
        }
      } catch (foregroundRecoveryError) {
        logger.error('[CashuContext] TurboUNIT foreground recovery failed', {
          source,
          error:
            foregroundRecoveryError instanceof Error
              ? foregroundRecoveryError.message
              : String(foregroundRecoveryError),
        });
      } finally {
        foregroundRecoveryInFlightRef.current = false;
      }
    },
    [activeWallet?.taprootAddress, fetchBalance, recoverOutgoingSwapTokens]
  );

  const reconcileSpentProofs = useCallback(async (source: string) => {
    try {
      const cleanup = await removeSpentProofs();
      if (cleanup.removed > 0) {
        logger.info('[CashuContext] Removed spent Cashu proofs during recovery', {
          source,
          removed: cleanup.removed,
          kept: cleanup.kept,
        });
      }
      return cleanup;
    } catch (spentProofError) {
      logger.error('[CashuContext] Spent proof reconciliation failed', {
        source,
        error: spentProofError instanceof Error ? spentProofError.message : String(spentProofError),
      });
      return { removed: 0, kept: 0 };
    }
  }, []);

  useEffect(() => {
    if (recoveryChecked.current || !activeWallet?.taprootAddress) {
      return;
    }
    let cancelled = false;
    let recoveryStarted = false;

    const runRecovery = async () => {
      if (recoveryChecked.current) {
        return;
      }
      recoveryChecked.current = true;
      recoveryStarted = true;

      try {
        // Check for pending swap recovery (proofs lost mid-swap)
        logger.info('[CashuContext] Checking for pending swap recovery...');
        await checkAndRecoverSwaps();
        if (cancelled) return;

        await recoverOutgoingSwapTokens('startup');
        if (cancelled) return;

        await reconcileSpentProofs('startup');
        if (cancelled) return;

        logger.info('[CashuContext] Checking for failed proof save recovery...');
        const proofSaveRecovery = await recoverFailedProofSaves();
        if (cancelled) return;
        if (proofSaveRecovery.recovered > 0) {
          logger.info('[CashuContext] Recovered failed proof saves on startup', {
            recovered: proofSaveRecovery.recovered,
            totalAmount: proofSaveRecovery.totalAmountRecovered,
          });
        }

        // Check for unclaimed mint quotes (paid but not claimed)
        logger.info('[CashuContext] Checking for unclaimed mint quotes...');
        const mintRecovery = await recoverUnclaimedMintQuotes();
        if (cancelled) return;
        if (mintRecovery.recovered > 0) {
          logger.info('[CashuContext] Recovered unclaimed mint quotes on startup', {
            recovered: mintRecovery.recovered,
            totalAmount: mintRecovery.totalAmountRecovered,
          });
        }

        // If a vault TurboUNIT mint finished while the app was locked, clear
        // the persisted UNIT send and mark the vault settlement complete.
        const turboMintSettlement = await refreshPersistedTurboMintSettlementStatus();
        if (cancelled) return;
        if (turboMintSettlement.status === 'settled') {
          logger.info('[CashuContext] Recovered persisted TurboUNIT vault settlement on startup', {
            lastStatus: turboMintSettlement.lastStatus,
          });
        }

        // Check for pending turbo sends (mint completed but P2PK not sent)
        logger.info('[CashuContext] Checking for pending turbo sends...');
        const turboRecovery = await recoverPendingTurboSend(
          sendP2PKToken,
          extractPubkeyFromTaprootAddress,
          shortenCashuToken,
          saveSentLockedToken
        );
        if (cancelled) return;
        if (turboRecovery.recovered) {
          logger.info('[CashuContext] Recovered pending turbo send on startup', {
            recipient: turboRecovery.recipient?.substring(0, 12) + '...',
            amount: turboRecovery.amount,
            hasToken: !!turboRecovery.token,
          });
          // Notify user that their turbo send was recovered
          if (turboRecovery.token) {
            notify.transaction.success('send');
          }
        }

        // Refresh balance after potential recovery
        await fetchBalance();
      } catch (recoveryError) {
        if (cancelled) return;
        logger.error('[CashuContext] Recovery check failed', {
          error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
        });
      }
    };

    const task = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) {
        runRecovery();
      }
    });

    return () => {
      cancelled = true;
      task.cancel();
      if (!recoveryStarted) {
        recoveryChecked.current = false;
      }
    };
  }, [
    activeWallet?.taprootAddress,
    fetchBalance,
    reconcileSpentProofs,
    recoverOutgoingSwapTokens,
  ]);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasLockedOrBackgrounded =
        previousState === 'inactive' || previousState === 'background';
      previousState = nextState;

      if (wasLockedOrBackgrounded && nextState === 'active') {
        runTurboMintForegroundRecovery('app_state_active').catch(() => undefined);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [runTurboMintForegroundRecovery]);

  useEffect(() => {
    if (!activeWallet?.taprootAddress) {
      return;
    }

    if (!hasSeenAuthenticatedWalletRef.current) {
      hasSeenAuthenticatedWalletRef.current = true;
      return;
    }

    runTurboMintForegroundRecovery('wallet_reauthenticated').catch(() => undefined);
  }, [activeWallet?.taprootAddress, runTurboMintForegroundRecovery]);

  /**
   * Clear all Cashu proofs (for testing/reset)
   */
  const reset = useCallback(async () => {
    try {
      await clearWallet();
      setBalance(0);
      setPendingMints([]);
      setError(null);
      logger.info('Cashu wallet reset');
    } catch (err: unknown) {
      if (err instanceof Error) {
        logger.error('Failed to reset wallet', { error: err.message });
      }
      throw err;
    }
  }, [setBalance, setPendingMints, setError]);

  /**
   * Refresh all data and recover any unclaimed mint quotes
   */
  const refresh = useCallback(async () => {
    // First, check for any paid but unclaimed mint quotes
    await reconcileSpentProofs('manual_refresh');

    try {
      logger.info('[CashuContext] Checking for failed proof save recovery...');
      const proofSaveRecovery = await recoverFailedProofSaves();

      if (proofSaveRecovery.recovered > 0) {
        logger.info('[CashuContext] Recovered failed proof saves', {
          recovered: proofSaveRecovery.recovered,
          totalAmount: proofSaveRecovery.totalAmountRecovered,
        });
      }
    } catch (proofSaveRecoveryError) {
      logger.error('[CashuContext] Failed proof save recovery failed', {
        error:
          proofSaveRecoveryError instanceof Error
            ? proofSaveRecoveryError.message
            : String(proofSaveRecoveryError),
      });
    }

    try {
      logger.info('[CashuContext] Checking for unclaimed mint quotes...');
      const recoveryResult = await recoverUnclaimedMintQuotes();

      if (recoveryResult.recovered > 0) {
        logger.info('[CashuContext] Recovered unclaimed mint quotes', {
          recovered: recoveryResult.recovered,
          totalAmount: recoveryResult.totalAmountRecovered,
        });
      }
    } catch (mintQuoteRecoveryError) {
      logger.error('[CashuContext] Mint quote recovery failed', {
        error:
          mintQuoteRecoveryError instanceof Error
            ? mintQuoteRecoveryError.message
            : String(mintQuoteRecoveryError),
      });
    }

    try {
      const turboMintSettlement = await refreshPersistedTurboMintSettlementStatus();
      if (turboMintSettlement.status === 'settled') {
        logger.info('[CashuContext] Recovered persisted TurboUNIT vault settlement', {
          lastStatus: turboMintSettlement.lastStatus,
        });
      }
    } catch (turboMintSettlementError) {
      logger.error('[CashuContext] TurboUNIT vault settlement recovery failed', {
        error:
          turboMintSettlementError instanceof Error
            ? turboMintSettlementError.message
            : String(turboMintSettlementError),
      });
    }

    // Also check for swap recovery
    try {
      await checkAndRecoverSwaps();
      await recoverOutgoingSwapTokens('manual_refresh');
    } catch (swapRecoveryError) {
      logger.error('[CashuContext] Swap recovery failed during refresh', {
        error:
          swapRecoveryError instanceof Error
            ? swapRecoveryError.message
            : String(swapRecoveryError),
      });
    }

    // Finally, refresh balance
    await fetchBalance();
  }, [fetchBalance, reconcileSpentProofs, recoverOutgoingSwapTokens]);

  /**
   * Reset and refresh for account switching
   * Called by useAccountSwitcher to ensure clean state
   */
  const resetAndRefresh = useCallback(
    async (newTaprootAddress?: string) => {
      // Reset state immediately (synchronous) for snappy UI
      setBalance(0);
      setPendingMints([]);
      setError(null);

      // CRITICAL: Set the current account BEFORE fetching balance
      // This ensures we read from the correct storage key
      if (newTaprootAddress) {
        await setCurrentAccount(newTaprootAddress);
        logger.debug('[CashuContext] resetAndRefresh: Set current account to', {
          address: newTaprootAddress.substring(0, 20) + '...',
        });
      }

      // Then fetch fresh balance from the correct account
      await fetchBalance();
    },
    [setBalance, setPendingMints, setError, fetchBalance]
  );

  // Memoize balance context value (changes frequently)
  const balanceValue = useMemo(
    (): CashuBalanceValue => ({
      balance,
      isLoading,
      error,
      pendingMints: pendingMints as PendingMint[],
    }),
    [balance, isLoading, error, pendingMints]
  );

  // Tracked wrappers for analytics
  const trackedStartMint = useCallback(
    async (amount: number) => {
      analytics.track(CASHU_EVENTS.CASHU_MINT_STARTED, { amount });
      return startMint(amount);
    },
    [startMint]
  );

  const trackedCheckAndCompleteMint = useCallback(
    async (quoteId: string) => {
      const result = await checkAndCompleteMint(quoteId);
      if (result.completed)
        analytics.track(CASHU_EVENTS.CASHU_MINT_COMPLETED, { amount: result.amount });
      return result;
    },
    [checkAndCompleteMint]
  );

  const trackedReceive = useCallback(
    async (token: string) => {
      const result = await receive(token);
      analytics.track(CASHU_EVENTS.CASHU_TOKEN_RECEIVED);
      return result;
    },
    [receive]
  );

  const trackedSend = useCallback(
    async (amount: number) => {
      const result = await send(amount);
      analytics.track(CASHU_EVENTS.CASHU_TOKEN_SENT, { amount });
      return result;
    },
    [send]
  );

  const trackedStartMelt = useCallback(
    async (address: string, amount: number) => {
      analytics.track(CASHU_EVENTS.CASHU_MELT_STARTED, { amount });
      return startMelt(address, amount);
    },
    [startMelt]
  );

  const trackedFinishMelt = useCallback(
    async (quoteId: string, totalAmount: number) => {
      const result = await finishMelt(quoteId, totalAmount);
      analytics.track(CASHU_EVENTS.CASHU_MELT_COMPLETED, { amount: totalAmount });
      return result;
    },
    [finishMelt]
  );

  // Memoize operations context value (stable references)
  const operationsValue = useMemo(
    (): CashuOperationsValue => ({
      startMint: trackedStartMint,
      checkAndCompleteMint: trackedCheckAndCompleteMint,
      removePendingMint,
      addPendingMint,
      autoMint,
      receive: trackedReceive,
      send: trackedSend,
      startMelt: trackedStartMelt,
      finishMelt: trackedFinishMelt,
      refresh,
      resetAndRefresh,
      reset,
    }),
    [
      trackedStartMint,
      trackedCheckAndCompleteMint,
      removePendingMint,
      addPendingMint,
      autoMint,
      trackedReceive,
      trackedSend,
      trackedStartMelt,
      trackedFinishMelt,
      refresh,
      resetAndRefresh,
      reset,
    ]
  );

  return (
    <CashuBalanceContext.Provider value={balanceValue}>
      <CashuOperationsContext.Provider value={operationsValue}>
        {children}
      </CashuOperationsContext.Provider>
    </CashuBalanceContext.Provider>
  );
};
