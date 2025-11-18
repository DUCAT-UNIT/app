/**
 * Formatters - Barrel export
 * Consolidates all formatting utilities
 */

// Address formatters
export {
  truncateAddress,
  truncateTxid,
  looksLikeBitcoinAddress,
  getAddressType,
} from './addresses';

// Amount formatters
export {
  formatFiat,
  formatSatoshis,
  formatAbbreviated,
  formatPercentage,
  parseFormattedAmount,
} from './amounts';

// Date formatters
export {
  formatTimestamp,
  formatTransactionDate,
  formatRelativeTime,
  formatDateRange,
  isToday,
} from './dates';

// Bitcoin conversions (from utils/bitcoin/conversions)
export {
  satsToBTC,
  btcToSats,
  formatBTC,
  formatBTCSmart,
  formatBTCAuto,
  parseBTCInput,
  SATS_PER_BTC,
} from '../bitcoin/conversions';

/**
 * Format balance value (BTC) for display
 * @param {number} balance - Balance in BTC
 * @param {number} decimals - Decimal places (default: 8)
 * @returns {string} Formatted balance
 */
export const formatBalance = (balance, decimals = 8) => {
  if (!balance && balance !== 0) return '0.00000000';
  return balance.toFixed(decimals);
};
