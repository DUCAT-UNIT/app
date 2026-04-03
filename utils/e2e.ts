/**
 * E2E Testing Utilities
 *
 * Centralizes E2E bypass detection. All E2E-conditional logic should
 * import `isE2E` from here instead of checking the env var inline.
 *
 * The bypass is only active in __DEV__ builds with EXPO_PUBLIC_E2E_BYPASS=true.
 * Production builds always have isE2E === false (enforced in App.tsx and app.config.ts).
 */

export const isE2E: boolean = __DEV__ && process.env.EXPO_PUBLIC_E2E_BYPASS === 'true';
