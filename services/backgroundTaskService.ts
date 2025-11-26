/**
 * Background Task Service
 * Handles background transaction monitoring and notifications
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
// Note: Notifications import kept for future use
// import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { getTxApiUrl } from '../utils/constants';

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

    const pendingTxs = JSON.parse(pendingTxsJson) as PendingTransaction[];
    let hasUpdates = false;

    // Check each pending transaction
    for (const tx of pendingTxs) {
      const isConfirmed = await checkTransactionConfirmation(tx.txid);

      if (isConfirmed) {
        // Push notifications disabled - using snackbars only
        // Send notification
        // const notificationId = await Notifications.scheduleNotificationAsync({
        //   content: {
        //     title: 'Transaction Confirmed',
        //     body: `The ${tx.type} transaction for ${tx.amount} ${tx.assetType} has been confirmed on Mutinynet.`,
        //     data: { txid: tx.txid, assetType: tx.assetType, amount: tx.amount },
        //     sound: true,
        //   },
        //   trigger: null,
        // });

        // Auto-dismiss after 15 seconds
        // setTimeout(async () => {
        //   try {
        //     await Notifications.dismissNotificationAsync(notificationId);
        //   } catch (dismissError) {
        //     // Silently fail if notification already dismissed
        //   }
        // }, 15000);

        // Remove from pending list
        const updatedTxs = pendingTxs.filter((t) => t.txid !== tx.txid);
        await SecureStore.setItemAsync(PENDING_TX_KEY, JSON.stringify(updatedTxs));
        hasUpdates = true;
      }
    }

    return hasUpdates
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    // Silently fail
  }
}

/**
 * Unregister the background fetch task
 */
export async function unregisterBackgroundFetchAsync(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
  } catch (error) {
    // Silently fail
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
    const pendingTxs: PendingTransaction[] = pendingTxsJson ? JSON.parse(pendingTxsJson) : [];

    // Add new transaction
    pendingTxs.push({
      txid,
      assetType,
      amount,
      type,
      timestamp: Date.now(),
    });

    await SecureStore.setItemAsync(PENDING_TX_KEY, JSON.stringify(pendingTxs));
  } catch (error) {
    // Silently fail
  }
}

/**
 * Remove a transaction from the pending list
 */
export async function removePendingTransaction(txid: string): Promise<void> {
  try {
    const pendingTxsJson = await SecureStore.getItemAsync(PENDING_TX_KEY);
    if (!pendingTxsJson) return;

    const pendingTxs = JSON.parse(pendingTxsJson) as PendingTransaction[];
    const updatedTxs = pendingTxs.filter((tx) => tx.txid !== txid);

    await SecureStore.setItemAsync(PENDING_TX_KEY, JSON.stringify(updatedTxs));
  } catch (error) {
    // Silently fail
  }
}

/**
 * Get all pending transactions
 */
export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  try {
    const pendingTxsJson = await SecureStore.getItemAsync(PENDING_TX_KEY);
    return pendingTxsJson ? JSON.parse(pendingTxsJson) : [];
  } catch (error) {
    return [];
  }
}
