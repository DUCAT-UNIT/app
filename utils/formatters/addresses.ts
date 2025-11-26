/**
 * Address Formatting Utilities
 * Functions for formatting Bitcoin addresses and transaction IDs
 */

export type AddressType = 'legacy' | 'segwit' | 'taproot' | 'unknown';

/**
 * Truncate a Bitcoin address for display
 * @param address - Full Bitcoin address
 * @param startChars - Number of characters to show at start (default: 8)
 * @param endChars - Number of characters to show at end (default: 8)
 * @returns Truncated address or original if too short
 */
export function truncateAddress(address: string | null | undefined, startChars = 8, endChars = 8): string {
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
 * @param txid - Transaction ID
 * @param startChars - Number of characters to show at start (default: 8)
 * @param endChars - Number of characters to show at end (default: 8)
 * @returns Truncated transaction ID
 */
export function truncateTxid(txid: string | null | undefined, startChars = 8, endChars = 8): string {
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
 * @param address - Address to validate
 * @returns True if format looks like a Bitcoin address
 */
export function looksLikeBitcoinAddress(address: string | null | undefined): boolean {
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
 * @param address - Bitcoin address
 * @returns Address type
 */
export function getAddressType(address: string | null | undefined): AddressType {
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
