/**
 * Fee Estimation Types and Constants
 * Shared types and helper functions for fee estimation
 */

import { VAULT_CONFIG } from '../utils/constants';

/**
 * Transaction types supported by the fee estimation service
 */
export enum TransactionType {
  BTC_SEND = 'BTC_SEND',
  UNIT_SEND = 'UNIT_SEND',
  VAULT_DEPOSIT = 'VAULT_DEPOSIT',
  VAULT_WITHDRAW = 'VAULT_WITHDRAW',
  VAULT_BORROW = 'VAULT_BORROW',
  VAULT_REPAY = 'VAULT_REPAY',
}

/**
 * Fee estimation result
 */
export interface FeeEstimate {
  feeSats: number;
  feeRate: number;
  numInputs: number;
  numOutputs: number;
}

/**
 * Result of BTC sufficiency check
 */
export interface BtcSufficiencyResult {
  hasSufficientBtc: boolean;
  requiredBtcSats: number;
  availableBtcSats: number;
  shortfallSats: number;
  errorMessage: string | null;
}

// Transaction size constants (matching transactionCalculationService and vaultUtils)
export const BASE_TX_SIZE = 10;
export const P2WPKH_INPUT_SIZE = 68;  // Native SegWit input
export const P2TR_INPUT_SIZE = 57;    // Taproot input
export const P2SH_INPUT_SIZE = 108;   // P2SH input
export const P2PKH_INPUT_SIZE = 148;  // Legacy input
export const P2WPKH_OUTPUT_SIZE = 31;
export const DEFAULT_FEE_RATE = 1; // sats per vbyte

// Buffer percentage for fee safety margin (10%)
export const FEE_BUFFER_PERCENTAGE = 0.1;

/**
 * Get input size based on script type (matching vaultUtils.ts)
 */
export function getInputSizeForScript(script?: string): number {
  if (!script) return P2WPKH_INPUT_SIZE; // Default to SegWit
  if (script.startsWith('5120')) return P2TR_INPUT_SIZE;   // Taproot
  if (script.startsWith('0014')) return P2WPKH_INPUT_SIZE; // Native SegWit
  if (script.startsWith('a914')) return P2SH_INPUT_SIZE;   // P2SH
  return P2PKH_INPUT_SIZE; // Legacy fallback
}

/**
 * Calculate dynamic VIN allowance based on actual UTXOs
 * This matches the pattern in vaultUtils.ts calculateVinAllowance()
 */
export function calculateDynamicVinAllowance(
  utxos: Array<{ script?: string }>,
  feeRate: number
): number {
  if (!utxos || utxos.length === 0) {
    // Fallback to single UTXO estimate
    return VAULT_CONFIG.VIN_ALLOWANCE * feeRate;
  }

  const totalVsize = utxos.reduce((acc, utxo) => {
    return acc + getInputSizeForScript(utxo.script);
  }, 0);

  return totalVsize * feeRate;
}

/**
 * Get estimated number of inputs and outputs for each transaction type
 * Based on actual transaction structures from the codebase
 */
export function getTransactionShape(type: TransactionType): { inputs: number; outputs: number } {
  switch (type) {
    case TransactionType.BTC_SEND:
      return { inputs: 1, outputs: 2 };
    case TransactionType.UNIT_SEND:
      return { inputs: 2, outputs: 4 };
    case TransactionType.VAULT_DEPOSIT:
      return { inputs: 1, outputs: 2 };
    case TransactionType.VAULT_WITHDRAW:
      return { inputs: 0, outputs: 2 };
    case TransactionType.VAULT_BORROW:
      return { inputs: 1, outputs: 3 };
    case TransactionType.VAULT_REPAY:
      return { inputs: 2, outputs: 3 };
    default:
      return { inputs: 1, outputs: 2 };
  }
}

/**
 * Get estimated base cost (in sats) for vault operations.
 *
 * NOTE: These values are currently hardcoded estimates based on observed transaction sizes.
 * They serve as fallback fee estimates for UI display before the actual SDK transaction
 * quote is available. In production, the real cost comes from the SDK's txQuote.total_cost.
 *
 * TODO: Consider fetching actual base costs from the SDK at runtime instead of using
 * these static estimates.
 */
export function getVaultBaseCost(type: TransactionType): number {
  switch (type) {
    case TransactionType.VAULT_DEPOSIT:
      return 1000;
    case TransactionType.VAULT_WITHDRAW:
      return 500;
    case TransactionType.VAULT_BORROW:
      return 1000;
    case TransactionType.VAULT_REPAY:
      return 800;
    default:
      return 1000;
  }
}

/**
 * Format BTC amount for display, removing unnecessary trailing zeros
 */
export function formatBtcAmount(sats: number): string {
  const btc = sats / 100_000_000;
  if (btc < 0.0001) {
    return btc.toFixed(8).replace(/\.?0+$/, '');
  } else if (btc < 0.01) {
    return btc.toFixed(6).replace(/\.?0+$/, '');
  } else {
    return btc.toFixed(4).replace(/\.?0+$/, '');
  }
}

/**
 * Generate a specific, helpful error message based on the situation
 */
export function generateFeeErrorMessage(
  btcBalanceSats: number,
  requiredSats: number,
  type: TransactionType
): string {
  const requiredBtc = formatBtcAmount(requiredSats);
  const availableBtc = formatBtcAmount(btcBalanceSats);
  const shortfallSats = requiredSats - btcBalanceSats;
  const shortfallBtc = formatBtcAmount(shortfallSats);

  // Zero balance case
  if (btcBalanceSats === 0) {
    switch (type) {
      case TransactionType.UNIT_SEND:
        return 'You need BTC in your wallet to send UNIT (for transaction fees)';
      case TransactionType.VAULT_BORROW:
        return 'You need BTC in your wallet to borrow UNIT (for transaction fees)';
      case TransactionType.VAULT_REPAY:
        return 'You need BTC in your wallet to repay your vault (for transaction fees)';
      case TransactionType.VAULT_WITHDRAW:
        return 'You need BTC in your wallet to withdraw from your vault (for transaction fees)';
      case TransactionType.VAULT_DEPOSIT:
        return 'You need more BTC to cover the deposit and transaction fees';
      default:
        return 'You need BTC in your wallet for transaction fees';
    }
  }

  // Has some BTC but not enough
  switch (type) {
    case TransactionType.UNIT_SEND:
      return `Need ${shortfallBtc} more BTC for fees to send UNIT. You have ${availableBtc} BTC, need ${requiredBtc} BTC.`;
    case TransactionType.VAULT_BORROW:
      return `Need ${shortfallBtc} more BTC for fees to borrow. You have ${availableBtc} BTC, need ${requiredBtc} BTC.`;
    case TransactionType.VAULT_REPAY:
      return `Need ${shortfallBtc} more BTC for fees to repay. You have ${availableBtc} BTC, need ${requiredBtc} BTC.`;
    case TransactionType.VAULT_WITHDRAW:
      return `Need ${shortfallBtc} more BTC for fees to withdraw. You have ${availableBtc} BTC, need ${requiredBtc} BTC.`;
    case TransactionType.VAULT_DEPOSIT:
      return `Need ${shortfallBtc} more BTC for deposit fees. You have ${availableBtc} BTC, need ${requiredBtc} BTC.`;
    case TransactionType.BTC_SEND:
      return `Need ${shortfallBtc} more BTC to cover fees. You have ${availableBtc} BTC, need ${requiredBtc} BTC total.`;
    default:
      return `Need ${requiredBtc} BTC for fees, but only have ${availableBtc} BTC`;
  }
}
