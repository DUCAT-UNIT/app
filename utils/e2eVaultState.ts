/**
 * E2E Vault State
 * Module-level state used by E2E bypasses to simulate vault operations
 * without hitting the Guardian WebSocket. Only active when
 * __DEV__ && EXPO_PUBLIC_E2E_BYPASS === 'true'.
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
