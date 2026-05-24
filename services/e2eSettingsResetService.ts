import { E2E_AUTO_LOCK_TIMEOUT_MS, USDC_FEATURE_UNLOCK_PHRASE } from '../constants/settings';
import { useUsdcFeatureFlagStore } from '../stores/usdcFeatureFlagStore';
import { setBoolean, setNumber, SettingKeys } from './settingsService';

export const E2E_RESET_SETTINGS_URL_PREFIX = 'ducat://e2e/reset-settings';
export const E2E_ENABLE_USDC_URL_PREFIX = 'ducat://e2e/enable-usdc';

const canonicalizeUnlockPhrase = (phrase: string): string =>
  phrase
    .trim()
    .normalize('NFKC')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[^a-z0-9]/gi, '')
    .toLocaleLowerCase('en-US');

const getUrlUnlockPhrase = (url: string): string => {
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
  if (!__DEV__) return;

  useUsdcFeatureFlagStore.getState().setEnabled(false);

  await Promise.allSettled([
    setBoolean(SettingKeys.NOTIFICATIONS_ENABLED, false),
    setBoolean(SettingKeys.SHOW_ZERO_ASSETS, false),
    setBoolean(SettingKeys.ADVANCED_MODE, false),
    setNumber(SettingKeys.ECASH_THRESHOLD, 10000),
    setNumber(SettingKeys.AUTO_LOCK_TIMEOUT, E2E_AUTO_LOCK_TIMEOUT_MS),
    setBoolean(SettingKeys.USDC_FEATURES_ENABLED, false),
  ]);
}

export async function enableUsdcFeaturesForE2E(url = ''): Promise<void> {
  if (!__DEV__) return;

  const urlUnlockPhrase = getUrlUnlockPhrase(url);
  const hasUnlockPhrase =
    canonicalizeUnlockPhrase(urlUnlockPhrase) ===
    canonicalizeUnlockPhrase(USDC_FEATURE_UNLOCK_PHRASE);
  if (!hasUnlockPhrase) return;

  useUsdcFeatureFlagStore.getState().setEnabled(true);
  await setBoolean(SettingKeys.USDC_FEATURES_ENABLED, true);
}
