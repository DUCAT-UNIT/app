/**
 * Pending Transactions Utilities
 * Pure functions for managing pending transaction state
 */

import { logger } from './logger';

/**
 * Build exclusion set from transaction intent
 * @param {object} intent - Transaction intent with inputs
 * @returns {Set} Set of excluded UTXO keys (txid:vout)
 */
export function buildExclusionSet(intent) {
  const excludedKeys = new Set();

  if (!intent) {
    return excludedKeys;
  }

  // Exclude BTC inputs
  if (intent.inputs) {
    intent.inputs.forEach(input => {
      const key = `${input.txid}:${input.vout}`;
      excludedKeys.add(key);
    });
  }

  // Exclude UNIT inputs (runeUtxo and satUtxo)
  if (intent.runeUtxo) {
    const key = `${intent.runeUtxo.transaction}:${intent.runeUtxo.vout}`;
    excludedKeys.add(key);
  }

  if (intent.satUtxo) {
    const key = `${intent.satUtxo.txid}:${intent.satUtxo.vout}`;
    excludedKeys.add(key);
  }

  return excludedKeys;
}

/**
 * Check if address matches the given type
 * @param {string} address - Bitcoin address
 * @param {string} addressType - 'all', 'segwit', or 'taproot'
 * @returns {boolean} True if address matches type
 */
export function matchesAddressType(address, addressType) {
  if (addressType === 'all') {
    return true;
  }

  const isSegwit = address.startsWith('tb1q') || address.startsWith('bc1q');
  const isTaproot = address.startsWith('tb1p') || address.startsWith('bc1p');

  return (addressType === 'segwit' && isSegwit) || (addressType === 'taproot' && isTaproot);
}

/**
 * Get unconfirmed UTXOs from pending transactions
 * @param {Object} pendingTransactions - Map of pending transactions
 * @param {string} addressType - Filter by address type
 * @param {Set} excludedKeys - Set of UTXO keys to exclude
 * @returns {Array} Array of unconfirmed UTXOs
 */
export function getUnconfirmedUTXOsFromPending(pendingTransactions, addressType, excludedKeys) {
  const utxos = [];

  Object.values(pendingTransactions).forEach(tx => {
    // Only include pending transactions (not invalid)
    if (tx.status === 'pending') {
      tx.outputs.forEach(output => {
        // Check if this UTXO should be excluded
        const key = `${tx.txid}:${output.vout}`;
        if (excludedKeys.has(key)) {
          return; // Skip this UTXO
        }

        // Filter by address type if specified
        if (matchesAddressType(output.address, addressType)) {
          utxos.push({
            ...output,
            txid: tx.txid,
            status: { confirmed: false }, // Match blockchain API format
            parentTxid: tx.parentTxid,
            assetType: tx.assetType,
          });
        }
      });
    }
  });

  return utxos;
}

/**
 * Calculate unconfirmed balance from UTXOs
 * @param {Array} utxos - Array of UTXOs
 * @returns {Object} Balance object with btc and runes
 */
export function calculateUnconfirmedBalance(utxos) {
  const btcBalance = utxos.reduce((sum, utxo) => sum + (utxo.value || 0), 0);
  const runeBalance = utxos.reduce((sum, utxo) => sum + (utxo.runeAmount || 0), 0);

  return {
    btc: btcBalance / 100000000, // Convert sats to BTC
    runes: runeBalance / 100, // Convert to UNIT
  };
}

/**
 * Recursively invalidate child transactions
 * @param {Object} transactions - Map of pending transactions
 * @param {string} parentId - Parent transaction ID
 * @param {Array} invalidated - Array to collect invalidated txids
 */
export function invalidateChildrenRecursive(transactions, parentId, invalidated) {
  Object.keys(transactions).forEach(childTxid => {
    if (transactions[childTxid].parentTxid === parentId) {
      invalidated.push(childTxid);
      transactions[childTxid].status = 'invalid';
      invalidateChildrenRecursive(transactions, childTxid, invalidated); // Invalidate grandchildren
    }
  });
}

/**
 * Invalidate a transaction and all its children
 * @param {Object} pendingTransactions - Map of pending transactions
 * @param {string} txid - Transaction ID to invalidate
 * @returns {Object} { updated: Object, invalidated: Array }
 */
export function invalidateTransactionTree(pendingTransactions, txid) {
  const updated = { ...pendingTransactions };
  const invalidated = [];

  // Mark the transaction itself as invalid
  if (updated[txid]) {
    updated[txid].status = 'invalid';
    invalidated.push(txid);
  }

  // Invalidate all children
  invalidateChildrenRecursive(updated, txid, invalidated);

  return { updated, invalidated };
}

/**
 * Remove a specific UTXO from pending transaction outputs
 * @param {Object} pendingTransactions - Map of pending transactions
 * @param {string} txid - Transaction ID
 * @param {number} vout - Output index
 * @returns {Object} Updated pending transactions map
 */
export function removeUtxoFromPending(pendingTransactions, txid, vout) {
  const updated = { ...pendingTransactions };

  if (updated[txid] && updated[txid].outputs) {
    // Remove the specific output from the transaction's outputs
    updated[txid].outputs = updated[txid].outputs.filter(output => output.vout !== vout);

    // If no outputs left, remove the transaction entirely
    if (updated[txid].outputs.length === 0) {
      delete updated[txid];
    }
  }

  return updated;
}

/**
 * Clean up invalid transactions
 * @param {Object} pendingTransactions - Map of pending transactions
 * @returns {Object} { updated: Object, cleaned: number }
 */
export function cleanupInvalidTransactions(pendingTransactions) {
  const updated = { ...pendingTransactions };
  let cleaned = 0;

  Object.keys(updated).forEach(txid => {
    if (updated[txid].status === 'invalid') {
      delete updated[txid];
      cleaned++;
    }
  });

  return { updated, cleaned };
}

/**
 * Mark UTXOs as spent
 * @param {Set} spentUtxos - Set of spent UTXO keys
 * @param {Array} utxos - Array of {txid, vout} objects to mark
 * @returns {Set} Updated set of spent UTXOs
 */
export function markUtxosAsSpent(spentUtxos, utxos) {
  const updated = new Set(spentUtxos);

  utxos.forEach(({ txid, vout }) => {
    const key = `${txid}:${vout}`;
    updated.add(key);
    logger.debug('🚫 Marking UTXO as spent:', key);
  });

  return updated;
}

/**
 * Unmark UTXOs as spent
 * @param {Set} spentUtxos - Set of spent UTXO keys
 * @param {Array} utxos - Array of {txid, vout} objects to unmark
 * @returns {Set} Updated set of spent UTXOs
 */
export function unmarkUtxosAsSpent(spentUtxos, utxos) {
  const updated = new Set(spentUtxos);

  utxos.forEach(({ txid, vout }) => {
    const key = `${txid}:${vout}`;
    if (updated.has(key)) {
      updated.delete(key);
      logger.debug('✅ Unmarking UTXO as spent (released):', key);
    }
  });

  return updated;
}

/**
 * Convert spent UTXO keys (format: "txid:vout") to UTXO objects
 * @param {Set|Array} spentUtxoKeys - Set or Array of spent UTXO keys
 * @returns {Array} Array of {txid, vout} objects
 */
export function convertSpentKeysToUtxos(spentUtxoKeys) {
  const keys = spentUtxoKeys instanceof Set ? Array.from(spentUtxoKeys) : spentUtxoKeys;
  return keys.map(key => {
    const [txid, vout] = key.split(':');
    return { txid, vout: parseInt(vout, 10) };
  });
}

/**
 * Release orphaned/spent UTXOs - utility to clean up after failed transactions
 * @param {Function} getSpentUtxos - Function that returns the Set of spent UTXO keys
 * @param {Function} unmarkFn - Function to unmark UTXOs as spent
 * @returns {Promise<void>}
 */
export async function releaseOrphanedUtxos(getSpentUtxos, unmarkFn) {
  const currentSpent = getSpentUtxos();
  if (currentSpent.size > 0) {
    const utxosToRelease = convertSpentKeysToUtxos(currentSpent);
    await unmarkFn(utxosToRelease);
    logger.debug('Released orphaned UTXOs:', utxosToRelease.length);
  }
}
