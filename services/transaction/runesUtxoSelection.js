/**
 * Runes UTXO Selection Utilities
 * Handles finding appropriate UTXOs for Runes transactions
 */

import logger from '../../utils/logger';
import {
  getOrdAddressUrl,
  getOrdOutputUrl,
  getTxOutspendUrl,
  getAddressUtxoUrl,
} from '../../utils/constants';

const MIN_FEE_SATS = 12000;

/**
 * Find rune UTXOs with sufficient balance (supports multiple UTXOs)
 * @param {string} taprootAddress - Taproot address to search
 * @param {number} amountInRunes - Required rune amount
 * @param {Array} unconfirmedUtxos - Unconfirmed UTXOs to check first
 * @param {Set} spentUtxos - Set of spent UTXO keys
 * @returns {Promise<Array|null>} Array of rune UTXOs or null if not found
 */
export async function findRuneUtxo(taprootAddress, amountInRunes, unconfirmedUtxos, spentUtxos) {
  const selectedUtxos = [];
  let totalRuneAmount = 0;

  // Check unconfirmed UTXOs first
  for (const utxo of unconfirmedUtxos) {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (spentUtxos.has(key)) {
      logger.debug('⚠️ Skipping spent rune UTXO:', key);
      continue;
    }

    if (utxo.runeAmount && utxo.runeAmount > 0) {
      selectedUtxos.push({
        transaction: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        runeAmount: utxo.runeAmount,
        status: { confirmed: false },
      });
      totalRuneAmount += utxo.runeAmount;

      // If we have enough, return early
      if (totalRuneAmount >= amountInRunes) {
        logger.debug('[findRuneUtxo] ✅ Found sufficient runes in unconfirmed UTXOs:', selectedUtxos.length);
        return selectedUtxos;
      }
    }
  }

  // Fetch confirmed rune UTXOs from ord API
  const ordResponse = await fetch(getOrdAddressUrl(taprootAddress), {
    headers: { Accept: 'application/json' },
  });
  const ordData = await ordResponse.json();

  logger.debug('[findRuneUtxo] Looking for rune amount:', amountInRunes);
  logger.debug('[findRuneUtxo] Already have from unconfirmed:', totalRuneAmount);
  logger.debug('[findRuneUtxo] Found outputs from ord API:', ordData.outputs?.length || 0);

  // Collect confirmed UTXOs
  for (const output of ordData.outputs || []) {
    const utxoResponse = await fetch(getOrdOutputUrl(output), {
      headers: { Accept: 'application/json' },
    });
    const utxoData = await utxoResponse.json();

    // Check if this UTXO has DUCAT•UNIT•RUNE
    if (utxoData.runes && utxoData.runes['DUCAT•UNIT•RUNE']) {
      const runeAmount = parseInt(utxoData.runes['DUCAT•UNIT•RUNE'].amount, 10);
      const vout = parseInt(output.match(/:(.*)$/)[1], 10);
      const key = `${utxoData.transaction}:${vout}`;

      logger.debug('[findRuneUtxo] Found UTXO with rune amount:', runeAmount, 'total so far:', totalRuneAmount + runeAmount);

      // Check if already spent
      if (spentUtxos.has(key)) {
        logger.debug('⚠️ Skipping spent rune UTXO from ord API:', key);
        continue;
      }

      // Verify unspent on blockchain
      const spendResponse = await fetch(getTxOutspendUrl(utxoData.transaction, vout));
      const spendData = await spendResponse.json();

      if (!spendData.spent) {
        selectedUtxos.push({
          transaction: utxoData.transaction,
          vout: vout,
          value: utxoData.value,
          runeAmount: runeAmount,
          status: { confirmed: true },
        });
        totalRuneAmount += runeAmount;

        // If we have enough, return
        if (totalRuneAmount >= amountInRunes) {
          logger.debug('[findRuneUtxo] ✅ Found sufficient runes using', selectedUtxos.length, 'UTXOs');
          logger.debug('[findRuneUtxo] Total rune amount:', totalRuneAmount, `(${totalRuneAmount / 100} UNIT)`);
          return selectedUtxos;
        }
      }
    }
  }

  // Log summary if insufficient funds
  if (selectedUtxos.length > 0) {
    logger.error('[findRuneUtxo] ❌ Insufficient runes across all UTXOs!');
    logger.error('[findRuneUtxo] Required:', amountInRunes, `(${amountInRunes / 100} UNIT)`);
    logger.error('[findRuneUtxo] Total available:', totalRuneAmount, `(${totalRuneAmount / 100} UNIT)`);
    logger.error('[findRuneUtxo] Found', selectedUtxos.length, 'UTXOs');
  }

  return null;
}

/**
 * Find a sat UTXO for fees
 * @param {string} segwitAddress - SegWit address to search
 * @param {Array} unconfirmedUtxos - Unconfirmed UTXOs to check first
 * @param {Set} spentUtxos - Set of spent UTXO keys
 * @returns {Promise<Object|null>} Sat UTXO or null if not found
 */
export async function findSatUtxo(segwitAddress, unconfirmedUtxos, spentUtxos) {
  // Check unconfirmed UTXOs first
  for (const utxo of unconfirmedUtxos) {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (spentUtxos.has(key)) {
      logger.debug('⚠️ Skipping spent sat UTXO:', key);
      continue;
    }

    if (utxo.value >= MIN_FEE_SATS) {
      return {
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        status: { confirmed: false },
      };
    }
  }

  // Fetch confirmed UTXOs
  const utxoResponse = await fetch(getAddressUtxoUrl(segwitAddress));
  const utxos = await utxoResponse.json();

  // Find confirmed UTXO with sufficient sats
  for (const utxo of utxos) {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (spentUtxos.has(key)) {
      logger.debug('⚠️ Skipping spent sat UTXO from blockchain API:', key);
      continue;
    }

    if (utxo.status.confirmed && utxo.value >= MIN_FEE_SATS) {
      return {
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        status: { confirmed: true },
      };
    }
  }

  return null;
}
