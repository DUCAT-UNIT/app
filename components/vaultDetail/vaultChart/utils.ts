/**
 * VaultHealthChart Utilities
 * Pure functions for chart data transformation and calculation
 */

import type { VaultHistoryTransaction } from '../../../services/vaultService';
import type { BitcoinData, VaultEvent, SeriesItem, ReferenceLine, PriceTimeframe } from './types';
import { INTERVAL_CONFIG } from './types';

/**
 * Transform transactions to vault events format
 */
export function transformToEvents(transactions: VaultHistoryTransaction[]): VaultEvent[] {
  const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

  return sorted.map((tx) => ({
    amount: tx.amount_borrowed / 100,
    type: tx.action.toLowerCase() === 'open' ? 'create' : tx.action.toLowerCase(),
    date: new Date(tx.timestamp * 1000).toISOString(),
    btcWallet: tx.vault_amount / 100_000_000,
    oraclePrice: tx.oracle_price,
  }));
}

/**
 * Binary search for closest BTC price by timestamp (in seconds)
 */
function getBitcoinPriceByTimestamp(bitcoinData: BitcoinData[], targetTimestamp: number): number {
  if (bitcoinData.length === 0) return 50000; // fallback

  let left = 0;
  let right = bitcoinData.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTimestamp = bitcoinData[mid].timestamp;

    if (midTimestamp === targetTimestamp) {
      return parseFloat(bitcoinData[mid].price);
    }

    if (midTimestamp < targetTimestamp) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  // Find closest between left and right
  if (left >= bitcoinData.length) {
    return parseFloat(bitcoinData[right].price);
  }
  if (right < 0) {
    return parseFloat(bitcoinData[left].price);
  }

  const leftDiff = Math.abs(bitcoinData[left].timestamp - targetTimestamp);
  const rightDiff = Math.abs(bitcoinData[right].timestamp - targetTimestamp);

  return parseFloat(leftDiff < rightDiff ? bitcoinData[left].price : bitcoinData[right].price);
}

/**
 * Get closest transaction before a timestamp (transactions sorted descending by timestamp)
 */
function getClosestTransactionBeforeSortedDesc(
  transactions: VaultHistoryTransaction[],
  timestamp: number
): VaultHistoryTransaction | undefined {
  let left = 0;
  let right = transactions.length - 1;
  let resultIndex = transactions.length;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (transactions[mid].timestamp <= timestamp) {
      resultIndex = mid;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return resultIndex < transactions.length ? transactions[resultIndex] : undefined;
}

/**
 * Compute health percentage from transaction
 */
function computeHealthPercent(tx: VaultHistoryTransaction, btcPrice: number): number {
  const { vault_amount, amount_borrowed } = tx;
  const value = Math.floor(
    (((vault_amount / 100_000_000) * btcPrice) / (amount_borrowed / 100)) * 100
  );
  return Math.min(value, 500);
}

/**
 * Create series data following frontend time-bucketed approach
 */
export function createEventSeries(
  bitcoinData: BitcoinData[],
  _events: VaultEvent[],
  interval: PriceTimeframe,
  transactions: VaultHistoryTransaction[]
): { series: SeriesItem[]; referenceLines: ReferenceLine[] } {
  if (!bitcoinData.length || !transactions.length) {
    return { series: [], referenceLines: [] };
  }

  const { unitLength, numberOfUnits } = INTERVAL_CONFIG[interval];
  const referenceLines: ReferenceLine[] = [];

  // Sort transactions descending (latest first) as expected by helper functions
  const sortedTxsDesc = [...transactions].sort((a, b) => b.timestamp - a.timestamp);
  // Sort bitcoin data ascending for binary search
  const sortedBtcData = [...bitcoinData].sort((a, b) => a.timestamp - b.timestamp);

  const endTimestamp = Math.floor(Date.now() / 1000);
  const startTimestamp = endTimestamp - unitLength * numberOfUnits;

  const transactionsByBucket: VaultHistoryTransaction[][] = Array.from(
    { length: numberOfUnits },
    () => []
  );
  for (const tx of sortedTxsDesc) {
    const bucketIndex = Math.floor((tx.timestamp - startTimestamp) / unitLength);
    if (bucketIndex >= 0 && bucketIndex < numberOfUnits) {
      transactionsByBucket[bucketIndex].push(tx);
    }
  }

  const series: SeriesItem[] = [];

  for (let i = 0; i < numberOfUnits; i++) {
    const timeDelta = i * unitLength;
    const bucketStart = startTimestamp + timeDelta;
    const bucketEnd = bucketStart + unitLength - 1;

    const btcPrice = getBitcoinPriceByTimestamp(sortedBtcData, bucketEnd);
    const txBefore = getClosestTransactionBeforeSortedDesc(sortedTxsDesc, bucketStart);
    const txsBetween = transactionsByBucket[i];

    // Calculate health values
    const healthBefore = txBefore ? computeHealthPercent(txBefore, btcPrice) : null;
    // If there are transactions in this bucket, use the oldest one (last in the array since sorted desc)
    const healthAfter =
      txsBetween.length > 0
        ? computeHealthPercent(txsBetween[txsBetween.length - 1], btcPrice)
        : healthBefore;

    // Add reference line if there's an event in this bucket
    if (txsBetween.length > 0) {
      const eventTx = txsBetween[txsBetween.length - 1]; // oldest tx in bucket
      referenceLines.push({
        date: bucketEnd * 1000, // For chart positioning
        txTimestamp: eventTx.timestamp * 1000, // Actual tx timestamp for filtering
        prevValue: Math.max(healthBefore || 125, 125),
        newValue: Math.max(healthAfter || 125, 125),
        eventType:
          eventTx.action.toLowerCase() === 'open' ? 'create' : eventTx.action.toLowerCase(),
        btcWallet: eventTx.vault_amount / 100_000_000,
        amount: eventTx.amount_borrowed / 100,
      });
    }

    series.push({
      date: bucketEnd * 1000,
      healthValue: healthAfter,
      eventType:
        txsBetween.length > 0
          ? txsBetween[0].action.toLowerCase() === 'open'
            ? 'create'
            : txsBetween[0].action.toLowerCase()
          : undefined,
      isEventPoint: txsBetween.length > 0,
    });
  }

  return { series, referenceLines };
}
