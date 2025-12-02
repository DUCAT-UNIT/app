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

export interface RuneUtxo {
  transaction: string;
  vout: number;
  value: number;
  runeAmount: number;
  status: {
    confirmed: boolean;
  };
}

export interface SatUtxo {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
  };
}

interface UnconfirmedUtxo {
  txid: string;
  vout: number;
  value: number;
  runeAmount?: number;
}

interface OrdData {
  outputs?: string[];
}

interface OrdUtxoData {
  transaction: string;
  value: number;
  runes?: {
    'DUCAT•UNIT•RUNE'?: {
      amount: string;
    };
  };
}

interface SpendData {
  spent: boolean;
}

interface BlockchainUtxo {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
  };
}

/**
 * Find rune UTXOs with sufficient balance (supports multiple UTXOs)
 * @param taprootAddress - Taproot address to search
 * @param amountInRunes - Required rune amount
 * @param unconfirmedUtxos - Unconfirmed UTXOs to check first
 * @param spentUtxos - Set of spent UTXO keys
 * @returns Array of rune UTXOs or null if not found
 */
export async function findRuneUtxo(
  taprootAddress: string,
  amountInRunes: number,
  unconfirmedUtxos: UnconfirmedUtxo[],
  spentUtxos: Set<string>
): Promise<RuneUtxo[] | null> {
  const selectedUtxos: RuneUtxo[] = [];
  let totalRuneAmount = 0;

  // Check unconfirmed UTXOs first
  for (const utxo of unconfirmedUtxos) {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (spentUtxos.has(key)) {
      logger.debug('⚠️ Skipping spent rune UTXO:', { key });
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
        logger.debug('[findRuneUtxo] ✅ Found sufficient runes in unconfirmed UTXOs:', { count: selectedUtxos.length });
        return selectedUtxos;
      }
    }
  }

  // Fetch confirmed rune UTXOs from ord API
  const ordResponse = await fetch(getOrdAddressUrl(taprootAddress), {
    headers: { Accept: 'application/json' },
  });
  const ordData = await ordResponse.json() as OrdData;

  logger.debug('[findRuneUtxo] Looking for rune amount:', { amountInRunes });
  logger.debug('[findRuneUtxo] Already have from unconfirmed:', { totalRuneAmount });
  logger.debug('[findRuneUtxo] Found outputs from ord API:', { count: ordData.outputs?.length || 0 });

  // Batch fetch all output data in parallel
  const outputs = ordData.outputs || [];
  const outputDataPromises = outputs.map(async (output) => {
    const utxoResponse = await fetch(getOrdOutputUrl(output), {
      headers: { Accept: 'application/json' },
    });
    return { output, data: await utxoResponse.json() as OrdUtxoData };
  });
  const outputResults = await Promise.all(outputDataPromises);

  // Filter to only UTXOs with our rune
  const runeOutputs = outputResults.filter(
    ({ data }) => data.runes && data.runes['DUCAT•UNIT•RUNE']
  );

  // Batch check spend status for all rune UTXOs in parallel
  const spendCheckPromises = runeOutputs.map(async ({ output, data }) => {
    const vout = parseInt(output.match(/:(.*)$/)?.[1] || '0', 10);
    const key = `${data.transaction}:${vout}`;

    // Skip if already in our spent set
    if (spentUtxos.has(key)) {
      return { output, data, vout, key, spent: true };
    }

    const spendResponse = await fetch(getTxOutspendUrl(data.transaction, vout));
    const spendData = await spendResponse.json() as SpendData;
    return { output, data, vout, key, spent: spendData.spent };
  });
  const spendResults = await Promise.all(spendCheckPromises);

  // Collect unspent UTXOs
  for (const { data, vout, key, spent } of spendResults) {
    if (spent) {
      logger.debug('⚠️ Skipping spent rune UTXO:', { key });
      continue;
    }

    const runeAmount = parseInt(data.runes!['DUCAT•UNIT•RUNE']!.amount, 10);
    logger.debug('[findRuneUtxo] Found UTXO with rune amount:', { runeAmount, totalSoFar: totalRuneAmount + runeAmount });

    selectedUtxos.push({
      transaction: data.transaction,
      vout: vout,
      value: data.value,
      runeAmount: runeAmount,
      status: { confirmed: true },
    });
    totalRuneAmount += runeAmount;

    // If we have enough, return
    if (totalRuneAmount >= amountInRunes) {
      logger.debug('[findRuneUtxo] ✅ Found sufficient runes using', { count: selectedUtxos.length });
      logger.debug('[findRuneUtxo] Total rune amount:', { totalRuneAmount, unit: totalRuneAmount / 100 });
      return selectedUtxos;
    }
  }

  // Log summary if insufficient funds
  if (selectedUtxos.length > 0) {
    logger.error('[findRuneUtxo] ❌ Insufficient runes across all UTXOs!');
    logger.error('[findRuneUtxo] Required:', { amountInRunes, unit: amountInRunes / 100 });
    logger.error('[findRuneUtxo] Total available:', { totalRuneAmount, unit: totalRuneAmount / 100 });
    logger.error('[findRuneUtxo] Found', { count: selectedUtxos.length });
  }

  return null;
}

/**
 * Find a sat UTXO for fees
 * @param segwitAddress - SegWit address to search
 * @param unconfirmedUtxos - Unconfirmed UTXOs to check first
 * @param spentUtxos - Set of spent UTXO keys
 * @returns Sat UTXO or null if not found
 */
export async function findSatUtxo(
  segwitAddress: string,
  unconfirmedUtxos: UnconfirmedUtxo[],
  spentUtxos: Set<string>
): Promise<SatUtxo | null> {
  // Check unconfirmed UTXOs first
  for (const utxo of unconfirmedUtxos) {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (spentUtxos.has(key)) {
      logger.debug('⚠️ Skipping spent sat UTXO:', { key });
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
  const utxos = await utxoResponse.json() as BlockchainUtxo[];

  // Find confirmed UTXO with sufficient sats
  for (const utxo of utxos) {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (spentUtxos.has(key)) {
      logger.debug('⚠️ Skipping spent sat UTXO from blockchain API:', { key });
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
