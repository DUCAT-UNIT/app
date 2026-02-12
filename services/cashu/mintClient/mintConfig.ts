/**
 * Mint Client Configuration
 */

// Mint server configuration with simple failover list
export const MINT_URLS = [
  process.env.EXPO_PUBLIC_MINT_URL || 'https://cashu-mint.ducatprotocol.com',
  'https://backup-mint.ducatprotocol.com',
];
export const MINT_URL = MINT_URLS[0];

export const CASHU_UNIT = 'unit'; // Using 'unit' for UNIT runes
export const RUNE_ID = '1527352:1'; // DUCAT•UNIT•RUNE (Mutinynet)
