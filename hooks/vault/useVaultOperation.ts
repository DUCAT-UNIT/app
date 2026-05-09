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
import { useCallback,useEffect,useRef,useState } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { useVaultData } from '../../contexts/WalletDataContext';
import { disconnectGuardian,getGuardianClient } from '../../services/guardianService';
import { fetchPriceQuote } from '../../services/oracleService';
import {
buildVaultProfile,
computeVaultPrevoutFromTx,
} from '../../services/vaultOperationsService';
import { fetchLatestVaultHistoryTransaction,fetchVaultData } from '../../services/vaultService';
import { createVaultWallet } from '../../services/vaultWalletService';
import { useNotificationStore } from '../../stores/notificationStore';
import { usePendingVaultTransactionStore } from '../../stores/pendingVaultTransactionStore';
import { usePendingTransactionsStore } from '../../stores/pendingTransactionsStore';
import { usePrice } from '../../stores/priceStore';
import { logger } from '../../utils/logger';
import { analytics } from '../../services/analyticsService';
import { watchTransaction } from '../../services/pushNotificationService';
import { VAULT_EVENTS } from '../../constants/analyticsEvents';
import {
  getPendingVaultOperationMessage,
  shouldBlockVaultOperationForPendingTx,
} from '../../utils/vaultPendingGuard';
import {
  extractVaultFinalizationPendingData,
  extractVaultIssuePendingData,
} from '../../services/vault/pendingIssueOutputs';
import type {
ProcessingStep,
UseVaultOperationResult,
VaultOperationConfig,
VaultWalletData,
} from './vaultOperationTypes';

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
  const { wallet } = useWallet();
  const { btcPrice } = usePrice();
  const { vaultData: contextVaultData } = useVaultData();

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
  const setPendingTransaction = usePendingVaultTransactionStore(
    (s) => s.setPendingTransaction
  );
  const pendingVaultTransaction = usePendingVaultTransactionStore(
    (s) => s.pendingTransaction
  );
  const addPendingTransaction = usePendingTransactionsStore((s) => s.addPendingTransaction);
  const markUtxoAsSpent = usePendingTransactionsStore((s) => s.markUtxoAsSpent);
  const showSnackbar = useNotificationStore((s) => s.showSnackbar);

  // Operation state
  const operationInProgressRef = useRef(false);
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

    return true;
  }, [
    wallet?.taprootPubkey,
    contextVaultData,
    setError,
    setCurrentVaultData,
    operationName,
  ]);

  /**
   * Build VaultProfile from current vault data
   */
  const buildVaultProfileFromData = useCallback(async (): Promise<VaultProfile | null> => {
    if (!wallet?.taprootPubkey) {
      return null;
    }

    try {
      const vaultData = await fetchVaultData(wallet.taprootPubkey);

      if (!vaultData?.vaultInfo || !vaultData.vaultId) {
        logger.error(`[${operationName}] No vault info available`);
        return null;
      }

      const latestTx = await fetchLatestVaultHistoryTransaction(vaultData.vaultId, 540);

      if (!latestTx) {
        logger.error(`[${operationName}] No vault history available`);
        return null;
      }

      const vaultPrevout = computeVaultPrevoutFromTx(latestTx);

      if (!vaultPrevout) {
        logger.error(`[${operationName}] Could not compute VaultPrevout from transaction`);
        return null;
      }

      const profile = buildVaultProfile(
        wallet.taprootPubkey,
        vaultData.vaultInfo,
        vaultPrevout
      );

      logger.debug(`[${operationName}] VaultProfile built:`, {
        acct_id: profile.acct_id,
        master_id: profile.master_id,
        hasRdata: !!profile.rdata,
        hasUtxo: !!profile.utxo,
      });

      return profile;
    } catch (err) {
      logger.error(`[${operationName}] Error building VaultProfile:`, { error: err });
      return null;
    }
  }, [wallet?.taprootPubkey, operationName]);

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
    });

    if (validationError) {
      setError(validationError);
      return null;
    }

    operationInProgressRef.current = true;
    setLoading(true);
    setError(null);
    setCurrentStep('processing');
    analytics.track(VAULT_EVENTS.VAULT_OPERATION_STARTED, { operation: operationName });

    try {
      // Step 1: Build VaultProfile and create config
      updateProcessingStep(1);
      logger.debug(`[${operationName}] Step 1: Building VaultProfile and config...`);

      const vaultProfile = await buildVaultProfileFromData();

      if (!vaultProfile) {
        throw new Error('Failed to build vault profile. Please try again.');
      }

      const vaultWallet = await createVaultWallet({
        segwitAddress: wallet!.segwitAddress!,
        segwitPubkey: wallet!.segwitPubkey || '',
        taprootAddress: wallet!.taprootAddress!,
        taprootPubkey: wallet!.taprootPubkey || '',
      });

      const operationConfig = createConfig(amount, selectedFeeRate);

      // Step 2: Connect to guardian (+ optional reservation)
      updateProcessingStep(2);
      if (needsReservation) {
        logger.debug(`[${operationName}] Step 2: Connecting to guardian and reserving...`);
      } else {
        logger.debug(`[${operationName}] Step 2: Connecting to guardian...`);
      }

      const gclient = await getGuardianClient(wallet!.taprootPubkey || '');

      let reservationResult: unknown;
      if (needsReservation && performReservation) {
        reservationResult = await performReservation(
          gclient,
          operationConfig,
          wallet!.taprootPubkey || ''
        );
      }

      // Step 3: Create request with PSBT
      updateProcessingStep(3);
      logger.debug(`[${operationName}] Step 3: Creating ${operationType} request...`);

      // Calculate liquidation price for oracle quote
      const liquidationPrice = calculateLiquidationPrice({
        amount,
        currentUnitBorrowed,
        currentBtcLocked,
      });

      const oracleQuote = await fetchPriceQuote(liquidationPrice);

      const request = await createRequest({
        vaultWallet,
        config: operationConfig,
        reservationResult,
        feeRate: selectedFeeRate,
        oracleQuote,
        vaultProfile,
      });

      // Step 4: Submit to guardian
      updateProcessingStep(4);
      logger.debug(`[${operationName}] Step 4: Submitting to guardian...`);

      const result = await sendRequest(gclient, request);
      const { txid, vaultTxid: resultVaultTxid } = extractResult(result);

      // Update store
      if (hasIssueTxid && setIssueTxid && txid) {
        setIssueTxid(txid);
      }
      setVaultTxid(resultVaultTxid);
      if (!deferSuccessTransition) {
        setCurrentStep('success');
      }

      // Track pending transaction
      const pendingTx = createPendingTransaction({
        config: operationConfig,
        result: { txid, vaultTxid: resultVaultTxid },
        taprootPubkey: wallet!.taprootPubkey || '',
      });

      if (txid) {
        const livePendingTransactions = usePendingTransactionsStore.getState().pendingTransactions;
        const { outputs, spentInputs, parentTxid } = extractVaultIssuePendingData(
          request as {
            issue_txhex?: string;
            vault_txhex?: string;
          },
          wallet,
          livePendingTransactions,
        );

        for (const spentInput of spentInputs) {
          if (livePendingTransactions[spentInput.txid]?.status === 'pending') {
            await markUtxoAsSpent(spentInput.txid, spentInput.vout);
          }
        }

        if (outputs.length > 0) {
          await addPendingTransaction(
            txid,
            outputs,
            'UNIT',
            parentTxid,
            pendingTx.unitAmt,
            spentInputs,
          );
        }

        const latestPendingTransactions = usePendingTransactionsStore.getState().pendingTransactions;
        const finalizationPendingData = extractVaultFinalizationPendingData(
          request as {
            issue_txhex?: string;
            vault_txhex?: string;
          },
          wallet,
          latestPendingTransactions,
        );

        for (const spentInput of finalizationPendingData.spentInputs) {
          if (latestPendingTransactions[spentInput.txid]?.status === 'pending') {
            await markUtxoAsSpent(spentInput.txid, spentInput.vout);
          }
        }

        if (
          resultVaultTxid !== txid &&
          finalizationPendingData.outputs.length > 0
        ) {
          await addPendingTransaction(
            resultVaultTxid,
            finalizationPendingData.outputs,
            'BTC',
            finalizationPendingData.parentTxid,
            undefined,
            finalizationPendingData.spentInputs,
          );
        }
      }

      await setPendingTransaction(pendingTx);

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
      analytics.trackTransaction(VAULT_EVENTS.VAULT_OPERATION_COMPLETED, resultVaultTxid, { operation: operationName });

      // Register vault TX for push-notification monitoring (fire-and-forget)
      watchTransaction(
        resultVaultTxid,
        wallet?.segwitAddress || '',
        'vault transaction'
      );

      return { txid, vaultTxid: resultVaultTxid };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : `${operationName} operation failed`;
      const errorStack = err instanceof Error ? err.stack : undefined;
      logger.error(`[${operationName}] Error:`, {
        message: errorMessage,
        stack: errorStack,
      });
      analytics.track(VAULT_EVENTS.VAULT_OPERATION_FAILED, { operation: operationName, error: errorMessage });
      setError(errorMessage);
      setCurrentStep('confirm');
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
    setPendingTransaction,
    addPendingTransaction,
    markUtxoAsSpent,
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
