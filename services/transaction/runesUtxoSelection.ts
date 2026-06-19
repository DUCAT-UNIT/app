/**
 * Runes UTXO Selection Utilities
 * Handles finding appropriate UTXOs for Runes transactions
 */

import { logger } from '../../utils/logger';
import {
  getOrdAddressUrl,
  getOrdOutputUrl,
  getTxOutspendUrl,
  getAddressUtxoUrl,
  RUNES_CONFIG,
} from '../../utils/constants';
import { fetchWithTimeout } from '../../utils/api';

const MIN_FEE_SATS = 12000;
const ORD_FETCH_TIMEOUT_MS = 8000;
const ESPLORA_FETCH_TIMEOUT_MS = 8000;
const RUNE_OUTPUT_BATCH_SIZE = 4;

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
  runes?: Record<string, { amount?: string }>;
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

interface OrdOutputDetails {
  data: OrdUtxoData;
  vout: number;
  key: string;
}

async function fetchOrdOutputDetails(output: string): Promise<OrdOutputDetails> {
  const utxoResponse = await fetchWithTimeout(
    getOrdOutputUrl(output),
    {
      headers: { Accept: 'application/json' },
    },
    ORD_FETCH_TIMEOUT_MS
  );
  const data = (await utxoResponse.json()) as OrdUtxoData;
  const vout = parseInt(output.match(/:(.*)$/)?.[1] || '0', 10);

  return {
    data,
    vout,
    key: `${data.transaction}:${vout}`,
  };
}

function getDucatUnitRuneData(
  runes: OrdUtxoData['runes']
): { amount?: string } | undefined {
  if (!runes) {
    return undefined;
  }

  return runes[RUNES_CONFIG.DUCAT_UNIT_RUNE_LABEL] || runes['DUCAT•UNIT•RUNE'];
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
  let totalRuneAmount = 0n;
  const requiredRuneAmount = BigInt(amountInRunes);

  // Check unconfirmed UTXOs first
  for (const utxo of unconfirmedUtxos) {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (spentUtxos.has(key)) {
      logger.debug('Skipping spent rune UTXO', { key });
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
      totalRuneAmount += BigInt(utxo.runeAmount);

      // If we have enough, return early
      if (totalRuneAmount >= requiredRuneAmount) {
        logger.debug('[findRuneUtxo] Found sufficient runes in unconfirmed UTXOs', {
          count: selectedUtxos.length,
        });
        return selectedUtxos;
      }
    }
  }

  // Fetch confirmed rune UTXOs from ord API
  const ordResponse = await fetchWithTimeout(
    getOrdAddressUrl(taprootAddress),
    {
      headers: { Accept: 'application/json' },
    },
    ORD_FETCH_TIMEOUT_MS
  );
  const ordData = (await ordResponse.json()) as OrdData;

  logger.debug('[findRuneUtxo] Looking for rune amount:', { amountInRunes });
  logger.debug('[findRuneUtxo] Already have from unconfirmed:', { totalRuneAmount });
  logger.debug('[findRuneUtxo] Found outputs from ord API:', {
    count: ordData.outputs?.length || 0,
  });

  // Walk output batches incrementally and stop as soon as we have enough rune balance.
  const outputs = ordData.outputs || [];
  for (let startIndex = 0; startIndex < outputs.length; startIndex += RUNE_OUTPUT_BATCH_SIZE) {
    const batch = outputs.slice(startIndex, startIndex + RUNE_OUTPUT_BATCH_SIZE);
    const outputDetails = await Promise.all(batch.map(fetchOrdOutputDetails));
    const runeOutputs = outputDetails.filter(({ data }) => getDucatUnitRuneData(data.runes));

    const spendChecks = await Promise.all(
      runeOutputs.map(async (details) => {
        const { data, vout, key } = details;
        if (spentUtxos.has(key)) {
          logger.debug('Skipping spent rune UTXO', { key });
          return { details, spent: true, logged: true };
        }

        const spendResponse = await fetchWithTimeout(
          getTxOutspendUrl(data.transaction, vout),
          {},
          ESPLORA_FETCH_TIMEOUT_MS
        );
        const spendData = (await spendResponse.json()) as SpendData;
        return { details, spent: spendData.spent, logged: false };
      })
    );

    for (const { details, spent, logged } of spendChecks) {
      const { data, vout, key } = details;
      if (spent) {
        if (!logged) {
          logger.debug('Skipping spent rune UTXO', { key });
        }
        continue;
      }

      // Safe access with validation (already filtered but double-check for safety)
      const runeData = getDucatUnitRuneData(data.runes);
      if (!runeData?.amount) {
        logger.warn('[findRuneUtxo] Skipping UTXO with missing rune data:', { key });
        continue;
      }
      const runeAmountBigInt = BigInt(runeData.amount);
      if (runeAmountBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(`Rune amount exceeds supported range for UTXO ${key}`);
      }
      const runeAmount = Number(runeAmountBigInt);
      logger.debug('[findRuneUtxo] Found UTXO with rune amount:', {
        runeAmount,
        totalSoFar: Number(totalRuneAmount + runeAmountBigInt),
      });

      selectedUtxos.push({
        transaction: data.transaction,
        vout: vout,
        value: data.value,
        runeAmount: runeAmount,
        status: { confirmed: true },
      });
      totalRuneAmount += runeAmountBigInt;

      // If we have enough, return after the current batch is processed in output order.
      if (totalRuneAmount >= requiredRuneAmount) {
        logger.debug('[findRuneUtxo] Found sufficient runes', {
          count: selectedUtxos.length,
        });
        logger.debug('[findRuneUtxo] Total rune amount:', {
          totalRuneAmount: Number(totalRuneAmount),
          unit: Number(totalRuneAmount) / 100,
        });
        return selectedUtxos;
      }
    }
  }

  // Log summary if insufficient funds
  if (selectedUtxos.length > 0) {
    logger.error('[findRuneUtxo] Insufficient runes across all UTXOs');
    logger.error('[findRuneUtxo] Required:', { amountInRunes, unit: amountInRunes / 100 });
    logger.error('[findRuneUtxo] Total available:', {
      totalRuneAmount: Number(totalRuneAmount),
      unit: Number(totalRuneAmount) / 100,
    });
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
      logger.debug('Skipping spent sat UTXO', { key });
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
  const utxoResponse = await fetchWithTimeout(
    getAddressUtxoUrl(segwitAddress),
    {},
    ESPLORA_FETCH_TIMEOUT_MS
  );
  const utxos = (await utxoResponse.json()) as BlockchainUtxo[];

  // Find confirmed UTXO with sufficient sats
  for (const utxo of utxos) {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (spentUtxos.has(key)) {
      logger.debug('Skipping spent sat UTXO from blockchain API', { key });
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
