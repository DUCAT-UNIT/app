/**
 * E2E test state for simulating vault operations without Guardian WebSocket.
 *
 * Safety: Consumers gate behavior through `isE2E()`.
 * - `isE2E()` is false in production builds because it also requires `__DEV__`
 * - `app.config.ts` throws at build time if EXPO_PUBLIC_E2E_BYPASS is set with NODE_ENV=production
 *
 * This module stores inert state only; production code paths must not read from it
 * unless `isE2E()` is true.
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
