/**
 * useVaultOperation Base Hook
 *
 * A unified hook that handles all vault operations (borrow, deposit, repay, withdraw).
 * Each operation provides its own configuration, and this hook handles the common flow:
 *
 * 1. Validate inputs
 * 2. Build VaultProfile
 * 3. Connect to guardian (+ optional reservation)
 * 4. Create and sign request
 * 5. Submit to guardian
 * 6. Track pending transaction
 *
 * This consolidation reduces ~1,400 lines of duplicated code across 4 hooks
 * into a single ~200 line base hook with ~50 line config wrappers.
 */

import type { VaultProfile } from '@ducat-unit/client-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { useVaultData } from '../../contexts/WalletDataContext';
import { disconnectGuardian, getGuardianClient } from '../../services/guardianService';
import { fetchPriceQuote } from '../../services/oracleService';
import {
  buildVaultProfile,
  computeVaultPrevoutFromTx,
  resolveLatestUnspentVaultPrevout,
} from '../../services/vaultOperationsService';
import {
  fetchLatestVaultHistoryTransaction,
  fetchVaultData,
  selectLatestUsableVaultHistoryTransaction,
  type VaultData,
} from '../../services/vaultService';
import { createVaultWallet, prefetchProtocolContract } from '../../services/vaultWalletService';
import { useNotificationStore } from '../../stores/notificationStore';
import { usePendingVaultTransactionStore } from '../../stores/pendingVaultTransactionStore';
import { usePendingTransactionsStore } from '../../stores/pendingTransactionsStore';
import { usePrice } from '../../stores/priceStore';
import { useVaultSettlementStore } from '../../stores/vaultSettlementStore';
import { logger } from '../../utils/logger';
import { analytics } from '../../services/analyticsService';
import { watchTransaction } from '../../services/pushNotificationService';
import { getNotificationsEnabled } from '../../services/settingsService';
import { VAULT_EVENTS } from '../../constants/analyticsEvents';
import { getTxApiUrl } from '../../utils/constants';
import { getErrorMessage } from '../../utils/errorUtils';
import { getJsonWithNativeTimeout } from '../../utils/nativeHttp';
import {
  getPendingVaultOperationMessage,
  shouldBlockVaultOperationForPendingTx,
} from '../../utils/vaultPendingGuard';
import {
  extractVaultFinalizationPendingData,
  extractVaultIssuePendingData,
} from '../../services/vault/pendingIssueOutputs';
import {
  withVaultBuildTimeout,
  withVaultBuildTimeoutFn,
} from '../../services/vault/operationTimeout';
import type {
  ProcessingStep,
  UseVaultOperationResult,
  VaultOperationConfig,
  VaultWalletData,
} from './vaultOperationTypes';

const VAULT_REQUEST_BUILD_TIMEOUT_MS = 90_000;
const VAULT_REQUEST_SUBMIT_TIMEOUT_MS = 75_000;
const VAULT_PREVOUT_RESOLVE_TIMEOUT_MS = 90_000;
const VAULT_RECOVERY_TX_VISIBILITY_ATTEMPTS = 3;
const VAULT_RECOVERY_TX_VISIBILITY_TIMEOUT_MS = 4_000;
const VAULT_RECOVERY_TX_VISIBILITY_RETRY_MS = 2_000;

function hasVaultProfileData(
  data: VaultData | null | undefined
): data is VaultData & { vaultId: string; vaultInfo: NonNullable<VaultData['vaultInfo']> } {
  return Boolean(data?.vaultId && data.vaultInfo);
}

interface VaultRequestTxidLike {
  issue_txid?: string;
  repay_txid?: string;
  vault_txid?: string;
}

function extractTxidsFromVaultRequest(
  request: unknown
): { txid?: string; vaultTxid: string } | null {
  if (!request || typeof request !== 'object') {
    return null;
  }

  const txRequest = request as VaultRequestTxidLike;
  if (typeof txRequest.vault_txid !== 'string' || txRequest.vault_txid.length === 0) {
    return null;
  }

  return {
    txid: txRequest.issue_txid || txRequest.repay_txid,
    vaultTxid: txRequest.vault_txid,
  };
}

function txidResultsMatch(
  left: { txid?: string; vaultTxid: string },
  right: { txid?: string; vaultTxid: string }
): boolean {
  return left.txid === right.txid && left.vaultTxid === right.vaultTxid;
}

function compactTxids(txids: Array<string | null | undefined>): string[] {
  return [...new Set(txids.filter((txid): txid is string => Boolean(txid)))];
}

function sameUtxo(
  left: { txid: string; vout: number },
  right: { txid: string; vout: number }
): boolean {
  return left.txid === right.txid && left.vout === right.vout;
}

function appendUniqueUtxo(
  inputs: Array<{ txid: string; vout: number }>,
  input: { txid: string; vout: number } | null
): Array<{ txid: string; vout: number }> {
  if (!input || inputs.some((existing) => sameUtxo(existing, input))) {
    return inputs;
  }

  return [...inputs, input];
}

function vaultPrevoutToInput(prevout: unknown): { txid: string; vout: number } | null {
  if (!prevout || typeof prevout !== 'object') {
    return null;
  }

  const maybePrevout = prevout as {
    txid?: unknown;
    vout?: unknown;
    utxo?: {
      txid?: unknown;
      vout?: unknown;
    };
  };
  const txid = maybePrevout.utxo?.txid ?? maybePrevout.txid;
  const vout = maybePrevout.utxo?.vout ?? maybePrevout.vout;

  if (typeof txid !== 'string' || typeof vout !== 'number' || !Number.isInteger(vout) || vout < 0) {
    return null;
  }

  return { txid, vout };
}

function isMissingTxError(error: unknown): boolean {
  return /\bHTTP\s+404\b/i.test(getErrorMessage(error, ''));
}

async function wait(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, ms);
    (timeout as { unref?: () => void }).unref?.();
  });
}

async function checkTxMissingFromExplorer(txid: string): Promise<boolean | null> {
  try {
    await getJsonWithNativeTimeout<unknown>(getTxApiUrl(txid), {
      timeout: VAULT_RECOVERY_TX_VISIBILITY_TIMEOUT_MS,
      headers: { Accept: 'application/json' },
    });
    return false;
  } catch (error) {
    if (isMissingTxError(error)) {
      return true;
    }

    logger.warn('[VaultOps] Could not verify failed vault tx visibility', {
      txid,
      error: getErrorMessage(error, 'Unknown transaction visibility check error'),
    });
    return null;
  }
}

async function areTxidsStillMissingFromExplorer(txids: string[]): Promise<boolean> {
  if (txids.length === 0) {
    return false;
  }

  for (let attempt = 1; attempt <= VAULT_RECOVERY_TX_VISIBILITY_ATTEMPTS; attempt += 1) {
    const statuses = await Promise.all(txids.map((txid) => checkTxMissingFromExplorer(txid)));

    if (statuses.some((status) => status === false || status === null)) {
      return false;
    }

    if (attempt < VAULT_RECOVERY_TX_VISIBILITY_ATTEMPTS) {
      await wait(VAULT_RECOVERY_TX_VISIBILITY_RETRY_MS);
    }
  }

  return true;
}

/**
 * Base hook for all vault operations
 *
 * @param config - Operation-specific configuration
 * @returns Common vault operation interface
 */
export function useVaultOperation<TConfig, TRequest, TResult>(
  config: VaultOperationConfig<TConfig, TRequest, TResult>
): UseVaultOperationResult {
  const {
    operationType,
    operationName,
    needsReservation,
    hasIssueTxid,
    deferSuccessTransition,
    useStore,
    validate,
    createConfig,
    createRequest,
    performReservation,
    sendRequest,
    extractResult,
    createPendingTransaction,
    calculateLiquidationPrice,
  } = config;

  // Wallet and price context
  const { wallet, currentAccount } = useWallet();
  const { btcPrice } = usePrice();
  const { vaultData: contextVaultData, vaultTransactions: contextVaultTransactions = [] } =
    useVaultData();

  // Get store state and actions
  const { state, actions } = useStore();
  const {
    amount,
    selectedFeeRate,
    currentUnitBorrowed,
    currentBtcLocked,
    loading,
    error,
    issueTxid,
    vaultTxid,
  } = state;
  const {
    setLoading,
    setError,
    setVaultTxid,
    setIssueTxid,
    setCurrentStep,
    setProcessingStep,
    setCurrentVaultData,
    setBitcoinPrice,
    reset,
  } = actions;

  // Global store actions
  const setPendingTransactionForAccount = usePendingVaultTransactionStore(
    (s) => s.setPendingTransactionForAccount
  );
  const clearPendingTransactionForAccount = usePendingVaultTransactionStore(
    (s) => s.clearPendingTransactionForAccount
  );
  const discardPendingTransactionForAccount = usePendingVaultTransactionStore(
    (s) => s.discardPendingTransactionForAccount
  );
  const pendingVaultTransaction = usePendingVaultTransactionStore((s) => s.pendingTransaction);
  const addPendingTransaction = usePendingTransactionsStore((s) => s.addPendingTransaction);
  const invalidatePendingTransaction = usePendingTransactionsStore((s) => s.invalidateTransaction);
  const markUtxoAsSpent = usePendingTransactionsStore((s) => s.markUtxoAsSpent);
  const markUtxosAsSpent = usePendingTransactionsStore((s) => s.markUtxosAsSpent);
  const unmarkUtxosAsSpent = usePendingTransactionsStore((s) => s.unmarkUtxosAsSpent);
  const showSnackbar = useNotificationStore((s) => s.showSnackbar);

  // Operation state
  const operationInProgressRef = useRef(false);
  const activeVaultPrevoutInputRef = useRef<{ txid: string; vout: number } | null>(null);
  const [vaultDataLoaded, setVaultDataLoaded] = useState(false);

  // Sync bitcoin price to store
  useEffect(() => {
    if (btcPrice !== null) {
      setBitcoinPrice(btcPrice);
    }
  }, [btcPrice, setBitcoinPrice]);

  /**
   * Update processing step with proper typing
   */
  const updateProcessingStep = useCallback(
    (step: ProcessingStep) => {
      setProcessingStep(step);
    },
    [setProcessingStep]
  );

  /**
   * Load vault data from context
   */
  const loadVaultData = useCallback(async (): Promise<boolean> => {
    if (!wallet?.taprootPubkey) {
      setError('Wallet not connected');
      return false;
    }

    if (!contextVaultData) {
      setError('No vault found. Please create a vault first.');
      return false;
    }

    const unitBorrowed = contextVaultData.totalDebt || 0;
    const btcLocked = contextVaultData.totalCollateral || 0;

    setCurrentVaultData(unitBorrowed, btcLocked);
    setVaultDataLoaded(true);

    logger.debug(`[${operationName}] Vault data synced from context:`, {
      unitBorrowed,
      btcLocked,
      vaultId: contextVaultData.vaultId,
    });

    prefetchProtocolContract();

    return true;
  }, [wallet?.taprootPubkey, contextVaultData, setError, setCurrentVaultData, operationName]);

  /**
   * Build VaultProfile from current vault data
   */
  const buildVaultProfileFromData = useCallback(async (): Promise<VaultProfile | null> => {
    if (!wallet?.taprootPubkey) {
      return null;
    }

    try {
      let vaultData: VaultData | null = null;

      if (hasVaultProfileData(contextVaultData)) {
        vaultData = contextVaultData;
        logger.info(`[${operationName}] Using cached vault data for request preparation`, {
          operationType,
          vaultId: contextVaultData.vaultId,
        });
      } else {
        const vaultDataStartedAt = Date.now();
        logger.info(`[${operationName}] Fetching vault data for request preparation`, {
          operationType,
        });
        vaultData = await withVaultBuildTimeout(
          fetchVaultData(wallet.taprootPubkey),
          'Vault data request timed out. Please check your connection and try again.',
          25000
        );
        logger.info(`[${operationName}] Vault data ready for request preparation`, {
          operationType,
          durationMs: Date.now() - vaultDataStartedAt,
        });
      }

      if (!hasVaultProfileData(vaultData)) {
        logger.error(`[${operationName}] No vault info available`);
        return null;
      }

      let latestTx = selectLatestUsableVaultHistoryTransaction(contextVaultTransactions);
      if (latestTx) {
        logger.info(`[${operationName}] Using cached vault history transaction`, {
          operationType,
          vaultId: vaultData.vaultId,
          txid: latestTx.transaction_id,
        });
      } else {
        const vaultHistoryStartedAt = Date.now();
        logger.info(`[${operationName}] Fetching latest vault history transaction`, {
          operationType,
        });
        latestTx = await withVaultBuildTimeout(
          fetchLatestVaultHistoryTransaction(vaultData.vaultId, 540, {
            requireUsablePrevout: true,
          }),
          'Vault history request timed out. Please check your connection and try again.',
          25000
        );
        logger.info(`[${operationName}] Latest vault history transaction ready`, {
          operationType,
          durationMs: Date.now() - vaultHistoryStartedAt,
        });
      }

      if (!latestTx) {
        logger.error(`[${operationName}] No vault history available`);
        return null;
      }

      const vaultPrevout = computeVaultPrevoutFromTx(latestTx);

      if (!vaultPrevout) {
        logger.error(`[${operationName}] Could not compute VaultPrevout from transaction`);
        return null;
      }

      const resolvedVaultPrevout = await withVaultBuildTimeout(
        resolveLatestUnspentVaultPrevout(vaultPrevout),
        'Timed out verifying the current vault UTXO. Please try again.',
        VAULT_PREVOUT_RESOLVE_TIMEOUT_MS
      );
      activeVaultPrevoutInputRef.current = vaultPrevoutToInput(resolvedVaultPrevout.prevout);

      if (resolvedVaultPrevout.replaced) {
        logger.warn(`[${operationName}] Using on-chain vault prevout ahead of validator history`, {
          operationType,
          hopCount: resolvedVaultPrevout.hopCount,
          sourceTxids: resolvedVaultPrevout.sourceTxids,
          latestTxid: resolvedVaultPrevout.prevout.utxo.txid,
          latestVout: resolvedVaultPrevout.prevout.utxo.vout,
        });
      }

      const profile = buildVaultProfile(
        wallet.taprootPubkey,
        vaultData.vaultInfo,
        resolvedVaultPrevout.prevout
      );

      logger.info(`[${operationName}] Vault profile built`, {
        operationType,
      });
      logger.debug(`[${operationName}] VaultProfile built:`, {
        acct_id: profile.acct_id,
        master_id: profile.master_id,
        hasRdata: !!profile.rdata,
        hasUtxo: !!profile.utxo,
      });

      return profile;
    } catch (err) {
      logger.error(`[${operationName}] Error building VaultProfile:`, { error: err });
      throw err;
    }
  }, [
    wallet?.taprootPubkey,
    contextVaultData,
    contextVaultTransactions,
    operationName,
    operationType,
  ]);

  /**
   * Execute the vault operation
   */
  const execute = useCallback(async (): Promise<{
    txid?: string;
    vaultTxid: string;
  } | null> => {
    // Prevent double execution
    if (operationInProgressRef.current) {
      logger.warn(`[${operationName}] Operation already in progress`);
      return null;
    }

    if (shouldBlockVaultOperationForPendingTx(operationType, pendingVaultTransaction)) {
      const pendingMessage = getPendingVaultOperationMessage(pendingVaultTransaction);
      logger.warn(`[${operationName}] Blocking vault operation while prior vault tx updates`, {
        pendingAction: pendingVaultTransaction?.action,
        pendingTxid: pendingVaultTransaction?.vaultTxid || pendingVaultTransaction?.txid,
      });
      setError(pendingMessage);
      showSnackbar({
        title: 'Vault transaction pending',
        description: pendingMessage,
        type: 'warning',
        duration: 7000,
      });
      return null;
    }

    // Build wallet data for validation
    const walletData: VaultWalletData | null = wallet
      ? {
          segwitAddress: wallet.segwitAddress || '',
          segwitPubkey: wallet.segwitPubkey || '',
          taprootAddress: wallet.taprootAddress || '',
          taprootPubkey: wallet.taprootPubkey || '',
        }
      : null;

    // Validate
    const validationError = validate({
      wallet: walletData,
      btcPrice,
      amount,
      currentUnitBorrowed,
      currentBtcLocked,
      selectedFeeRate,
    });

    if (validationError) {
      setError(validationError);
      return null;
    }

    operationInProgressRef.current = true;
    activeVaultPrevoutInputRef.current = null;
    setLoading(true);
    setError(null);
    setCurrentStep('processing');
    analytics.track(VAULT_EVENTS.VAULT_OPERATION_STARTED, { operation: operationName });
    const preserveSettlementFinalStep =
      operationType === 'repay' &&
      useVaultSettlementStore.getState().kind === 'repay' &&
      useVaultSettlementStore.getState().phase === 'repaying_vault';
    const setOperationProcessingStep = (step: ProcessingStep): void => {
      if (preserveSettlementFinalStep) {
        if (step === 1) {
          updateProcessingStep(4);
        }
        return;
      }
      updateProcessingStep(step);
    };

    let guardianSubmitAttempted = false;
    let localVaultRecoveryWrittenBeforeSubmit = false;
    let recoveryTxidsForSubmit: { txid?: string; vaultTxid: string } | null = null;
    const spentInputsForPreSubmitRollback: Array<{ txid: string; vout: number }> = [];
    const recordPreSubmitRollbackInputs = (inputs: Array<{ txid: string; vout: number }>): void => {
      for (const input of inputs) {
        if (
          !spentInputsForPreSubmitRollback.some(
            (existing) => existing.txid === input.txid && existing.vout === input.vout
          )
        ) {
          spentInputsForPreSubmitRollback.push(input);
        }
      }
    };

    try {
      // Step 1: Build VaultProfile and create config
      setOperationProcessingStep(1);
      logger.info(`[${operationName}] Preparing vault request`, { operationType });
      logger.debug(`[${operationName}] Step 1: Building VaultProfile and config...`);

      const profileStartedAt = Date.now();
      const vaultProfile = await buildVaultProfileFromData();

      if (!vaultProfile) {
        throw new Error('Failed to build vault profile. Please try again.');
      }
      logger.info(`[${operationName}] Vault profile ready for request`, {
        operationType,
        durationMs: Date.now() - profileStartedAt,
      });

      const walletStartedAt = Date.now();
      const vaultWallet = await withVaultBuildTimeout(
        createVaultWallet({
          segwitAddress: wallet!.segwitAddress!,
          segwitPubkey: wallet!.segwitPubkey || '',
          taprootAddress: wallet!.taprootAddress!,
          taprootPubkey: wallet!.taprootPubkey || '',
        }),
        'Timed out preparing the vault wallet. Please try again.',
        25000
      );
      logger.info(`[${operationName}] Vault wallet ready for request`, {
        operationType,
        durationMs: Date.now() - walletStartedAt,
      });

      const operationConfig = createConfig(amount, selectedFeeRate);

      const liquidationPrice = calculateLiquidationPrice({
        amount,
        currentUnitBorrowed,
        currentBtcLocked,
      });
      logger.info(`[${operationName}] Fetching oracle quote for transaction build`, {
        operationType,
        liquidationPrice,
      });

      const quoteStartedAt = Date.now();
      const oracleQuote = await withVaultBuildTimeoutFn(
        () =>
          fetchPriceQuote(liquidationPrice, {
            cache: false,
            dedupe: false,
            includeContracts: operationType !== 'deposit',
            transport: 'xhr',
            timeout: 8_000,
          }),
        'Timed out fetching oracle price quote. Please try again.',
        20_000
      );
      logger.info(`[${operationName}] Oracle quote ready for transaction build`, {
        operationType,
        durationMs: Date.now() - quoteStartedAt,
      });

      // Step 2: Connect to guardian (+ optional reservation)
      setOperationProcessingStep(2);
      logger.info(`[${operationName}] Connecting to guardian`, {
        operationType,
        needsReservation,
      });
      if (needsReservation) {
        logger.debug(`[${operationName}] Step 2: Connecting to guardian and reserving...`);
      } else {
        logger.debug(`[${operationName}] Step 2: Connecting to guardian...`);
      }

      disconnectGuardian();
      const guardianStartedAt = Date.now();
      const gclient = await withVaultBuildTimeout(
        getGuardianClient(wallet!.taprootPubkey || ''),
        'Timed out connecting to Guardian. Please try again.',
        15_000
      );
      logger.info(`[${operationName}] Guardian connected`, {
        operationType,
        durationMs: Date.now() - guardianStartedAt,
      });

      let reservationResult: unknown;
      if (needsReservation && performReservation) {
        const reservationStartedAt = Date.now();
        reservationResult = await withVaultBuildTimeout(
          performReservation(gclient, operationConfig, wallet!.taprootPubkey || ''),
          'Timed out reserving UNIT with Guardian. Please try again.',
          20_000
        );
        logger.info(`[${operationName}] Guardian reservation ready`, {
          operationType,
          durationMs: Date.now() - reservationStartedAt,
        });
      }

      // Step 3: Create request with PSBT
      setOperationProcessingStep(3);
      logger.info(`[${operationName}] Building vault transaction request`, {
        operationType,
      });
      logger.debug(`[${operationName}] Step 3: Creating ${operationType} request...`);

      const requestStartedAt = Date.now();
      const request = await withVaultBuildTimeout(
        createRequest({
          vaultWallet,
          config: operationConfig,
          reservationResult,
          feeRate: selectedFeeRate,
          oracleQuote,
          vaultProfile,
        }),
        `Timed out building the ${operationType} transaction. Please try again.`,
        VAULT_REQUEST_BUILD_TIMEOUT_MS
      );
      logger.info(`[${operationName}] Vault request built`, {
        operationType,
        durationMs: Date.now() - requestStartedAt,
      });

      const persistVaultRecovery = async (recoveryResult: {
        txid?: string;
        vaultTxid: string;
      }): Promise<void> => {
        const pendingTx = createPendingTransaction({
          config: operationConfig,
          result: recoveryResult,
          taprootPubkey: wallet!.taprootPubkey || '',
        });

        await setPendingTransactionForAccount(pendingTx, currentAccount);
        localVaultRecoveryWrittenBeforeSubmit = !guardianSubmitAttempted;

        if (recoveryResult.txid) {
          const livePendingTransactions =
            usePendingTransactionsStore.getState().pendingTransactions;
          const { outputs, spentInputs, parentTxid } = extractVaultIssuePendingData(
            request as {
              issue_txhex?: string;
              repay_txhex?: string;
              vault_txhex?: string;
            },
            wallet,
            livePendingTransactions
          );
          recordPreSubmitRollbackInputs(spentInputs);

          for (const spentInput of spentInputs) {
            if (livePendingTransactions[spentInput.txid]?.status === 'pending') {
              await markUtxoAsSpent(spentInput.txid, spentInput.vout);
            }
          }

          if (spentInputs.length > 0) {
            await markUtxosAsSpent(spentInputs);
          }

          if (outputs.length > 0 || spentInputs.length > 0) {
            await addPendingTransaction(
              recoveryResult.txid,
              outputs,
              'UNIT',
              parentTxid,
              pendingTx.unitAmt,
              spentInputs
            );
          }
        }

        const shouldTrackVaultTx =
          Boolean(recoveryResult.vaultTxid) && recoveryResult.vaultTxid !== recoveryResult.txid;
        if (shouldTrackVaultTx) {
          const latestPendingTransactions =
            usePendingTransactionsStore.getState().pendingTransactions;
          const finalizationPendingData = extractVaultFinalizationPendingData(
            request as {
              issue_txhex?: string;
              repay_txhex?: string;
              vault_txhex?: string;
            },
            wallet,
            latestPendingTransactions
          );
          const finalizationSpentInputs = appendUniqueUtxo(
            finalizationPendingData.spentInputs,
            activeVaultPrevoutInputRef.current
          );
          recordPreSubmitRollbackInputs(finalizationSpentInputs);

          for (const spentInput of finalizationSpentInputs) {
            if (latestPendingTransactions[spentInput.txid]?.status === 'pending') {
              await markUtxoAsSpent(spentInput.txid, spentInput.vout);
            }
          }

          if (finalizationSpentInputs.length > 0) {
            await markUtxosAsSpent(finalizationSpentInputs);
          }

          if (finalizationPendingData.outputs.length > 0 || finalizationSpentInputs.length > 0) {
            await addPendingTransaction(
              recoveryResult.vaultTxid,
              finalizationPendingData.outputs,
              'BTC',
              finalizationPendingData.parentTxid,
              undefined,
              finalizationSpentInputs
            );
          }
        }
      };

      // Step 4: Submit to guardian
      setOperationProcessingStep(4);
      logger.info(`[${operationName}] Submitting vault request to guardian`, {
        operationType,
      });
      logger.debug(`[${operationName}] Step 4: Submitting to guardian...`);

      const requestTxids = extractTxidsFromVaultRequest(request);
      if (!requestTxids) {
        throw new Error(
          `${operationName} request did not include transaction IDs; refusing to submit without a recovery checkpoint.`
        );
      }
      recoveryTxidsForSubmit = requestTxids;
      await persistVaultRecovery(requestTxids);

      disconnectGuardian();
      const submitClient = await withVaultBuildTimeout(
        getGuardianClient(wallet!.taprootPubkey || ''),
        'Timed out reconnecting to Guardian. Please try again.',
        15_000
      );

      guardianSubmitAttempted = true;
      const submitStartedAt = Date.now();
      const result = await withVaultBuildTimeout(
        sendRequest(submitClient, request),
        `Timed out submitting the ${operationType} request to Guardian. Please wait for confirmation or try again after the pending transaction clears.`,
        VAULT_REQUEST_SUBMIT_TIMEOUT_MS
      );
      logger.info(`[${operationName}] Guardian submit finished`, {
        operationType,
        durationMs: Date.now() - submitStartedAt,
      });
      const { txid, vaultTxid: resultVaultTxid } = extractResult(result);
      const resultTxids = { txid, vaultTxid: resultVaultTxid };

      if (!txidResultsMatch(requestTxids, resultTxids)) {
        await persistVaultRecovery(resultTxids);
      }

      // Update store
      if (hasIssueTxid && setIssueTxid && txid) {
        setIssueTxid(txid);
      }
      setVaultTxid(resultVaultTxid);
      if (!deferSuccessTransition) {
        setCurrentStep('success');
      }

      // Show confirmation snackbar
      showSnackbar({
        title: 'Vault transaction confirming',
        description: 'Please wait for the block to get mined',
        type: 'info',
        duration: 7000,
      });

      logger.info(`[${operationName}] Operation completed successfully:`, {
        txid,
        vault_txid: resultVaultTxid,
      });
      logger.info(
        `[E2E_TX] vault_operation_success operation=${operationType} txid=${txid ?? ''} vaultTxid=${resultVaultTxid}`
      );
      analytics.trackTransaction(VAULT_EVENTS.VAULT_OPERATION_COMPLETED, resultVaultTxid, {
        operation: operationName,
      });

      // Register vault TX for push-notification monitoring only when explicitly enabled.
      if (await getNotificationsEnabled()) {
        void watchTransaction(resultVaultTxid, wallet?.segwitAddress || '', 'vault transaction');
      }

      return { txid, vaultTxid: resultVaultTxid };
    } catch (err) {
      const errorMessage = getErrorMessage(err, `${operationName} operation failed`);
      const errorStack = err instanceof Error ? err.stack : undefined;
      logger.error(`[${operationName}] Error:`, {
        message: errorMessage,
        errorName: err instanceof Error ? err.name : typeof err,
        stack: errorStack,
      });
      if (!guardianSubmitAttempted) {
        if (spentInputsForPreSubmitRollback.length > 0) {
          try {
            await unmarkUtxosAsSpent(spentInputsForPreSubmitRollback);
          } catch (rollbackError) {
            logger.error(`[${operationName}] Failed to roll back pre-submit vault UTXO locks:`, {
              error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
            });
          }
        }

        if (localVaultRecoveryWrittenBeforeSubmit) {
          try {
            await discardPendingTransactionForAccount(
              currentAccount,
              recoveryTxidsForSubmit?.vaultTxid || recoveryTxidsForSubmit?.txid,
              err
            );
          } catch (clearError) {
            logger.error(`[${operationName}] Failed to clear pre-submit vault recovery lock:`, {
              error: getErrorMessage(clearError, 'Unknown vault recovery cleanup error'),
            });
          }
        }
      } else if (localVaultRecoveryWrittenBeforeSubmit && recoveryTxidsForSubmit) {
        const recoveryTxids = compactTxids([
          recoveryTxidsForSubmit.txid,
          recoveryTxidsForSubmit.vaultTxid,
        ]);
        const txidsMissing = await areTxidsStillMissingFromExplorer(recoveryTxids);

        if (txidsMissing) {
          logger.warn(
            `[${operationName}] Guardian submit failed before recovery txids reached mempool; clearing local recovery lock`,
            {
              operationType,
              recoveryTxids,
              error: errorMessage,
            }
          );

          try {
            await discardPendingTransactionForAccount(
              currentAccount,
              recoveryTxidsForSubmit.vaultTxid || recoveryTxidsForSubmit.txid,
              err
            );
          } catch (clearError) {
            logger.error(`[${operationName}] Failed to discard rejected vault recovery lock:`, {
              error: getErrorMessage(clearError, 'Unknown vault recovery cleanup error'),
            });
          }

          for (const txid of recoveryTxids) {
            try {
              await invalidatePendingTransaction(txid, errorMessage);
            } catch (invalidateError) {
              logger.error(`[${operationName}] Failed to invalidate rejected vault tx:`, {
                txid,
                error: getErrorMessage(invalidateError, 'Unknown pending tx cleanup error'),
              });
            }
          }
        } else {
          logger.warn(
            `[${operationName}] Guardian submit failed after local recovery was written`,
            {
              operationType,
              recoveryTxids,
              error: errorMessage,
            }
          );
        }
      }
      analytics.track(VAULT_EVENTS.VAULT_OPERATION_FAILED, {
        operation: operationName,
        error: errorMessage,
      });
      setCurrentStep('confirm');
      setError(errorMessage);
      return null;
    } finally {
      operationInProgressRef.current = false;
      setLoading(false);
      disconnectGuardian();
    }
  }, [
    wallet,
    btcPrice,
    amount,
    selectedFeeRate,
    currentUnitBorrowed,
    currentBtcLocked,
    pendingVaultTransaction,
    operationName,
    operationType,
    needsReservation,
    hasIssueTxid,
    deferSuccessTransition,
    validate,
    createConfig,
    createRequest,
    performReservation,
    sendRequest,
    extractResult,
    createPendingTransaction,
    calculateLiquidationPrice,
    setLoading,
    setError,
    setVaultTxid,
    setIssueTxid,
    setCurrentStep,
    updateProcessingStep,
    buildVaultProfileFromData,
    setPendingTransactionForAccount,
    currentAccount,
    clearPendingTransactionForAccount,
    discardPendingTransactionForAccount,
    addPendingTransaction,
    invalidatePendingTransaction,
    markUtxoAsSpent,
    markUtxosAsSpent,
    unmarkUtxosAsSpent,
    showSnackbar,
  ]);

  /**
   * Cancel and reset
   */
  const cancel = useCallback(() => {
    operationInProgressRef.current = false;
    setVaultDataLoaded(false);
    disconnectGuardian();
    reset();
  }, [reset]);

  return {
    execute,
    loadVaultData,
    cancel,
    isLoading: loading,
    error,
    issueTxid: issueTxid ?? null,
    vaultTxid,
    vaultDataLoaded,
  };
}
