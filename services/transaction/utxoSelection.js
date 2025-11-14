/**
 * UTXO Selection Utilities
 * Functions for selecting and filtering UTXOs for transaction creation
 */

/**
 * Merge confirmed and unconfirmed UTXOs, removing duplicates and spent UTXOs
 * @param {Array} confirmedUtxos - Array of confirmed UTXOs
 * @param {Array} unconfirmedUtxos - Array of unconfirmed UTXOs
 * @param {Set} spentUtxos - Set of spent UTXO keys (txid:vout)
 * @returns {Array} Available UTXOs
 */
export function mergeAndFilterUtxos(confirmedUtxos, unconfirmedUtxos, spentUtxos) {
  const utxoMap = new Map();

  // Add confirmed UTXOs first
  confirmedUtxos.forEach(utxo => {
    const key = `${utxo.txid}:${utxo.vout}`;
    utxoMap.set(key, utxo);
  });

  // Add unconfirmed UTXOs, but don't overwrite if already present
  unconfirmedUtxos.forEach(utxo => {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (!utxoMap.has(key)) {
      utxoMap.set(key, utxo);
    }
  });

  // Filter out spent UTXOs
  return Array.from(utxoMap.values()).filter(utxo => {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (spentUtxos.has(key)) {
      logger.debug('⚠️ Filtering out spent UTXO:', key);
      return false;
    }
    return true;
  });
}

/**
 * Select UTXOs for a transaction with dynamic fee calculation
 * @param {Array} availableUtxos - Available UTXOs to select from
 * @param {number} amountInSats - Amount to send in satoshis
 * @param {Function} calculateFee - Function to calculate fee based on inputs/outputs
 * @param {number} dustLimit - Dust limit in satoshis
 * @returns {Object} Selected UTXOs, total input, fee, and change
 */
export function selectUtxosForTransaction(availableUtxos, amountInSats, calculateFee, dustLimit = 546) {
  const selectedUtxos = [];
  const selectedUtxoKeys = new Set();
  let totalInput = 0;
  let estimatedFee = 0;
  let previousFee = 0;

  // Iteratively select UTXOs and recalculate fee
  do {
    previousFee = estimatedFee;
    const numOutputs = 2; // recipient + change (adjust if no change needed)

    // Add more UTXOs if needed
    while (selectedUtxos.length < availableUtxos.length) {
      // Find next available UTXO (prefer confirmed)
      let nextUtxo = availableUtxos.find((utxo) => {
        const key = `${utxo.txid}:${utxo.vout}`;
        return utxo.status.confirmed && !selectedUtxoKeys.has(key);
      });

      // If no confirmed UTXOs available, use unconfirmed
      if (!nextUtxo) {
        nextUtxo = availableUtxos.find((utxo) => {
          const key = `${utxo.txid}:${utxo.vout}`;
          return !selectedUtxoKeys.has(key);
        });
      }

      if (!nextUtxo) break;

      // Add UTXO to selection
      const key = `${nextUtxo.txid}:${nextUtxo.vout}`;
      selectedUtxoKeys.add(key);
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
  } while (estimatedFee !== previousFee && selectedUtxos.length < availableUtxos.length);

  // Calculate preliminary change
  let preliminaryChange = totalInput - amountInSats - estimatedFee;

  // If change would be below dust, recalculate fee for 1 output (no change)
  if (preliminaryChange < dustLimit) {
    estimatedFee = calculateFee(selectedUtxos.length, 1);
    preliminaryChange = totalInput - amountInSats - estimatedFee;
  }

  // Calculate final change
  let change = totalInput - amountInSats - estimatedFee;
  let finalFee = estimatedFee;

  // If change is below dust, it goes entirely to miners
  if (change > 0 && change < dustLimit) {
    finalFee = totalInput - amountInSats;
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
 * @param {number} feeRate - Fee rate in sats per vbyte
 * @returns {Function} Fee calculation function
 */
export function createFeeCalculator(feeRate = 1) {
  const BASE_TX_SIZE = 10;
  const P2WPKH_INPUT_SIZE = 68;
  const P2WPKH_OUTPUT_SIZE = 31;

  return (numInputs, numOutputs) => {
    const txSize = BASE_TX_SIZE + numInputs * P2WPKH_INPUT_SIZE + numOutputs * P2WPKH_OUTPUT_SIZE;
    return Math.ceil(txSize * feeRate);
  };
}
