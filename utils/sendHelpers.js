/**
 * Send Transaction Helper Functions
 * Utilities for formatting and validating send transaction inputs
 */

import { validateBitcoinAddress as validateBitcoinAddressCore } from './bitcoin';

// Format number with commas while preserving decimals
export const formatNumberWithCommas = (value) => {
  if (!value) return '';

  // Split into integer and decimal parts
  const parts = value.split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Return with decimal part if it exists
  return parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart;
};

// Remove commas from formatted number
export const removeCommas = (value) => {
  return value.replace(/,/g, '');
};

// Format BTC amount to show only significant decimals
export const formatBTC = (value) => {
  const num = parseFloat(value);
  if (isNaN(num)) return '0.00';

  // Convert to fixed 8 decimals then trim trailing zeros
  const fixed = num.toFixed(8);
  const trimmed = fixed.replace(/\.?0+$/, '');

  // If no decimals remain or only removed trailing zeros, ensure at least 2 decimals
  if (!trimmed.includes('.') || trimmed.split('.')[1].length === 0) {
    return num.toFixed(2);
  }

  return trimmed;
};

// Bitcoin address validation using bitcoinjs-lib for proper validation
export const validateBitcoinAddress = (address) => {
  if (!address) return { valid: false, error: '' };

  // Use the core validation function from bitcoin.js
  return validateBitcoinAddressCore(address);
};
