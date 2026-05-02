/**
 * Mint Client Configuration
 */

import { logger } from '../../../utils/logger';

// Whitelist of allowed mint URLs (production only — __DEV__ allows any URL)
const ALLOWED_MINT_URLS: readonly string[] = [
  'https://dev-cashu-mint.ducatprotocol.com',
  'https://cashu-mint.ducatprotocol.com',
  'https://backup-mint.ducatprotocol.com',
];

const DEFAULT_MINT_URL = 'https://dev-cashu-mint.ducatprotocol.com';

const isLocalDevMintUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    );
  } catch {
    return false;
  }
};

/**
 * Resolve the primary mint URL from env, applying whitelist validation.
 * In __DEV__ mode any URL is allowed for testing.
 */
const resolvePrimaryMintUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_MINT_URL;

  if (!envUrl) {
    return DEFAULT_MINT_URL;
  }

  // Allow local-only URLs in dev mode for testing against developer mints.
  if (__DEV__ && isLocalDevMintUrl(envUrl)) {
    return envUrl;
  }

  if (!ALLOWED_MINT_URLS.includes(envUrl)) {
    logger.error('[MintConfig] EXPO_PUBLIC_MINT_URL is not in the allowed whitelist, falling back to default', {
      provided: envUrl,
      allowed: ALLOWED_MINT_URLS,
      devLocalOnly: __DEV__,
    });
    return DEFAULT_MINT_URL;
  }

  return envUrl;
};

// Mint server configuration with simple failover list
export const MINT_URLS = [
  resolvePrimaryMintUrl(),
  'https://backup-mint.ducatprotocol.com',
];
export const MINT_URL = MINT_URLS[0];

export const CASHU_UNIT = 'unit'; // Cashu unit advertised for Ducat UNIT
export const RUNE_ID = '1527352:1'; // DUCAT•UNIT•RUNE (Mutinynet)
