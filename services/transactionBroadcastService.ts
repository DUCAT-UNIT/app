/**
 * Transaction Broadcast Service
 * Handles broadcasting signed transactions to the Bitcoin network
 */

import * as bitcoin from 'bitcoinjs-lib';
import { retrySilently } from '../utils/retry';
import { getBroadcastUrl } from '../utils/constants';
import { logger } from '../utils/logger';

/**
 * Broadcast a signed transaction to the Bitcoin network
 * SECURITY: Verifies returned txid matches the transaction to prevent MITM attacks
 * @param signedTxHex - Signed transaction in hex format
 * @returns Transaction ID (txid)
 */
export const broadcastTransaction = async (signedTxHex: string): Promise<string> => {
  const txn = logger.startTransaction('broadcast_transaction');

  try {
    logger.transaction('broadcast_started', { txHexLength: signedTxHex?.length });

    // SECURITY: Calculate expected txid from signed transaction
    // This prevents MITM attacks that could return a fake txid
    let expectedTxid: string;
    try {
      const tx = bitcoin.Transaction.fromHex(signedTxHex);
      expectedTxid = tx.getId();
      logger.transaction('txid_calculated', { txid: expectedTxid.substring(0, 8) + '...' });
    } catch (txError) {
      logger.error(txError as Error, { context: 'Invalid transaction hex' });
      throw new Error(`Invalid transaction hex: ${(txError as Error).message}`);
    }

    const response = await retrySilently(
      () =>
        fetch(getBroadcastUrl(), {
          method: 'POST',
          body: signedTxHex,
        }),
      { maxRetries: 2 } // Fewer retries for broadcasts
    );

    if (!response.ok) {
      const errorText = await response.text();
      const normalizedError = (errorText || '').trim().toLowerCase();
      if (
        normalizedError.includes('already in mempool') ||
        normalizedError.includes('txn-already-known')
      ) {
        logger.transaction('broadcast_already_known', {
          txid: expectedTxid.substring(0, 8) + '...',
          error: errorText?.substring(0, 100),
        });
        txn.finish('ok');
        return expectedTxid;
      }
      logger.transaction('broadcast_failed', {
        status: response.status,
        error: errorText?.substring(0, 100)
      });
      throw new Error(errorText || 'Failed to broadcast transaction');
    }

    const returnedTxid = await response.text();

    // SECURITY: Verify returned txid matches what we signed
    // Trim whitespace from API response
    const trimmedTxid = returnedTxid.trim();

    if (trimmedTxid !== expectedTxid) {
      logger.error('SECURITY: Txid mismatch detected', {
        expected: expectedTxid.substring(0, 8),
        returned: trimmedTxid.substring(0, 8)
      });
      throw new Error(
        `SECURITY: Txid mismatch detected! ` +
        `Expected ${expectedTxid} but API returned ${trimmedTxid}. ` +
        `This could indicate a MITM attack or API error. Transaction not confirmed.`
      );
    }

    logger.transaction('broadcast_success', { txid: expectedTxid.substring(0, 8) + '...' });
    txn.finish('ok');

    // Return our calculated txid (not the API's) for extra safety
    return expectedTxid;
  } catch (error: unknown) {
    logger.transaction('broadcast_error', { error: (error as Error).message });
    txn.finish('error');
    throw error;
  }
};
