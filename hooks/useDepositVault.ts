/**
 * useDepositVault Hook
 * Orchestrates the full deposit flow for adding more BTC collateral to an existing vault
 *
 * @deprecated This hook is deprecated. Use `useDepositVaultNew` from `hooks/vault` instead.
 * The new implementation uses the unified `useVaultOperation` base hook which consolidates
 * common patterns across all vault operations (borrow, deposit, repay, withdraw).
 *
 * Migration:
 * ```ts
 * // Before
 * import { useDepositVault } from '../hooks/useDepositVault';
 *
 * // After
 * import { useDepositVaultNew } from '../hooks/vault';
 * ```
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { useDepositStore } from '../stores/depositStore';
import { useWallet } from '../contexts/WalletContext';
import { usePrice } from '../stores/priceStore';
import { useVaultData } from '../contexts/WalletDataContext';
import { getGuardianClient, disconnectGuardian } from '../services/guardianService';
import { usePendingVaultTransactionStore } from '../stores/pendingVaultTransactionStore';
import { useNotificationStore } from '../stores/notificationStore';
import {
  createDepositConfig,
  createVaultReqDeposit,
  guardianSendReqDeposit,
  computeVaultPrevoutFromTx,
  buildVaultProfile,
} from '../services/vaultOperationsService';
import { fetchPriceQuote } from '../services/oracleService';
import { createVaultWallet } from '../services/vaultWalletService';
import { fetchVaultData, fetchVaultHistory } from '../services/vaultService';
import { computeLiquidationPrice } from '../utils/vaultUtils';
import { logger } from '../utils/logger';
import type { DepositProcessingStep } from '../stores/depositStore';
import type { VaultProfile } from '@ducat-unit/client-sdk';

export interface UseDepositVaultResult {
  /** Initiates the deposit process */
  deposit: () => Promise<{ vaultTxid: string } | null>;
  /** Fetches and loads current vault data */
  loadVaultData: () => Promise<boolean>;
  /** Cancels the current operation and resets state */
  cancel: () => void;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Current error message, if any */
  error: string | null;
  /** Vault transaction ID after successful deposit */
  vaultTxid: string | null;
  /** Whether vault data has been loaded */
  vaultDataLoaded: boolean;
}

export function useDepositVault(): UseDepositVaultResult {
  const { wallet } = useWallet();
  const { btcPrice } = usePrice();
  const { vaultData: contextVaultData } = useVaultData();

  // Use individual selectors for reactive state
  const depositAmountSats = useDepositStore((state) => state.depositAmountSats);
  const selectedFeeRate = useDepositStore((state) => state.selectedFeeRate);
  const currentUnitBorrowed = useDepositStore((state) => state.currentUnitBorrowed);
  const currentBtcLocked = useDepositStore((state) => state.currentBtcLocked);
  const loading = useDepositStore((state) => state.loading);
  const error = useDepositStore((state) => state.error);
  const vaultTxid = useDepositStore((state) => state.vaultTxid);

  // Get actions (stable references)
  const setLoading = useDepositStore((state) => state.setLoading);
  const setError = useDepositStore((state) => state.setError);
  const setVaultTxid = useDepositStore((state) => state.setVaultTxid);
  const setCurrentStep = useDepositStore((state) => state.setCurrentStep);
  const setProcessingStep = useDepositStore((state) => state.setProcessingStep);
  const setCurrentVaultData = useDepositStore((state) => state.setCurrentVaultData);
  const setBitcoinPrice = useDepositStore((state) => state.setBitcoinPrice);
  const reset = useDepositStore((state) => state.reset);

  // Get store actions
  const setPendingTransaction = usePendingVaultTransactionStore((state) => state.setPendingTransaction);
  const showSnackbar = useNotificationStore((state) => state.showSnackbar);

  // Track if we're in the middle of an operation
  const operationInProgressRef = useRef(false);
  const [vaultDataLoaded, setVaultDataLoaded] = useState(false);

  // Update bitcoin price when it changes
  useEffect(() => {
    setBitcoinPrice(btcPrice);
  }, [btcPrice, setBitcoinPrice]);

  const updateProcessingStep = useCallback(
    (step: DepositProcessingStep) => {
      setProcessingStep(step);
    },
    [setProcessingStep]
  );

  /**
   * Load current vault data from context (already fetched by WalletDataContext)
   */
  const loadVaultData = useCallback(async (): Promise<boolean> => {
    if (!wallet?.taprootPubkey) {
      setError('Wallet not connected');
      return false;
    }

    // Use vault data from context - no API call needed
    if (!contextVaultData) {
      setError('No vault found. Please create a vault first.');
      return false;
    }

    // Convert from API units to display units
    const unitBorrowed = contextVaultData.totalDebt || 0;
    const btcLocked = contextVaultData.totalCollateral || 0;

    setCurrentVaultData(unitBorrowed, btcLocked);
    setVaultDataLoaded(true);

    logger.debug('[useDepositVault] Vault data synced from context:', {
      unitBorrowed,
      btcLocked,
      vaultId: contextVaultData.vaultId,
    });

    return true;
  }, [wallet?.taprootPubkey, contextVaultData, setError, setCurrentVaultData]);

  /**
   * Build VaultProfile from current vault data
   */
  const buildVaultProfileFromData = useCallback(async (): Promise<VaultProfile | null> => {
    if (!wallet?.taprootPubkey) {
      return null;
    }

    try {
      // Fetch full vault data including vaultInfo
      const vaultData = await fetchVaultData(wallet.taprootPubkey);

      if (!vaultData?.vaultInfo) {
        logger.error('[useDepositVault] No vault info available');
        return null;
      }

      // Fetch vault history to get the latest transaction for VaultPrevout
      const history = await fetchVaultHistory(wallet.taprootPubkey);

      if (!history || history.length === 0) {
        logger.error('[useDepositVault] No vault history available');
        return null;
      }

      const latestTx = history[0];
      const vaultPrevout = computeVaultPrevoutFromTx(latestTx);

      if (!vaultPrevout) {
        logger.error('[useDepositVault] Could not compute VaultPrevout from transaction');
        return null;
      }

      const profile = buildVaultProfile(
        wallet.taprootPubkey,
        vaultData.vaultInfo,
        vaultPrevout
      );

      logger.debug('[useDepositVault] VaultProfile built:', {
        acct_id: profile.acct_id,
        master_id: profile.master_id,
        vault_pk: profile.vault_pk,
        guard_pk: profile.guard_pk?.substring(0, 20) + '...',
        hasRdata: !!profile.rdata,
        hasUtxo: !!profile.utxo,
        rdata_unit_balance: profile.rdata?.unit_balance,
        rdata_vault_action: profile.rdata?.vault_action,
        utxo_txid: profile.utxo?.txid,
        utxo_vout: profile.utxo?.vout,
        utxo_value: profile.utxo?.value,
        vaultId: vaultData.vaultId,
      });

      return profile;
    } catch (err) {
      logger.error('[useDepositVault] Error building VaultProfile:', { error: err });
      return null;
    }
  }, [wallet?.taprootPubkey]);

  const deposit = useCallback(async (): Promise<{ vaultTxid: string } | null> => {
    logger.debug('[useDepositVault] deposit() called with:', {
      operationInProgress: operationInProgressRef.current,
      hasSegwit: !!wallet?.segwitAddress,
      hasTaproot: !!wallet?.taprootAddress,
      btcPrice,
      depositAmountSats,
      currentBtcLocked,
      currentUnitBorrowed,
    });

    // Prevent double execution
    if (operationInProgressRef.current) {
      logger.warn('[useDepositVault] Operation already in progress');
      return null;
    }

    // Validate wallet connection
    if (!wallet?.segwitAddress || !wallet?.taprootAddress) {
      logger.error('[useDepositVault] Wallet not connected');
      setError('Wallet not connected');
      return null;
    }

    // Validate bitcoin price
    if (!btcPrice) {
      logger.error('[useDepositVault] Bitcoin price not available');
      setError('Bitcoin price not available');
      return null;
    }

    // Validate deposit amount
    if (depositAmountSats <= 0) {
      logger.error('[useDepositVault] Deposit amount is 0');
      setError('Please enter an amount to deposit');
      return null;
    }

    // Validate vault data is loaded
    if (currentBtcLocked <= 0 && currentUnitBorrowed <= 0) {
      logger.error('[useDepositVault] No vault data');
      setError('No vault data. Please load vault data first.');
      return null;
    }

    operationInProgressRef.current = true;
    setLoading(true);
    setError(null);
    setCurrentStep('processing');

    try {
      // Step 1: Build VaultProfile and create config
      updateProcessingStep(1);
      logger.debug('[useDepositVault] Step 1: Building VaultProfile and config...');

      const vaultProfile = await buildVaultProfileFromData();

      if (!vaultProfile) {
        throw new Error('Failed to build vault profile. Please try again.');
      }

      // Create VaultWallet instance
      const vaultWallet = await createVaultWallet({
        segwitAddress: wallet.segwitAddress,
        segwitPubkey: wallet.segwitPubkey || '',
        taprootAddress: wallet.taprootAddress,
        taprootPubkey: wallet.taprootPubkey || '',
      });

      const depositConfig = createDepositConfig(depositAmountSats, selectedFeeRate);

      // Step 2: Connect to guardian (no reservation needed for deposit)
      updateProcessingStep(2);
      logger.debug('[useDepositVault] Step 2: Connecting to guardian...');

      const gclient = await getGuardianClient(wallet.taprootPubkey || '');

      // Step 3: Create deposit request with PSBT
      updateProcessingStep(3);
      logger.debug('[useDepositVault] Step 3: Creating deposit request...');

      // Calculate new liquidation price after deposit
      const newCollateral = currentBtcLocked + depositAmountSats / 100_000_000;
      const newLiquidationPrice = computeLiquidationPrice(currentUnitBorrowed, newCollateral);

      // Fetch oracle quote
      const oracleQuote = await fetchPriceQuote(newLiquidationPrice);

      const depositReq = await createVaultReqDeposit(
        vaultWallet,
        depositConfig,
        {
          feeRate: selectedFeeRate,
          oracleQuote,
          vaultProfile,
        }
      );

      // Step 4: Submit to guardian
      updateProcessingStep(4);
      logger.debug('[useDepositVault] Step 4: Submitting to guardian...');

      const result = await guardianSendReqDeposit(gclient, depositReq);

      setVaultTxid(result.vault_txid);
      setCurrentStep('success');

      // Set pending transaction for activity list and button disabling
      await setPendingTransaction({
        txid: result.vault_txid,
        vaultTxid: result.vault_txid,
        action: 'deposit',
        btcAmt: depositAmountSats,
        unitAmt: 0,
        timestamp: Date.now(),
        vaultPubkey: wallet.taprootPubkey || '',
      });

      // Show info snackbar about pending confirmation (auto-dismiss after 7s)
      showSnackbar({
        title: 'Vault transaction confirming',
        description: 'Please wait for the block to get mined',
        type: 'info',
        duration: 7000,
      });

      logger.info('[useDepositVault] Deposit completed successfully:', {
        vault_txid: result.vault_txid,
      });

      return { vaultTxid: result.vault_txid };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Deposit operation failed';
      const errorStack = err instanceof Error ? err.stack : undefined;
      logger.error('[useDepositVault] Error:', {
        message: errorMessage,
        stack: errorStack,
      });
      setError(errorMessage);
      setCurrentStep('confirm'); // Go back to confirm step on error
      return null;
    } finally {
      operationInProgressRef.current = false;
      setLoading(false);
      disconnectGuardian();
    }
  }, [
    wallet,
    btcPrice,
    depositAmountSats,
    selectedFeeRate,
    currentUnitBorrowed,
    currentBtcLocked,
    setLoading,
    setError,
    setVaultTxid,
    setCurrentStep,
    updateProcessingStep,
    buildVaultProfileFromData,
    setPendingTransaction,
    showSnackbar,
  ]);

  const cancel = useCallback(() => {
    operationInProgressRef.current = false;
    setVaultDataLoaded(false);
    disconnectGuardian();
    reset();
  }, [reset]);

  return {
    deposit,
    loadVaultData,
    cancel,
    isLoading: loading,
    error,
    vaultTxid,
    vaultDataLoaded,
  };
}

// Re-export for convenience
export { useDeposit } from '../stores/depositStore';
