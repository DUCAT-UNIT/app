/**
 * useDepositVault Hook (New Implementation)
 *
 * Wrapper around useVaultOperation for the deposit flow.
 * Uses the unified base hook with deposit-specific configuration.
 */

import type {
GuardianSocket,
WalletVaultDepositConfig,
WalletVaultDepositRequest,
} from '@ducat-unit/client-sdk';
import { useMemo } from 'react';
import {
createDepositConfig,
createVaultReqDeposit,
guardianSendReqDeposit,
} from '../../services/vaultOperationsService';
import type { DepositProcessingStep,DepositStep } from '../../stores/depositStore';
import { useDepositStore } from '../../stores/depositStore';
import { computeLiquidationPrice } from '../../utils/vaultUtils';
import { useVaultOperation } from './useVaultOperation';
import type {
LiquidationPriceParams,
PendingTransactionParams,
VaultOperationConfig,
VaultRequestParams,
VaultStore,
VaultValidationParams,
} from './vaultOperationTypes';

// Type aliases for readability
type DepositConfig = WalletVaultDepositConfig;
type DepositRequest = WalletVaultDepositRequest;

// Result type from guardian
interface DepositResult {
  vault_txid: string;
}

/**
 * Create the deposit-specific store adapter
 */
function useDepositStoreAdapter(): VaultStore {
  // State selectors
  const depositAmountSats = useDepositStore((s) => s.depositAmountSats);
  const selectedFeeRate = useDepositStore((s) => s.selectedFeeRate);
  const currentUnitBorrowed = useDepositStore((s) => s.currentUnitBorrowed);
  const currentBtcLocked = useDepositStore((s) => s.currentBtcLocked);
  const loading = useDepositStore((s) => s.loading);
  const error = useDepositStore((s) => s.error);
  const vaultTxid = useDepositStore((s) => s.vaultTxid);

  // Action selectors
  const setLoading = useDepositStore((s) => s.setLoading);
  const setError = useDepositStore((s) => s.setError);
  const setVaultTxid = useDepositStore((s) => s.setVaultTxid);
  const setCurrentStep = useDepositStore((s) => s.setCurrentStep);
  const setProcessingStep = useDepositStore((s) => s.setProcessingStep);
  const setCurrentVaultData = useDepositStore((s) => s.setCurrentVaultData);
  const setBitcoinPrice = useDepositStore((s) => s.setBitcoinPrice);
  const reset = useDepositStore((s) => s.reset);

  return {
    state: {
      amount: depositAmountSats,
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
      setCurrentStep: (step: string) => setCurrentStep(step as DepositStep),
      setProcessingStep: (step: 1 | 2 | 3 | 4) => setProcessingStep(step as DepositProcessingStep),
      setCurrentVaultData,
      setBitcoinPrice: (p: number) => setBitcoinPrice(p ?? null),
      reset,
    },
  };
}

/**
 * Validate deposit operation
 */
function validateDeposit(params: VaultValidationParams): string | null {
  const { wallet, btcPrice, amount } = params;

  if (!wallet?.segwitAddress || !wallet?.taprootAddress) {
    return 'Wallet not connected';
  }

  if (!btcPrice) {
    return 'Bitcoin price not available';
  }

  if (amount <= 0) {
    return 'Please enter an amount to deposit';
  }

  // Note: For deposit, we allow deposits even without existing vault data
  // as the user might be adding to a new vault

  return null;
}

/**
 * Create deposit request
 */
async function createDepositRequest(
  params: VaultRequestParams<DepositConfig>
): Promise<DepositRequest> {
  const { vaultWallet, config, feeRate, oracleQuote, vaultProfile } = params;

  return createVaultReqDeposit(
    vaultWallet as Parameters<typeof createVaultReqDeposit>[0],
    config,
    {
      feeRate,
      oracleQuote: oracleQuote as Parameters<typeof createVaultReqDeposit>[2]['oracleQuote'],
      vaultProfile,
    }
  );
}

/**
 * Send deposit request to guardian
 */
async function sendDepositRequest(
  gclient: GuardianSocket,
  request: DepositRequest
): Promise<DepositResult> {
  return guardianSendReqDeposit(gclient, request);
}

/**
 * Extract result from deposit response
 */
function extractDepositResult(result: DepositResult): { txid?: string; vaultTxid: string } {
  return {
    vaultTxid: result.vault_txid,
  };
}

/**
 * Create pending transaction for deposit
 */
function createDepositPendingTransaction(
  params: PendingTransactionParams<DepositConfig>
): {
  txid: string;
  vaultTxid: string;
  action: 'deposit';
  btcAmt: number;
  unitAmt: number;
  timestamp: number;
  vaultPubkey: string;
} {
  const { config, result, taprootPubkey } = params;
  return {
    txid: result.vaultTxid,
    vaultTxid: result.vaultTxid,
    action: 'deposit',
    btcAmt: config.deposit_amount, // In sats
    unitAmt: 0,
    timestamp: Date.now(),
    vaultPubkey: taprootPubkey,
  };
}

/**
 * Calculate liquidation price for deposit
 * Deposit improves collateral ratio, so liquidation price decreases
 */
function calculateDepositLiquidationPrice(params: LiquidationPriceParams): number {
  const { amount, currentUnitBorrowed, currentBtcLocked } = params;
  const depositBtc = amount / 100_000_000; // Convert sats to BTC
  const newCollateral = currentBtcLocked + depositBtc;

  if (newCollateral <= 0 || currentUnitBorrowed <= 0) return 0;
  return computeLiquidationPrice(currentUnitBorrowed, newCollateral);
}

/**
 * Deposit operation configuration
 */
const depositConfig: VaultOperationConfig<DepositConfig, DepositRequest, DepositResult> = {
  operationType: 'deposit',
  operationName: 'useDepositVault',
  needsReservation: false,
  hasIssueTxid: false,
  useStore: useDepositStoreAdapter,
  validate: validateDeposit,
  createConfig: createDepositConfig,
  createRequest: createDepositRequest,
  sendRequest: sendDepositRequest,
  extractResult: extractDepositResult,
  createPendingTransaction: createDepositPendingTransaction,
  calculateLiquidationPrice: calculateDepositLiquidationPrice,
};

/**
 * Result interface matching the original hook
 */
export interface UseDepositVaultResult {
  deposit: () => Promise<{ vaultTxid: string } | null>;
  loadVaultData: () => Promise<boolean>;
  cancel: () => void;
  isLoading: boolean;
  error: string | null;
  vaultTxid: string | null;
  vaultDataLoaded: boolean;
}

/**
 * useDepositVault Hook
 *
 * Orchestrates the full deposit flow using the unified vault operation hook.
 */
export function useDepositVaultNew(): UseDepositVaultResult {
  const result = useVaultOperation(depositConfig);

  // Map to original interface
  return useMemo(
    () => ({
      deposit: result.execute as () => Promise<{ vaultTxid: string } | null>,
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
export { useDeposit } from '../../stores/depositStore';
