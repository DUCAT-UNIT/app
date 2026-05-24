/**
 * Mint Client Configuration
 */

function resolveMintUrl(): string {
  const configured = process.env.EXPO_PUBLIC_CASHU_MINT_URL?.trim()
    ?? 'https://dev-cashu-mint.ducatprotocol.com';

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error(`Invalid EXPO_PUBLIC_CASHU_MINT_URL: ${configured}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_CASHU_MINT_URL must use HTTPS');
  }

  return parsed.toString().replace(/\/$/, '');
}

export const MINT_URL = resolveMintUrl();
export const CASHU_UNIT = 'unit'; // Cashu unit advertised for Ducat UNIT
export const RUNE_ID = '1527352:1'; // DUCAT•UNIT•RUNE (Mutinynet)
