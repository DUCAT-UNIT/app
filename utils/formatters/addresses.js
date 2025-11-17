/**
 * Address Formatting Utilities
 * Functions for formatting Bitcoin addresses and transaction IDs
 */

/**
 * Truncate a Bitcoin address for display
 * @param {string} address - Full Bitcoin address
 * @param {number} startChars - Number of characters to show at start (default: 8)
 * @param {number} endChars - Number of characters to show at end (default: 8)
 * @returns {string} Truncated address or original if too short
 */
export function truncateAddress(address, startChars = 8, endChars = 8) {
  if (!address) {
    return '';
  }

  if (typeof address !== 'string') {
    return String(address);
  }

  if (address.length <= startChars + endChars) {
    return address;
  }

  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Truncate a transaction ID for display
 * @param {string} txid - Transaction ID
 * @param {number} startChars - Number of characters to show at start (default: 8)
 * @param {number} endChars - Number of characters to show at end (default: 8)
 * @returns {string} Truncated transaction ID
 */
export function truncateTxid(txid, startChars = 8, endChars = 8) {
  if (!txid) {
    return '';
  }

  if (typeof txid !== 'string') {
    return String(txid);
  }

  if (txid.length <= startChars + endChars) {
    return txid;
  }

  return `${txid.slice(0, startChars)}...${txid.slice(-endChars)}`;
}

/**
 * Validate if a string looks like a Bitcoin address
 * Basic validation - checks format only, not validity
 * @param {string} address - Address to validate
 * @returns {boolean} True if format looks like a Bitcoin address
 */
export function looksLikeBitcoinAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Bitcoin addresses are typically 26-62 characters
  if (address.length < 26 || address.length > 62) {
    return false;
  }

  // Check for valid Bitcoin address prefixes
  const validPrefixes = ['1', '3', 'bc1', 'tb1', 'bcrt1'];
  return validPrefixes.some((prefix) => address.startsWith(prefix));
}

/**
 * Get address type from address string
 * @param {string} address - Bitcoin address
 * @returns {'legacy'|'segwit'|'taproot'|'unknown'} Address type
 */
export function getAddressType(address) {
  if (!address || typeof address !== 'string') {
    return 'unknown';
  }

  if (address.startsWith('1')) {
    return 'legacy';
  }

  if (address.startsWith('3')) {
    return 'segwit';
  }

  if (address.startsWith('bc1q') || address.startsWith('tb1q')) {
    return 'segwit';
  }

  if (address.startsWith('bc1p') || address.startsWith('tb1p')) {
    return 'taproot';
  }

  return 'unknown';
}
