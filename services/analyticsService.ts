/**
 * Analytics Service
 * Centralized PostHog analytics with privacy guards and E2E bypass.
 * All methods are fire-and-forget — never block UI or throw.
 */

import { isE2E } from '../utils/e2e';
import { logger } from '../utils/logger';

// Lazy-initialized PostHog client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let posthogClient: any = null;
let initAttempted = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getClient(): any {
  if (isE2E) return null;
  if (posthogClient) return posthogClient;
  if (initAttempted) return null;

  initAttempted = true;

  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey) {
    logger.debug('[Analytics] No POSTHOG_KEY set, analytics disabled');
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PostHog } = require('posthog-react-native');
    posthogClient = new PostHog(apiKey, {
      host,
      flushAt: 5,          // Flush after 5 events (was 20)
      flushInterval: 10000, // Flush every 10s (was 30s)
    });
    logger.debug('[Analytics] PostHog initialized');
    return posthogClient;
  } catch (err: unknown) {
    logger.warn('[Analytics] Failed to initialize PostHog', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * SHA-256 hash an address for privacy.
 * Never send raw Bitcoin addresses to analytics.
 */
async function hashString(value: string): Promise<string> {
  try {
    const { digestStringAsync, CryptoDigestAlgorithm } = await import('expo-crypto');
    return digestStringAsync(CryptoDigestAlgorithm.SHA256, value);
  } catch {
    return 'hash_failed';
  }
}

/** Truncate a txid to first 8 chars for privacy */
function truncateTxid(txid: string): string {
  return txid.substring(0, 8);
}

export const analytics = {
  /**
   * Track an event with optional properties.
   * Fire-and-forget — never blocks, never throws.
   */
  track(event: string, properties?: Record<string, unknown>): void {
    try {
      getClient()?.capture(event, properties);
    } catch {
      // Never throw from analytics
    }
  },

  /**
   * Track a screen view.
   */
  screen(screenName: string, properties?: Record<string, unknown>): void {
    try {
      getClient()?.screen(screenName, properties);
    } catch {
      // Never throw from analytics
    }
  },

  /**
   * Identify a user with traits. Uses hashed wallet address as ID.
   */
  identify(userId: string, traits?: Record<string, unknown>): void {
    try {
      getClient()?.identify(userId, traits);
    } catch {
      // Never throw from analytics
    }
  },

  /**
   * Reset identity (on wallet delete or account switch).
   */
  reset(): void {
    try {
      getClient()?.reset();
    } catch {
      // Never throw from analytics
    }
  },

  /**
   * Set super properties attached to every subsequent event.
   */
  setSuperProperties(props: Record<string, unknown>): void {
    try {
      getClient()?.register(props);
    } catch {
      // Never throw from analytics
    }
  },

  /**
   * Track an event with a hashed address (async).
   */
  async trackWithAddress(
    event: string,
    address: string,
    properties?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const hashed = await hashString(address);
      getClient()?.capture(event, { ...properties, address_hash: hashed });
    } catch {
      // Never throw from analytics
    }
  },

  /**
   * Track a transaction event with truncated txid.
   */
  trackTransaction(
    event: string,
    txid: string,
    properties?: Record<string, unknown>,
  ): void {
    try {
      getClient()?.capture(event, {
        ...properties,
        txid_prefix: truncateTxid(txid),
      });
    } catch {
      // Never throw from analytics
    }
  },

  /**
   * Hash an address for use as user ID.
   */
  hashAddress: hashString,

  /**
   * Flush pending events immediately.
   */
  flush(): void {
    try {
      getClient()?.flush();
    } catch {
      // Never throw from analytics
    }
  },
};
