/**
 * Transaction Formatters
 * Utility functions for formatting transaction data
 */

import { formatUnitAmount, formatBalance } from './formatters';

/**
 * Format a transaction ID for display
 * @param txid - Transaction ID
 * @returns Shortened transaction ID
 */
export function formatTxid(txid: string | null | undefined): string {
  if (!txid) return '';
  return `${txid.slice(0, 8)}...${txid.slice(-8)}`;
}

/**
 * Format an amount based on asset type
 * @param value - Amount value
 * @param type - Asset type ('BTC' or 'UNIT')
 * @returns Formatted amount
 */
export function formatTransactionAmount(value: number | bigint, type: string): string {
  if (type === 'UNIT') {
    // UNIT is stored with 100x multiplier, so divide by 100 for display
    return formatUnitAmount(Number(value));
  } else {
    // BTC in satoshis
    return formatBalance(Number(value) / 100000000);
  }
}
