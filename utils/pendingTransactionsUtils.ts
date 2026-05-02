/**
 * Pending Transactions Utilities
 * Pure functions for managing pending transaction state
 */

import { logger } from './logger';
import { SEGWIT_ADDRESS_PREFIX, TAPROOT_ADDRESS_PREFIX } from './bitcoin';

export interface TransactionInput {
  txid: string;
  vout: number;
}

export interface RuneUtxo {
  transaction: string;
  vout: number;
}

export interface SatUtxo {
  txid: string;
  vout: number;
}

export interface TransactionIntent {
  inputs?: TransactionInput[];
  runeUtxo?: RuneUtxo;
  satUtxo?: SatUtxo;
}

export type AddressType = 'all' | 'segwit' | 'taproot';

export interface TransactionOutput {
  vout: number;
  address: string;
  value?: number;
  runeAmount?: number;
}

export interface PendingTransaction {
  txid: string;
  status: 'pending' | 'invalid';
  outputs: TransactionOutput[];
  parentTxid?: string;
  assetType?: string;
}

export interface UnconfirmedUTXO extends TransactionOutput {
  txid: string;
  status: { confirmed: boolean };
  parentTxid?: string;
  assetType?: string;
}

export interface UnconfirmedBalance {
  btc: number;
  runes: number;
}

export interface InvalidateResult {
  updated: Record<string, PendingTransaction>;
  invalidated: string[];
}

export interface CleanupResult {
  updated: Record<string, PendingTransaction>;
  cleaned: number;
}

/**
 * Build exclusion set from transaction intent
 * @param intent - Transaction intent with inputs
 * @returns Set of excluded UTXO keys (txid:vout)
 */
export function buildExclusionSet(intent: TransactionIntent | null | undefined): Set<string> {
  const excludedKeys = new Set<string>();

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
 * @param address - Bitcoin address
 * @param addressType - 'all', 'segwit', or 'taproot'
 * @returns True if address matches type
 */
export function matchesAddressType(address: string, addressType: AddressType): boolean {
  if (addressType === 'all') {
    return true;
  }

  const lowerAddress = address.toLowerCase();
  const isSegwit = lowerAddress.startsWith(SEGWIT_ADDRESS_PREFIX);
  const isTaproot = lowerAddress.startsWith(TAPROOT_ADDRESS_PREFIX);

  return (addressType === 'segwit' && isSegwit) || (addressType === 'taproot' && isTaproot);
}

/**
 * Get unconfirmed UTXOs from pending transactions
 * @param pendingTransactions - Map of pending transactions
 * @param addressType - Filter by address type
 * @param excludedKeys - Set of UTXO keys to exclude
 * @returns Array of unconfirmed UTXOs
 */
export function getUnconfirmedUTXOsFromPending(
  pendingTransactions: Record<string, PendingTransaction>,
  addressType: AddressType,
  excludedKeys: Set<string>,
  spentUtxos: Set<string> = new Set()
): UnconfirmedUTXO[] {
  const utxos: UnconfirmedUTXO[] = [];

  Object.values(pendingTransactions).forEach(tx => {
    // Only include pending transactions (not invalid)
    if (tx.status === 'pending') {
      tx.outputs.forEach(output => {
        // Check if this UTXO should be excluded
        const key = `${tx.txid}:${output.vout}`;
        if (excludedKeys.has(key)) {
          logger.debug('[getUnconfirmedUTXOsFromPending] Excluding UTXO (in exclusion set):', { key });
          return; // Skip this UTXO
        }
        if (spentUtxos.has(key)) {
          logger.debug('[getUnconfirmedUTXOsFromPending] Excluding UTXO (already spent):', { key });
          return;
        }

        // Filter by address type if specified
        const matches = matchesAddressType(output.address, addressType);
        if (!matches) {
          logger.debug('[getUnconfirmedUTXOsFromPending] Filtering UTXO (address type mismatch):', {
            address: output.address?.slice(0, 15) + '...',
            addressType,
            isSegwit: output.address?.toLowerCase().startsWith(SEGWIT_ADDRESS_PREFIX),
            isTaproot: output.address?.toLowerCase().startsWith(TAPROOT_ADDRESS_PREFIX),
          });
          return;
        }

        utxos.push({
          ...output,
          txid: tx.txid,
          status: { confirmed: false }, // Match blockchain API format
          parentTxid: tx.parentTxid,
          assetType: tx.assetType,
        });
      });
    } else {
      logger.debug('[getUnconfirmedUTXOsFromPending] Skipping tx (not pending):', {
        txid: tx.txid?.slice(0, 16) + '...',
        status: tx.status,
      });
    }
  });

  return utxos;
}

/**
 * Calculate unconfirmed balance from UTXOs
 * @param utxos - Array of UTXOs
 * @returns Balance object with btc and runes
 */
export function calculateUnconfirmedBalance(utxos: UnconfirmedUTXO[]): UnconfirmedBalance {
  const btcBalance = utxos.reduce((sum, utxo) => sum + (utxo.value || 0), 0);
  const runeBalance = utxos.reduce((sum, utxo) => sum + (utxo.runeAmount || 0), 0);

  return {
    btc: btcBalance / 100000000, // Convert sats to BTC
    runes: runeBalance / 100, // Convert to UNIT
  };
}

/**
 * Recursively invalidate child transactions
 * @param transactions - Map of pending transactions
 * @param parentId - Parent transaction ID
 * @param invalidated - Array to collect invalidated txids
 */
export function invalidateChildrenRecursive(
  transactions: Record<string, PendingTransaction>,
  parentId: string,
  invalidated: string[]
): void {
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
 * @param pendingTransactions - Map of pending transactions
 * @param txid - Transaction ID to invalidate
 * @returns { updated: Object, invalidated: Array }
 */
export function invalidateTransactionTree(
  pendingTransactions: Record<string, PendingTransaction>,
  txid: string
): InvalidateResult {
  const updated = { ...pendingTransactions };
  const invalidated: string[] = [];

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
 * @param pendingTransactions - Map of pending transactions
 * @param txid - Transaction ID
 * @param vout - Output index
 * @returns Updated pending transactions map
 */
export function removeUtxoFromPending(
  pendingTransactions: Record<string, PendingTransaction>,
  txid: string,
  vout: number
): Record<string, PendingTransaction> {
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
 * @param pendingTransactions - Map of pending transactions
 * @returns { updated: Object, cleaned: number }
 */
export function cleanupInvalidTransactions(
  pendingTransactions: Record<string, PendingTransaction>
): CleanupResult {
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
 * @param spentUtxos - Set of spent UTXO keys
 * @param utxos - Array of {txid, vout} objects to mark
 * @returns Updated set of spent UTXOs
 */
export function markUtxosAsSpent(
  spentUtxos: Set<string>,
  utxos: Array<{ txid: string; vout: number }>
): Set<string> {
  const updated = new Set(spentUtxos);

  utxos.forEach(({ txid, vout }) => {
    const key = `${txid}:${vout}`;
    updated.add(key);
    logger.debug('🚫 Marking UTXO as spent:', { key });
  });

  return updated;
}

/**
 * Unmark UTXOs as spent
 * @param spentUtxos - Set of spent UTXO keys
 * @param utxos - Array of {txid, vout} objects to unmark
 * @returns Updated set of spent UTXOs
 */
export function unmarkUtxosAsSpent(
  spentUtxos: Set<string>,
  utxos: Array<{ txid: string; vout: number }>
): Set<string> {
  const updated = new Set(spentUtxos);

  utxos.forEach(({ txid, vout }) => {
    const key = `${txid}:${vout}`;
    if (updated.has(key)) {
      updated.delete(key);
      logger.debug('✅ Unmarking UTXO as spent (released):', { key });
    }
  });

  return updated;
}

/**
 * Convert spent UTXO keys (format: "txid:vout") to UTXO objects
 * @param spentUtxoKeys - Set or Array of spent UTXO keys
 * @returns Array of {txid, vout} objects
 */
export function convertSpentKeysToUtxos(
  spentUtxoKeys: Set<string> | string[]
): Array<{ txid: string; vout: number }> {
  const keys = spentUtxoKeys instanceof Set ? Array.from(spentUtxoKeys) : spentUtxoKeys;
  return keys
    .filter(key => key.includes(':'))
    .map(key => {
      const colonIdx = key.lastIndexOf(':');
      const txid = key.substring(0, colonIdx);
      const vout = parseInt(key.substring(colonIdx + 1), 10);
      return { txid, vout: Number.isNaN(vout) ? 0 : vout };
    });
}

/**
 * Release orphaned/spent UTXOs - utility to clean up after failed transactions
 * @param getSpentUtxos - Function that returns the Set of spent UTXO keys
 * @param unmarkFn - Function to unmark UTXOs as spent
 * @returns Promise<void>
 */
export async function releaseOrphanedUtxos(
  getSpentUtxos: () => Set<string>,
  unmarkFn: (utxos: Array<{ txid: string; vout: number }>) => Promise<void>
): Promise<void> {
  const currentSpent = getSpentUtxos();
  if (currentSpent.size > 0) {
    const utxosToRelease = convertSpentKeysToUtxos(currentSpent);
    await unmarkFn(utxosToRelease);
    logger.debug('Released orphaned UTXOs:', { count: utxosToRelease.length });
  }
}
