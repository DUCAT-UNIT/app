/**
 * Transaction Broadcast Service
 * Handles broadcasting signed transactions to the Bitcoin network
 */

import * as bitcoin from 'bitcoinjs-lib';
import { retrySilently } from '../utils/retry';
import { getBroadcastUrl } from '../utils/constants';

/**
 * Broadcast a signed transaction to the Bitcoin network
 * SECURITY: Verifies returned txid matches the transaction to prevent MITM attacks
 * @param {string} signedTxHex - Signed transaction in hex format
 * @returns {Promise<string>} Transaction ID (txid)
 */
export const broadcastTransaction = async (signedTxHex) => {
  try {
    // SECURITY: Calculate expected txid from signed transaction
    // This prevents MITM attacks that could return a fake txid
    let expectedTxid;
    try {
      const tx = bitcoin.Transaction.fromHex(signedTxHex);
      expectedTxid = tx.getId();
    } catch (txError) {
      throw new Error(`Invalid transaction hex: ${txError.message}`);
    }

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

    const returnedTxid = await response.text();

    // SECURITY: Verify returned txid matches what we signed
    // Trim whitespace from API response
    const trimmedTxid = returnedTxid.trim();

    if (trimmedTxid !== expectedTxid) {
      throw new Error(
        `SECURITY: Txid mismatch detected! ` +
        `Expected ${expectedTxid} but API returned ${trimmedTxid}. ` +
        `This could indicate a MITM attack or API error. Transaction not confirmed.`
      );
    }

    // Return our calculated txid (not the API's) for extra safety
    return expectedTxid;
  } catch (error) {
    throw error;
  }
};
