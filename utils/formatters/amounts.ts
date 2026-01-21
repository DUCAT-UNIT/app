/**
 * Amount Formatting Utilities
 * Functions for formatting fiat amounts, satoshis, and other numeric values
 */

/**
 * Format a fiat amount (USD) for display
 * @param amount - Amount in fiat currency
 * @param decimals - Number of decimal places (default: 2)
 * @param currency - Currency code (default: 'USD')
 * @returns Formatted fiat amount
 */
export function formatFiat(amount: number | null | undefined, decimals = 2, currency = 'USD'): string {
  if (amount === null || amount === undefined) {
    return '0.00';
  }

  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
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
 * @param satoshis - Amount in satoshis
 * @returns Formatted satoshi amount with commas
 */
export function formatSatoshis(satoshis: number | null | undefined): string {
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
 * @param num - Number to format
 * @param decimals - Decimal places (default: 1)
 * @returns Abbreviated number (e.g., "1.2K", "3.4M")
 */
export function formatAbbreviated(num: number | null | undefined, decimals = 1): string {
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
 * @param value - Percentage value (e.g., 0.25 for 25%)
 * @param decimals - Decimal places (default: 2)
 * @param showSign - Show + for positive values (default: true)
 * @returns Formatted percentage (e.g., "+25.00%")
 */
export function formatPercentage(value: number | null | undefined, decimals = 2, showSign = true): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.00%';
  }

  const percentage = value * 100;
  const sign = showSign && percentage > 0 ? '+' : '';

  return `${sign}${percentage.toFixed(decimals)}%`;
}

/**
 * Format UNIT amount for display
 * UNIT is stored as integers (smallest units, 100x multiplier)
 * This function converts to display format with 2 decimal places
 * @param smallestUnits - Amount in smallest units (integer)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted UNIT amount (e.g., 10000 -> "100.00")
 */
export function formatUnitAmount(smallestUnits: number | bigint | null | undefined, decimals = 2): string {
  if (smallestUnits === null || smallestUnits === undefined) {
    return '0.00';
  }

  const numValue = typeof smallestUnits === 'bigint' ? Number(smallestUnits) : smallestUnits;

  if (typeof numValue !== 'number' || isNaN(numValue)) {
    return '0.00';
  }

  const displayAmount = numValue / 100;
  return displayAmount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Parse a display UNIT amount to smallest units (integer)
 * Converts user input (e.g., "100.50") to storage format (10050)
 * @param displayAmount - Display amount string or number
 * @returns Amount in smallest units (integer)
 */
export function parseUnitToSmallestUnits(displayAmount: string | number | null | undefined): number {
  if (displayAmount === null || displayAmount === undefined) {
    return 0;
  }

  const numValue = typeof displayAmount === 'string' ? parseFloat(displayAmount) : displayAmount;

  if (isNaN(numValue)) {
    return 0;
  }

  // Multiply by 100 and round to avoid floating point issues
  return Math.round(numValue * 100);
}

/**
 * Parse a formatted amount string to number
 * Removes commas and handles decimal separators
 * @param formattedAmount - Formatted amount string
 * @returns Parsed number or 0 if invalid
 */
export function parseFormattedAmount(formattedAmount: string | null | undefined): number {
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
