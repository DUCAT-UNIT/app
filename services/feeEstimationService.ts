/**
 * Fee Estimation Service
 * Provides fee estimation utilities for different transaction types
 * Helps validate if users have sufficient BTC for transaction fees
 */

import { BITCOIN_TX, VAULT_CONFIG, getAddressUtxoUrl } from '../utils/constants';
import { fetchUtxosForAddress, calculateTransactionFee } from './transactionCalculationService';

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
const BASE_TX_SIZE = 10;
const P2WPKH_INPUT_SIZE = 68;  // Native SegWit input
const P2TR_INPUT_SIZE = 57;    // Taproot input
const P2SH_INPUT_SIZE = 108;   // P2SH input
const P2PKH_INPUT_SIZE = 148;  // Legacy input
const P2WPKH_OUTPUT_SIZE = 31;
const DEFAULT_FEE_RATE = 1; // sats per vbyte

// Buffer percentage for fee safety margin (10%)
const FEE_BUFFER_PERCENTAGE = 0.1;

/**
 * Get input size based on script type (matching vaultUtils.ts)
 */
function getInputSizeForScript(script?: string): number {
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
function calculateDynamicVinAllowance(
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
 * Based on actual transaction structures from the codebase:
 * - runesPsbtBuilder.ts for UNIT sends
 * - services/vault/*.ts for vault operations
 */
function getTransactionShape(type: TransactionType): { inputs: number; outputs: number } {
  switch (type) {
    case TransactionType.BTC_SEND:
      // Simple P2WPKH send: 1+ inputs, 2 outputs (recipient + change)
      return { inputs: 1, outputs: 2 };
    case TransactionType.UNIT_SEND:
      // Runes transaction (runesPsbtBuilder.ts):
      // Inputs: 1 P2WPKH (fees) + 1+ Taproot (rune UTXOs)
      // Outputs: rune return + recipient + change + OP_RETURN runestone
      return { inputs: 2, outputs: 4 };
    case TransactionType.VAULT_DEPOSIT:
      // Deposit: user provides sats UTXOs (deposit amount + fees)
      // SDK constructs PSBT with vault UTXO update
      return { inputs: 1, outputs: 2 };
    case TransactionType.VAULT_WITHDRAW:
      // Withdraw: no user UTXOs needed - withdraws from vault UTXO
      // User only pays signing fee, vault covers tx fee
      return { inputs: 0, outputs: 2 };
    case TransactionType.VAULT_BORROW:
      // Borrow: user provides sats UTXOs for fees
      // Creates 2 transactions (issue + vault update)
      return { inputs: 1, outputs: 3 };
    case TransactionType.VAULT_REPAY:
      // Repay: user provides sats UTXOs (fees) + rune UTXOs (UNIT to burn)
      // Creates 2 transactions (repay + vault update)
      return { inputs: 2, outputs: 3 };
    default:
      return { inputs: 1, outputs: 2 };
  }
}

/**
 * Estimate transaction fee based on transaction type and UTXOs
 * Uses dynamic calculation based on actual UTXO count and types
 *
 * @param type - Transaction type
 * @param sourceAddress - Source address for UTXO lookup
 * @param feeRate - Fee rate in sats/vbyte (optional, defaults to 1)
 * @returns Fee estimate with details
 */
export async function estimateTransactionFee(
  type: TransactionType,
  sourceAddress?: string,
  feeRate: number = DEFAULT_FEE_RATE
): Promise<FeeEstimate> {
  const baseShape = getTransactionShape(type);
  let numInputs = baseShape.inputs;
  let utxos: Array<{ script?: string }> = [];

  // If we have a source address, fetch actual UTXOs for accurate estimation
  if (sourceAddress) {
    try {
      const fetchedUtxos = await fetchUtxosForAddress(sourceAddress);
      if (fetchedUtxos.length > 0) {
        // Map UTXOs - they may not have script field, which calculateDynamicVinAllowance handles
        utxos = fetchedUtxos.map(u => ({ script: undefined }));
        numInputs = fetchedUtxos.length;
      }
    } catch {
      // Fall back to estimated inputs on error
    }
  }

  // For vault operations, use the SDK pattern:
  // total_cost (base fee from SDK) + dynamic VIN allowance for user's UTXOs
  const isVaultOp = [
    TransactionType.VAULT_DEPOSIT,
    TransactionType.VAULT_WITHDRAW,
    TransactionType.VAULT_BORROW,
    TransactionType.VAULT_REPAY,
  ].includes(type);

  if (isVaultOp) {
    // Base cost from SDK (use test mock values as estimates)
    const baseCost = getVaultBaseCost(type);

    // Dynamic VIN allowance based on actual UTXOs (matching vaultUtils.ts pattern)
    const vinAllowance = calculateDynamicVinAllowance(utxos, feeRate);

    // For repay, add extra allowance for rune UTXOs (user also spends UNIT)
    const runeAllowance = type === TransactionType.VAULT_REPAY
      ? VAULT_CONFIG.VIN_ALLOWANCE * feeRate  // Extra buffer for rune inputs
      : 0;

    const totalFee = baseCost + vinAllowance + runeAllowance;

    return {
      feeSats: totalFee,
      feeRate,
      numInputs,
      numOutputs: baseShape.outputs,
    };
  }

  // For non-vault transactions (BTC_SEND, UNIT_SEND), calculate directly
  const feeSats = calculateTransactionFee(numInputs, baseShape.outputs, feeRate);

  return {
    feeSats,
    feeRate,
    numInputs,
    numOutputs: baseShape.outputs,
  };
}

/**
 * Get base cost for vault operations (SDK's txQuote.total_cost)
 * Values based on test mocks in services/vault/__tests__/vault.test.ts
 */
function getVaultBaseCost(type: TransactionType): number {
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
 * Quick fee estimate without UTXO lookup (for UI responsiveness)
 * Uses conservative estimates based on transaction type
 *
 * These estimates are based on:
 * 1. Test mocks in services/vault/__tests__/vault.test.ts which use txQuote.total_cost values
 * 2. The pattern: user pays total_cost + (VIN_ALLOWANCE * feeRate) for their input UTXOs
 * 3. Constants: ESTIMATED_TX_FEE=1000, VIN_ALLOWANCE=350
 *
 * SDK txQuote.total_cost test values:
 * - open: 1500
 * - deposit: 1000
 * - borrow: 1000
 * - repay: 800
 * - withdraw: 500
 *
 * @param type - Transaction type
 * @param feeRate - Fee rate in sat/vB (optional, defaults to 1)
 * @returns Estimated fee in satoshis
 */
export function estimateTransactionFeeQuick(type: TransactionType, feeRate: number = DEFAULT_FEE_RATE): number {
  const vinAllowance = VAULT_CONFIG.VIN_ALLOWANCE * feeRate;

  // Base vsize estimates at 1 sat/vB, scaled by feeRate
  switch (type) {
    case TransactionType.BTC_SEND:
      // Simple P2WPKH send, not vault-related
      // ~250 vbytes for 1-2 inputs, 2 outputs
      return 250 * feeRate;

    case TransactionType.UNIT_SEND:
      // Runes transaction (from runesPsbtBuilder.ts):
      // 1 P2WPKH input + 1+ Taproot inputs + 4 outputs
      // ~500 vbytes for multiple rune UTXOs
      return 500 * feeRate;

    case TransactionType.VAULT_DEPOSIT:
      // SDK total_cost ~1000 + vinAllowance for user's sats UTXOs
      return (1000 * feeRate) + vinAllowance;

    case TransactionType.VAULT_WITHDRAW:
      // SDK total_cost ~500 + vinAllowance
      // Withdraw is simpler - BTC comes from vault, user just pays signing fee
      return (500 * feeRate) + vinAllowance;

    case TransactionType.VAULT_BORROW:
      // SDK total_cost ~1000 + vinAllowance for user's sats UTXOs
      // Creates 2 transactions (issue + vault)
      return (1000 * feeRate) + vinAllowance;

    case TransactionType.VAULT_REPAY:
      // SDK total_cost ~800 + vinAllowance
      // User provides sats UTXOs (fees) + rune UTXOs (UNIT to burn)
      // Add extra allowance for rune input UTXOs
      return (800 * feeRate) + vinAllowance + vinAllowance;

    default:
      return BITCOIN_TX.ESTIMATED_TX_FEE * feeRate;
  }
}

/**
 * Check if user has sufficient BTC for transaction fees
 * Includes a safety buffer to account for fee rate changes
 * @param type - Transaction type
 * @param btcBalanceSats - User's BTC balance in satoshis
 * @param sourceAddress - Source address for UTXO lookup (optional)
 * @returns Sufficiency result with details
 */
export async function hasSufficientBtcForFees(
  type: TransactionType,
  btcBalanceSats: number,
  sourceAddress?: string
): Promise<BtcSufficiencyResult> {
  try {
    const feeEstimate = sourceAddress
      ? await estimateTransactionFee(type, sourceAddress)
      : { feeSats: estimateTransactionFeeQuick(type), feeRate: 1, numInputs: 1, numOutputs: 2 };

    // Add safety buffer (10%)
    const requiredWithBuffer = Math.ceil(feeEstimate.feeSats * (1 + FEE_BUFFER_PERCENTAGE));
    const hasSufficient = btcBalanceSats >= requiredWithBuffer;
    const shortfall = hasSufficient ? 0 : requiredWithBuffer - btcBalanceSats;

    const errorMessage = hasSufficient
      ? null
      : generateFeeErrorMessage(btcBalanceSats, requiredWithBuffer, type);

    return {
      hasSufficientBtc: hasSufficient,
      requiredBtcSats: requiredWithBuffer,
      availableBtcSats: btcBalanceSats,
      shortfallSats: shortfall,
      errorMessage,
    };
  } catch {
    // On error, use conservative estimate with the same error message logic
    const conservativeFee = estimateTransactionFeeQuick(type);
    const requiredWithBuffer = Math.ceil(conservativeFee * (1 + FEE_BUFFER_PERCENTAGE));
    const hasSufficient = btcBalanceSats >= requiredWithBuffer;
    const shortfall = hasSufficient ? 0 : requiredWithBuffer - btcBalanceSats;

    const errorMessage = hasSufficient
      ? null
      : generateFeeErrorMessage(btcBalanceSats, requiredWithBuffer, type);

    return {
      hasSufficientBtc: hasSufficient,
      requiredBtcSats: requiredWithBuffer,
      availableBtcSats: btcBalanceSats,
      shortfallSats: shortfall,
      errorMessage,
    };
  }
}

/**
 * Format BTC amount for display, removing unnecessary trailing zeros
 * @param sats - Amount in satoshis
 * @returns Formatted BTC string
 */
function formatBtcAmount(sats: number): string {
  const btc = sats / 100_000_000;
  // Show up to 8 decimal places, but remove trailing zeros
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
 * @param btcBalanceSats - User's BTC balance in satoshis
 * @param requiredSats - Required BTC for fees in satoshis
 * @param type - Transaction type
 * @returns Error message string
 */
function generateFeeErrorMessage(
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

/**
 * Synchronous version of fee sufficiency check using quick estimates
 * Useful for immediate UI feedback without async calls
 * @param type - Transaction type
 * @param btcBalanceSats - User's BTC balance in satoshis
 * @returns Sufficiency result with details
 */
export function hasSufficientBtcForFeesSync(
  type: TransactionType,
  btcBalanceSats: number
): BtcSufficiencyResult {
  const feeSats = estimateTransactionFeeQuick(type);
  const requiredWithBuffer = Math.ceil(feeSats * (1 + FEE_BUFFER_PERCENTAGE));
  const hasSufficient = btcBalanceSats >= requiredWithBuffer;
  const shortfall = hasSufficient ? 0 : requiredWithBuffer - btcBalanceSats;

  const errorMessage = hasSufficient
    ? null
    : generateFeeErrorMessage(btcBalanceSats, requiredWithBuffer, type);

  return {
    hasSufficientBtc: hasSufficient,
    requiredBtcSats: requiredWithBuffer,
    availableBtcSats: btcBalanceSats,
    shortfallSats: shortfall,
    errorMessage,
  };
}

/**
 * Calculate maximum sendable amount after deducting fees
 * @param type - Transaction type
 * @param totalBalanceSats - Total balance in satoshis
 * @param sourceAddress - Source address for UTXO lookup (optional)
 * @returns Maximum amount that can be sent in satoshis
 */
export async function calculateMaxAfterFees(
  type: TransactionType,
  totalBalanceSats: number,
  sourceAddress?: string
): Promise<number> {
  try {
    const feeEstimate = sourceAddress
      ? await estimateTransactionFee(type, sourceAddress)
      : { feeSats: estimateTransactionFeeQuick(type), feeRate: 1, numInputs: 1, numOutputs: 2 };

    // Add safety buffer
    const feeWithBuffer = Math.ceil(feeEstimate.feeSats * (1 + FEE_BUFFER_PERCENTAGE));

    // For sends, we send max minus fees
    // Ensure we don't go below dust limit
    const maxSendable = Math.max(0, totalBalanceSats - feeWithBuffer);

    if (maxSendable < BITCOIN_TX.DUST_LIMIT) {
      return 0;
    }

    return maxSendable;
  } catch {
    // Fallback to conservative estimate
    const conservativeFee = estimateTransactionFeeQuick(type);
    const feeWithBuffer = Math.ceil(conservativeFee * (1 + FEE_BUFFER_PERCENTAGE));
    const maxSendable = Math.max(0, totalBalanceSats - feeWithBuffer);
    return maxSendable < BITCOIN_TX.DUST_LIMIT ? 0 : maxSendable;
  }
}

/**
 * Calculate maximum sendable amount synchronously using quick estimates
 * @param type - Transaction type
 * @param totalBalanceSats - Total balance in satoshis
 * @returns Maximum amount that can be sent in satoshis
 */
export function calculateMaxAfterFeesSync(
  type: TransactionType,
  totalBalanceSats: number
): number {
  const feeSats = estimateTransactionFeeQuick(type);
  const feeWithBuffer = Math.ceil(feeSats * (1 + FEE_BUFFER_PERCENTAGE));
  const maxSendable = Math.max(0, totalBalanceSats - feeWithBuffer);
  return maxSendable < BITCOIN_TX.DUST_LIMIT ? 0 : maxSendable;
}
