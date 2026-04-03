/**
 * E2E test state for simulating vault operations without Guardian WebSocket.
 *
 * Safety: All consumers check `__DEV__ && process.env.EXPO_PUBLIC_E2E_BYPASS === 'true'`.
 * - `__DEV__` is false in production builds (Metro dead code elimination strips these blocks)
 * - `app.config.ts` throws at build time if EXPO_PUBLIC_E2E_BYPASS is set with NODE_ENV=production
 *
 * This module is only referenced inside `if (__DEV__)` guards, so the entire import
 * and all associated code paths are removed from production bundles.
 */

export const e2eVaultState = {
  /** Whether a vault has been "created" in this E2E session */
  vaultCreated: false,
  /** BTC locked in vault (in BTC, e.g. 0.05) */
  btcLocked: 0,
  /** UNIT borrowed from vault (in UNIT, e.g. 548.25) */
  unitBorrowed: 0,
};

/** Reset E2E vault state (called on wallet reset / clearState) */
export function resetE2eVaultState(): void {
  e2eVaultState.vaultCreated = false;
  e2eVaultState.btcLocked = 0;
  e2eVaultState.unitBorrowed = 0;
}
