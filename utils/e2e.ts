import Constants from 'expo-constants';

/**
 * E2E Testing Utilities
 *
 * Centralizes E2E bypass detection. All E2E-conditional logic should
 * import `isE2E` from here instead of checking the env var inline.
 *
 * The bypass is only active when explicitly configured. Development builds do
 * not imply E2E because dev-client live Maestro flows must exercise real vault,
 * PSBT, and TurboUNIT behavior. Jest keeps it disabled so unit tests can still
 * assert normal security lifecycle behavior. Production builds always return
 * false (enforced in App.tsx and app.config.ts).
 */

let runtimeE2EBypass = false;

export function enableRuntimeE2EBypass(): void {
  if (hasConfiguredE2EBypass()) {
    runtimeE2EBypass = true;
  }
}

export function hasActiveE2EBypass(): boolean {
  return runtimeE2EBypass || hasConfiguredE2EBypass();
}

export function hasConfiguredE2EBypass(): boolean {
  const extra = Constants.expoConfig?.extra as { e2eBypass?: boolean } | undefined;
  return (
    process.env.EXPO_PUBLIC_E2E_BYPASS === 'true' ||
    extra?.e2eBypass === true
  );
}

export function isE2E(): boolean {
  const isJest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID != null;
  return !isJest && hasActiveE2EBypass();
}
