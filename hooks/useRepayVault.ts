/**
 * useRepayVault Hook
 * Orchestrates the full repay flow for paying back UNIT debt
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { useRepayStore } from '../stores/repayStore';
import { useWallet } from '../contexts/WalletContext';
import { usePrice } from '../stores/priceStore';
import { getGuardianClient, disconnectGuardian } from '../services/guardianService';
import { usePendingVaultTransactionStore } from '../stores/pendingVaultTransactionStore';
import { useNotificationStore } from '../stores/notificationStore';
import {
  createRepayConfig,
  createVaultReqRepay,
  guardianRepayReserve,
  guardianSendReqRepay,
  computeVaultPrevoutFromTx,
  buildVaultProfile,
} from '../services/vaultOperationsService';
import { fetchPriceQuote } from '../services/oracleService';
import { createVaultWallet } from '../services/vaultWalletService';
import { fetchVaultData, fetchVaultHistory } from '../services/vaultService';
import { computeLiquidationPrice } from '../utils/vaultUtils';
import { logger } from '../utils/logger';
import type { RepayProcessingStep } from '../stores/repayStore';
import type { VaultProfile } from '@ducat-unit/client-sdk';

export interface UseRepayVaultResult {
  /** Initiates the repay process */
  repay: () => Promise<{ txid: string; vaultTxid: string } | null>;
  /** Fetches and loads current vault data */
  loadVaultData: () => Promise<boolean>;
  /** Cancels the current operation and resets state */
  cancel: () => void;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Current error message, if any */
  error: string | null;
  /** Issue transaction ID after successful repay */
  issueTxid: string | null;
  /** Vault transaction ID after successful repay */
  vaultTxid: string | null;
  /** Whether vault data has been loaded */
  vaultDataLoaded: boolean;
}

export function useRepayVault(): UseRepayVaultResult {
  const { wallet } = useWallet();
  const { btcPrice } = usePrice();

  const {
    repayAmountUnit,
    selectedFeeRate,
    currentUnitBorrowed,
    currentBtcLocked,
    loading,
    error,
    issueTxid,
    vaultTxid,
    setLoading,
    setError,
    setIssueTxid,
    setVaultTxid,
    setCurrentStep,
    setProcessingStep,
    setCurrentVaultData,
    setBitcoinPrice,
    reset,
  } = useRepayStore();

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
    (step: RepayProcessingStep) => {
      setProcessingStep(step);
    },
    [setProcessingStep]
  );

  /**
   * Load current vault data from the validator API
   */
  const loadVaultData = useCallback(async (): Promise<boolean> => {
    if (!wallet?.taprootPubkey) {
      setError('Wallet not connected');
      return false;
    }

    try {
      setLoading(true);
      logger.debug('[useRepayVault] Loading vault data...');

      const vaultData = await fetchVaultData(wallet.taprootPubkey);

      if (!vaultData) {
        setError('No vault found. Please create a vault first.');
        return false;
      }

      // Convert from API units to display units
      const unitBorrowed = vaultData.totalDebt || 0;
      const btcLocked = vaultData.totalCollateral || 0;

      setCurrentVaultData(unitBorrowed, btcLocked);
      setVaultDataLoaded(true);

      logger.debug('[useRepayVault] Vault data loaded:', {
        unitBorrowed,
        btcLocked,
        vaultId: vaultData.vaultId,
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load vault data';
      logger.error('[useRepayVault] Error loading vault data:', { error: errorMessage });
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [wallet?.taprootPubkey, setLoading, setError, setCurrentVaultData]);

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
        logger.error('[useRepayVault] No vault info available');
        return null;
      }

      // Fetch vault history to get the latest transaction for VaultPrevout
      const history = await fetchVaultHistory(wallet.taprootPubkey);

      if (!history || history.length === 0) {
        logger.error('[useRepayVault] No vault history available');
        return null;
      }

      const latestTx = history[0];
      const vaultPrevout = computeVaultPrevoutFromTx(latestTx);

      if (!vaultPrevout) {
        logger.error('[useRepayVault] Could not compute VaultPrevout from transaction');
        return null;
      }

      const profile = buildVaultProfile(
        wallet.taprootPubkey,
        vaultData.vaultInfo,
        vaultPrevout
      );

      logger.debug('[useRepayVault] VaultProfile built:', {
        acct_id: profile.acct_id,
        master_id: profile.master_id,
        hasRdata: !!profile.rdata,
        hasUtxo: !!profile.utxo,
      });

      return profile;
    } catch (err) {
      logger.error('[useRepayVault] Error building VaultProfile:', { error: err });
      return null;
    }
  }, [wallet?.taprootPubkey]);

  const repay = useCallback(async (): Promise<{ txid: string; vaultTxid: string } | null> => {
    // Prevent double execution
    if (operationInProgressRef.current) {
      logger.warn('[useRepayVault] Operation already in progress');
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

    // Validate repay amount
    if (repayAmountUnit <= 0) {
      setError('Please enter an amount to repay');
      return null;
    }

    // Validate repay amount doesn't exceed debt
    if (repayAmountUnit > currentUnitBorrowed) {
      setError('Repay amount cannot exceed current debt');
      return null;
    }

    // Validate vault data is loaded
    if (currentBtcLocked <= 0 && currentUnitBorrowed <= 0) {
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
      logger.debug('[useRepayVault] Step 1: Building VaultProfile and config...');

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

      const repayConfig = createRepayConfig(repayAmountUnit, selectedFeeRate);

      // Step 2: Connect to guardian and reserve UNIT
      updateProcessingStep(2);
      logger.debug('[useRepayVault] Step 2: Connecting to guardian and reserving UNIT...');

      const gclient = await getGuardianClient(wallet.taprootPubkey || '');
      const acctRes = await guardianRepayReserve(gclient, repayConfig, wallet.taprootPubkey || '');

      // Step 3: Create repay request with PSBT
      updateProcessingStep(3);
      logger.debug('[useRepayVault] Step 3: Creating repay request...');

      // Calculate new liquidation price after repay
      const newDebt = Math.max(0, currentUnitBorrowed - repayAmountUnit);
      const newLiquidationPrice = newDebt > 0
        ? computeLiquidationPrice(newDebt, currentBtcLocked)
        : 0;

      // Fetch oracle quote
      const oracleQuote = await fetchPriceQuote(newLiquidationPrice);

      const repayReq = await createVaultReqRepay(
        vaultWallet,
        repayConfig,
        acctRes,
        {
          feeRate: selectedFeeRate,
          oracleQuote,
          vaultProfile,
        }
      );

      // Step 4: Submit to guardian
      updateProcessingStep(4);
      logger.debug('[useRepayVault] Step 4: Submitting to guardian...');

      const result = await guardianSendReqRepay(gclient, repayReq);

      setIssueTxid(result.txid);
      setVaultTxid(result.vault_txid);
      setCurrentStep('success');

      // Set pending transaction for activity list and button disabling
      await setPendingTransaction({
        txid: result.txid,
        vaultTxid: result.vault_txid,
        action: 'repay',
        btcAmt: 0,
        unitAmt: repayConfig.repay_amount, // In cents
        timestamp: Date.now(),
        vaultPubkey: wallet.taprootPubkey || '',
      });

      // Show info snackbar about pending confirmation
      showSnackbar({
        title: 'Vault transaction confirming',
        description: 'Please wait for the block to get mined',
        type: 'info',
        persistent: true,
      });

      logger.info('[useRepayVault] Repay completed successfully:', {
        issue_txid: result.txid,
        vault_txid: result.vault_txid,
      });

      return { txid: result.txid, vaultTxid: result.vault_txid };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Repay operation failed';
      const errorStack = err instanceof Error ? err.stack : undefined;
      logger.error('[useRepayVault] Error:', {
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
    repayAmountUnit,
    selectedFeeRate,
    currentUnitBorrowed,
    currentBtcLocked,
    setLoading,
    setError,
    setIssueTxid,
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
    repay,
    loadVaultData,
    cancel,
    isLoading: loading,
    error,
    issueTxid,
    vaultTxid,
    vaultDataLoaded,
  };
}

// Re-export for convenience
export { useRepay } from '../stores/repayStore';
