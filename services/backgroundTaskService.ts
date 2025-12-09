/**
 * Background Task Service
 * Handles background transaction monitoring and notifications
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import { getTxApiUrl } from '../utils/constants';
import { logger } from '../utils/logger';

const BACKGROUND_FETCH_TASK = 'background-transaction-check';
const PENDING_TX_KEY = 'pending_transactions';

export interface PendingTransaction {
  txid: string;
  assetType: string;
  amount: string | number;
  type: string;
  timestamp: number;
}

interface TransactionStatusResponse {
  status: {
    confirmed: boolean;
  };
}

/**
 * Define the background task
 * This runs even when the app is closed or in background
 */
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    // Get pending transactions from storage
    const pendingTxsJson = await SecureStore.getItemAsync(PENDING_TX_KEY);
    if (!pendingTxsJson) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    let pendingTxs: PendingTransaction[] = [];
    try {
      pendingTxs = JSON.parse(pendingTxsJson) as PendingTransaction[];
    } catch (parseError) {
      logger.error('Failed to parse pending transactions JSON', {
        error: parseError instanceof Error ? parseError.message : String(parseError)
      });
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    // Check all transactions in parallel
    const confirmationResults = await Promise.all(
      pendingTxs.map(async (tx) => ({
        txid: tx.txid,
        isConfirmed: await checkTransactionConfirmation(tx.txid),
      }))
    );

    // Filter out confirmed transactions
    const confirmedTxids = new Set(
      confirmationResults.filter((r) => r.isConfirmed).map((r) => r.txid)
    );
    const hasUpdates = confirmedTxids.size > 0;

    if (hasUpdates) {
      const updatedTxs = pendingTxs.filter((tx) => !confirmedTxids.has(tx.txid));
      await SecureStore.setItemAsync(PENDING_TX_KEY, JSON.stringify(updatedTxs));
      logger.debug('[BackgroundTask] Confirmed transactions removed', { count: confirmedTxids.size });
    }

    return hasUpdates
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error: unknown) {
    logger.error(error instanceof Error ? error : new Error(String(error)), {
      context: 'BackgroundTask',
    });
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Check if a transaction is confirmed on Mutinynet
 */
async function checkTransactionConfirmation(txid: string): Promise<boolean> {
  try {
    const response = await fetch(getTxApiUrl(txid));
    if (!response.ok) return false;

    const tx = await response.json() as TransactionStatusResponse;
    return tx.status && tx.status.confirmed;
  } catch (error: unknown) {
    logger.warn('Error checking transaction confirmation', {
      txid,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Register the background fetch task
 */
export async function registerBackgroundFetchAsync(): Promise<void> {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 60 * 5, // 5 minutes minimum interval (iOS limitation)
      stopOnTerminate: false, // Continue after app is closed
      startOnBoot: true, // Start on device reboot
    });
  } catch (error: unknown) {
    logger.debug('[BackgroundTask] Failed to register task', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Unregister the background fetch task
 */
export async function unregisterBackgroundFetchAsync(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
  } catch (error: unknown) {
    logger.debug('[BackgroundTask] Failed to unregister task', { error: error instanceof Error ? error.message : String(error) });
  }
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

    await SecureStore.setItemAsync(PENDING_TX_KEY, JSON.stringify(pendingTxs));
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

    await SecureStore.setItemAsync(PENDING_TX_KEY, JSON.stringify(updatedTxs));
  } catch (error: unknown) {
    logger.warn('[BackgroundTask] Failed to remove pending transaction', { txid, error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Get all pending transactions
 */
export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  try {
    const pendingTxsJson = await SecureStore.getItemAsync(PENDING_TX_KEY);
    if (!pendingTxsJson) return [];

    let pendingTxs: PendingTransaction[] = [];
    try {
      pendingTxs = JSON.parse(pendingTxsJson) as PendingTransaction[];
    } catch (parseError) {
      logger.error('Failed to parse pending transactions JSON', {
        error: parseError instanceof Error ? parseError.message : String(parseError)
      });
      return [];
    }
    return pendingTxs;
  } catch (error: unknown) {
    logger.warn('[BackgroundTask] Failed to get pending transactions', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}
