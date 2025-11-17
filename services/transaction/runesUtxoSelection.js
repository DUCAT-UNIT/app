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
 * Find a rune UTXO with sufficient balance
 * @param {string} taprootAddress - Taproot address to search
 * @param {number} amountInRunes - Required rune amount
 * @param {Array} unconfirmedUtxos - Unconfirmed UTXOs to check first
 * @param {Set} spentUtxos - Set of spent UTXO keys
 * @returns {Promise<Object|null>} Rune UTXO or null if not found
 */
export async function findRuneUtxo(taprootAddress, amountInRunes, unconfirmedUtxos, spentUtxos) {
  // Check unconfirmed UTXOs first
  for (const utxo of unconfirmedUtxos) {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (spentUtxos.has(key)) {
      logger.debug('⚠️ Skipping spent rune UTXO:', key);
      continue;
    }

    if (utxo.runeAmount && utxo.runeAmount >= amountInRunes) {
      return {
        transaction: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        runeAmount: utxo.runeAmount,
        status: { confirmed: false },
      };
    }
  }

  // Fetch confirmed rune UTXOs from ord API
  const ordResponse = await fetch(getOrdAddressUrl(taprootAddress), {
    headers: { Accept: 'application/json' },
  });
  const ordData = await ordResponse.json();

  // Find a UTXO with sufficient runes
  for (const output of ordData.outputs || []) {
    const utxoResponse = await fetch(getOrdOutputUrl(output), {
      headers: { Accept: 'application/json' },
    });
    const utxoData = await utxoResponse.json();

    // Check if this UTXO has DUCAT•UNIT•RUNE
    if (utxoData.runes && utxoData.runes['DUCAT•UNIT•RUNE']) {
      const runeAmount = parseInt(utxoData.runes['DUCAT•UNIT•RUNE'].amount, 10);

      if (runeAmount >= amountInRunes) {
        const vout = parseInt(output.match(/:(.*)$/)[1], 10);
        const key = `${utxoData.transaction}:${vout}`;

        // Check if already spent
        if (spentUtxos.has(key)) {
          logger.debug('⚠️ Skipping spent rune UTXO from ord API:', key);
          continue;
        }

        // Verify unspent on blockchain
        const spendResponse = await fetch(getTxOutspendUrl(utxoData.transaction, vout));
        const spendData = await spendResponse.json();

        if (!spendData.spent) {
          return {
            transaction: utxoData.transaction,
            vout: vout,
            value: utxoData.value,
            runeAmount: runeAmount,
            status: { confirmed: true },
          };
        }
      }
    }
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
