/**
 * Send Transaction Helper Functions
 * Utilities for formatting and validating send transaction inputs
 */

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

// Bitcoin address validation
export const validateBitcoinAddress = (address) => {
  if (!address) return { valid: false, error: '' };

  const trimmed = address.trim();

  // Check for basic bitcoin address patterns
  const isValidFormat =
    /^(bc1|tb1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(trimmed) || // Mainnet/Testnet
    /^[mn2][a-zA-HJ-NP-Z0-9]{25,34}$/.test(trimmed); // Legacy testnet

  if (!isValidFormat) {
    return { valid: false, error: 'Invalid Bitcoin address format' };
  }

  // Check length constraints
  if (trimmed.length < 26 || trimmed.length > 90) {
    return { valid: false, error: 'Address length is invalid' };
  }

  return { valid: true, error: '' };
};
