/**
 * useCreateVault Hook
 * Orchestrates the full vault creation flow
 */

import { useCallback, useRef } from 'react';
import { useVaultCreationStore } from '../stores/vaultCreationStore';
import { useWallet } from '../contexts/WalletContext';
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
import { logger } from '../utils/logger';
import type { ProcessingStep } from '../stores/vaultCreationStore';

export interface CreateVaultParams {
  isMaxDeposit?: boolean;
  isMaxBorrow?: boolean;
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
}

export function useCreateVault(): UseCreateVaultResult {
  const { wallet } = useWallet();
  const { btcPrice } = usePrice();

  const {
    btcAmount,
    unitAmount,
    selectedFeeRate,
    loading,
    error,
    txid,
    setLoading,
    setError,
    setTxid,
    setCurrentStep,
    setProcessingStep,
    reset,
  } = useVaultCreationStore();

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
        unitAmount,
        btcPrice,
        btcAmount // TODO: Get actual available balance
      );

      if (!validation.isValid) {
        setError(validation.errors[0]);
        return null;
      }

      operationInProgressRef.current = true;
      setLoading(true);
      setError(null);
      setCurrentStep('processing');

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

        const vaultConfig = createVaultConfig(unitAmount, btcAmount, selectedFeeRate);

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

        const liquidationPrice = computeLiquidationPrice(unitAmount, btcAmount);

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

        setTxid(resultTxid);
        setCurrentStep('success');

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
      unitAmount,
      selectedFeeRate,
      setLoading,
      setError,
      setTxid,
      setCurrentStep,
      updateProcessingStep,
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
  };
}

// Re-export for convenience
export { useVaultCreation } from '../stores/vaultCreationStore';
