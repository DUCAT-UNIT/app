/**
 * useWithdrawVault Hook
 * Orchestrates the full withdraw flow for removing BTC collateral from an existing vault
 */

import { useCallback, useRef, useEffect } from 'react';
import { useWithdrawStore } from '../stores/withdrawStore';
import { useWallet } from '../contexts/WalletContext';
import { usePrice } from '../stores/priceStore';
import { getGuardianClient, disconnectGuardian } from '../services/guardianService';
import {
  createWithdrawConfig,
  createVaultReqWithdraw,
  guardianSendReqWithdraw,
  computeVaultPrevoutFromTx,
  buildVaultProfile,
} from '../services/vaultOperationsService';
import { fetchPriceQuote } from '../services/oracleService';
import { createVaultWallet } from '../services/vaultWalletService';
import { fetchVaultData, fetchVaultHistory } from '../services/vaultService';
import { computeLiquidationPrice } from '../utils/vaultUtils';
import { VAULT_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';
import type { WithdrawProcessingStep } from '../stores/withdrawStore';
import type { VaultProfile } from '@ducat-unit/client-sdk';

export interface UseWithdrawVaultResult {
  /** Initiates the withdraw process */
  withdraw: () => Promise<{ vaultTxid: string } | null>;
  /** Fetches and loads current vault data */
  loadVaultData: () => Promise<boolean>;
  /** Cancels the current operation and resets state */
  cancel: () => void;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Current error message, if any */
  error: string | null;
  /** Vault transaction ID after successful withdraw */
  vaultTxid: string | null;
  /** Whether vault data has been loaded */
  vaultDataLoaded: boolean;
}

export function useWithdrawVault(): UseWithdrawVaultResult {
  const { wallet } = useWallet();
  const { btcPrice } = usePrice();

  const {
    withdrawAmountSats,
    selectedFeeRate,
    currentUnitBorrowed,
    currentBtcLocked,
    loading,
    error,
    vaultTxid,
    setLoading,
    setError,
    setVaultTxid,
    setCurrentStep,
    setProcessingStep,
    setCurrentVaultData,
    setBitcoinPrice,
    reset,
  } = useWithdrawStore();

  // Track if we're in the middle of an operation
  const operationInProgressRef = useRef(false);
  const vaultDataLoadedRef = useRef(false);

  // Update bitcoin price when it changes
  useEffect(() => {
    setBitcoinPrice(btcPrice);
  }, [btcPrice, setBitcoinPrice]);

  const updateProcessingStep = useCallback(
    (step: WithdrawProcessingStep) => {
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
      logger.debug('[useWithdrawVault] Loading vault data...');

      const vaultData = await fetchVaultData(wallet.taprootPubkey);

      if (!vaultData) {
        setError('No vault found. Please create a vault first.');
        return false;
      }

      // Convert from API units to display units
      const unitBorrowed = vaultData.totalDebt || 0;
      const btcLocked = vaultData.totalCollateral || 0;

      setCurrentVaultData(unitBorrowed, btcLocked);
      vaultDataLoadedRef.current = true;

      logger.debug('[useWithdrawVault] Vault data loaded:', {
        unitBorrowed,
        btcLocked,
        vaultId: vaultData.vaultId,
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load vault data';
      logger.error('[useWithdrawVault] Error loading vault data:', { error: errorMessage });
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
        logger.error('[useWithdrawVault] No vault info available');
        return null;
      }

      // Fetch vault history to get the latest transaction for VaultPrevout
      const history = await fetchVaultHistory(wallet.taprootPubkey);

      if (!history || history.length === 0) {
        logger.error('[useWithdrawVault] No vault history available');
        return null;
      }

      const latestTx = history[0];
      const vaultPrevout = computeVaultPrevoutFromTx(latestTx);

      if (!vaultPrevout) {
        logger.error('[useWithdrawVault] Could not compute VaultPrevout from transaction');
        return null;
      }

      const profile = buildVaultProfile(
        wallet.taprootPubkey,
        vaultData.vaultInfo,
        vaultPrevout
      );

      logger.debug('[useWithdrawVault] VaultProfile built:', {
        acct_id: profile.acct_id,
        master_id: profile.master_id,
        hasRdata: !!profile.rdata,
        hasUtxo: !!profile.utxo,
      });

      return profile;
    } catch (err) {
      logger.error('[useWithdrawVault] Error building VaultProfile:', { error: err });
      return null;
    }
  }, [wallet?.taprootPubkey]);

  /**
   * Calculate if withdraw would violate minimum health ratio
   */
  const validateHealthAfterWithdraw = useCallback((): boolean => {
    if (!btcPrice || currentUnitBorrowed <= 0) return true; // No debt, can withdraw freely

    const newCollateral = currentBtcLocked - withdrawAmountSats / 100_000_000;
    if (newCollateral <= 0) return false;

    // Calculate new health factor
    const collateralValue = newCollateral * btcPrice;
    const newHealthFactor = (collateralValue / currentUnitBorrowed) * 100;

    return newHealthFactor >= VAULT_CONFIG.MIN_COL_RATE * 100;
  }, [btcPrice, currentUnitBorrowed, currentBtcLocked, withdrawAmountSats]);

  const withdraw = useCallback(async (): Promise<{ vaultTxid: string } | null> => {
    // Prevent double execution
    if (operationInProgressRef.current) {
      logger.warn('[useWithdrawVault] Operation already in progress');
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

    // Validate withdraw amount
    if (withdrawAmountSats <= 0) {
      setError('Please enter an amount to withdraw');
      return null;
    }

    // Validate withdraw amount doesn't exceed collateral
    const maxWithdrawSats = Math.floor(currentBtcLocked * 100_000_000);
    if (withdrawAmountSats > maxWithdrawSats) {
      setError('Withdraw amount cannot exceed current collateral');
      return null;
    }

    // Validate health ratio after withdraw
    if (!validateHealthAfterWithdraw()) {
      setError(`Withdrawal would put vault below minimum health ratio (${VAULT_CONFIG.MIN_COL_RATE * 100}%)`);
      return null;
    }

    // Validate vault data is loaded
    if (currentBtcLocked <= 0) {
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
      logger.debug('[useWithdrawVault] Step 1: Building VaultProfile and config...');

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

      const withdrawConfig = createWithdrawConfig(withdrawAmountSats, selectedFeeRate);

      // Step 2: Connect to guardian (no reservation needed for withdraw)
      updateProcessingStep(2);
      logger.debug('[useWithdrawVault] Step 2: Connecting to guardian...');

      const gclient = await getGuardianClient(wallet.taprootPubkey || '');

      // Step 3: Create withdraw request with PSBT
      updateProcessingStep(3);
      logger.debug('[useWithdrawVault] Step 3: Creating withdraw request...');

      // Calculate new liquidation price after withdraw
      const newCollateral = currentBtcLocked - withdrawAmountSats / 100_000_000;
      const newLiquidationPrice = currentUnitBorrowed > 0 && newCollateral > 0
        ? computeLiquidationPrice(currentUnitBorrowed, newCollateral)
        : 0;

      // Fetch oracle quote
      const oracleQuote = await fetchPriceQuote(newLiquidationPrice);

      const withdrawReq = await createVaultReqWithdraw(
        vaultWallet,
        withdrawConfig,
        {
          feeRate: selectedFeeRate,
          oracleQuote,
          vaultProfile,
        }
      );

      // Step 4: Submit to guardian
      updateProcessingStep(4);
      logger.debug('[useWithdrawVault] Step 4: Submitting to guardian...');

      const result = await guardianSendReqWithdraw(gclient, withdrawReq);

      setVaultTxid(result.vault_txid);
      setCurrentStep('success');

      logger.info('[useWithdrawVault] Withdraw completed successfully:', {
        vault_txid: result.vault_txid,
      });

      return { vaultTxid: result.vault_txid };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Withdraw operation failed';
      const errorStack = err instanceof Error ? err.stack : undefined;
      logger.error('[useWithdrawVault] Error:', {
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
    withdrawAmountSats,
    selectedFeeRate,
    currentUnitBorrowed,
    currentBtcLocked,
    setLoading,
    setError,
    setVaultTxid,
    setCurrentStep,
    updateProcessingStep,
    buildVaultProfileFromData,
    validateHealthAfterWithdraw,
  ]);

  const cancel = useCallback(() => {
    operationInProgressRef.current = false;
    vaultDataLoadedRef.current = false;
    disconnectGuardian();
    reset();
  }, [reset]);

  return {
    withdraw,
    loadVaultData,
    cancel,
    isLoading: loading,
    error,
    vaultTxid,
    vaultDataLoaded: vaultDataLoadedRef.current,
  };
}

// Re-export for convenience
export { useWithdraw } from '../stores/withdrawStore';
