/**
 * useBorrowVault Hook
 * Orchestrates the full borrow flow for borrowing more UNIT from an existing vault
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { useBorrowStore } from '../stores/borrowStore';
import { useWallet } from '../contexts/WalletContext';
import { usePrice } from '../stores/priceStore';
import { getGuardianClient, disconnectGuardian } from '../services/guardianService';
import { usePendingVaultTransactionStore } from '../stores/pendingVaultTransactionStore';
import { useNotificationStore } from '../stores/notificationStore';
import {
  createBorrowConfig,
  guardianBorrowReserve,
  guardianSendReqBorrow,
  createVaultReqBorrow,
  computeVaultPrevoutFromTx,
  buildVaultProfile,
} from '../services/vaultOperationsService';
import { fetchPriceQuote } from '../services/oracleService';
import { createVaultWallet } from '../services/vaultWalletService';
import { fetchVaultData, fetchVaultHistory } from '../services/vaultService';
import { computeLiquidationPrice } from '../utils/vaultUtils';
import { logger } from '../utils/logger';
import type { BorrowProcessingStep } from '../stores/borrowStore';
import type { VaultProfile } from '@ducat-unit/client-sdk';

export interface UseBorrowVaultResult {
  /** Initiates the borrow process */
  borrowMore: () => Promise<{ txid: string; vaultTxid: string } | null>;
  /** Fetches and loads current vault data */
  loadVaultData: () => Promise<boolean>;
  /** Cancels the current operation and resets state */
  cancel: () => void;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Current error message, if any */
  error: string | null;
  /** Transaction ID after successful borrow */
  txid: string | null;
  /** Vault transaction ID after successful borrow */
  vaultTxid: string | null;
  /** Whether vault data has been loaded */
  vaultDataLoaded: boolean;
}

export function useBorrowVault(): UseBorrowVaultResult {
  const { wallet } = useWallet();
  const { btcPrice } = usePrice();

  const {
    borrowAmount,
    selectedFeeRate,
    currentUnitBorrowed,
    currentBtcLocked,
    loading,
    error,
    txid,
    vaultTxid,
    setLoading,
    setError,
    setTxid,
    setCurrentStep,
    setProcessingStep,
    setCurrentVaultData,
    setBitcoinPrice,
    reset,
  } = useBorrowStore();

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
    (step: BorrowProcessingStep) => {
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
      logger.debug('[useBorrowVault] Loading vault data...');

      const vaultData = await fetchVaultData(wallet.taprootPubkey);

      if (!vaultData) {
        setError('No vault found. Please create a vault first.');
        return false;
      }

      const unitBorrowed = vaultData.totalDebt || 0;
      const btcLocked = vaultData.totalCollateral || 0;

      setCurrentVaultData(unitBorrowed, btcLocked);
      setVaultDataLoaded(true);

      logger.debug('[useBorrowVault] Vault data loaded:', {
        unitBorrowed,
        btcLocked,
        vaultId: vaultData.vaultId,
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load vault data';
      logger.error('[useBorrowVault] Error loading vault data:', { error: errorMessage });
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
        logger.error('[useBorrowVault] No vault info available');
        return null;
      }

      // Fetch vault history to get the latest transaction for VaultPrevout
      const history = await fetchVaultHistory(wallet.taprootPubkey);

      if (!history || history.length === 0) {
        logger.error('[useBorrowVault] No vault history available');
        return null;
      }

      const latestTx = history[0];
      const vaultPrevout = computeVaultPrevoutFromTx(latestTx);

      if (!vaultPrevout) {
        logger.error('[useBorrowVault] Could not compute VaultPrevout from transaction');
        return null;
      }

      const profile = buildVaultProfile(
        wallet.taprootPubkey,
        vaultData.vaultInfo,
        vaultPrevout
      );

      logger.debug('[useBorrowVault] VaultProfile built:', {
        acct_id: profile.acct_id,
        master_id: profile.master_id,
        hasRdata: !!profile.rdata,
        hasUtxo: !!profile.utxo,
      });

      return profile;
    } catch (err) {
      logger.error('[useBorrowVault] Error building VaultProfile:', { error: err });
      return null;
    }
  }, [wallet?.taprootPubkey]);

  const borrowMore = useCallback(async (): Promise<{ txid: string; vaultTxid: string } | null> => {
    // Prevent double execution
    if (operationInProgressRef.current) {
      logger.warn('[useBorrowVault] Operation already in progress');
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

    // Validate borrow amount
    if (borrowAmount <= 0) {
      setError('Please enter an amount to borrow');
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
      logger.debug('[useBorrowVault] Step 1: Building VaultProfile and config...');

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

      const borrowConfig = createBorrowConfig(borrowAmount, selectedFeeRate);

      // Step 2: Connect to guardian and reserve UNIT
      updateProcessingStep(2);
      logger.debug('[useBorrowVault] Step 2: Connecting to guardian...');

      const gclient = await getGuardianClient(wallet.taprootPubkey || '');

      logger.debug('[useBorrowVault] Step 2: Reserving UNIT for borrow...');
      const acctRes = await guardianBorrowReserve(
        gclient,
        borrowConfig,
        wallet.taprootPubkey || ''
      );

      // Step 3: Create borrow request with PSBT
      updateProcessingStep(3);
      logger.debug('[useBorrowVault] Step 3: Creating borrow request...');

      // Calculate new liquidation price after borrow
      const totalDebt = currentUnitBorrowed + borrowAmount;
      const newLiquidationPrice = computeLiquidationPrice(totalDebt, currentBtcLocked);

      // Fetch oracle quote
      const oracleQuote = await fetchPriceQuote(newLiquidationPrice);

      const borrowReq = await createVaultReqBorrow(
        vaultWallet,
        borrowConfig,
        acctRes,
        {
          feeRate: selectedFeeRate,
          oracleQuote,
          vaultProfile,
        }
      );

      // Step 4: Submit to guardian
      updateProcessingStep(4);
      logger.debug('[useBorrowVault] Step 4: Submitting to guardian...');

      const result = await guardianSendReqBorrow(gclient, borrowReq);

      setTxid(result.txid, result.vault_txid);
      setCurrentStep('success');

      // Set pending transaction for activity list and button disabling
      await setPendingTransaction({
        txid: result.txid,
        vaultTxid: result.vault_txid,
        action: 'borrow',
        btcAmt: 0,
        unitAmt: borrowConfig.borrow_amount, // In cents
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

      logger.info('[useBorrowVault] Borrow completed successfully:', {
        txid: result.txid,
        vault_txid: result.vault_txid,
      });

      return { txid: result.txid, vaultTxid: result.vault_txid };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Borrow operation failed';
      const errorStack = err instanceof Error ? err.stack : undefined;
      logger.error('[useBorrowVault] Error:', {
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
    borrowAmount,
    selectedFeeRate,
    currentUnitBorrowed,
    currentBtcLocked,
    setLoading,
    setError,
    setTxid,
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
    borrowMore,
    loadVaultData,
    cancel,
    isLoading: loading,
    error,
    txid,
    vaultTxid,
    vaultDataLoaded,
  };
}

// Re-export for convenience
export { useBorrow } from '../stores/borrowStore';
