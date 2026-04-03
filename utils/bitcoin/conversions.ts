/**
 * Bitcoin Conversion Utilities
 * Standardized functions for converting between BTC and satoshis
 */

import { logger } from '../logger';

/**
 * Satoshis per Bitcoin constant
 */
export const SATS_PER_BTC = 100000000;

/**
 * Convert satoshis to BTC
 * @param satoshis - Amount in satoshis
 * @returns Amount in BTC
 */
export function satsToBTC(satoshis: number | null | undefined): number {
  if (satoshis === null || satoshis === undefined) {
    return 0;
  }

  if (typeof satoshis !== 'number' || isNaN(satoshis)) {
    logger.warn('satsToBTC: Invalid satoshis value', { type: typeof satoshis });
    return 0;
  }

  if (satoshis < 0) {
    logger.warn('satsToBTC: Negative sats value');
    return 0;
  }

  if (satoshis > Number.MAX_SAFE_INTEGER) {
    logger.warn('satsToBTC: Value exceeds MAX_SAFE_INTEGER');
    return 0;
  }

  return satoshis / SATS_PER_BTC;
}

/**
 * Convert BTC to satoshis
 * @param btc - Amount in BTC (can be string for user input)
 * @returns Amount in satoshis (rounded to nearest integer)
 */
export function btcToSats(btc: number | string | null | undefined): number {
  if (btc === null || btc === undefined || btc === '') {
    return 0;
  }

  let str: string;
  if (typeof btc === 'string') {
    str = btc.replace(',', '.');
  } else {
    str = btc.toFixed(8);
  }

  if (isNaN(parseFloat(str))) {
    logger.warn('btcToSats: Invalid BTC value');
    return 0;
  }

  if (parseFloat(str) < 0) {
    logger.warn('btcToSats: Negative BTC value');
    return 0;
  }

  const parts = str.split('.');
  const whole = parseInt(parts[0] || '0', 10);
  const fracRaw = (parts[1] || '').slice(0, 8);
  const fracPadded = fracRaw.padEnd(8, '0');
  const fractional = parseInt(fracPadded, 10);

  const satoshis = whole * SATS_PER_BTC + fractional;

  if (satoshis > Number.MAX_SAFE_INTEGER) {
    logger.warn('btcToSats: Result exceeds MAX_SAFE_INTEGER');
    return 0;
  }

  return satoshis;
}

/**
 * Format satoshis as BTC with specified decimal places and thousand separators
 * @param satoshis - Amount in satoshis
 * @param decimals - Number of decimal places (default: 8)
 * @returns Formatted BTC amount with commas (e.g., "1,234.56789012")
 */
export function formatBTC(satoshis: number | null | undefined, decimals = 8): string {
  if (satoshis === null || satoshis === undefined) {
    return (0).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  if (typeof satoshis !== 'number' || isNaN(satoshis)) {
    logger.warn('formatBTC: Invalid satoshis value', { satoshis });
    return (0).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  const btc = satsToBTC(satoshis);
  return btc.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format satoshis as BTC with smart decimal trimming and thousand separators
 * Removes trailing zeros but keeps at least minDecimals
 * @param satoshis - Amount in satoshis
 * @param minDecimals - Minimum decimal places (default: 2)
 * @param maxDecimals - Maximum decimal places (default: 8)
 * @returns Formatted BTC amount with commas (e.g., "1,234.56")
 */
export function formatBTCSmart(satoshis: number | null | undefined, minDecimals = 2, maxDecimals = 8): string {
  if (satoshis === null || satoshis === undefined) {
    return '0.00';
  }

  if (typeof satoshis !== 'number' || isNaN(satoshis)) {
    logger.warn('formatBTCSmart: Invalid satoshis value', { satoshis });
    return '0.00';
  }

  const btc = satsToBTC(satoshis);

  // First determine how many significant decimals we need
  const fullPrecision = btc.toFixed(maxDecimals);
  const parts = fullPrecision.split('.');
  let decimals = parts[1] || '';

  // Remove trailing zeros down to minDecimals
  while (decimals.length > minDecimals && decimals[decimals.length - 1] === '0') {
    decimals = decimals.slice(0, -1);
  }

  const actualDecimals = Math.max(minDecimals, decimals.length);

  return btc.toLocaleString('en-US', {
    minimumFractionDigits: actualDecimals,
    maximumFractionDigits: actualDecimals,
  });
}

export interface ParseBTCResult {
  valid: boolean;
  satoshis: number;
  error?: string;
}

/**
 * Parse user input BTC amount and validate
 * @param input - User input string
 * @returns Parse result with validation
 */
export function parseBTCInput(input: string | null | undefined): ParseBTCResult {
  if (!input || input.trim() === '') {
    return { valid: false, satoshis: 0, error: 'Amount is required' };
  }

  const normalized = input.trim().replace(',', '.');

  // Check for valid number format
  if (!/^\d+\.?\d*$/.test(normalized)) {
    return { valid: false, satoshis: 0, error: 'Invalid number format' };
  }

  const satoshis = btcToSats(normalized);

  if (satoshis <= 0) {
    return { valid: false, satoshis: 0, error: 'Amount must be greater than 0' };
  }

  // Check if amount is too small (less than 1 satoshi)
  const btcValue = parseFloat(normalized);
  if (btcValue > 0 && satoshis === 0) {
    return { valid: false, satoshis: 0, error: 'Amount is too small (minimum 1 satoshi)' };
  }

  return { valid: true, satoshis };
}

export interface FormatBTCAutoResult {
  value: string;
  unit: 'BTC' | 'sats';
}

/**
 * Format satoshis amount for display based on size
 * Uses BTC for large amounts, sats for small amounts
 * @param satoshis - Amount in satoshis
 * @param threshold - Threshold in satoshis to switch to BTC (default: 100000 = 0.001 BTC)
 * @returns Formatted value and unit
 */
export function formatBTCAuto(satoshis: number | null | undefined, threshold = 100000): FormatBTCAutoResult {
  if (satoshis === null || satoshis === undefined || satoshis === 0) {
    return { value: '0', unit: 'BTC' };
  }

  if (typeof satoshis !== 'number' || isNaN(satoshis)) {
    logger.warn('formatBTCAuto: Invalid satoshis value', { satoshis });
    return { value: '0', unit: 'BTC' };
  }

  if (Math.abs(satoshis) < threshold) {
    return { value: satoshis.toString(), unit: 'sats' };
  }

  return { value: formatBTCSmart(satoshis), unit: 'BTC' };
}
