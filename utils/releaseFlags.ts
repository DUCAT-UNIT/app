/**
 * Review-facing feature flags.
 *
 * EXPO_PUBLIC flags are inlined by Expo at build time. Keep review-sensitive
 * experiments opt-in so production TestFlight builds do not expose incomplete
 * or rewards-like surfaces unless we intentionally enable them.
 */

export const ENABLE_QUANTA_REWARDS =
  __DEV__ || process.env.EXPO_PUBLIC_ENABLE_QUANTA_REWARDS === 'true';
