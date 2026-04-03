/**
 * Send Transaction Helper Functions
 * Utilities for formatting send transaction inputs
 */

/**
 * Format number with commas while preserving decimals
 * @param value - Number string to format
 * @returns Formatted number string with commas
 */
export const formatNumberWithCommas = (value: string | null | undefined): string => {
  if (!value) return '';

  // Split into integer and decimal parts
  const parts = value.split('.');
  // Remove leading zeros (but keep at least one digit)
  const normalized = parts[0].replace(/^0+(?=\d)/, '');
  const integerPart = normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Return with decimal part if it exists
  return parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart;
};
