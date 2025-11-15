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

/**
 * Format balance value (BTC) for display
 */
export const formatBalance = (balance, decimals = 8) => {
  if (!balance && balance !== 0) return '0.00000000';
  return balance.toFixed(decimals);
};

/**
 * Format fiat amount (USD) for display
 */
export const formatFiatAmount = (amount, decimals = 2) => {
  if (!amount && amount !== 0) return '0.00';
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};
