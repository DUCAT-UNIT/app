/**
 * Analytics Service
 * Local no-op shim. Tracking is disabled in-app.
 */

type AnalyticsProperties = Record<string, unknown>;

/**
 * SHA-256 hash an address for privacy.
 */
async function hashString(value: string): Promise<string> {
  try {
    const { digestStringAsync, CryptoDigestAlgorithm } = await import('expo-crypto');
    return digestStringAsync(CryptoDigestAlgorithm.SHA256, value);
  } catch {
    return 'hash_failed';
  }
}

export const analytics = {
  track(_event: string, _properties?: AnalyticsProperties): void {
    // Tracking intentionally disabled.
  },

  screen(_screenName: string, _properties?: AnalyticsProperties): void {
    // Tracking intentionally disabled.
  },

  identifyHashed(_hashedUserId: string, _traits?: AnalyticsProperties): void {
    // Tracking intentionally disabled.
  },

  reset(): void {
    // Tracking intentionally disabled.
  },

  setSuperProperties(_props: AnalyticsProperties): void {
    // Tracking intentionally disabled.
  },

  async trackWithAddress(
    _event: string,
    _address: string,
    _properties?: AnalyticsProperties,
  ): Promise<void> {
    // Tracking intentionally disabled.
  },

  trackTransaction(
    _event: string,
    _txid: string,
    _properties?: AnalyticsProperties,
  ): void {
    // Tracking intentionally disabled.
  },

  hashAddress: hashString,

  flush(): void {
    // Tracking intentionally disabled.
  },
};
