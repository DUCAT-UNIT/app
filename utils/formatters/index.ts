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
  type AddressType,
} from './addresses';

// Amount formatters
export {
  formatFiat,
  formatSatoshis,
  formatAbbreviated,
  formatPercentage,
  formatUnitAmount,
  parseUnitToSmallestUnits,
  parseFormattedAmount,
} from './amounts';

// Date formatters
export {
  formatTimestamp,
  formatTransactionDate,
  formatRelativeTime,
  formatDateRange,
  isToday,
  type FormatTimestampOptions,
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
  type ParseBTCResult,
  type FormatBTCAutoResult,
} from '../bitcoin/conversions';

/**
 * Format balance value (BTC) for display with thousand separators
 * @param balance - Balance in BTC
 * @param decimals - Decimal places (default: 8)
 * @returns Formatted balance with commas (e.g., "1,234.56789012")
 */
export const formatBalance = (balance: number | null | undefined, decimals = 8): string => {
  if (!balance && balance !== 0) {
    return (0).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return balance.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};
