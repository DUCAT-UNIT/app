import { DEFAULT_AUTO_LOCK_TIMEOUT_MS, USDC_FEATURE_PASSWORD } from '../constants/settings';
import { useUsdcFeatureFlagStore } from '../stores/usdcFeatureFlagStore';
import { enableRuntimeE2EBypass, hasConfiguredE2EBypass } from '../utils/e2e';
import { setBoolean, setNumber, SettingKeys } from './settingsService';

export const E2E_RESET_SETTINGS_URL_PREFIX = 'ducat://e2e/reset-settings';
export const E2E_ENABLE_USDC_URL_PREFIX = 'ducat://e2e/enable-usdc';
export { hasActiveE2EBypass, hasConfiguredE2EBypass } from '../utils/e2e';

const canonicalizePassword = (password: string): string =>
  password
    .trim()
    .normalize('NFKC')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[^a-z0-9]/gi, '')
    .toLocaleLowerCase('en-US');

const getUrlPassword = (url: string): string => {
  const match = url.match(/[?&]password=([^&#]+)/);
  if (!match?.[1]) return '';

  try {
    return decodeURIComponent(match[1].replace(/\+/g, ' '));
  } catch {
    return '';
  }
};

/**
 * Reset only non-secret preferences used by E2E. Wallet keys, PINs, and other
 * secrets are intentionally left to Maestro clearKeychain/clearState.
 */
export async function resetNonSecretE2ESettings(): Promise<void> {
  if (!__DEV__ && !hasConfiguredE2EBypass()) return;

  if (hasConfiguredE2EBypass()) {
    enableRuntimeE2EBypass();
  }
  useUsdcFeatureFlagStore.getState().setEnabled(false);

  await Promise.allSettled([
    setBoolean(SettingKeys.NOTIFICATIONS_ENABLED, false),
    setBoolean(SettingKeys.SHOW_ZERO_ASSETS, false),
    setBoolean(SettingKeys.ADVANCED_MODE, false),
    setNumber(SettingKeys.ECASH_THRESHOLD, 10000),
    setNumber(SettingKeys.AUTO_LOCK_TIMEOUT, DEFAULT_AUTO_LOCK_TIMEOUT_MS),
    setBoolean(SettingKeys.USDC_FEATURES_ENABLED, false),
  ]);
}

export async function enableUsdcFeaturesForE2E(url = ''): Promise<void> {
  const urlPassword = getUrlPassword(url);
  const hasUrlPassword = canonicalizePassword(urlPassword) === canonicalizePassword(USDC_FEATURE_PASSWORD);
  if (!hasUrlPassword && !__DEV__ && !hasConfiguredE2EBypass()) return;

  if (hasConfiguredE2EBypass()) {
    enableRuntimeE2EBypass();
  }
  useUsdcFeatureFlagStore.getState().setEnabled(true);
  await setBoolean(SettingKeys.USDC_FEATURES_ENABLED, true);
}
