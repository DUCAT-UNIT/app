import AsyncStorage from '@react-native-async-storage/async-storage';
import { E2E_AUTO_LOCK_TIMEOUT_MS, USDC_FEATURE_UNLOCK_PHRASE } from '../constants/settings';
import { useUsdcFeatureFlagStore } from '../stores/usdcFeatureFlagStore';
import { setBoolean, setNumber, SettingKeys } from './settingsService';

export const E2E_RESET_SETTINGS_URL_PREFIX = 'ducat://e2e/reset-settings';
export const E2E_ENABLE_USDC_URL_PREFIX = 'ducat://e2e/enable-usdc';
export const E2E_SKIP_AIRDROP_URL_PREFIX = 'ducat://e2e/skip-airdrop';

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

const AIRDROP_E2E_RESET_PREFIXES = ['airdropLock_', 'lastAirdropTime_', 'pendingAirdrop_'] as const;

async function clearAirdropRegressionState(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const airdropKeys = keys.filter((key) =>
    AIRDROP_E2E_RESET_PREFIXES.some((prefix) => key.startsWith(prefix))
  );

  if (airdropKeys.length > 0) {
    await AsyncStorage.multiRemove(airdropKeys);
  }
}

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
    setBoolean(SettingKeys.E2E_SKIP_AIRDROP_REQUESTS, false),
    clearAirdropRegressionState(),
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

export async function setSkipAirdropRequestsForE2E(url = ''): Promise<void> {
  if (!__DEV__) return;

  const enabled = /[?&]enabled=true(?:[&#]|$)/.test(url);
  await setBoolean(SettingKeys.E2E_SKIP_AIRDROP_REQUESTS, enabled);
}
