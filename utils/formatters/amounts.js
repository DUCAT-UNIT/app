/**
 * Amount Formatting Utilities
 * Functions for formatting fiat amounts, satoshis, and other numeric values
 */

/**
 * Format a fiat amount (USD) for display
 * @param {number} amount - Amount in fiat currency
 * @param {number} decimals - Number of decimal places (default: 2)
 * @param {string} currency - Currency code (default: 'USD')
 * @returns {string} Formatted fiat amount
 */
export function formatFiat(amount, decimals = 2, currency = 'USD') {
  if (amount === null || amount === undefined) {
    return '0.00';
  }

  if (typeof amount !== 'number' || isNaN(amount)) {
    return '0.00';
  }

  // For USD and most currencies, use locale formatting
  if (currency === 'USD') {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  // Generic formatting for other currencies
  return amount.toFixed(decimals);
}

/**
 * Format satoshis with thousand separators
 * @param {number} satoshis - Amount in satoshis
 * @returns {string} Formatted satoshi amount with commas
 */
export function formatSatoshis(satoshis) {
  if (satoshis === null || satoshis === undefined) {
    return '0';
  }

  if (typeof satoshis !== 'number' || isNaN(satoshis)) {
    return '0';
  }

  return satoshis.toLocaleString('en-US');
}

/**
 * Format a number with abbreviated suffix (K, M, B)
 * @param {number} num - Number to format
 * @param {number} decimals - Decimal places (default: 1)
 * @returns {string} Abbreviated number (e.g., "1.2K", "3.4M")
 */
export function formatAbbreviated(num, decimals = 1) {
  if (num === null || num === undefined || num === 0) {
    return '0';
  }

  if (typeof num !== 'number' || isNaN(num)) {
    return '0';
  }

  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 1e9) {
    return sign + (abs / 1e9).toFixed(decimals) + 'B';
  }

  if (abs >= 1e6) {
    return sign + (abs / 1e6).toFixed(decimals) + 'M';
  }

  if (abs >= 1e3) {
    return sign + (abs / 1e3).toFixed(decimals) + 'K';
  }

  return sign + abs.toString();
}

/**
 * Format a percentage value
 * @param {number} value - Percentage value (e.g., 0.25 for 25%)
 * @param {number} decimals - Decimal places (default: 2)
 * @param {boolean} showSign - Show + for positive values (default: true)
 * @returns {string} Formatted percentage (e.g., "+25.00%")
 */
export function formatPercentage(value, decimals = 2, showSign = true) {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.00%';
  }

  const percentage = value * 100;
  const sign = showSign && percentage > 0 ? '+' : '';

  return `${sign}${percentage.toFixed(decimals)}%`;
}

/**
 * Parse a formatted amount string to number
 * Removes commas and handles decimal separators
 * @param {string} formattedAmount - Formatted amount string
 * @returns {number} Parsed number or 0 if invalid
 */
export function parseFormattedAmount(formattedAmount) {
  if (!formattedAmount || formattedAmount.trim() === '') {
    return 0;
  }

  // Remove commas and normalize decimal separator
  const normalized = formattedAmount
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();

  const parsed = parseFloat(normalized);

  return isNaN(parsed) ? 0 : parsed;
}
