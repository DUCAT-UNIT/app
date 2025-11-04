/**
 * Formatters - Address and BTC/Satoshi conversion utilities
 */

/**
 * Convert satoshis to BTC
 */
export const satoshisToBTC = (satoshis) => {
  return satoshis / 100000000;
};

/**
 * Convert BTC to satoshis
 */
export const btcToSatoshis = (btc) => {
  return Math.floor(btc * 100000000);
};

/**
 * Format Bitcoin address for display (truncate middle)
 */
export const formatAddress = (address, startChars = 8, endChars = 8) => {
  if (!address || address.length <= startChars + endChars) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * Format satoshis with commas
 */
export const formatSatoshis = (satoshis) => {
  return satoshis.toLocaleString();
};

/**
 * Format BTC with proper decimal places
 */
export const formatBTC = (btc, decimals = 8) => {
  return btc.toFixed(decimals);
};
