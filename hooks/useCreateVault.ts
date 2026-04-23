/**
 * useCreateVault Hook
 * Orchestrates the full vault creation flow
 */

import { useCallback, useRef } from 'react';
import { useVaultCreation } from '../stores/vaultCreationStore';
import { useWallet } from '../contexts/WalletContext';
import { useBalance } from '../contexts/WalletDataContext';
import { usePrice } from '../stores/priceStore';
import { getGuardianClient, disconnectGuardian } from '../services/guardianService';
import {
  createVaultConfig,
  guardianOpenVaultReserve,
  guardianSendReqOpen,
  createVaultReqOpen,
} from '../services/vaultOperationsService';
import { createVaultWallet } from '../services/vaultWalletService';
import { computeLiquidationPrice, validateVaultParams } from '../utils/vaultUtils';
import { e2eVaultState } from '../utils/e2eVaultState';
import { logger } from '../utils/logger';
import type { ProcessingStep } from '../stores/vaultCreationStore';
import { usePendingVaultTransactionStore } from '../stores/pendingVaultTransactionStore';
import { usePendingTransactionsStore } from '../stores/pendingTransactionsStore';
import { useNotificationStore } from '../stores/notificationStore';
import {
  extractVaultFinalizationPendingData,
  extractVaultIssuePendingData,
} from '../services/vault/pendingIssueOutputs';

export interface CreateVaultParams {
  isMaxDeposit?: boolean;
  isMaxBorrow?: boolean;
}

export interface UseCreateVaultOptions {
  deferSuccessTransition?: boolean;
}

export interface UseCreateVaultResult {
  /** Initiates the vault creation process */
  createVault: (params?: CreateVaultParams) => Promise<string | null>;
  /** Cancels the current operation and resets state */
  cancel: () => void;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Current error message, if any */
  error: string | null;
  /** Transaction ID after successful creation */
  txid: string | null;
  /** Vault transaction ID after successful creation */
  vaultTxid: string | null;
}

export function useCreateVault(options: UseCreateVaultOptions = {}): UseCreateVaultResult {
  const { wallet } = useWallet();
  const { segwitBalance } = useBalance();
  const { btcPrice } = usePrice();
  const setPendingTransaction = usePendingVaultTransactionStore((s) => s.setPendingTransaction);
  const addPendingTransaction = usePendingTransactionsStore((s) => s.addPendingTransaction);
  const markUtxoAsSpent = usePendingTransactionsStore((s) => s.markUtxoAsSpent);
  const showSnackbar = useNotificationStore((s) => s.showSnackbar);

  const {
    btcAmount,
    borrowAmountUsd,
    protocolUnitAmount,
    selectedFeeRate,
    loading,
    error,
    txid,
    vaultTxid,
    setLoading,
    setError,
    setTxid,
    setVaultTxid,
    setCurrentStep,
    setProcessingStep,
    reset,
  } = useVaultCreation();

  // Track if we're in the middle of an operation
  const operationInProgressRef = useRef(false);

  const updateProcessingStep = useCallback(
    (step: ProcessingStep) => {
      setProcessingStep(step);
    },
    [setProcessingStep]
  );

  const createVault = useCallback(
    async (params: CreateVaultParams = {}): Promise<string | null> => {
      // Prevent double execution
      if (operationInProgressRef.current) {
        logger.warn('[useCreateVault] Operation already in progress');
        return null;
      }

      // Validate wallet connection
      if (!wallet?.segwitAddress || !wallet?.taprootAddress) {
        setError('Wallet not connected');
        return null;
      }

      // Validate bitcoin price
      if (!btcPrice) {
        setError('Bitcoin price not available');
        return null;
      }

      // Validate vault parameters
      const validation = validateVaultParams(
        btcAmount,
        protocolUnitAmount,
        btcPrice,
        segwitBalance // Available BTC balance from wallet
      );

      if (!validation.isValid) {
        setError(validation.errors[0]);
        return null;
      }

      operationInProgressRef.current = true;
      setLoading(true);
      setError(null);
      setCurrentStep('processing');

      // E2E bypass: skip Guardian and simulate instant vault creation
      if (__DEV__ && process.env.EXPO_PUBLIC_E2E_BYPASS === 'true') {
        try {
          for (const step of [1, 2, 3, 4] as ProcessingStep[]) {
            updateProcessingStep(step);
            await new Promise((r) => setTimeout(r, 200));
          }
          const fakeTxid = `e2e-vault-${Date.now().toString(16)}`;
          e2eVaultState.vaultCreated = true;
          e2eVaultState.btcLocked = btcAmount;
          e2eVaultState.unitBorrowed = protocolUnitAmount;
          setTxid(fakeTxid);
          setVaultTxid(fakeTxid);
          if (!options.deferSuccessTransition) {
            setCurrentStep('success');
          }
          logger.info('[useCreateVault] E2E bypass: vault created', {
            fakeTxid,
            borrowAmountUsd,
            btcAmount,
            protocolUnitAmount,
          });
          return fakeTxid;
        } finally {
          operationInProgressRef.current = false;
          setLoading(false);
        }
      }

      try {
        // Step 1: Creating VaultWallet and config
        updateProcessingStep(1);
        logger.debug('[useCreateVault] Step 1: Creating vault wallet and config...');

        // Create VaultWallet instance
        const vaultWallet = await createVaultWallet({
          segwitAddress: wallet.segwitAddress,
          segwitPubkey: wallet.segwitPubkey || '',
          taprootAddress: wallet.taprootAddress,
          taprootPubkey: wallet.taprootPubkey || '',
        });

        const vaultConfig = createVaultConfig(protocolUnitAmount, btcAmount, selectedFeeRate);

        // Step 2: Connect to guardian and reserve UNIT
        updateProcessingStep(2);
        logger.debug('[useCreateVault] Step 2: Connecting to guardian...');

        const gclient = await getGuardianClient(wallet.taprootPubkey || '');

        logger.debug('[useCreateVault] Step 2: Reserving UNIT...');
        const acctRes = await guardianOpenVaultReserve(
          gclient,
          vaultConfig,
          wallet.taprootPubkey || ''
        );

        // Step 3: Create vault request with PSBT
        updateProcessingStep(3);
        logger.debug('[useCreateVault] Step 3: Creating vault request...');

        const liquidationPrice = computeLiquidationPrice(protocolUnitAmount, btcAmount);

        const vaultReq = await createVaultReqOpen(
          vaultWallet,
          vaultConfig,
          acctRes,
          {
            feeRate: selectedFeeRate,
            isMaxDeposit: params.isMaxDeposit || false,
            liquidationPrice,
          }
        );

        // Step 4: Submit to guardian
        updateProcessingStep(4);
        logger.debug('[useCreateVault] Step 4: Submitting to guardian...');

        const resultTxid = await guardianSendReqOpen(gclient, vaultReq);

        const livePendingTransactions = usePendingTransactionsStore.getState().pendingTransactions;
        const { outputs, spentInputs, parentTxid } = extractVaultIssuePendingData(
          vaultReq,
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
            resultTxid,
            outputs,
            'UNIT',
            parentTxid,
            Math.round(protocolUnitAmount * 100),
            spentInputs,
          );
        }

        const latestPendingTransactions = usePendingTransactionsStore.getState().pendingTransactions;
        const finalizationPendingData = extractVaultFinalizationPendingData(
          vaultReq,
          wallet,
          latestPendingTransactions,
        );

        for (const spentInput of finalizationPendingData.spentInputs) {
          if (latestPendingTransactions[spentInput.txid]?.status === 'pending') {
            await markUtxoAsSpent(spentInput.txid, spentInput.vout);
          }
        }

        if (
          vaultReq.vault_txid !== resultTxid &&
          finalizationPendingData.outputs.length > 0
        ) {
          await addPendingTransaction(
            vaultReq.vault_txid,
            finalizationPendingData.outputs,
            'BTC',
            finalizationPendingData.parentTxid,
            undefined,
            finalizationPendingData.spentInputs,
          );
        }

        setTxid(resultTxid);
        setVaultTxid(vaultReq.vault_txid);

        await setPendingTransaction({
          txid: resultTxid,
          vaultTxid: vaultReq.vault_txid,
          action: 'open',
          btcAmt: Math.round(btcAmount * 100_000_000),
          unitAmt: Math.round(protocolUnitAmount * 100),
          timestamp: Date.now(),
          vaultPubkey: wallet.taprootPubkey || '',
        });

        showSnackbar({
          title: 'Vault transaction confirming',
          description: 'Please wait for the block to get mined',
          type: 'info',
          duration: 7000,
        });

        if (!options.deferSuccessTransition) {
          setCurrentStep('success');
        }

        logger.info('[useCreateVault] Vault created successfully:', { txid: resultTxid });
        return resultTxid;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Vault creation failed';
        const errorStack = err instanceof Error ? err.stack : undefined;
        logger.error('[useCreateVault] Error:', {
          message: errorMessage,
          stack: errorStack,
          rawError: JSON.stringify(err, Object.getOwnPropertyNames(err || {}))
        });
        setError(errorMessage);
        setCurrentStep('confirm'); // Go back to confirm step on error
        return null;
      } finally {
        operationInProgressRef.current = false;
        setLoading(false);
        disconnectGuardian();
      }
    },
    [
      wallet,
      btcPrice,
      btcAmount,
      borrowAmountUsd,
      protocolUnitAmount,
      segwitBalance,
      selectedFeeRate,
      setLoading,
      setError,
      setTxid,
      setVaultTxid,
      setCurrentStep,
      updateProcessingStep,
      setPendingTransaction,
      addPendingTransaction,
      markUtxoAsSpent,
      showSnackbar,
      options.deferSuccessTransition,
    ]
  );

  const cancel = useCallback(() => {
    operationInProgressRef.current = false;
    disconnectGuardian();
    reset();
  }, [reset]);

  return {
    createVault,
    cancel,
    isLoading: loading,
    error,
    txid,
    vaultTxid,
  };
}

// Re-export for convenience
export { useVaultCreation } from '../stores/vaultCreationStore';
