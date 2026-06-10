/**
 * UTXO Selection Utilities
 * Functions for selecting and filtering UTXOs for transaction creation
 */

import { logger } from '../../utils/logger';
import { BITCOIN_TX } from '../../utils/constants';
import { ERRORS } from '../../utils/messages';

export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
  };
}

export interface UtxoSelectionResult {
  selectedUtxos: UTXO[];
  totalInput: number;
  fee: number;
  change: number;
}

export type FeeCalculator = (numInputs: number, numOutputs: number) => number;

/**
 * Merge confirmed and unconfirmed UTXOs, removing duplicates and spent UTXOs
 * @param confirmedUtxos - Array of confirmed UTXOs
 * @param unconfirmedUtxos - Array of unconfirmed UTXOs
 * @param spentUtxos - Set of spent UTXO keys (txid:vout)
 * @returns Available UTXOs
 */
export function mergeAndFilterUtxos(
  confirmedUtxos: UTXO[],
  unconfirmedUtxos: UTXO[],
  spentUtxos: Set<string>
): UTXO[] {
  const utxoMap = new Map<string, UTXO>();

  // Add confirmed UTXOs first
  confirmedUtxos.forEach((utxo) => {
    const key = `${utxo.txid}:${utxo.vout}`;
    utxoMap.set(key, utxo);
  });

  // Add unconfirmed UTXOs, but don't overwrite if already present (already confirmed)
  let skippedDuplicates = 0;
  unconfirmedUtxos.forEach((utxo) => {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (!utxoMap.has(key)) {
      utxoMap.set(key, utxo);
    } else {
      skippedDuplicates++;
      logger.info('[mergeAndFilterUtxos] Skipping unconfirmed UTXO (already confirmed):', {
        key,
        value: utxo.value,
      });
    }
  });

  if (skippedDuplicates > 0) {
    logger.info('[mergeAndFilterUtxos] Skipped duplicates (unconfirmed already in confirmed):', {
      count: skippedDuplicates,
    });
  }

  // Filter out spent UTXOs
  return Array.from(utxoMap.values()).filter((utxo) => {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (spentUtxos.has(key)) {
      logger.debug('Filtering out spent UTXO', { key });
      return false;
    }
    return true;
  });
}

/**
 * Select UTXOs for a transaction with dynamic fee calculation
 * @param availableUtxos - Available UTXOs to select from
 * @param amountInSats - Amount to send in satoshis
 * @param calculateFee - Function to calculate fee based on inputs/outputs
 * @param dustLimit - Dust limit in satoshis
 * @returns Selected UTXOs, total input, fee, and change
 */
export function selectUtxosForTransaction(
  availableUtxos: UTXO[],
  amountInSats: number,
  calculateFee: FeeCalculator,
  dustLimit = BITCOIN_TX.DUST_LIMIT
): UtxoSelectionResult {
  const candidateUtxos: UTXO[] = [];
  const candidateUtxoKeys = new Set<string>();

  for (const utxo of availableUtxos) {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (utxo.status.confirmed && !candidateUtxoKeys.has(key)) {
      candidateUtxoKeys.add(key);
      candidateUtxos.push(utxo);
    }
  }

  for (const utxo of availableUtxos) {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (!candidateUtxoKeys.has(key)) {
      candidateUtxoKeys.add(key);
      candidateUtxos.push(utxo);
    }
  }

  const selectedUtxos: UTXO[] = [];
  let totalInput = 0;
  let estimatedFee = 0;
  let previousFee = 0;
  let candidateIndex = 0;

  // Iteratively select UTXOs and recalculate fee. Stop as soon as the
  // current selection covers the recalculated fee so we do not pull in stale
  // pending UTXOs unnecessarily.
  do {
    previousFee = estimatedFee;
    const numOutputs = 2; // recipient + change (adjust if no change needed)

    // Add more UTXOs if needed
    while (candidateIndex < candidateUtxos.length && totalInput < amountInSats + estimatedFee) {
      const nextUtxo = candidateUtxos[candidateIndex];
      candidateIndex += 1;

      // Add UTXO to selection
      selectedUtxos.push(nextUtxo);
      totalInput += nextUtxo.value;

      // Calculate fee with current number of selected UTXOs
      estimatedFee = calculateFee(selectedUtxos.length, numOutputs);
      const requiredAmount = amountInSats + estimatedFee;

      // Check if we have enough
      if (totalInput >= requiredAmount) {
        break;
      }
    }

    // Final fee calculation with actual selected UTXOs
    estimatedFee = calculateFee(selectedUtxos.length, numOutputs);
  } while (
    estimatedFee !== previousFee &&
    totalInput < amountInSats + estimatedFee &&
    candidateIndex < candidateUtxos.length
  );

  // Calculate preliminary change
  let preliminaryChange = totalInput - amountInSats - estimatedFee;

  // If change would be below dust, recalculate fee for 1 output (no change)
  if (preliminaryChange < dustLimit) {
    estimatedFee = calculateFee(selectedUtxos.length, 1);
    preliminaryChange = totalInput - amountInSats - estimatedFee;
  }

  // Verify sufficient funds
  if (totalInput < amountInSats + estimatedFee) {
    logger.warn('[selectUtxos] Insufficient funds', {
      totalInput,
      amountInSats,
      estimatedFee,
      shortfall: amountInSats + estimatedFee - totalInput,
    });
    return {
      selectedUtxos,
      totalInput,
      fee: estimatedFee,
      change: totalInput - amountInSats - estimatedFee,
    };
  }

  // Calculate final change
  let change = totalInput - amountInSats - estimatedFee;
  if (change < 0) {
    throw new Error('Insufficient funds: input total does not cover amount plus fee');
  }
  let finalFee = estimatedFee;

  // If change is below dust, add it to the fee instead of creating a dust output
  if (change > 0 && change < dustLimit) {
    logger.warn('[selectUtxos] Change below dust; adding to fee', {
      dustChange: change,
      dustLimit,
    });
    finalFee += change;
    change = 0;
  }

  return {
    selectedUtxos,
    totalInput,
    fee: finalFee,
    change,
  };
}

/**
 * Calculate BTC transaction fee based on inputs and outputs
 * @param feeRate - Fee rate in sats per vbyte
 * @returns Fee calculation function
 */
export function createFeeCalculator(
  feeRate = 1,
  inputType: 'segwit' | 'taproot' = 'segwit'
): FeeCalculator {
  const BASE_TX_SIZE = 10;
  const P2WPKH_INPUT_SIZE = 68;
  const P2TR_INPUT_SIZE = 57;
  const P2WPKH_OUTPUT_SIZE = 31;
  const inputSize = inputType === 'taproot' ? P2TR_INPUT_SIZE : P2WPKH_INPUT_SIZE;

  return (numInputs: number, numOutputs: number): number => {
    const txSize = BASE_TX_SIZE + numInputs * inputSize + numOutputs * P2WPKH_OUTPUT_SIZE;
    const fee = Math.ceil(txSize * feeRate);
    if (fee <= 0) {
      throw new Error(ERRORS.FEE_TOO_LOW);
    }
    return fee;
  };
}
