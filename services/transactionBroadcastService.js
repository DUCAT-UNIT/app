/**
 * Transaction Broadcast Service
 * Handles broadcasting signed transactions to the Bitcoin network
 */

import { retrySilently } from '../utils/retry';
import { getBroadcastUrl } from '../utils/constants';

/**
 * Broadcast a signed transaction to the Bitcoin network
 * @param {string} signedTxHex - Signed transaction in hex format
 * @returns {Promise<string>} Transaction ID (txid)
 */
export const broadcastTransaction = async (signedTxHex) => {
  try {
    const response = await retrySilently(
      () =>
        fetch(getBroadcastUrl(), {
          method: 'POST',
          body: signedTxHex,
        }),
      'Broadcast transaction',
      { maxRetries: 2 } // Fewer retries for broadcasts
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to broadcast transaction');
    }

    const txid = await response.text();

    return txid;
  } catch (error) {
    throw error;
  }
};
