/**
 * useRepayVault Hook (New Implementation)
 *
 * Wrapper around useVaultOperation for the repay flow.
 * Uses the unified base hook with repay-specific configuration.
 */

import { useMemo } from 'react';
import { useRepayStore } from '../../stores/repayStore';
import {
  createRepayConfig,
  createVaultReqRepay,
  guardianRepayReserve,
  guardianSendReqRepay,
} from '../../services/vaultOperationsService';
import { computeLiquidationPrice } from '../../utils/vaultUtils';
import { useVaultOperation } from './useVaultOperation';
import type {
  VaultOperationConfig,
  VaultStore,
  VaultValidationParams,
  VaultRequestParams,
  LiquidationPriceParams,
  PendingTransactionParams,
} from './vaultOperationTypes';
import type {
  GuardianSocket,
  WalletVaultRepayConfig,
  WalletVaultRepayRequest,
  UnitAccountResponse,
} from '@ducat-unit/client-sdk';
import type { RepayStep, RepayProcessingStep } from '../../stores/repayStore';

// Type aliases for readability
type RepayConfig = WalletVaultRepayConfig;
type RepayRequest = WalletVaultRepayRequest;

// Result type from guardian
interface RepayResult {
  txid: string;
  vault_txid: string;
}

/**
 * Create the repay-specific store adapter
 */
function useRepayStoreAdapter(): VaultStore {
  // State selectors
  const repayAmountUnit = useRepayStore((s) => s.repayAmountUnit);
  const selectedFeeRate = useRepayStore((s) => s.selectedFeeRate);
  const currentUnitBorrowed = useRepayStore((s) => s.currentUnitBorrowed);
  const currentBtcLocked = useRepayStore((s) => s.currentBtcLocked);
  const loading = useRepayStore((s) => s.loading);
  const error = useRepayStore((s) => s.error);
  const issueTxid = useRepayStore((s) => s.issueTxid);
  const vaultTxid = useRepayStore((s) => s.vaultTxid);

  // Action selectors
  const setLoading = useRepayStore((s) => s.setLoading);
  const setError = useRepayStore((s) => s.setError);
  const setIssueTxid = useRepayStore((s) => s.setIssueTxid);
  const setVaultTxid = useRepayStore((s) => s.setVaultTxid);
  const setCurrentStep = useRepayStore((s) => s.setCurrentStep);
  const setProcessingStep = useRepayStore((s) => s.setProcessingStep);
  const setCurrentVaultData = useRepayStore((s) => s.setCurrentVaultData);
  const setBitcoinPrice = useRepayStore((s) => s.setBitcoinPrice);
  const reset = useRepayStore((s) => s.reset);

  return {
    state: {
      amount: repayAmountUnit,
      selectedFeeRate,
      currentUnitBorrowed,
      currentBtcLocked,
      loading,
      error,
      issueTxid,
      vaultTxid,
    },
    actions: {
      setLoading,
      setError,
      setVaultTxid,
      setIssueTxid,
      setCurrentStep: (step: string) => setCurrentStep(step as RepayStep),
      setProcessingStep: (step: 1 | 2 | 3 | 4) => setProcessingStep(step as RepayProcessingStep),
      setCurrentVaultData,
      setBitcoinPrice: (p: number) => setBitcoinPrice(p),
      reset,
    },
  };
}

/**
 * Validate repay operation
 */
function validateRepay(params: VaultValidationParams): string | null {
  const { wallet, btcPrice, amount, currentUnitBorrowed, currentBtcLocked } = params;

  if (!wallet?.segwitAddress || !wallet?.taprootAddress) {
    return 'Wallet not connected';
  }

  if (!btcPrice) {
    return 'Bitcoin price not available';
  }

  if (amount <= 0) {
    return 'Please enter an amount to repay';
  }

  if (amount > currentUnitBorrowed) {
    return 'Repay amount cannot exceed current debt';
  }

  if (currentBtcLocked <= 0 && currentUnitBorrowed <= 0) {
    return 'No vault data. Please load vault data first.';
  }

  return null;
}

/**
 * Create repay request
 */
async function createRepayRequest(
  params: VaultRequestParams<RepayConfig>
): Promise<RepayRequest> {
  const { vaultWallet, config, reservationResult, feeRate, oracleQuote, vaultProfile } = params;

  return createVaultReqRepay(
    vaultWallet as Parameters<typeof createVaultReqRepay>[0],
    config,
    reservationResult as UnitAccountResponse,
    {
      feeRate,
      oracleQuote: oracleQuote as Parameters<typeof createVaultReqRepay>[3]['oracleQuote'],
      vaultProfile,
    }
  );
}

/**
 * Perform repay reservation
 */
async function performRepayReservation(
  gclient: GuardianSocket,
  config: RepayConfig,
  taprootPubkey: string
): Promise<UnitAccountResponse> {
  return guardianRepayReserve(gclient, config, taprootPubkey);
}

/**
 * Send repay request to guardian
 */
async function sendRepayRequest(
  gclient: GuardianSocket,
  request: RepayRequest
): Promise<RepayResult> {
  return guardianSendReqRepay(gclient, request);
}

/**
 * Extract result from repay response
 */
function extractRepayResult(result: RepayResult): { txid: string; vaultTxid: string } {
  return {
    txid: result.txid,
    vaultTxid: result.vault_txid,
  };
}

/**
 * Create pending transaction for repay
 */
function createRepayPendingTransaction(
  params: PendingTransactionParams<RepayConfig>
): {
  txid: string;
  vaultTxid: string;
  action: 'repay';
  btcAmt: number;
  unitAmt: number;
  timestamp: number;
  vaultPubkey: string;
} {
  const { config, result, taprootPubkey } = params;
  return {
    txid: result.txid || result.vaultTxid,
    vaultTxid: result.vaultTxid,
    action: 'repay',
    btcAmt: 0,
    unitAmt: config.repay_amount, // In cents
    timestamp: Date.now(),
    vaultPubkey: taprootPubkey,
  };
}

/**
 * Calculate liquidation price for repay
 * Repay reduces debt, so liquidation price decreases (improves)
 */
function calculateRepayLiquidationPrice(params: LiquidationPriceParams): number {
  const { amount, currentUnitBorrowed, currentBtcLocked } = params;
  const newDebt = Math.max(0, currentUnitBorrowed - amount);

  if (currentBtcLocked <= 0 || newDebt <= 0) return 0;
  return computeLiquidationPrice(newDebt, currentBtcLocked);
}

/**
 * Repay operation configuration
 */
const repayConfig: VaultOperationConfig<RepayConfig, RepayRequest, RepayResult> = {
  operationType: 'repay',
  operationName: 'useRepayVault',
  needsReservation: true,
  hasIssueTxid: true,
  useStore: useRepayStoreAdapter,
  validate: validateRepay,
  createConfig: createRepayConfig,
  createRequest: createRepayRequest,
  performReservation: performRepayReservation,
  sendRequest: sendRepayRequest,
  extractResult: extractRepayResult,
  createPendingTransaction: createRepayPendingTransaction,
  calculateLiquidationPrice: calculateRepayLiquidationPrice,
};

/**
 * Result interface matching the original hook
 */
export interface UseRepayVaultResult {
  repay: () => Promise<{ txid: string; vaultTxid: string } | null>;
  loadVaultData: () => Promise<boolean>;
  cancel: () => void;
  isLoading: boolean;
  error: string | null;
  issueTxid: string | null;
  vaultTxid: string | null;
  vaultDataLoaded: boolean;
}

/**
 * useRepayVault Hook
 *
 * Orchestrates the full repay flow using the unified vault operation hook.
 */
export function useRepayVault(): UseRepayVaultResult {
  const result = useVaultOperation(repayConfig);

  // Map to original interface
  return useMemo(
    () => ({
      repay: result.execute as () => Promise<{ txid: string; vaultTxid: string } | null>,
      loadVaultData: result.loadVaultData,
      cancel: result.cancel,
      isLoading: result.isLoading,
      error: result.error,
      issueTxid: result.issueTxid,
      vaultTxid: result.vaultTxid,
      vaultDataLoaded: result.vaultDataLoaded,
    }),
    [result]
  );
}

// Re-export for convenience
export { useRepay } from '../../stores/repayStore';
