/**
 * useWithdrawVault Hook (New Implementation)
 *
 * Wrapper around useVaultOperation for the withdraw flow.
 * Uses the unified base hook with withdraw-specific configuration.
 */

import { useMemo } from 'react';
import { useWithdrawStore } from '../../stores/withdrawStore';
import {
  createWithdrawConfig,
  createVaultReqWithdraw,
  guardianSendReqWithdraw,
} from '../../services/vaultOperationsService';
import { computeLiquidationPrice } from '../../utils/vaultUtils';
import { VAULT_CONFIG } from '../../utils/constants';
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
  WalletVaultWithdrawConfig,
  WalletVaultWithdrawRequest,
} from '@ducat-unit/client-sdk';
import type { WithdrawStep, WithdrawProcessingStep } from '../../stores/withdrawStore';

// Type aliases for readability
type WithdrawConfig = WalletVaultWithdrawConfig;
type WithdrawRequest = WalletVaultWithdrawRequest;

// Result type from guardian
interface WithdrawResult {
  vault_txid: string;
}

// Store the validation context for health ratio check
let validationContext: {
  btcPrice: number | null;
} = { btcPrice: null };

/**
 * Create the withdraw-specific store adapter
 */
function useWithdrawStoreAdapter(): VaultStore {
  // State selectors
  const withdrawAmountSats = useWithdrawStore((s) => s.withdrawAmountSats);
  const selectedFeeRate = useWithdrawStore((s) => s.selectedFeeRate);
  const currentUnitBorrowed = useWithdrawStore((s) => s.currentUnitBorrowed);
  const currentBtcLocked = useWithdrawStore((s) => s.currentBtcLocked);
  const loading = useWithdrawStore((s) => s.loading);
  const error = useWithdrawStore((s) => s.error);
  const vaultTxid = useWithdrawStore((s) => s.vaultTxid);

  // Action selectors
  const setLoading = useWithdrawStore((s) => s.setLoading);
  const setError = useWithdrawStore((s) => s.setError);
  const setVaultTxid = useWithdrawStore((s) => s.setVaultTxid);
  const setCurrentStep = useWithdrawStore((s) => s.setCurrentStep);
  const setProcessingStep = useWithdrawStore((s) => s.setProcessingStep);
  const setCurrentVaultData = useWithdrawStore((s) => s.setCurrentVaultData);
  const setBitcoinPrice = useWithdrawStore((s) => s.setBitcoinPrice);
  const reset = useWithdrawStore((s) => s.reset);

  return {
    state: {
      amount: withdrawAmountSats,
      selectedFeeRate,
      currentUnitBorrowed,
      currentBtcLocked,
      loading,
      error,
      vaultTxid,
    },
    actions: {
      setLoading,
      setError,
      setVaultTxid,
      setCurrentStep: (step: string) => setCurrentStep(step as WithdrawStep),
      setProcessingStep: (step: 1 | 2 | 3 | 4) => setProcessingStep(step as WithdrawProcessingStep),
      setCurrentVaultData,
      setBitcoinPrice: (p: number) => setBitcoinPrice(p),
      reset,
    },
  };
}

/**
 * Validate health ratio after withdrawal
 */
function validateHealthAfterWithdraw(
  btcPrice: number | null,
  currentUnitBorrowed: number,
  currentBtcLocked: number,
  withdrawAmountSats: number
): boolean {
  if (!btcPrice || currentUnitBorrowed <= 0) return true; // No debt, can withdraw freely

  const newCollateral = currentBtcLocked - withdrawAmountSats / 100_000_000;
  if (newCollateral <= 0) return false;

  // Calculate new health factor
  const collateralValue = newCollateral * btcPrice;
  const newHealthFactor = (collateralValue / currentUnitBorrowed) * 100;

  return newHealthFactor >= VAULT_CONFIG.MIN_COL_RATE * 100;
}

/**
 * Validate withdraw operation
 */
function validateWithdraw(params: VaultValidationParams): string | null {
  const { wallet, btcPrice, amount, currentUnitBorrowed, currentBtcLocked } = params;

  // Store btcPrice for health ratio validation
  validationContext.btcPrice = btcPrice;

  if (!wallet?.segwitAddress || !wallet?.taprootAddress) {
    return 'Wallet not connected';
  }

  if (!btcPrice) {
    return 'Bitcoin price not available';
  }

  if (amount <= 0) {
    return 'Please enter an amount to withdraw';
  }

  const maxWithdrawSats = Math.floor(currentBtcLocked * 100_000_000);
  if (amount > maxWithdrawSats) {
    return 'Withdraw amount cannot exceed current collateral';
  }

  // Validate health ratio after withdraw
  if (!validateHealthAfterWithdraw(btcPrice, currentUnitBorrowed, currentBtcLocked, amount)) {
    return `Withdrawal would put vault below minimum health ratio (${VAULT_CONFIG.MIN_COL_RATE * 100}%)`;
  }

  if (currentBtcLocked <= 0) {
    return 'No vault data. Please load vault data first.';
  }

  return null;
}

/**
 * Create withdraw request
 */
async function createWithdrawRequest(
  params: VaultRequestParams<WithdrawConfig>
): Promise<WithdrawRequest> {
  const { vaultWallet, config, feeRate, oracleQuote, vaultProfile } = params;

  return createVaultReqWithdraw(
    vaultWallet as Parameters<typeof createVaultReqWithdraw>[0],
    config,
    {
      feeRate,
      oracleQuote: oracleQuote as Parameters<typeof createVaultReqWithdraw>[2]['oracleQuote'],
      vaultProfile,
    }
  );
}

/**
 * Send withdraw request to guardian
 */
async function sendWithdrawRequest(
  gclient: GuardianSocket,
  request: WithdrawRequest
): Promise<WithdrawResult> {
  return guardianSendReqWithdraw(gclient, request);
}

/**
 * Extract result from withdraw response
 */
function extractWithdrawResult(result: WithdrawResult): { txid?: string; vaultTxid: string } {
  return {
    vaultTxid: result.vault_txid,
  };
}

/**
 * Create pending transaction for withdraw
 */
function createWithdrawPendingTransaction(
  params: PendingTransactionParams<WithdrawConfig>
): {
  txid: string;
  vaultTxid: string;
  action: 'withdraw';
  btcAmt: number;
  unitAmt: number;
  timestamp: number;
  vaultPubkey: string;
} {
  const { config, result, taprootPubkey } = params;
  return {
    txid: result.vaultTxid,
    vaultTxid: result.vaultTxid,
    action: 'withdraw',
    btcAmt: config.change_amount, // In sats (uses change_amount in SDK)
    unitAmt: 0,
    timestamp: Date.now(),
    vaultPubkey: taprootPubkey,
  };
}

/**
 * Calculate liquidation price for withdraw
 * Withdraw reduces collateral, so liquidation price increases (worsens)
 */
function calculateWithdrawLiquidationPrice(params: LiquidationPriceParams): number {
  const { amount, currentUnitBorrowed, currentBtcLocked } = params;
  const withdrawBtc = amount / 100_000_000; // Convert sats to BTC
  const newCollateral = currentBtcLocked - withdrawBtc;

  if (newCollateral <= 0 || currentUnitBorrowed <= 0) return 0;
  return computeLiquidationPrice(currentUnitBorrowed, newCollateral);
}

/**
 * Withdraw operation configuration
 */
const withdrawConfig: VaultOperationConfig<WithdrawConfig, WithdrawRequest, WithdrawResult> = {
  operationType: 'withdraw',
  operationName: 'useWithdrawVault',
  needsReservation: false,
  hasIssueTxid: false,
  useStore: useWithdrawStoreAdapter,
  validate: validateWithdraw,
  createConfig: createWithdrawConfig,
  createRequest: createWithdrawRequest,
  sendRequest: sendWithdrawRequest,
  extractResult: extractWithdrawResult,
  createPendingTransaction: createWithdrawPendingTransaction,
  calculateLiquidationPrice: calculateWithdrawLiquidationPrice,
};

/**
 * Result interface matching the original hook
 */
export interface UseWithdrawVaultResult {
  withdraw: () => Promise<{ vaultTxid: string } | null>;
  loadVaultData: () => Promise<boolean>;
  cancel: () => void;
  isLoading: boolean;
  error: string | null;
  vaultTxid: string | null;
  vaultDataLoaded: boolean;
}

/**
 * useWithdrawVault Hook
 *
 * Orchestrates the full withdraw flow using the unified vault operation hook.
 */
export function useWithdrawVaultNew(): UseWithdrawVaultResult {
  const result = useVaultOperation(withdrawConfig);

  // Map to original interface
  return useMemo(
    () => ({
      withdraw: result.execute as () => Promise<{ vaultTxid: string } | null>,
      loadVaultData: result.loadVaultData,
      cancel: result.cancel,
      isLoading: result.isLoading,
      error: result.error,
      vaultTxid: result.vaultTxid,
      vaultDataLoaded: result.vaultDataLoaded,
    }),
    [result]
  );
}

// Re-export for convenience
export { useWithdraw } from '../../stores/withdrawStore';
