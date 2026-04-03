/**
 * Background Task Service
 * Manages pending transaction storage for monitoring
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../utils/logger';
import { DEVICE_ONLY } from './storagePolicy';

const PENDING_TX_KEY = 'pending_transactions';

export interface PendingTransaction {
  txid: string;
  assetType: string;
  amount: string | number;
  type: string;
  timestamp: number;
}

/**
 * Add a transaction to the pending list for background monitoring
 */
export async function addPendingTransaction(
  txid: string,
  assetType: string,
  amount: string | number,
  type = 'withdraw'
): Promise<void> {
  try {
    const pendingTxsJson = await SecureStore.getItemAsync(PENDING_TX_KEY);
    let pendingTxs: PendingTransaction[] = [];
    if (pendingTxsJson) {
      try {
        pendingTxs = JSON.parse(pendingTxsJson) as PendingTransaction[];
      } catch (parseError) {
        logger.error('Failed to parse pending transactions JSON', {
          error: parseError instanceof Error ? parseError.message : String(parseError)
        });
        // Start fresh if JSON is corrupted
        pendingTxs = [];
      }
    }

    // Add new transaction
    pendingTxs.push({
      txid,
      assetType,
      amount,
      type,
      timestamp: Date.now(),
    });

    await SecureStore.setItemAsync(PENDING_TX_KEY, JSON.stringify(pendingTxs), DEVICE_ONLY);
  } catch (error: unknown) {
    logger.warn('[BackgroundTask] Failed to add pending transaction', { txid, error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Remove a transaction from the pending list
 */
export async function removePendingTransaction(txid: string): Promise<void> {
  try {
    const pendingTxsJson = await SecureStore.getItemAsync(PENDING_TX_KEY);
    if (!pendingTxsJson) return;

    let pendingTxs: PendingTransaction[] = [];
    try {
      pendingTxs = JSON.parse(pendingTxsJson) as PendingTransaction[];
    } catch (parseError) {
      logger.error('Failed to parse pending transactions JSON', {
        error: parseError instanceof Error ? parseError.message : String(parseError)
      });
      return;
    }
    const updatedTxs = pendingTxs.filter((tx) => tx.txid !== txid);

    await SecureStore.setItemAsync(PENDING_TX_KEY, JSON.stringify(updatedTxs), DEVICE_ONLY);
  } catch (error: unknown) {
    logger.warn('[BackgroundTask] Failed to remove pending transaction', { txid, error: error instanceof Error ? error.message : String(error) });
  }
}

