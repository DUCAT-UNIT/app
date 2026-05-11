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
import {
  clearPendingTurboSend,
  recoverPendingTurboSend,
} from '../services/cashu/cashuTurboRecovery';
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
  taprootAddress?: string;
  [key: string]: unknown;
}

export interface CashuBalanceValue {
  balance: number;
  btcBalanceSats: number;
  isLoading: boolean;
  isBtcLoading: boolean;
  error: string | null;
  btcError: string | null;
  pendingMints: PendingMint[];
  pendingBtcMints: PendingMint[];
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
  startBtcMint: (amountSats: number) => Promise<MintQuoteResult>;
  checkAndCompleteMint: (quoteId: string) => Promise<MintCheckResult>;
  checkAndCompleteBtcMint: (quoteId: string) => Promise<MintCheckResult>;
  removePendingMint: (quoteId: string) => void;
  removePendingBtcMint: (quoteId: string) => void;
  addPendingMint: (quoteId: string, amount: number, taprootAddress?: string) => void;
  addPendingBtcMint: (quoteId: string, amount: number, taprootAddress?: string) => void;
  autoMint: (
    amountSats: number,
    onSuccess?: (data: AutoMintSuccessData) => void
  ) => Promise<MintQuoteResult>;
  autoBtcMint: (
    amountSats: number,
    onSuccess?: (data: AutoMintSuccessData) => void
  ) => Promise<MintQuoteResult>;
  receive: (token: string) => Promise<ReceiveTokenResult>;
  receiveBtc: (token: string) => Promise<ReceiveTokenResult>;
  send: (amount: number) => Promise<SendTokenResult>;
  sendBtc: (amountSats: number) => Promise<SendTokenResult>;
  startMelt: (address: string, amount: number) => Promise<MeltQuoteResult>;
  startBtcMelt: (address: string, amountSats: number) => Promise<MeltQuoteResult>;
  finishMelt: (quoteId: string, totalAmount: number) => Promise<MeltResult>;
  finishBtcMelt: (quoteId: string, totalAmount: number) => Promise<MeltResult>;
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
    unit: 'unit',
  });
  const {
    balance: btcBalanceSats,
    setBalance: setBtcBalanceSats,
    error: btcError,
    setError: setBtcError,
    fetchBalance: fetchBtcBalance,
  } = useCashuBalance({
    wallet: activeWallet,
    unit: 'sat',
  });

  // Mint operations
  const {
    pendingMints,
    startMint,
    checkAndCompleteMint,
    removePendingMint,
    autoMint,
    setPendingMints,
  } = useCashuMint({ fetchBalance, setIsLoading, setError, unit: 'unit' });
  const {
    pendingMints: pendingBtcMints,
    startMint: startBtcMint,
    checkAndCompleteMint: checkAndCompleteBtcMint,
    removePendingMint: removePendingBtcMint,
    autoMint: autoBtcMint,
    setPendingMints: setPendingBtcMints,
  } = useCashuMint({ fetchBalance: fetchBtcBalance, setIsLoading, setError: setBtcError, unit: 'sat' });

  // Melt operations
  const { startMelt, finishMelt } = useCashuMelt({
    setIsLoading,
    setError,
    setBalance,
    unit: 'unit',
  });
  const { startMelt: startBtcMelt, finishMelt: finishBtcMelt } = useCashuMelt({
    setIsLoading,
    setError: setBtcError,
    setBalance: setBtcBalanceSats,
    unit: 'sat',
  });

  // Send/Receive operations
  const { receive, send } = useCashuSendReceive({
    setIsLoading,
    setError,
    setBalance,
    fetchBalance,
    taprootAddress: activeWallet?.taprootAddress,
    unit: 'unit',
  });
  const { receive: receiveBtc, send: sendBtc } = useCashuSendReceive({
    setIsLoading,
    setError: setBtcError,
    setBalance: setBtcBalanceSats,
    fetchBalance: fetchBtcBalance,
    taprootAddress: activeWallet?.taprootAddress,
    unit: 'sat',
  });

  /**
   * Add an externally-created mint quote to the pending mints list.
   * Used by the threshold conversion flow which creates its own quote
   * via useEcashThresholdManager but needs app-level polling to complete it.
   */
  const addPendingMint = useCallback(
    (quoteId: string, amount: number, taprootAddress?: string) => {
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
            taprootAddress: taprootAddress ?? activeWallet?.taprootAddress,
          },
        ];
      });
    },
    [activeWallet?.taprootAddress, setPendingMints]
  );

  const addPendingBtcMint = useCallback(
    (quoteId: string, amount: number, taprootAddress?: string) => {
      setPendingBtcMints((prev) => {
        if (prev.some((m) => m.quoteId === quoteId)) {
          return prev;
        }
        return [
          ...prev,
          {
            quoteId,
            amount,
            depositAddress: '',
            state: 'UNPAID',
            createdAt: Date.now(),
            taprootAddress: taprootAddress ?? activeWallet?.taprootAddress,
            unit: 'sat',
          },
        ];
      });
    },
    [activeWallet?.taprootAddress, setPendingBtcMints]
  );

  // Track wallet for reference (account switch reset is handled by useAccountSwitcher)
  useEffect(() => {
    prevWalletRef.current = activeWallet;
  }, [activeWallet]);

  // Check for and recover any pending swap/mint/turbo transactions on startup
  const recoveryChecked = useRef(false);
  const foregroundRecoveryInFlightRef = useRef(false);
  const hasSeenAuthenticatedWalletRef = useRef(false);

  const runRecoveryStep = useCallback(
    async <T,>(
      source: string,
      label: string,
      recover: () => Promise<T>,
      fallback: T
    ): Promise<T> => {
      try {
        return await recover();
      } catch (error) {
        logger.error(`[CashuContext] ${label} failed`, {
          source,
          error: error instanceof Error ? error.message : String(error),
        });
        return fallback;
      }
    },
    []
  );

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
          if ((recoveredToken.unit ?? 'unit') === 'unit') {
            await saveSentLockedToken(
              recoveredToken.token,
              recipient,
              recoveredToken.amount,
              null,
              null,
              recoveredToken.taprootAddress ?? activeWallet?.taprootAddress ?? null
            );
          } else {
            await saveSentLockedToken(
              recoveredToken.token,
              recipient,
              recoveredToken.amount,
              null,
              null,
              recoveredToken.taprootAddress ?? activeWallet?.taprootAddress ?? null,
              recoveredToken.unit
            );
          }
          if (recoveredToken.proofsToRemove?.length) {
            if ((recoveredToken.unit ?? 'unit') === 'unit') {
              await removeProofs(recoveredToken.proofsToRemove);
            } else {
              await removeProofs(recoveredToken.proofsToRemove, recoveredToken.unit);
            }
          }
          await clearRecoveredOutgoingSwapToken(recoveredToken.token);
          if (recoveredToken.kind === 'p2pk' && recoveredToken.recipient) {
            await clearPendingTurboSend({
              senderTaprootAddress: recoveredToken.taprootAddress ?? activeWallet?.taprootAddress ?? null,
              unit: recoveredToken.unit ?? 'unit',
              recipient: recoveredToken.recipient,
              amount: recoveredToken.amount,
            });
          }
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

  const reconcileSpentProofs = useCallback(async (source: string) => {
    const cleanupResults = await Promise.allSettled([
      removeSpentProofs('unit'),
      removeSpentProofs('sat'),
    ]);

    let removed = 0;
    let kept = 0;
    const units = ['unit', 'sat'] as const;

    cleanupResults.forEach((result, index) => {
      const unit = units[index];
      if (result.status === 'fulfilled') {
        removed += result.value.removed;
        kept += result.value.kept;
        return;
      }

      logger.error('[CashuContext] Spent proof reconciliation failed for Cashu unit', {
        source,
        unit,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    });

    if (removed > 0) {
      logger.info('[CashuContext] Removed spent Cashu proofs during recovery', {
        source,
        removed,
        kept,
      });
    }

    return { removed, kept };
  }, []);

  const runTurboMintForegroundRecovery = useCallback(
    async (source: string) => {
      if (!activeWallet?.taprootAddress || foregroundRecoveryInFlightRef.current) {
        return;
      }

      foregroundRecoveryInFlightRef.current = true;
      try {
        await setCurrentAccount(activeWallet.taprootAddress);
        logger.info('[CashuContext] Checking TurboUNIT mint recovery after foreground', { source });
        const proofSaveRecovery = await runRecoveryStep(
          source,
          'Failed proof save recovery',
          recoverFailedProofSaves,
          { recovered: 0, checked: 0, totalAmountRecovered: 0, errors: [] }
        );
        const mintRecovery = await runRecoveryStep(
          source,
          'Mint quote recovery',
          recoverUnclaimedMintQuotes,
          { checked: 0, recovered: 0, totalAmountRecovered: 0, errors: [] }
        );
        const turboMintSettlement = await runRecoveryStep(
          source,
          'TurboUNIT vault settlement recovery',
          refreshPersistedTurboMintSettlementStatus,
          {
            status: 'error' as const,
            message: 'TurboUNIT vault settlement recovery failed.',
          }
        );
        await runRecoveryStep(source, 'Swap recovery', checkAndRecoverSwaps, undefined);
        const outgoingTokenRecovery = await runRecoveryStep(
          source,
          'Outgoing Cashu token recovery',
          () => recoverOutgoingSwapTokens(source),
          0
        );
        const spentProofCleanup = await runRecoveryStep(
          source,
          'Spent proof reconciliation',
          () => reconcileSpentProofs(source),
          { removed: 0, kept: 0 }
        );
        const turboSendRecovery = await runRecoveryStep(
          source,
          'Pending turbo send recovery',
          () =>
            recoverPendingTurboSend(
              sendP2PKToken,
              extractPubkeyFromTaprootAddress,
              shortenCashuToken,
              saveSentLockedToken
            ),
          { recovered: false }
        );

        if (
          proofSaveRecovery.recovered > 0 ||
          mintRecovery.recovered > 0 ||
          turboMintSettlement.status === 'settled' ||
          outgoingTokenRecovery > 0 ||
          spentProofCleanup.removed > 0 ||
          turboSendRecovery.recovered
        ) {
          await Promise.all([fetchBalance(), fetchBtcBalance()]);
        }

        if (turboSendRecovery.recovered && turboSendRecovery.token) {
          notify.transaction.success('send');
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
    [
      activeWallet?.taprootAddress,
      fetchBalance,
      fetchBtcBalance,
      reconcileSpentProofs,
      recoverOutgoingSwapTokens,
      runRecoveryStep,
    ]
  );

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
        await setCurrentAccount(activeWallet.taprootAddress);
        if (cancelled) return;

        // Check for pending swap recovery (proofs lost mid-swap)
        logger.info('[CashuContext] Checking for pending swap recovery...');
        await runRecoveryStep('startup', 'Swap recovery', checkAndRecoverSwaps, undefined);
        if (cancelled) return;

        await runRecoveryStep(
          'startup',
          'Outgoing Cashu token recovery',
          () => recoverOutgoingSwapTokens('startup'),
          0
        );
        if (cancelled) return;

        await reconcileSpentProofs('startup');
        if (cancelled) return;

        logger.info('[CashuContext] Checking for failed proof save recovery...');
        const proofSaveRecovery = await runRecoveryStep(
          'startup',
          'Failed proof save recovery',
          recoverFailedProofSaves,
          { recovered: 0, checked: 0, totalAmountRecovered: 0, errors: [] }
        );
        if (cancelled) return;
        if (proofSaveRecovery.recovered > 0) {
          logger.info('[CashuContext] Recovered failed proof saves on startup', {
            recovered: proofSaveRecovery.recovered,
            totalAmount: proofSaveRecovery.totalAmountRecovered,
          });
        }

        // Check for unclaimed mint quotes (paid but not claimed)
        logger.info('[CashuContext] Checking for unclaimed mint quotes...');
        const mintRecovery = await runRecoveryStep(
          'startup',
          'Mint quote recovery',
          recoverUnclaimedMintQuotes,
          { checked: 0, recovered: 0, totalAmountRecovered: 0, errors: [] }
        );
        if (cancelled) return;
        if (mintRecovery.recovered > 0) {
          logger.info('[CashuContext] Recovered unclaimed mint quotes on startup', {
            recovered: mintRecovery.recovered,
            totalAmount: mintRecovery.totalAmountRecovered,
          });
        }

        // If a vault TurboUNIT mint finished while the app was locked, clear
        // the persisted UNIT send and mark the vault settlement complete.
        const turboMintSettlement = await runRecoveryStep(
          'startup',
          'TurboUNIT vault settlement recovery',
          refreshPersistedTurboMintSettlementStatus,
          {
            status: 'error' as const,
            message: 'TurboUNIT vault settlement recovery failed.',
          }
        );
        if (cancelled) return;
        if (turboMintSettlement.status === 'settled') {
          logger.info('[CashuContext] Recovered persisted TurboUNIT vault settlement on startup', {
            lastStatus: turboMintSettlement.lastStatus,
          });
        }

        // Check for pending turbo sends (mint completed but P2PK not sent)
        logger.info('[CashuContext] Checking for pending turbo sends...');
        const turboRecovery = await runRecoveryStep(
          'startup',
          'Pending turbo send recovery',
          () =>
            recoverPendingTurboSend(
              sendP2PKToken,
              extractPubkeyFromTaprootAddress,
              shortenCashuToken,
              saveSentLockedToken
            ),
          { recovered: false }
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
        await Promise.all([fetchBalance(), fetchBtcBalance()]);
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
    fetchBtcBalance,
    reconcileSpentProofs,
    recoverOutgoingSwapTokens,
    runRecoveryStep,
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
      setBtcBalanceSats(0);
      setPendingMints([]);
      setPendingBtcMints([]);
      setError(null);
      setBtcError(null);
      logger.info('Cashu wallet reset');
    } catch (err: unknown) {
      if (err instanceof Error) {
        logger.error('Failed to reset wallet', { error: err.message });
      }
      throw err;
    }
  }, [setBalance, setBtcBalanceSats, setPendingMints, setPendingBtcMints, setError, setBtcError]);

  /**
   * Refresh all data and recover any unclaimed mint quotes
   */
  const refresh = useCallback(async () => {
    if (activeWallet?.taprootAddress) {
      await setCurrentAccount(activeWallet.taprootAddress);
    }

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

    // Recover swap-backed outgoing tokens before resuming pending Turbo sends.
    // A crash after sendP2PKToken journals the token but before the Turbo-send
    // stage update would otherwise create the same P2PK send again.
    try {
      await checkAndRecoverSwaps();
    } catch (swapRecoveryError) {
      logger.error('[CashuContext] Swap recovery failed during refresh', {
        error:
          swapRecoveryError instanceof Error
            ? swapRecoveryError.message
            : String(swapRecoveryError),
      });
    }

    try {
      await recoverOutgoingSwapTokens('manual_refresh');
      await reconcileSpentProofs('manual_refresh_after_outgoing_recovery');
    } catch (outgoingTokenRecoveryError) {
      logger.error('[CashuContext] Outgoing Cashu token recovery failed during refresh', {
        error:
          outgoingTokenRecoveryError instanceof Error
            ? outgoingTokenRecoveryError.message
            : String(outgoingTokenRecoveryError),
      });
    }

    try {
      const turboRecovery = await recoverPendingTurboSend(
        sendP2PKToken,
        extractPubkeyFromTaprootAddress,
        shortenCashuToken,
        saveSentLockedToken
      );
      if (turboRecovery.recovered && turboRecovery.token) {
        logger.info('[CashuContext] Recovered pending turbo send during refresh', {
          recipient: turboRecovery.recipient?.substring(0, 12) + '...',
          amount: turboRecovery.amount,
        });
        notify.transaction.success('send');
      }
    } catch (turboRecoveryError) {
      logger.error('[CashuContext] Pending turbo send recovery failed during refresh', {
        error:
          turboRecoveryError instanceof Error
            ? turboRecoveryError.message
            : String(turboRecoveryError),
      });
    }

    // Finally, refresh balance
    await Promise.all([fetchBalance(), fetchBtcBalance()]);
  }, [
    activeWallet?.taprootAddress,
    fetchBalance,
    fetchBtcBalance,
    reconcileSpentProofs,
    recoverOutgoingSwapTokens,
  ]);

  /**
   * Reset and refresh for account switching
   * Called by useAccountSwitcher to ensure clean state
   */
  const resetAndRefresh = useCallback(
    async (newTaprootAddress?: string) => {
      // Reset state immediately (synchronous) for snappy UI
      setBalance(0);
      setBtcBalanceSats(0);
      setPendingMints([]);
      setPendingBtcMints([]);
      setError(null);
      setBtcError(null);

      // CRITICAL: Set the current account BEFORE fetching balance
      // This ensures we read from the correct storage key
      if (newTaprootAddress) {
        await setCurrentAccount(newTaprootAddress);
        logger.debug('[CashuContext] resetAndRefresh: Set current account to', {
          address: newTaprootAddress.substring(0, 20) + '...',
        });
      }

      // Then fetch fresh balance from the correct account
      await Promise.all([fetchBalance(), fetchBtcBalance()]);
    },
    [
      setBalance,
      setBtcBalanceSats,
      setPendingMints,
      setPendingBtcMints,
      setError,
      setBtcError,
      fetchBalance,
      fetchBtcBalance,
    ]
  );

  // Memoize balance context value (changes frequently)
  const balanceValue = useMemo(
    (): CashuBalanceValue => ({
      balance,
      btcBalanceSats,
      isLoading,
      isBtcLoading: isLoading,
      error,
      btcError,
      pendingMints: pendingMints as PendingMint[],
      pendingBtcMints: pendingBtcMints as PendingMint[],
    }),
    [balance, btcBalanceSats, isLoading, error, btcError, pendingMints, pendingBtcMints]
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

  const trackedStartBtcMint = useCallback(
    async (amount: number) => {
      analytics.track(CASHU_EVENTS.CASHU_MINT_STARTED, { amount, unit: 'sat' });
      return startBtcMint(amount);
    },
    [startBtcMint]
  );

  const trackedCheckAndCompleteBtcMint = useCallback(
    async (quoteId: string) => {
      const result = await checkAndCompleteBtcMint(quoteId);
      if (result.completed)
        analytics.track(CASHU_EVENTS.CASHU_MINT_COMPLETED, {
          amount: result.amount,
          unit: 'sat',
        });
      return result;
    },
    [checkAndCompleteBtcMint]
  );

  const trackedReceive = useCallback(
    async (token: string) => {
      const result = await receive(token);
      analytics.track(CASHU_EVENTS.CASHU_TOKEN_RECEIVED);
      return result;
    },
    [receive]
  );

  const trackedReceiveBtc = useCallback(
    async (token: string) => {
      const result = await receiveBtc(token);
      analytics.track(CASHU_EVENTS.CASHU_TOKEN_RECEIVED, { unit: 'sat' });
      return result;
    },
    [receiveBtc]
  );

  const trackedSend = useCallback(
    async (amount: number) => {
      const result = await send(amount);
      analytics.track(CASHU_EVENTS.CASHU_TOKEN_SENT, { amount });
      return result;
    },
    [send]
  );

  const trackedSendBtc = useCallback(
    async (amount: number) => {
      const result = await sendBtc(amount);
      analytics.track(CASHU_EVENTS.CASHU_TOKEN_SENT, { amount, unit: 'sat' });
      return result;
    },
    [sendBtc]
  );

  const trackedStartMelt = useCallback(
    async (address: string, amount: number) => {
      analytics.track(CASHU_EVENTS.CASHU_MELT_STARTED, { amount });
      return startMelt(address, amount);
    },
    [startMelt]
  );

  const trackedStartBtcMelt = useCallback(
    async (address: string, amount: number) => {
      analytics.track(CASHU_EVENTS.CASHU_MELT_STARTED, { amount, unit: 'sat' });
      return startBtcMelt(address, amount);
    },
    [startBtcMelt]
  );

  const trackedFinishMelt = useCallback(
    async (quoteId: string, totalAmount: number) => {
      const result = await finishMelt(quoteId, totalAmount);
      analytics.track(CASHU_EVENTS.CASHU_MELT_COMPLETED, { amount: totalAmount });
      return result;
    },
    [finishMelt]
  );

  const trackedFinishBtcMelt = useCallback(
    async (quoteId: string, totalAmount: number) => {
      const result = await finishBtcMelt(quoteId, totalAmount);
      analytics.track(CASHU_EVENTS.CASHU_MELT_COMPLETED, {
        amount: totalAmount,
        unit: 'sat',
      });
      return result;
    },
    [finishBtcMelt]
  );

  // Memoize operations context value (stable references)
  const operationsValue = useMemo(
    (): CashuOperationsValue => ({
      startMint: trackedStartMint,
      startBtcMint: trackedStartBtcMint,
      checkAndCompleteMint: trackedCheckAndCompleteMint,
      checkAndCompleteBtcMint: trackedCheckAndCompleteBtcMint,
      removePendingMint,
      removePendingBtcMint,
      addPendingMint,
      addPendingBtcMint,
      autoMint,
      autoBtcMint,
      receive: trackedReceive,
      receiveBtc: trackedReceiveBtc,
      send: trackedSend,
      sendBtc: trackedSendBtc,
      startMelt: trackedStartMelt,
      startBtcMelt: trackedStartBtcMelt,
      finishMelt: trackedFinishMelt,
      finishBtcMelt: trackedFinishBtcMelt,
      refresh,
      resetAndRefresh,
      reset,
    }),
    [
      trackedStartMint,
      trackedStartBtcMint,
      trackedCheckAndCompleteMint,
      trackedCheckAndCompleteBtcMint,
      removePendingMint,
      removePendingBtcMint,
      addPendingMint,
      addPendingBtcMint,
      autoMint,
      autoBtcMint,
      trackedReceive,
      trackedReceiveBtc,
      trackedSend,
      trackedSendBtc,
      trackedStartMelt,
      trackedStartBtcMelt,
      trackedFinishMelt,
      trackedFinishBtcMelt,
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
