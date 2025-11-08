/**
 * Background Task Service
 * Handles background transaction monitoring and notifications
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

const BACKGROUND_FETCH_TASK = 'background-transaction-check';
const PENDING_TX_KEY = 'pending_transactions';

/**
 * Define the background task
 * This runs even when the app is closed or in background
 */
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    console.log('[Background] Checking for transaction confirmations...');

    // Get pending transactions from storage
    const pendingTxsJson = await SecureStore.getItemAsync(PENDING_TX_KEY);
    if (!pendingTxsJson) {
      console.log('[Background] No pending transactions');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const pendingTxs = JSON.parse(pendingTxsJson);
    let hasUpdates = false;

    // Check each pending transaction
    for (const tx of pendingTxs) {
      const isConfirmed = await checkTransactionConfirmation(tx.txid);

      if (isConfirmed) {
        // Send notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Transaction Confirmed',
            body: `The ${tx.type} transaction for ${tx.amount} ${tx.assetType} has been confirmed on Mutinynet.`,
            data: { txid: tx.txid, assetType: tx.assetType, amount: tx.amount },
            sound: true,
          },
          trigger: null,
        });

        // Remove from pending list
        const updatedTxs = pendingTxs.filter(t => t.txid !== tx.txid);
        await SecureStore.setItemAsync(PENDING_TX_KEY, JSON.stringify(updatedTxs));
        hasUpdates = true;
      }
    }

    return hasUpdates
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[Background] Error checking transactions:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Check if a transaction is confirmed on Mutinynet
 */
async function checkTransactionConfirmation(txid) {
  try {
    const response = await fetch(`https://mutinynet.com/api/tx/${txid}`);
    if (!response.ok) return false;

    const tx = await response.json();
    return tx.status && tx.status.confirmed;
  } catch (error) {
    console.error('[Background] Error fetching tx:', error);
    return false;
  }
}

/**
 * Register the background fetch task
 */
export async function registerBackgroundFetchAsync() {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 60 * 5, // 5 minutes minimum interval (iOS limitation)
      stopOnTerminate: false, // Continue after app is closed
      startOnBoot: true, // Start on device reboot
    });
    console.log('[Background] Task registered successfully');
  } catch (error) {
    console.error('[Background] Failed to register task:', error);
  }
}

/**
 * Unregister the background fetch task
 */
export async function unregisterBackgroundFetchAsync() {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    console.log('[Background] Task unregistered');
  } catch (error) {
    console.error('[Background] Failed to unregister task:', error);
  }
}

/**
 * Add a transaction to the pending list for background monitoring
 */
export async function addPendingTransaction(txid, assetType, amount, type = 'withdraw') {
  try {
    const pendingTxsJson = await SecureStore.getItemAsync(PENDING_TX_KEY);
    const pendingTxs = pendingTxsJson ? JSON.parse(pendingTxsJson) : [];

    // Add new transaction
    pendingTxs.push({
      txid,
      assetType,
      amount,
      type,
      timestamp: Date.now(),
    });

    await SecureStore.setItemAsync(PENDING_TX_KEY, JSON.stringify(pendingTxs));
    console.log('[Background] Added pending transaction:', txid);
  } catch (error) {
    console.error('[Background] Failed to add pending transaction:', error);
  }
}

/**
 * Remove a transaction from the pending list
 */
export async function removePendingTransaction(txid) {
  try {
    const pendingTxsJson = await SecureStore.getItemAsync(PENDING_TX_KEY);
    if (!pendingTxsJson) return;

    const pendingTxs = JSON.parse(pendingTxsJson);
    const updatedTxs = pendingTxs.filter(tx => tx.txid !== txid);

    await SecureStore.setItemAsync(PENDING_TX_KEY, JSON.stringify(updatedTxs));
    console.log('[Background] Removed pending transaction:', txid);
  } catch (error) {
    console.error('[Background] Failed to remove pending transaction:', error);
  }
}

/**
 * Get all pending transactions
 */
export async function getPendingTransactions() {
  try {
    const pendingTxsJson = await SecureStore.getItemAsync(PENDING_TX_KEY);
    return pendingTxsJson ? JSON.parse(pendingTxsJson) : [];
  } catch (error) {
    console.error('[Background] Failed to get pending transactions:', error);
    return [];
  }
}
