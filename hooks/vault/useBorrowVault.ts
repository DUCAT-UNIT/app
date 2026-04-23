/**
 * useBorrowVault Hook (New Implementation)
 *
 * Wrapper around useVaultOperation for the borrow flow.
 * Uses the unified base hook with borrow-specific configuration.
 */

import type {
GuardianSocket,
UnitAccountResponse,
WalletVaultBorrowConfig,
WalletVaultBorrowRequest,
} from '@ducat-unit/client-sdk';
import { useMemo } from 'react';
import {
createBorrowConfig,
createVaultReqBorrow,
guardianBorrowReserve,
guardianSendReqBorrow,
} from '../../services/vaultOperationsService';
import type { BorrowProcessingStep,BorrowStep } from '../../stores/borrowStore';
import { useBorrowStore } from '../../stores/borrowStore';
import { computeLiquidationPrice } from '../../utils/vaultUtils';
import { useVaultOperation } from './useVaultOperation';
import type {
LiquidationPriceParams,
PendingTransactionParams,
VaultOperationConfig,
VaultRequestParams,
VaultStore,
VaultValidationParams
} from './vaultOperationTypes';

// Type aliases for readability
type BorrowConfig = WalletVaultBorrowConfig;
type BorrowRequest = WalletVaultBorrowRequest;

// Result type from guardian
interface BorrowResult {
  txid: string;
  vault_txid: string;
}

/**
 * Create the borrow-specific store adapter
 */
function useBorrowStoreAdapter(): VaultStore {
  // State selectors
  const borrowAmount = useBorrowStore((s) => s.borrowAmount);
  const selectedFeeRate = useBorrowStore((s) => s.selectedFeeRate);
  const currentUnitBorrowed = useBorrowStore((s) => s.currentUnitBorrowed);
  const currentBtcLocked = useBorrowStore((s) => s.currentBtcLocked);
  const loading = useBorrowStore((s) => s.loading);
  const error = useBorrowStore((s) => s.error);
  const txid = useBorrowStore((s) => s.txid);
  const vaultTxid = useBorrowStore((s) => s.vaultTxid);

  // Action selectors
  const setLoading = useBorrowStore((s) => s.setLoading);
  const setError = useBorrowStore((s) => s.setError);
  const setVaultTxid = useBorrowStore((s) => s.setVaultTxid);
  const setTxid = useBorrowStore((s) => s.setTxid);
  const setCurrentStep = useBorrowStore((s) => s.setCurrentStep);
  const setProcessingStep = useBorrowStore((s) => s.setProcessingStep);
  const setCurrentVaultData = useBorrowStore((s) => s.setCurrentVaultData);
  const setBitcoinPrice = useBorrowStore((s) => s.setBitcoinPrice);
  const reset = useBorrowStore((s) => s.reset);

  return {
    state: {
      amount: borrowAmount,
      selectedFeeRate,
      currentUnitBorrowed,
      currentBtcLocked,
      loading,
      error,
      issueTxid: txid,
      vaultTxid,
    },
    actions: {
      setLoading,
      setError,
      setVaultTxid,
      setIssueTxid: (t: string | null) => setTxid(t),
      setCurrentStep: (step: string) => setCurrentStep(step as BorrowStep),
      setProcessingStep: (step: 1 | 2 | 3 | 4) => setProcessingStep(step as BorrowProcessingStep),
      setCurrentVaultData,
      setBitcoinPrice: (p: number) => setBitcoinPrice(p ?? null),
      reset,
    },
  };
}

/**
 * Validate borrow operation
 */
function validateBorrow(params: VaultValidationParams): string | null {
  const { wallet, btcPrice, amount, currentBtcLocked } = params;

  if (!wallet?.segwitAddress || !wallet?.taprootAddress) {
    return 'Wallet not connected';
  }

  if (!btcPrice) {
    return 'Bitcoin price not available';
  }

  if (amount <= 0) {
    return 'Please enter an amount to borrow';
  }

  if (currentBtcLocked <= 0) {
    return 'No vault data. Please load vault data first.';
  }

  return null;
}

/**
 * Create borrow request
 */
async function createBorrowRequest(
  params: VaultRequestParams<BorrowConfig>
): Promise<BorrowRequest> {
  const { vaultWallet, config, reservationResult, feeRate, oracleQuote, vaultProfile } = params;

  return createVaultReqBorrow(
    vaultWallet as Parameters<typeof createVaultReqBorrow>[0],
    config,
    reservationResult as UnitAccountResponse,
    {
      feeRate,
      oracleQuote: oracleQuote as Parameters<typeof createVaultReqBorrow>[3]['oracleQuote'],
      vaultProfile,
    }
  );
}

/**
 * Perform borrow reservation
 */
async function performBorrowReservation(
  gclient: GuardianSocket,
  config: BorrowConfig,
  taprootPubkey: string
): Promise<UnitAccountResponse> {
  return guardianBorrowReserve(gclient, config, taprootPubkey);
}

/**
 * Send borrow request to guardian
 */
async function sendBorrowRequest(
  gclient: GuardianSocket,
  request: BorrowRequest
): Promise<BorrowResult> {
  return guardianSendReqBorrow(gclient, request);
}

/**
 * Extract result from borrow response
 */
function extractBorrowResult(result: BorrowResult): { txid: string; vaultTxid: string } {
  return {
    txid: result.txid,
    vaultTxid: result.vault_txid,
  };
}

/**
 * Create pending transaction for borrow
 */
function createBorrowPendingTransaction(
  params: PendingTransactionParams<BorrowConfig>
): {
  txid: string;
  vaultTxid: string;
  action: 'borrow';
  btcAmt: number;
  unitAmt: number;
  timestamp: number;
  vaultPubkey: string;
} {
  const { config, result, taprootPubkey } = params;
  return {
    txid: result.txid || result.vaultTxid,
    vaultTxid: result.vaultTxid,
    action: 'borrow',
    btcAmt: 0,
    unitAmt: config.borrow_amount, // In cents
    timestamp: Date.now(),
    vaultPubkey: taprootPubkey,
  };
}

/**
 * Calculate liquidation price for borrow
 */
function calculateBorrowLiquidationPrice(params: LiquidationPriceParams): number {
  const { amount, currentUnitBorrowed, currentBtcLocked } = params;
  const newDebt = currentUnitBorrowed + amount;
  if (currentBtcLocked <= 0 || newDebt <= 0) return 0;
  return computeLiquidationPrice(newDebt, currentBtcLocked);
}

/**
 * Borrow operation configuration
 */
const borrowConfig: VaultOperationConfig<BorrowConfig, BorrowRequest, BorrowResult> = {
  operationType: 'borrow',
  operationName: 'useBorrowVault',
  needsReservation: true,
  hasIssueTxid: true,
  useStore: useBorrowStoreAdapter,
  validate: validateBorrow,
  createConfig: createBorrowConfig,
  createRequest: createBorrowRequest,
  performReservation: performBorrowReservation,
  sendRequest: sendBorrowRequest,
  extractResult: extractBorrowResult,
  createPendingTransaction: createBorrowPendingTransaction,
  calculateLiquidationPrice: calculateBorrowLiquidationPrice,
};

interface UseBorrowVaultOptions {
  deferSuccessTransition?: boolean;
}

/**
 * Result interface matching the original hook
 */
export interface UseBorrowVaultResult {
  borrow: () => Promise<{ txid: string; vaultTxid: string } | null>;
  loadVaultData: () => Promise<boolean>;
  cancel: () => void;
  isLoading: boolean;
  error: string | null;
  txid: string | null;
  vaultTxid: string | null;
  vaultDataLoaded: boolean;
}

/**
 * useBorrowVault Hook
 *
 * Orchestrates the full borrow flow using the unified vault operation hook.
 */
export function useBorrowVault(options: UseBorrowVaultOptions = {}): UseBorrowVaultResult {
  const result = useVaultOperation({
    ...borrowConfig,
    deferSuccessTransition: options.deferSuccessTransition,
  });

  // Map to original interface
  return useMemo(
    () => ({
      borrow: result.execute as () => Promise<{ txid: string; vaultTxid: string } | null>,
      loadVaultData: result.loadVaultData,
      cancel: result.cancel,
      isLoading: result.isLoading,
      error: result.error,
      txid: result.issueTxid,
      vaultTxid: result.vaultTxid,
      vaultDataLoaded: result.vaultDataLoaded,
    }),
    [result]
  );
}

// Re-export for convenience
export { useBorrow } from '../../stores/borrowStore';
