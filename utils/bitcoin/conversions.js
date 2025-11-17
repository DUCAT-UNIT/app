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
 * @param {number} satoshis - Amount in satoshis
 * @returns {number} Amount in BTC
 */
export function satsToBTC(satoshis) {
  if (satoshis === null || satoshis === undefined) {
    return 0;
  }

  if (typeof satoshis !== 'number' || isNaN(satoshis)) {
    logger.warn('satsToBTC: Invalid satoshis value:', satoshis);
    return 0;
  }

  return satoshis / SATS_PER_BTC;
}

/**
 * Convert BTC to satoshis
 * @param {number|string} btc - Amount in BTC (can be string for user input)
 * @returns {number} Amount in satoshis (floored to integer)
 */
export function btcToSats(btc) {
  if (btc === null || btc === undefined || btc === '') {
    return 0;
  }

  // Handle string input (from user forms)
  const normalized = typeof btc === 'string' ? btc.replace(',', '.') : btc;
  const btcValue = parseFloat(normalized);

  if (isNaN(btcValue)) {
    logger.warn('btcToSats: Invalid BTC value:', btc);
    return 0;
  }

  return Math.floor(btcValue * SATS_PER_BTC);
}

/**
 * Format satoshis as BTC with specified decimal places
 * @param {number} satoshis - Amount in satoshis
 * @param {number} decimals - Number of decimal places (default: 8)
 * @returns {string} Formatted BTC amount
 */
export function formatBTC(satoshis, decimals = 8) {
  if (satoshis === null || satoshis === undefined) {
    return '0'.padEnd(decimals > 0 ? decimals + 2 : 1, '0');
  }

  if (typeof satoshis !== 'number' || isNaN(satoshis)) {
    logger.warn('formatBTC: Invalid satoshis value:', satoshis);
    return '0'.padEnd(decimals > 0 ? decimals + 2 : 1, '0');
  }

  const btc = satsToBTC(satoshis);
  return btc.toFixed(decimals);
}

/**
 * Format satoshis as BTC with smart decimal trimming
 * Removes trailing zeros but keeps at least 2 decimals
 * @param {number} satoshis - Amount in satoshis
 * @param {number} minDecimals - Minimum decimal places (default: 2)
 * @param {number} maxDecimals - Maximum decimal places (default: 8)
 * @returns {string} Formatted BTC amount
 */
export function formatBTCSmart(satoshis, minDecimals = 2, maxDecimals = 8) {
  if (satoshis === null || satoshis === undefined) {
    return '0.00';
  }

  if (typeof satoshis !== 'number' || isNaN(satoshis)) {
    logger.warn('formatBTCSmart: Invalid satoshis value:', satoshis);
    return '0.00';
  }

  const btc = satsToBTC(satoshis);
  let formatted = btc.toFixed(maxDecimals);

  // Remove trailing zeros down to minDecimals
  const parts = formatted.split('.');
  if (parts[1]) {
    let decimals = parts[1];
    while (decimals.length > minDecimals && decimals[decimals.length - 1] === '0') {
      decimals = decimals.slice(0, -1);
    }
    formatted = decimals.length > 0 ? `${parts[0]}.${decimals}` : parts[0];
  }

  return formatted;
}

/**
 * Parse user input BTC amount and validate
 * @param {string} input - User input string
 * @returns {{valid: boolean, satoshis: number, error?: string}}
 */
export function parseBTCInput(input) {
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

/**
 * Format satoshis amount for display based on size
 * Uses BTC for large amounts, sats for small amounts
 * @param {number} satoshis - Amount in satoshis
 * @param {number} threshold - Threshold in satoshis to switch to BTC (default: 100000 = 0.001 BTC)
 * @returns {{value: string, unit: 'BTC'|'sats'}}
 */
export function formatBTCAuto(satoshis, threshold = 100000) {
  if (satoshis === null || satoshis === undefined || satoshis === 0) {
    return { value: '0', unit: 'BTC' };
  }

  if (typeof satoshis !== 'number' || isNaN(satoshis)) {
    logger.warn('formatBTCAuto: Invalid satoshis value:', satoshis);
    return { value: '0', unit: 'BTC' };
  }

  if (Math.abs(satoshis) < threshold) {
    return { value: satoshis.toString(), unit: 'sats' };
  }

  return { value: formatBTCSmart(satoshis), unit: 'BTC' };
}
