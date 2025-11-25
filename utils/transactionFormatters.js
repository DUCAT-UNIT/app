/**
 * Transaction Formatters
 * Utility functions for formatting transaction data
 */

/**
 * Format a transaction ID for display
 * @param {string} txid - Transaction ID
 * @returns {string} Shortened transaction ID
 */
export function formatTxid(txid) {
  if (!txid) return '';
  return `${txid.slice(0, 8)}...${txid.slice(-8)}`;
}

/**
 * Format an amount based on asset type
 * @param {number|bigint} value - Amount value
 * @param {string} type - Asset type ('BTC' or 'UNIT')
 * @returns {string} Formatted amount
 */
export function formatTransactionAmount(value, type) {
  if (type === 'UNIT') {
    // UNIT is stored with 100x multiplier, so divide by 100 for display
    const unitAmount = Number(value) / 100;
    return unitAmount.toLocaleString('en-US');
  } else {
    // BTC in satoshis
    const btc = value / 100000000;
    return btc.toFixed(8);
  }
}
